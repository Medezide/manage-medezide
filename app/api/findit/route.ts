import { NextResponse } from 'next/server';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// --- KONFIGURATION ---
const SHEET_ID = "1RZNyHgTMhNpoL_PAX0s-ymz-wBrdHpL1FuhtK8ojMEw"; 
const TARGET_SHEET_TITLE = "Data-No-Cat"; 

// Opsætning af Auth (Bruger dine credentials fra .env.local)
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export async function GET() {
  try {
    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    // Tjek om fanen findes
    const sheet = doc.sheetsByTitle[TARGET_SHEET_TITLE];
    if (!sheet) {
        return NextResponse.json({ success: false, error: `Fanen '${TARGET_SHEET_TITLE}' blev ikke fundet.` }, { status: 404 });
    }
    
    const rows = await sheet.getRows();
    
    // Vi mapper rækkerne baseret på dine headers fra arket
    const articles = rows.map((row, index) => {
        // Vi tjekker kolonnen 'PrimaryCategory'
        const currentCat = row.get('PrimaryCategory');
        
        // Hvis den er tom, skal den med på listen til CEO'en
        if (!currentCat || currentCat.toString().trim() === '') {
            return {
                rowIndex: index, // VIGTIGT: Vi bruger dette index til at gemme tilbage senere
                id: row.get('Alias') || row.get('Title'), 
                title: row.get('Title'),
                // Bruger 'introtext' som abstract baseret på dit ark
                abstract: row.get('introtext') || "Ingen tekst tilgængelig", 
                url: row.get('Link'),
                date: row.get('PublicationDate'),
                source: row.get('Source')
            };
        }
        return null;
    }).filter(article => article !== null); // Filtrer dem fra, der allerede er færdige

    return NextResponse.json({ success: true, data: articles });

  } catch (error) {
    console.error("Sheet API Error:", error);
    return NextResponse.json({ success: false, error: "Kunne ikke hente data fra Google Sheets" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rowIndex, primaryCategory, multipleCategory } = body;

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[TARGET_SHEET_TITLE];
    const rows = await sheet.getRows();

    // Vælg den specifikke række baseret på index
    const row = rows[rowIndex];
    
    if (row) {
      // Opdater de to kolonner: PrimaryCategory og MultipleCategory
      row.assign({
        'PrimaryCategory': primaryCategory,
        'MultipleCategory': multipleCategory
      });
      await row.save(); // Gem ændringerne til Google Sheets
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Rækken blev ikke fundet" }, { status: 404 });
  } catch (error) {
    console.error("Save Error:", error);
    return NextResponse.json({ success: false, error: "Opdatering fejlede" }, { status: 500 });
  }
}