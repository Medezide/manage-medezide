import requests
import json
import os
from dotenv import load_dotenv
import re

# 1. SETUP STIER (PATHS)
# Vi finder roden af projektet ved at gå én gang op fra 'scripts' mappen
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data') # Her skal JSON-filen lande
ENV_PATH = os.path.join(BASE_DIR, '.env') # <-- NYT: Stien til din .env fil

# Sørg for at data-mappen findes
os.makedirs(DATA_DIR, exist_ok=True)

# 2. LOAD .ENV FRA DEN SPECIFIKKE STI
load_dotenv(ENV_PATH) # <-- NYT: Vi loader fra den specifikke sti
DIFFBOT_API_TOKEN = os.getenv("DIFFBOT_TOKEN")

# Sikkerhedstjek: Stopper scriptet hvis nøglen mangler
if not DIFFBOT_API_TOKEN:
    print("❌ FEJL: Kunne ikke finde DIFFBOT_TOKEN.")
    print(f"   Tjek at filen findes her: {ENV_PATH}")
    print("   Og at den indeholder: DIFFBOT_TOKEN=din_nøgle")
    exit()

# Din Query (Du bruger den Engelske her - hvis du vil have den Nordiske, skal du skifte denne tekst ud)
DIFFBOT_QUERY = """
type:Article language:en  or(   title:"Antimicrobial resistance",    tags.label:"Antimicrobial resistance",    title:"Antibiotic resistance",    title:"Superbugs",    text:"Antimicrobial stewardship",    text:"Antibiotic resistance",    text:"Antimicrobial resistance",    text:"multidrug-resistant",    text:"Phage therapy" )  not(title:or("market research", "market size", "sensor", "magnetic", "forecast", "shares"))  not(site:or("surahquran.com", "angi.com", "NewStraitsTimes")) not(pageUrl:"www.nst.com.my")  sortBy:date"""

AMR_KEYWORDS = [
    "antimicrobial resistance", "antibiotic resistance", "amr", "superbugs", 
    "drug-resistant", "mrsa", "bacteria", "pathogens", "infection",
    "antibiotikaresistens", "multiresistent", "superbakterier"
]

def highlight_keywords(text, length=None):
    if not text: return "Ingen tekst fundet."
    
    # Hvis length er sat, klipper vi teksten (til preview)
    preview = text[:length] + "..." if length else text
        
    for word in AMR_KEYWORDS:
        pattern = re.compile(re.escape(word), re.IGNORECASE)
        # Vi indsætter HTML tags direkte i JSON strengen
        preview = pattern.sub(lambda m: f'<mark>{m.group(0)}</mark>', preview)
    return preview

def get_relevance_reason(text, tags):
    hits = []
    text_lower = text.lower() if text else ""
    for tag in tags:
        if tag.lower() in AMR_KEYWORDS:
            hits.append(tag)
    if not hits:
        for kw in AMR_KEYWORDS:
            if kw in text_lower:
                hits.append(kw)
                if len(hits) >= 3: break
    if hits:
        return f"🔥 Matcher: {', '.join(list(set(hits))[:3])}"
    return "Generel sundhed"

def run_scraper():
    # 1. Hent data fra Diffbot
    print("🚀 Starter Diffbot download...")
    url = 'https://kg.diffbot.com/kg/v3/dql?'
    
    parameters = {
        "token" : DIFFBOT_API_TOKEN,
        "query" : DIFFBOT_QUERY,
        "size" : 2, # Sat op til 25 igen
        "json" : True
    }
    
    try:
        response = requests.get(url, params=parameters)
        
        # Hvis vi får 401 her, vil scriptet crashe og vise fejlen
        response.raise_for_status() 
        data = response.json()
    except Exception as e:
        print(f"❌ Fejl under download: {e}")
        return

    raw_list = data.get('data', [])
    print(f"📥 Fandt {len(raw_list)} artikler. Behandler nu...")

    clean_articles = []

    # 2. Behandl data og tilføj highlights
    for item in raw_list:
        article = item.get('entity', item)
        raw_text = article.get('text', '')
        raw_html = article.get('html', raw_text)

        # Pre-process highlights here in Python
        summary_highlighted = highlight_keywords(raw_text, length=300)
        full_text_highlighted = highlight_keywords(raw_html, length=None)
        relevance = get_relevance_reason(raw_text, [t.get('label', '') for t in article.get('tags', [])])

        clean_obj = {
            "title": article.get('title', 'Uden titel'),
            "url": article.get('resolvedPageUrl') or article.get('pageUrl'),
            "date": article.get('date', {}).get('str', 'Ukendt dato'),
            "source": article.get('siteName', 'Ukendt kilde'),
            "image": article.get('image', None),
            
            # Vi gemmer HTML-strenge med <mark> tags direkte i JSON
            "summary_html": summary_highlighted,
            "full_content_html": full_text_highlighted,
            "relevance_msg": relevance,
            
            "tags": [t.get('label') for t in article.get('tags', []) if 'label' in t],
            "sentiment_score": article.get('sentiment', 0)
        }
        clean_articles.append(clean_obj)

    # 3. Gem til Next.js data mappen
    output_file = os.path.join(DATA_DIR, 'amr_news.json')
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(clean_articles, f, indent=4, ensure_ascii=False)

    print(f"✅ Succes! Data gemt i: {output_file}")

if __name__ == '__main__':
    run_scraper()