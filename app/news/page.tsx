"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, writeBatch, deleteDoc, doc } from 'firebase/firestore';
import { sendBacklogEmail } from "@/app/news-actions";
// newsData importen slettet, da den ikke bruges

interface BusinessOpportunity {
  id: string;
  title: string;
  source: string;
  url: string;
  image: string;
  date: string; // <--- ÆNDRET: Fra 'date' til 'publicationdate' (matcher DB)
  summary_html: string;
  full_content_html: string;
  relevance_msg: string;
  sentiment_score: number;
  tags: string[];
}

export default function BusinessOpportunityPage() {
  const [selectedArticle, setSelectedArticle] = useState<BusinessOpportunity | null>(null);
  const [news, setNews] = useState<BusinessOpportunity[]>([]); 
  const [loading, setLoading] = useState(true);

  // <--- ÆNDRET: Vi gemmer nu input for ALLE artikler i et objekt, i stedet for én streng
  // Før: const [categoryInput, setCategoryInput] = useState("");
  const [categoryInputs, setCategoryInputs] = useState<{[key: string]: string}>({}); 

  useEffect(() => {
    const fetchNews = async () => {
      try {
        // <--- ÆNDRET: Sorterer efter 'publicationdate' i stedet for 'date'
        const q = query(collection(db, "news-unresolved"), orderBy("date", "desc")); 
        const querySnapshot = await getDocs(q);
        
        const articles = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BusinessOpportunity[];

        setNews(articles);
      } catch (error) {
        console.error("Error fetching news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Slettet useEffect til reset af input, da det ikke længere er nødvendigt med den nye struktur

  // <--- NYT: Hjælpefunktion til at håndtere input for et specifikt kort
  const handleInputChange = (id: string, value: string) => {
    setCategoryInputs(prev => ({
        ...prev,
        [id]: value
    }));
  };

  const handleResolve = async (article: BusinessOpportunity) => {
    // <--- ÆNDRET: Henter inputtet specifikt for denne artikel
    const currentInput = categoryInputs[article.id] || "";

    if (!currentInput.trim()) {
        alert("Du skal indtaste Kategori ID.");
        return;
    }

    if (!confirm("Er du færdig med at behandle denne nyhed?")) return;

    try {
        const batch = writeBatch(db);
        const originalRef = doc(db, "news-unresolved", article.id);
        const newRef = doc(db, "news-resolved", article.id);

        const articleWithCategories = {
            ...article,
            assigned_categories: currentInput, // <--- ÆNDRET: Bruger currentInput
            resolved_at: new Date().toISOString()
        };

        batch.set(newRef, articleWithCategories);
        batch.delete(originalRef);
        await batch.commit();

        const emailResult = await sendBacklogEmail(article, currentInput); // <--- ÆNDRET: Sender currentInput

        if (emailResult.success) {
             // alert("Succes"); // Kan udkommenteres for hurtigere workflow
        } else {
             alert("Nyhed arkiveret, men MAIL FEJLEDE.");
        }

        setNews(prevNews => prevNews.filter(item => item.id !== article.id));
        
        // <--- NYT: Rydder inputtet op for den slettede artikel
        const newInputs = {...categoryInputs};
        delete newInputs[article.id];
        setCategoryInputs(newInputs);

    } catch (error) {
        console.error("Fejl:", error);
        alert("Der skete en fejl.");
    }
  };

  const handleDelete = async (article: BusinessOpportunity) => {
    // Ændret besked, så brugeren ved den flyttes i stedet for at slettes permanent
    if (!confirm("Er du sikker på, at du vil flytte denne nyhed til 'news-discarded'?")) return;

    try {
        const batch = writeBatch(db);
        
        // 1. Find referencerne
        const originalRef = doc(db, "news-unresolved", article.id);
        const discardedRef = doc(db, "news-discarded", article.id); // Den nye collection

        // 2. Klargør data (jeg tilføjer et tidsstempel, så I kan se hvornår den blev kasserede)
        const discardedArticle = {
            ...article,
            discarded_at: new Date().toISOString()
        };

        // 3. Køb flytningen (Kopier til ny -> Slet fra gammel)
        batch.set(discardedRef, discardedArticle);
        batch.delete(originalRef);

        // 4. Udfør
        await batch.commit();

        // 5. Opdater skærmen (fjerner den fra listen)
        setNews(prevNews => prevNews.filter(item => item.id !== article.id));
        
        // (Valgfrit) Ryd op i input-feltet i hukommelsen, hvis man havde skrevet noget
        const newInputs = {...categoryInputs};
        delete newInputs[article.id];
        setCategoryInputs(newInputs);

    } catch (error) {
        console.error("Fejl ved flytning:", error);
        alert("Kunne ikke flytte nyheden.");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === "Ukendt dato") return "";
    let cleanString = dateString;
    if (dateString.startsWith('d') && !isNaN(Number(dateString[1]))) {
        cleanString = dateString.substring(1);
    }
    const date = new Date(cleanString);
    if (isNaN(date.getTime())) return cleanString; 
    return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}>Indlæser nyheder...</div>;

  return (
    <main className="page-wrapper">
      
      {/* HEADER SECTION */}
      <div className="header-bg">
          <header className="header-content">
            <div className="header-top">
                <a href="/" className="back-link">← Tilbage</a>
                <span className="brand-tag">AMR INTELLIGENCE</span>
            </div>
            <h1>Monitorering af Resistens</h1>
            <p>Nyheds oversigt</p>
          </header>
      </div>

      {/* MAIN CONTAINER */}
      <div className="main-container">
        <div className="grid">
            {news.map((article, index) => (
            <article key={article.id || index} className="card">
                
                {/* IMAGE - Klik åbner stadig modal for at læse */}
                <div 
                    className="card-image-wrapper" 
                    onClick={() => setSelectedArticle(article)} 
                    style={{cursor: 'pointer'}} // <--- NYT
                >
                    <img 
                        src={article.image || "https://placehold.co/600x400?text=No+Image"} 
                        alt="News" 
                        className="card-image"
                    />
                    <div className="card-source-badge">{article.source}</div>
                </div>

                <div className="card-body">
                    <div className="meta-row">
                        {/* <--- ÆNDRET: Bruger publicationdate */}
                        <span className="date">{formatDate(article.date)}</span>
                        <div className="sentiment-wrapper" title={`Sentiment: ${article.sentiment_score}`}>
                            <span className={`sentiment-indicator ${article.sentiment_score > 0.1 ? 'pos' : article.sentiment_score < -0.1 ? 'neg' : 'neu'}`}>
                            {article.sentiment_score > 0.1 ? 'Positiv' : article.sentiment_score < -0.1 ? 'Negativ' : 'Neutral'}
                            </span>
                        </div>
                    </div>

                    <h2 className="card-title">
                        {/* <--- NYT: Klikbar titel */}
                        <span onClick={() => setSelectedArticle(article)} style={{cursor: 'pointer'}}>
                        {article.title}
                        </span>
                    </h2>

                    <div 
                        className="card-summary"
                        dangerouslySetInnerHTML={{ __html: article.summary_html }}
                    />

                    {/* <--- NYT: Workflow sektionen er flyttet ind i kortet */}
                    <div className="workflow-area">
                        <label className="input-label">Kategori ID'er:</label>
                        <input 
                            type="text" 
                            className="category-input"
                            placeholder="Fx 01 & 21 & 55 ..."
                            // Binder til værdien i vores state-objekt for dette ID
                            value={categoryInputs[article.id] || ""}
                            onChange={(e) => handleInputChange(article.id, e.target.value)}
                        />
                        
                        <div className="button-row">
                            <button 
                                onClick={() => handleDelete(article)} 
                                className="btn-icon delete"
                                title="Arkiver - ikke relevant"
                            >
                                🗑
                            </button>

                            <button 
                                onClick={() => handleResolve(article)} 
                                className="btn-action resolve"
                                // Deaktiver hvis input er tomt
                                disabled={!(categoryInputs[article.id] || "").trim()}
                                title="Send til backlog"
                            >
                                ✓ Send til Backlog
                            </button>
                        </div>
                    </div>
                    {/* --- SLUT PÅ NYT OMRÅDE --- */}

                </div>
            </article>
            ))}
        </div>
      </div>

      {/* MODAL (Kun til læsning nu) */}
      {selectedArticle && (
        <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-meta">
                <span className="modal-source">{selectedArticle.source}</span>
                {/* <--- ÆNDRET: Bruger publicationdate */}
                <span className="modal-date">{formatDate(selectedArticle.date)}</span>
              </div>
              <button className="btn-close" onClick={() => setSelectedArticle(null)}>Luk</button>
            </div>
            
            <div className="modal-scroll-area">
              <h2 className="modal-title">{selectedArticle.title}</h2>
              <a href={selectedArticle.url} target="_blank" className="original-link">Gå til original kilde →</a>
              <div className="article-prose" dangerouslySetInnerHTML={{ __html: selectedArticle.full_content_html }} />
              
              {/* <--- ÆNDRET: Input felter og knapper er FJERNET herfra */}
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        /* ... Dine eksisterende styles ... */
        :root { --brand-navy: #1B264F; --brand-red: #C01B2E; --bg-page: #F8F9FA; --bg-card: #FFFFFF; --text-main: #111827; --text-muted: #6B7280; --border-light: #E5E7EB; }
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-page); color: var(--text-main); }
        mark { background-color: #FEF2F2; color: #991B1B; padding: 0 2px; border-radius: 2px; font-weight: 500; }
        .page-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
        .header-bg { background-color: var(--brand-navy); color: white; padding: 60px 20px 80px 20px; }
        .header-content { max-width: 1280px; margin: 0 auto; text-align: center; }
        .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .back-link { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
        .back-link:hover { color: white; }
        .brand-tag { background: rgba(255,255,255,0.1); color: white; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em; }
        h1 { font-size: 3rem; font-weight: 700; margin: 0 0 10px 0; letter-spacing: -0.02em; }
        .header-content p { color: rgba(255,255,255,0.8); font-size: 1.25rem; font-weight: 300; margin: 0; }
        .main-container { max-width: 1280px; margin: -40px auto 0 auto; padding: 0 20px 40px 20px; width: 100%; box-sizing: border-box; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 32px; }
        .card { background: var(--bg-card); border-radius: 12px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); transition: all 0.3s ease; display: flex; flex-direction: column; }
        .card:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
        .card-image-wrapper { position: relative; height: 200px; background: #E5E7EB; }
        .card-image { width: 100%; height: 100%; object-fit: cover; }
        .card-source-badge { position: absolute; top: 12px; right: 12px; background: white; color: var(--brand-navy); font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .card-body { padding: 24px; display: flex; flex-direction: column; flex-grow: 1; }
        .meta-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.75rem; }
        .date { color: var(--text-muted); font-weight: 500; }
        .sentiment-indicator { font-size: 0.7rem; font-weight: 600; padding-left: 12px; position: relative; }
        .sentiment-indicator::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; }
        .sentiment-indicator.pos::before { background: #10B981; }
        .sentiment-indicator.neg::before { background: #EF4444; }
        .sentiment-indicator.neu::before { background: #9CA3AF; }
        .card-title { font-size: 1.25rem; font-weight: 700; line-height: 1.3; margin: 0 0 12px 0; color: var(--text-main); }
        .card-summary { font-size: 0.95rem; line-height: 1.6; color: var(--text-muted); margin-bottom: 20px; flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        
        /* <--- NYT: CSS til Workflow området */
        .workflow-area {
            background-color: #F9FAFB;
            border-top: 1px solid #E5E7EB;
            margin: auto -24px -24px -24px;
            padding: 20px;
        }

        .input-label {
            display: block;
            font-size: 0.75rem;
            font-weight: 700;
            color: var(--text-muted);
            margin-bottom: 6px;
            text-transform: uppercase;
        }

        .category-input {
            width: 100%;
            padding: 10px;
            border: 1px solid #D1D5DB;
            border-radius: 6px;
            font-size: 0.9rem;
            margin-bottom: 12px;
            box-sizing: border-box;
        }

        .button-row {
            display: flex;
            gap: 10px;
        }

        .btn-icon.delete {
            background: #FEF2F2;
            color: #EF4444;
            border: 1px solid #FCA5A5;
            border-radius: 6px;
            width: 42px;
            height: 42px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            font-size: 1.2rem;
            flex-shrink: 0;
        }
        .btn-icon.delete:hover { background: #FEE2E2; }

        .btn-action.resolve {
            background: #10B981;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 0 20px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            flex-grow: 1;
            transition: opacity 0.2s;
        }
        .btn-action.resolve:disabled {
            background: #D1D5DB;
            cursor: not-allowed;
        }
        .btn-action.resolve:hover:not(:disabled) {
            background: #059669;
        }
        /* <--- SLUT PÅ NYT CSS */

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(27, 38, 79, 0.6); backdrop-filter: blur(4px); z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 20px; animation: fadeIn 0.2s ease-out; }
        .modal-content { background: white; width: 100%; max-width: 750px; max-height: 85vh; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden; animation: slideUp 0.3s ease-out; }
        .modal-header { padding: 20px 30px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: #FAFAFA; }
        .modal-meta { display: flex; gap: 12px; align-items: center; font-size: 0.85rem; color: var(--text-muted); }
        .modal-source { font-weight: 700; color: var(--brand-navy); text-transform: uppercase; }
        .btn-close { background: none; border: none; font-weight: 600; color: var(--text-muted); cursor: pointer; }
        .btn-close:hover { color: var(--brand-red); }
        .modal-scroll-area { padding: 40px; overflow-y: auto; }
        .modal-title { font-size: 2rem; font-weight: 800; line-height: 1.2; margin: 0 0 10px 0; color: var(--brand-navy); }
        .original-link { display: inline-block; color: var(--brand-red); margin-bottom: 30px; text-decoration: none; font-weight: 600; }
        .original-link:hover { text-decoration: underline; }
        .article-prose { font-size: 1.1rem; line-height: 1.7; color: #374151; }
        .article-prose img { border-radius: 8px; margin: 20px 0; max-width: 100%; }
        .article-prose p { margin-bottom: 20px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </main>
  );
}