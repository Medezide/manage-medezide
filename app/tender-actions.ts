'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { parseTedXml, MONITORED_CPV_CODES } from '@/lib/tenderUtils';

interface SearchConfig {
  query?: string;
  cpvCode?: string;
  daysBack?: number;
  limit?: number;
  noticeId?: string;
}

// --- KEEP TRANSLATION AS IS ---
export async function translateText(text: string, noticeId: string) {
    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) return { success: false, text: "Error: No Translation API Key configured." };

    try {
        const docRef = adminDb.collection("tender-unresolved").doc(noticeId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            if (data?.translated_description) return { success: true, text: data.translated_description };
        }

        const response = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            headers: { 'Authorization': `DeepL-Auth-Key ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: [text], target_lang: 'EN' })
        });

        if (!response.ok) throw new Error(`DeepL Error: ${response.status}`);
        const resData = await response.json();
        
        if (resData.translations && resData.translations.length > 0) {
            const translatedText = resData.translations[0].text;
            await docRef.update({ translated_description: translatedText });
            return { success: true, text: translatedText };
        }
        return { success: false, text: "Could not translate text." };
    } catch (error) {
        console.error("Translation Failed:", error);
        return { success: false, text: "Translation failed." };
    }
}

// --- HELPER ---
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

// --- PART 1: GET THE LIST (Updated with Server Logging) ---
export async function fetchTedNotices(config: SearchConfig) {
  const API_URL = "https://api.ted.europa.eu/v3/notices/search";
  
  let qString = "";

  if (config.noticeId && config.noticeId.trim() !== "") {
      qString = `ND=${config.noticeId.trim()}`;
  } else {
      let queryParts = [];
      
      if (config.daysBack && config.daysBack > 0) {
          queryParts.push(generateDateFilter(config.daysBack));
      }

      if (config.cpvCode) {
        queryParts.push(`pc=${config.cpvCode}`);
      } else {
        const cpvOrString = MONITORED_CPV_CODES.map(c => `pc=${c}`).join(' OR ');
        queryParts.push(`(${cpvOrString})`);
      }

      if (config.query) queryParts.push(`ft~"${config.query}"`);

      const mainCriteria = queryParts.join(" AND ");
      const noticeTypes = "notice-type IN (cn-standard cn-social cn-desg pin-cfc-standard pin-cfc-social)";
      
      qString = `${mainCriteria} AND ${noticeTypes} SORT BY publication-number DESC`;
  }

  const payload = {
    "query": qString,
    "fields": ["links", "deadline-receipt-request", "classification-cpv", "publication-number"], 
    "page": 1,
    "limit": config.limit || 5,
    "scope": "ACTIVE",
    "paginationMode": "PAGE_NUMBER"
  };

  // --- SERVER-SIDE LOGGING ---
  console.log("---------------------------------------------------------");
  console.log("🔎 EXECUTING TED QUERY (SERVER SIDE):");
  console.log(qString);
  console.log("---------------------------------------------------------");

  try {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    
    return { 
        success: true, 
        notices: data.notices || [], 
        totalFound: data.totalNoticeCount || 0,
        queryUsed: qString 
    };

  } catch (error: any) {
    console.error("Fetch List Failed:", error);
    return { success: false, notices: [], totalFound: 0, queryUsed: qString, error: error.message };
  }
}

// --- PART 2: PROCESS SINGLE ITEM ---
export async function processSingleTender(notice: any) {
  const unresolvedRef = adminDb.collection("tender-unresolved");
  const resolvedRef = adminDb.collection("tender-resolved");
  const discardedRef = adminDb.collection("tender-discarded");

  const pNum = notice['publication-number'];

  // 1. Check Duplicates across ALL collections
  if (pNum) {
      const docUn = await unresolvedRef.doc(pNum).get();
      if (docUn.exists) return { status: 'duplicate', id: pNum };
      
      const docRes = await resolvedRef.doc(pNum).get();
      if (docRes.exists) return { status: 'duplicate', id: pNum };
      
      const docDisc = await discardedRef.doc(pNum).get();
      if (docDisc.exists) return { status: 'duplicate', id: pNum };
  }

  // 2. Validate Data
  if (!notice.links || !notice.links.xml) return { status: 'skipped', reason: 'No XML link' };
  
  const xmlLinks = notice.links.xml;
  const xmlUrl = xmlLinks.MUL || Object.values(xmlLinks)[0];
  const apiDateArray = notice['deadline-receipt-request'];
  const apiDate = (apiDateArray && apiDateArray.length > 0) ? apiDateArray[0] : undefined;
  const apiCpvs = notice['classification-cpv'] || [];

  if (!xmlUrl) return { status: 'skipped', reason: 'No valid XML URL' };

  try {
      // 3. Fetch & Parse XML
      const xmlRes = await fetch(xmlUrl as string);
      const xmlText = await xmlRes.text();
      
      // Pass pNum (ID from API) as 4th argument
      const tenderData = parseTedXml(xmlText, apiDate, apiCpvs, pNum);

      if (tenderData.NoticeID && tenderData.NoticeID !== "N/A") {
          await unresolvedRef.doc(tenderData.NoticeID).set(tenderData);
          return { status: 'saved', id: tenderData.NoticeID };
      } else {
          return { status: 'error', reason: 'Parsing failed (No ID found in XML or API)' };
      }
  } catch (error: any) {
      return { status: 'error', reason: error.message };
  }
}