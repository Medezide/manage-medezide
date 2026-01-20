import { XMLParser } from 'fast-xml-parser';

// --- 1. DEFINE YOUR MONITORED LIST HERE ---
// This allows us to reuse it for the search query AND the matching logic
export const MONITORED_CPV_CODES = [
    '33651100', '33651200', '33651300', '33651500', '33651600', '33651620', 
    '33651600', '33651660', '33698100', '38970000', '38433000', '38437000', 
    '38910000', '51400000', '72000000', '73000000', '80320000', '80420000', 
    '80430000', '85100000', '85200000', '90720000'
];

export const CPV_MAPPING: Record<string, string> = {
    // Medical & Pharma
    '33651100': 'Antivirals for systemic use',
    '33651200': 'Antineoplastic agents',
    '33651300': 'Immunosuppressive agents',
    '33651500': 'Vaccines',
    '33651600': 'Vaccines for veterinary medicine',
    '33651620': 'Bacterial vaccines',
    '33651660': 'Viral vaccines',
    '33698100': 'Microbiological cultures',
    '38970000': 'Research, testing and scientific technical simulator',
    '38433000': 'Spectrometers',
    '38437000': 'Laboratory pipettes and accessories',
    '38910000': 'Hygiene monitoring and testing',
    '51400000': 'Installation services of medical and surgical equipment',
    
    // Services & Education
    '72000000': 'IT services: consulting, software development, Internet and support',
    '73000000': 'Research and development services',
    '80320000': 'Medical education services',
    '80420000': 'E-learning services',
    '80430000': 'Adult education services at university level',
    
    // Health & Environment
    '85100000': 'Health services',
    '85200000': 'Veterinary services',
    '90720000': 'Environmental protection',

    // Common Fallbacks
    '33140000': 'Medical consumables',
    '33190000': 'Medical consumables and disposable goods',
    '33000000': 'Medical equipment, pharmaceuticals and personal care products',
    '79411000': 'General consultancy services',
    'default': 'Unmonitored CPV Code'
};

export const COUNTRY_MAPPING: Record<string, string> = {
    "IRL": "Ireland", "MLT": "Malta", "MKD": "North Macedonia", 
    "ROU": "Romania", "BEL": "Belgium", "NLD": "Netherlands",
    "ESP": "Spain", "PRT": "Portugal", "FIN": "Finland",
    "GRC": "Greece", "LUX": "Luxembourg", "NOR": "Norway",
    "DNK": "Denmark", "DEU": "Germany", "FRA": "France",
    "SWE": "Sweden", "ITA": "Italy", "UK": "United Kingdom",
    "EST": "Estonia", "LVA": "Latvia", "LTU": "Lithuania", "POL": "Poland", "CHE": "Switzerland"
};

function getSafeValue(obj: any, path: string[]): any {
    let current = obj;
    for (const key of path) {
        if (current === undefined || current === null) return null;
        if (Array.isArray(current)) current = current[0]; 
        
        if (current[key] !== undefined) {
            current = current[key];
        } else {
            const foundKey = Object.keys(current).find(k => k.endsWith(`:${key}`) || k === key);
            if (foundKey) current = current[foundKey];
            else return null;
        }
    }
    if (current && typeof current === 'object' && '#text' in current) return current['#text'];
    return current;
}

function formatCurrency(amount: string | number): string {
    if (!amount) return "N/A";
    try {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('de-DE').format(num);
    } catch { return String(amount); }
}

// --- HELPER: CHECK IF CPV IS CHILD OF PARENT ---
// e.g. 72500000 is a child of 72000000
function isCpvMatch(monitored: string, candidate: string): boolean {
    // Remove trailing zeros to get the "root" (e.g. 72000000 -> 72)
    const root = monitored.replace(/0+$/, '');
    return candidate.startsWith(root);
}

// --- MAIN PARSER ---
// Updated to accept apiCpvs (list of all CPVs from API)
export function parseTedXml(xmlContent: string, apiDate?: string, apiCpvs?: string[]) {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
    const result = parser.parse(xmlContent);
    const root = result['ContractNotice'] || Object.values(result)[0];

    // 1. Identification
    const noticeIdRaw = getSafeValue(root, ['UBLExtensions', 'UBLExtension', 'ExtensionContent', 'EformsExtension', 'Publication', 'NoticePublicationID']);
    const noticeId = noticeIdRaw ? noticeIdRaw.replace(/^0+/, '') : "N/A";

    // 2. Title & Description
    const projectNode = getSafeValue(root, ['ProcurementProject']);
    const title = getSafeValue(projectNode, ['Name']);
    const description = getSafeValue(projectNode, ['Description']);

    // 3. Buyer & Country
    const orgs = getSafeValue(root, ['UBLExtensions', 'UBLExtension', 'ExtensionContent', 'EformsExtension', 'Organizations']);
    const company = getSafeValue(orgs, ['Organization', 'Company']);
    const buyerName = getSafeValue(company, ['PartyName', 'Name']);
    const countryCodeRaw = getSafeValue(company, ['PostalAddress', 'Country', 'IdentificationCode']);
    const buyerCountry = COUNTRY_MAPPING[countryCodeRaw] || countryCodeRaw;

    // 4. CPV (Primary from XML)
    const cpvCode = getSafeValue(projectNode, ['MainCommodityClassification', 'ItemClassificationCode']);
    const cpvDesc = CPV_MAPPING[cpvCode] || CPV_MAPPING['default'];

    // 5. Value
    const valRaw = getSafeValue(projectNode, ['RequestedTenderTotal', 'EstimatedOverallContractAmount']);
    const currency = getSafeValue(projectNode, ['RequestedTenderTotal', 'EstimatedOverallContractAmount', '@_currencyID']) || 'EUR';
    const estimatedValue = valRaw ? `${formatCurrency(valRaw)} ${currency}` : "N/A";

    // 6. Dates
    let cleanDate = "N/A";
    if (apiDate) {
        cleanDate = apiDate.split('T')[0];
    } else {
        let dateStr = getSafeValue(root, ['IssueDate']); 
        const deadline = getSafeValue(root, ['TenderingProcess', 'TenderSubmissionDeadlinePeriod', 'EndDate']);
        if (deadline) dateStr = deadline;
        cleanDate = dateStr ? dateStr.split('+')[0].split('Z')[0] : "N/A";
    }
    const status = new Date(cleanDate) >= new Date() ? "Open" : "Closed";

    // 7. MATCH REASON (The new badge logic)
    let matchTrigger = null;
    
    // We check ALL CPVs from the API against ALL your monitored codes
    if (apiCpvs && apiCpvs.length > 0) {
        for (const candidate of apiCpvs) {
            // Find which monitored code "covers" this candidate
            const foundParent = MONITORED_CPV_CODES.find(monitored => isCpvMatch(monitored, candidate));
            
            if (foundParent) {
                const parentDesc = CPV_MAPPING[foundParent] || "Monitoring";
                // E.g. "72000000 - IT services..."
                matchTrigger = `${foundParent} - ${parentDesc}`; 
                break; // Stop after first match found
            }
        }
    }

    return {
        NoticeID: noticeId,
        ExternalURI: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
        Title: title || "No Title Found",
        Description: description || "",
        BuyerName: buyerName || "Unknown Buyer",
        BuyerCountry: buyerCountry || "Unknown",
        CPV: cpvCode, // Still the primary for display
        CPV_Description: `${cpvCode} - ${cpvDesc}`,
        EstimatedValue: estimatedValue,
        TenderStatus: status,
        TenderApplicationDate: cleanDate,
        MatchedTrigger: matchTrigger
    };
}