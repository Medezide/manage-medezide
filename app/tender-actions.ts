'use server';

import { adminDb } from '@/lib/firebaseAdmin';
import { parseTedXml } from '@/lib/tenderUtils';

interface SearchConfig {
  query?: string;
  cpvCode?: string;
  daysBack: number;
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
  
  // 1. Build Query
  let queryParts = [];
  const daysToFetch = config.daysBack && config.daysBack > 0 ? config.daysBack : 3;
  const dateQuery = generateDateFilter(daysToFetch);
  
  if (config.cpvCode) {
    queryParts.push(`pc=${config.cpvCode}`);
  } else {
    // Default Medical CPVs
    queryParts.push(`(pc=33651100 OR pc=33651200 OR pc=33651300 OR pc=33651500 OR pc=33651600 OR pc=33651620 OR pc=33651600 OR pc=33651660 OR pc=33698100 OR pc=38970000 OR pc=38433000 OR pc=38437000 OR pc=38910000 OR pc=51400000 OR pc=72000000 OR pc=73000000 OR pc=80320000 OR pc=80420000 OR pc=80430000 OR pc=85100000 OR pc=85200000 OR pc=90720000)`);
  }

  if (config.query) {
    queryParts.push(`ft="${config.query}"`);
  }

  const mainCriteria = queryParts.join(" AND ");
  const noticeTypes = "notice-type IN (cn-standard cn-social cn-desg pin-cfc-standard pin-cfc-social)";
  
  const qString = `${dateQuery} AND ${mainCriteria} AND ${noticeTypes} SORT BY publication-number DESC`;

  const payload = {
    "query": qString,
    "fields": ["links", "deadline-receipt-request"], 
    "page": 1,
    "limit": 5,
    "scope": "ACTIVE",
    "paginationMode": "PAGE_NUMBER"
  };

  // null, 4 adds 4 spaces of indentation for pretty printing
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
            continue;
        }

        const xmlLinks = notice.links.xml;
        const xmlUrl = xmlLinks.MUL || Object.values(xmlLinks)[0];

        if (!xmlUrl) continue;

        try {
            const xmlRes = await fetch(xmlUrl as string);
            const xmlText = await xmlRes.text();
            
            const tenderData = parseTedXml(xmlText);

            // --- UPDATED LOGIC HERE ---
            if (tenderData.NoticeID && tenderData.NoticeID !== "N/A") {
                await tendersRef.doc(tenderData.NoticeID).set(tenderData);
                console.log(`✅ Saved: ${tenderData.NoticeID}`);
                count++;
            } else {
                // NEW: Log why it was skipped
                console.log(`⚠️ Skipped (No ID): ${tenderData.Title || 'Unknown Title'} | Type: ${notice['notice-type']}`);
            }
            // --------------------------

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