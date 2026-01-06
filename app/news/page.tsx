"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, writeBatch, deleteDoc, doc } from 'firebase/firestore';
import { sendBacklogEmail } from "@/app/actions";
import newsData from '../../data/amr_news.json'; 

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  image: string;
  date: string; // Updated from 'date' to match Firestore
  summary_html: string;
  full_content_html: string;
  relevance_msg: string;
  sentiment_score: number;
  tags: string[];
}

export default function NewsPage() {
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]); 
  const [loading, setLoading] = useState(true);

  const [categoryInput, setCategoryInput] = useState(""); // <--- NYT

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const q = query(collection(db, "news-unresolved"), orderBy("date", "desc")); 
        const querySnapshot = await getDocs(q);
        
        const articles = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as NewsArticle[]; // Force TypeScript to treat this as NewsArticle

        setNews(articles);
      } catch (error) {
        console.error("Error fetching news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // 2. MANGLENDE RESET: Tøm inputfeltet når modal åbnes
  useEffect(() => {
    if (selectedArticle) {
        setCategoryInput(""); // <--- NYT
    }
  }, [selectedArticle]);

  // 2. THE NEW "MOVE" FUNCTION
  // 2. THE NEW "MOVE" FUNCTION
  const handleResolve = async (article: NewsArticle) => {

    if (!categoryInput.trim()) {
        alert("Du skal indtaste Kategori ID.");
        return;
    }

    if (!confirm("Er du færdig med at behandle denne nyhed?")) return;

    try {
        // 1. DATABASE FLYTNING
        const batch = writeBatch(db);
        const originalRef = doc(db, "news-unresolved", article.id);
        const newRef = doc(db, "news-resolved", article.id);

        const articleWithCategories = {
            ...article,
            assigned_categories: categoryInput,
            resolved_at: new Date().toISOString()
        };

        batch.set(newRef, articleWithCategories);
        batch.delete(originalRef);
        await batch.commit();

        // 2. SEND MAIL (Kalder Server Action)
        const emailResult = await sendBacklogEmail(article, categoryInput);

        if (emailResult.success) {
             alert("Nyhed arkiveret og mail sendt succesfuldt!");
        } else {
             alert("Nyhed arkiveret, men MAIL FEJLEDE. Tjek server logs.");
        }

        // 3. Opdater UI
        setNews(prevNews => prevNews.filter(item => item.id !== article.id));
        setSelectedArticle(null);

    } catch (error) {
        console.error("Fejl:", error);
        alert("Der skete en fejl.");
    }
  };


  // 3. NY FUNKTION: SLET FULDSTÆNDIGT (Den røde knap)
  const handleDelete = async (article: NewsArticle) => {
    if (!confirm("Er du sikker? Dette vil slette nyheden PERMANENT fra databasen.")) return;

    try {
        // Vi sletter bare dokumentet direkte fra 'news-unresolved'
        await deleteDoc(doc(db, "news-unresolved", article.id));

        // Opdater skærmen med det samme
        setNews(prevNews => prevNews.filter(item => item.id !== article.id));
        setSelectedArticle(null); // Luk vinduet
        
        // Ingen alert nødvendig her, det skal bare gå hurtigt
    } catch (error) {
        console.error("Fejl ved sletning:", error);
        alert("Kunne ikke slette nyheden.");
    }
  };


  const formatDate = (dateString: string) => {
    if (!dateString || dateString === "Ukendt dato") return "";
    
    // Clean up "d2025..." format if present
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
                
                {/* IMAGE */}
                <div className="card-image-wrapper">
                <img 
                    src={article.image || "https://placehold.co/600x400?text=No+Image"} 
                    alt="News" 
                    className="card-image"
                />
                <div className="card-source-badge">{article.source}</div>
                </div>

                {/* BODY */}
                <div className="card-body">
                <div className="meta-row">
                    <span className="date">{formatDate(article.date)}</span>
                    <div className="sentiment-wrapper" title={`Sentiment: ${article.sentiment_score}`}>
                         <span className={`sentiment-indicator ${article.sentiment_score > 0.1 ? 'pos' : article.sentiment_score < -0.1 ? 'neg' : 'neu'}`}>
                           {article.sentiment_score > 0.1 ? 'Positiv' : article.sentiment_score < -0.1 ? 'Negativ' : 'Neutral'}
                         </span>
                    </div>
                </div>

                <h2 className="card-title">
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                    {article.title}
                    </a>
                </h2>

                <div 
                    className="card-summary"
                    dangerouslySetInnerHTML={{ __html: article.summary_html }}
                />

                <div className="tags-container">
                    {(article.tags || []).slice(0, 3).map((tag, i) => (
                    <span key={i} className="tag">{tag}</span>
                    ))}
                </div>

                <div className="card-footer">
                    <button onClick={() => setSelectedArticle(article)} className="btn-read-more">
                    Læs hele artiklen
                    </button>
                </div>

                </div>
            </article>
            ))}
        </div>
      </div>

      {/* MODAL */}
      {selectedArticle && (
        <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-meta">
                <span className="modal-source">{selectedArticle.source}</span>
                <span className="modal-date">{formatDate(selectedArticle.date)}</span>
              </div>
              <button className="btn-close" onClick={() => setSelectedArticle(null)}>Luk</button>
            </div>
            
            <div className="modal-scroll-area">
              <h2 className="modal-title">{selectedArticle.title}</h2>
              <a href={selectedArticle.url} target="_blank" className="original-link">Gå til original kilde →</a>
              
              <div className="article-prose" dangerouslySetInnerHTML={{ __html: selectedArticle.full_content_html }} />
              
              {/* --- 3. MANGLENDE INPUT FELT: Her skriver brugeren kategorierne --- */}
              <div style={{marginTop: 30, backgroundColor: '#F3F4F6', padding: 20, borderRadius: 8}}>
                  <label style={{display: 'block', marginBottom: 8, fontWeight: 600, fontSize: '0.9rem'}}>
                      Kategori ID'er (obligatorisk til mail):
                  </label>
                  <input 
                    type="text" 
                    placeholder="F.eks. 21, 34, 55"
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #D1D5DB',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                    }}
                  />
                  <p style={{fontSize: '0.8rem', color: '#6B7280', marginTop: 5}}>
                      Dette vil blive indsat i emnefeltet på mailen til backloggen.
                  </p>
              </div>

              {/* ACTION AREA */}
              <div className="modal-actions" style={{
                  marginTop: 20, 
                  borderTop: '1px solid #eee', 
                  paddingTop: 20, 
                  display: 'flex', 
                  justifyContent: 'flex-end',
                  gap: '12px' 
              }}>
                 
                 <button 
                    onClick={() => handleDelete(selectedArticle)}
                    style={{
                        backgroundColor: '#FFF', 
                        color: '#EF4444', 
                        border: '1px solid #EF4444',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        transition: '0.2s'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFF')}
                 >
                    🗑 Slet (Irrelevant)
                 </button>

                 <button 
                    onClick={() => handleResolve(selectedArticle)}
                    // Deaktiver knap hvis input er tomt
                    disabled={!categoryInput.trim()} 
                    style={{
                        backgroundColor: categoryInput.trim() ? '#10B981' : '#9CA3AF', 
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: categoryInput.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '0.9rem'
                    }}
                 >
                    ✓ Marker som behandlet
                 </button>
              </div>

            </div>
          </div>
        </div>
      )}
       
      {/* Existing Styles */}
      <style jsx global>{`
        /* ... Keep your existing styles ... */
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
        .card-title a { text-decoration: none; color: inherit; transition: color 0.2s; }
        .card-title a:hover { color: var(--brand-red); }
        .card-summary { font-size: 0.95rem; line-height: 1.6; color: var(--text-muted); margin-bottom: 20px; flex-grow: 1; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .tags-container { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
        .tag { background: #F3F4F6; color: #4B5563; font-size: 0.7rem; font-weight: 600; padding: 4px 10px; border-radius: 99px; border: 1px solid #E5E7EB; }
        .card-footer { margin-top: auto; }
        .btn-read-more { background: var(--brand-red); border: none; color: white; padding: 10px 20px; border-radius: 50px; font-weight: 600; font-size: 0.9rem; cursor: pointer; width: 100%; transition: background 0.2s; box-shadow: 0 4px 6px -1px rgba(192, 27, 46, 0.2); }
        .btn-read-more:hover { background: #a11626; }
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