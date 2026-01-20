'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { parseTedXml, MONITORED_CPV_CODES } from '@/lib/tenderUtils';

interface SearchConfig {
  query?: string;
  cpvCode?: string;
  daysBack: number;
  limit?: number;
}

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

export async function fetchAndSaveTenders(config: SearchConfig) {
  const tendersRef = adminDb.collection("tender-unresolved");
  const API_URL = "https://api.ted.europa.eu/v3/notices/search";
  
  let queryParts = [];
  const daysToFetch = config.daysBack > 0 ? config.daysBack : 3;
  const dateQuery = generateDateFilter(daysToFetch);
  
  // CPV Filter
  if (config.cpvCode) {
    queryParts.push(`pc=${config.cpvCode}`);
  } else {
    const cpvOrString = MONITORED_CPV_CODES.map(c => `pc=${c}`).join(' OR ');
    queryParts.push(`(${cpvOrString})`);
  }

  if (config.query) queryParts.push(`ft="${config.query}"`);

  const mainCriteria = queryParts.join(" AND ");
  const noticeTypes = "notice-type IN (cn-standard cn-social cn-desg pin-cfc-standard pin-cfc-social)";
  const qString = `${dateQuery} AND ${mainCriteria} AND ${noticeTypes} SORT BY publication-number DESC`;

  const payload = {
    "query": qString,
    "fields": ["links", "deadline-receipt-request", "classification-cpv"], 
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
    console.log(`📥 Found ${notices.length} notices.`);

    let count = 0;

    for (const notice of notices) {
        if (!notice.links || !notice.links.xml) {
            console.log(`⚠️ Skipped (No XML links)`);
            continue;
        }

        const xmlLinks = notice.links.xml;
        const xmlUrl = xmlLinks.MUL || Object.values(xmlLinks)[0];

        // EXTRACT API DATA
        const apiDateArray = notice['deadline-receipt-request'];
        const apiDate = (apiDateArray && apiDateArray.length > 0) ? apiDateArray[0] : undefined;
        
        // NEW: Extract Full CPV List
        const apiCpvs = notice['classification-cpv'] || [];

        if (!xmlUrl) continue;

        try {
            const xmlRes = await fetch(xmlUrl as string);
            const xmlText = await xmlRes.text();
            
            // Pass BOTH apiDate AND apiCpvs to the parser
            const tenderData = parseTedXml(xmlText, apiDate, apiCpvs);

            if (tenderData.NoticeID && tenderData.NoticeID !== "N/A") {
                await tendersRef.doc(tenderData.NoticeID).set(tenderData);
                console.log(`✅ Saved: ${tenderData.NoticeID}`);
                count++;
            } else {
                console.log(`⚠️ Skipped (No ID found in XML)`);
            }
        } catch (innerErr) {
            console.error(`❌ XML Error for ${xmlUrl}:`, innerErr);
        }
    }

    return { success: true, count: count, message: `Hentede ${count} udbud.` };

  } catch (error) {
    console.error("🔥 Critical Error:", error);
    return { success: false, count: 0, message: "Fejl ved API kald: " + error };
  }
}