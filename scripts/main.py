import requests
import os
from dotenv import load_dotenv
import re
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import hashlib

# 1. SETUP STIER (PATHS)
# Vi finder roden af projektet ved at gå én gang op fra 'scripts' mappen
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, '.env') # <-- NYT: Stien til din .env fil


SERVICE_ACCOUNT_KEY_PATH = os.path.join(BASE_DIR, 'serviceAccountKey.json')

# 2. LOAD .ENV FRA DEN SPECIFIKKE STI
load_dotenv(ENV_PATH) # <-- NYT: Vi loader fra den specifikke sti
DIFFBOT_API_TOKEN = os.getenv("DIFFBOT_TOKEN")

# Sikkerhedstjek: Stopper scriptet hvis nøglen mangler
if not DIFFBOT_API_TOKEN:
    print("❌ FEJL: Kunne ikke finde DIFFBOT_TOKEN.")
    print(f"   Tjek at filen findes her: {ENV_PATH}")
    print("   Og at den indeholder: DIFFBOT_TOKEN=din_nøgle")
    exit()


# Initialize Firebase Admin SDK
try:
    if not firebase_admin._apps: # Check if app is not already initialized
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✅ Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"❌ FEJL: Kunne ikke initialisere Firebase Admin SDK: {e}")
    print(f"   Tjek at service account key filen findes her: {SERVICE_ACCOUNT_KEY_PATH}")
    exit()

# Din Query (Du bruger den Engelske her - hvis du vil have den Nordiske, skal du skifte denne tekst ud)
DIFFBOT_QUERY = """
type:Article language:en  or(   title:"Antimicrobial resistance",    tags.label:"Antimicrobial resistance",    title:"Antibiotic resistance",    title:"Superbugs",    text:"Antimicrobial stewardship",    text:"Antibiotic resistance",    text:"Antimicrobial resistance",    text:"multidrug-resistant",    text:"Phage therapy" )  not(title:or("market research", "market size", "sensor", "magnetic", "forecast", "shares"))  not(site:or("surahquran.com", "angi.com", "NewStraitsTimes")) not(pageUrl:"www.nst.com.my") date>"2026-01-14"  sortBy:date"""

AMR_KEYWORDS = [
    "antimicrobial resistance", "antibiotic resistance", "amr", "superbugs", "Superbugs", "Phage therapy", "multidrug-resistant", 
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




# NEW FUNCTION: To send data to Firestore
def send_to_firestore(collection_name: str, data: dict):
    """
    Sends a single document to a specified Firestore collection.
    Args:
        collection_name: The name of the Firestore collection.
        data: A dictionary containing the document data.
    Returns:
        The ID of the newly created document, or None if an error occurred.
    """
    try:
        url = data.get('url')
        if url:
            # unique id for url = hashing
            doc_id = hashlib.md5(url.encode('utf-8')).hexdigest()

            # vi bruger .set() med dette id i stedet for .add() for at undgå dubletter
            db.collection(collection_name).document(doc_id).set(data)
            print(f"📝 Successfully set document with ID: {doc_id} in collection '{collection_name}'")
            return doc_id
        else:
            # Fallback hvis ingen URL findes (burde sjældent ske)
            doc_ref = db.collection(collection_name).add(data)
            print(f"📝 Tilføjet (uden URL-ID): {doc_ref[1].id}")
            return doc_ref[1].id
    except Exception as e:
        print(f"❌ Fejl ved skrivning til Firestore: {e}")
        return None

def run_scraper():
    # 1. Hent data fra Diffbot
    print("🚀 Starter Diffbot download...")
    url = 'https://kg.diffbot.com/kg/v3/dql?'
    
    parameters = {
        "token" : DIFFBOT_API_TOKEN,
        "query" : DIFFBOT_QUERY,
        "size" : 50, # Sat op til 25 igen
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

    firestore_collection_name = 'news-unresolved'

    # 2. Behandl data og tilføj highlights
    for item in raw_list:
        article = item.get('entity', item)
        raw_text = article.get('text', '')
        raw_html = article.get('html', raw_text)

        # Pre-process highlights here in Python
        summary_highlighted = highlight_keywords(raw_text, length=300)
        full_text_highlighted = highlight_keywords(raw_html, length=None)
        relevance = get_relevance_reason(raw_text, [t.get('label', '') for t in article.get('tags', [])])

        pub_date = "Ukendt dato"
        diffbot_date = article.get('date')

        if diffbot_date:
            # Hvis det er en ordbog (dict), hent 'str' nøglen
            if isinstance(diffbot_date, dict):
                pub_date = diffbot_date.get('str', 'Ukendt dato')
            # Hvis det allerede er en streng, brug den direkte
            elif isinstance(diffbot_date, str):
                pub_date = diffbot_date
            
            # Rens datoen for det mærkelige 'd' hvis det findes (d2025 -> 2025)
            if pub_date.startswith('d') and pub_date[1].isdigit():
                pub_date = pub_date[1:]




        clean_obj = {
            "title": article.get('title', 'Uden titel'),
            "url": article.get('resolvedPageUrl') or article.get('pageUrl'),
            "date": pub_date,
            "source": article.get('siteName', 'Ukendt kilde'),
            "image": article.get('image', None),
            
            # Vi gemmer HTML-strenge med <mark> tags direkte i JSON
            "summary_html": summary_highlighted,
            "full_content_html": full_text_highlighted,
            "relevance_msg": relevance,
            
            "tags": [t.get('label') for t in article.get('tags', []) if 'label' in t],
            "sentiment_score": article.get('sentiment', 0)
        }

        # NEW: Send the clean_obj to Firestore
        send_to_firestore(firestore_collection_name, clean_obj)


if __name__ == '__main__':
    run_scraper()