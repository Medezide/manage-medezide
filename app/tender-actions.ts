'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { parseTedXml, MONITORED_CPV_CODES } from '@/lib/tenderUtils';

interface SearchConfig {
  query?: string;
  cpvCode?: string;
  daysBack?: number; // Made optional
  limit?: number;
  noticeId?: string; // New Field
}

// --- TRANSLATION ACTION (Preserved) ---
export async function translateText(text: string, noticeId: string) {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) return { success: false, text: "Error: No Translation API Key configured." };

    try {
        const docRef = adminDb.collection("tender-unresolved").doc(noticeId);

        // Check DB Cache
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data?.translated_description) {
                return { success: true, text: data.translated_description };
            }
        }

        // Call DeepL
        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: [text], target_lang: 'EN' })
        });

        if (!response.ok) throw new Error(`DeepL Error: ${response.status}`);
        const resData = await response.json();
        
        if (resData.translations && resData.translations.length > 0) {
            const translatedText = resData.translations[0].text;
            // Write to Cache
            await docRef.update({ translated_description: translatedText });
            return { success: true, text: translatedText };
        } else {
            return { success: false, text: "Could not translate text." };
        }
    } catch (error) {
        console.error("Translation Failed:", error);
        return { success: false, text: "Translation failed." };
    }
}

// --- HELPER: Date Filter ---
function generateDateFilter(days: number): string {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().slice(0,10).replace(/-/g, '');
        dates.push(`pd=${dateStr}`);
    }
    return `(${dates.join(' OR ')})`;
}

// --- MAIN FETCH ACTION ---
export async function fetchAndSaveTenders(config: SearchConfig) {
  const unresolvedRef = adminDb.collection("tender-unresolved");
  const resolvedRef = adminDb.collection("tender-resolved");
  const discardedRef = adminDb.collection("tender-discarded"); // New Collection
  
  const API_URL = "https://api.ted.europa.eu/v3/notices/search";
  
  // 1. BUILD QUERY
  let qString = "";

  // CASE A: Specific Notice ID (Overrides everything else)
  if (config.noticeId && config.noticeId.trim() !== "") {
      // "ND" is the field for Notice ID in TED Search
      qString = `ND=${config.noticeId.trim()}`;
  } 
  // CASE B: Standard Search
  else {
      let queryParts = [];
      
      // Date Logic (Skip if -1 or undefined)
      if (config.daysBack && config.daysBack > 0) {
          queryParts.push(generateDateFilter(config.daysBack));
      }

      // CPV Logic
      if (config.cpvCode) {
        queryParts.push(`pc=${config.cpvCode}`);
      } else {
        const cpvOrString = MONITORED_CPV_CODES.map(c => `pc=${c}`).join(' OR ');
        queryParts.push(`(${cpvOrString})`);
      }

      // Text Logic
      if (config.query) {
        queryParts.push(`ft="${config.query}"`);
      }

      const mainCriteria = queryParts.join(" AND ");
      // Only active standard notices
      const noticeTypes = "notice-type IN (cn-standard cn-social cn-desg pin-cfc-standard pin-cfc-social)";
      
      // Combine
      qString = `${mainCriteria} AND ${noticeTypes} SORT BY publication-number DESC`;
      
      // If no date filter, ensure we warn logic
      if (!config.daysBack || config.daysBack <= 0) {
          console.log("⚠️ Searching without date limit (All time).");
      }
  }

  const payload = {
    "query": qString,
    // We need publication-number for the duplicate check
    "fields": ["links", "deadline-receipt-request", "classification-cpv", "publication-number"], 
    "page": 1,
    "limit": config.limit || 5,
    "scope": "ACTIVE",
    "paginationMode": "PAGE_NUMBER"
  };

  console.log("🔍 Searching TED:\n", JSON.stringify(payload, null, 4)); 

  try {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    const notices = data.notices || [];
    const totalFound = data.totalNoticeCount || 0; // Capture total count
    
    console.log(`📥 API Returned ${notices.length} items (Total available: ${totalFound})`);

    let count = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const notice of notices) {
        // --- 1. DUPLICATE CHECK (OPTIMIZATION) ---
        // publication-number (e.g., "34561-2026") maps to NoticeID
        const pNum = notice['publication-number'];
        
        if (pNum) {
            // Check Unresolved
            const docUn = await unresolvedRef.doc(pNum).get();
            if (docUn.exists) {
                console.log(`⏭️ Skipped (Already in Inbox): ${pNum}`);
                duplicates++;
                continue;
            }
            // Check Resolved
            const docRes = await resolvedRef.doc(pNum).get();
            if (docRes.exists) {
                console.log(`⏭️ Skipped (Already Resolved): ${pNum}`);
                duplicates++;
                continue;
            }
            // Check Discarded
            const docDisc = await discardedRef.doc(pNum).get();
            if (docDisc.exists) {
                console.log(`⏭️ Skipped (Previously Discarded): ${pNum}`);
                duplicates++;
                continue;
            }
        }

        // --- 2. DATA EXTRACTION ---
        if (!notice.links || !notice.links.xml) {
            skipped++;
            continue;
        }

        const xmlLinks = notice.links.xml;
        const xmlUrl = xmlLinks.MUL || Object.values(xmlLinks)[0];
        
        const apiDateArray = notice['deadline-receipt-request'];
        const apiDate = (apiDateArray && apiDateArray.length > 0) ? apiDateArray[0] : undefined;
        const apiCpvs = notice['classification-cpv'] || [];

        if (!xmlUrl) continue;

        try {
            // --- 3. FETCH XML ---
            const xmlRes = await fetch(xmlUrl as string);
            const xmlText = await xmlRes.text();
            
            const tenderData = parseTedXml(xmlText, apiDate, apiCpvs);

            if (tenderData.NoticeID && tenderData.NoticeID !== "N/A") {
                await unresolvedRef.doc(tenderData.NoticeID).set(tenderData);
                console.log(`✅ Saved: ${tenderData.NoticeID}`);
                count++;
            } else {
                skipped++;
            }
        } catch (innerErr) {
            console.error(`❌ XML Error for ${xmlUrl}:`, innerErr);
            skipped++;
        }
    }

    return { 
        success: true, 
        count: count, 
        duplicates: duplicates,
        totalFound: totalFound, // Pass this back to frontend
        message: `Hentede ${count} nye udbud. (Fandt ${duplicates} dubletter, ${skipped} fejlede/sprunget over). Total tilgængelig: ${totalFound}` 
    };

  } catch (error) {
    console.error("🔥 Critical Error:", error);
    return { success: false, count: 0, duplicates: 0, totalFound: 0, message: "Fejl ved API kald: " + error };
  }
}