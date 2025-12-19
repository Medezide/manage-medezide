"use client";
import { useState } from 'react';
import newsData from '../../data/amr_news.json'; 

export default function NewsPage() {
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

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

  return (
    <main className="page-wrapper">
      
      {/* --- HEADER SECTION (MEDEZIDE THEME) --- */}
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

      {/* --- MAIN CONTAINER --- */}
      <div className="main-container">
        <div className="grid">
            {newsData.map((article: any, index: number) => (
            <article key={index} className="card">
                
                {/* BILLEDE */}
                <div className="card-image-wrapper">
                <img 
                    src={article.image || "https://placehold.co/600x400?text=No+Image"} 
                    alt="News" 
                    className="card-image"
                />
                <div className="card-source-badge">{article.source}</div>
                </div>

                {/* KORT INDHOLD */}
                <div className="card-body">
                <div className="meta-row">
                    <span className="date">{formatDate(article.date)}</span>
                    {/* Vi bruger sentiment score til at farve kanten på en lille indikator */}
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
                    {article.tags.slice(0, 3).map((tag: string, i: number) => (
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

      {/* --- MODAL (POP-UP) --- */}
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
            </div>
          </div>
        </div>
      )}
      
      {/* --- CSS DESIGN SYSTEM (MEDEZIDE COLORS) --- */}
      <style jsx global>{`
        /* Reset & Variables */
        :root {
            /* MEDEZIDE FARVER */
            --brand-navy: #1B264F;  /* Den mørkeblå fra headeren */
            --brand-red: #C01B2E;   /* Den røde fra knapperne */
            
            --bg-page: #F8F9FA;
            --bg-card: #FFFFFF;
            --text-main: #111827;
            --text-muted: #6B7280;
            --border-light: #E5E7EB;
        }

        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-page); color: var(--text-main); }
        mark { background-color: #FEF2F2; color: #991B1B; padding: 0 2px; border-radius: 2px; font-weight: 500; } /* Rødlig highlight */

        /* Layout */
        .page-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
        
        .header-bg {
            background-color: var(--brand-navy);
            color: white;
            padding: 60px 20px 80px 20px; /* Ekstra padding i bunden for at skabe luft */
        }
        
        .header-content {
            max-width: 1280px; margin: 0 auto; text-align: center;
        }

        .header-top {
            display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;
        }

        .back-link { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: color 0.2s; }
        .back-link:hover { color: white; }
        
        .brand-tag { 
            background: rgba(255,255,255,0.1); color: white; font-size: 0.7rem; font-weight: 700; 
            padding: 4px 10px; border-radius: 4px; letter-spacing: 0.05em;
        }

        h1 { font-size: 3rem; font-weight: 700; margin: 0 0 10px 0; letter-spacing: -0.02em; }
        .header-content p { color: rgba(255,255,255,0.8); font-size: 1.25rem; font-weight: 300; margin: 0; }

        /* Main Content - Rykker op over headeren for en lag-effekt */
        .main-container {
            max-width: 1280px;
            margin: -40px auto 0 auto; /* Negativ margin trækker kortene op */
            padding: 0 20px 40px 20px;
            width: 100%;
            box-sizing: border-box;
        }

        /* Grid */
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
            gap: 32px;
        }

        /* Card Design */
        .card {
            background: var(--bg-card);
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.05);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            transition: all 0.3s ease;
            display: flex; flex-direction: column;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .card-image-wrapper { position: relative; height: 200px; background: #E5E7EB; }
        .card-image { width: 100%; height: 100%; object-fit: cover; }
        .card-source-badge {
            position: absolute; top: 12px; right: 12px;
            background: white; color: var(--brand-navy);
            font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
            padding: 4px 8px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

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

        /* Card Footer & Button - MEDEZIDE STYLE */
        .card-footer { margin-top: auto; }
        
        .btn-read-more {
            background: var(--brand-red); 
            border: none; 
            color: white;
            padding: 10px 20px; 
            border-radius: 50px; /* Runde knapper som på billedet */
            font-weight: 600; 
            font-size: 0.9rem; 
            cursor: pointer;
            width: 100%;
            transition: background 0.2s;
            box-shadow: 0 4px 6px -1px rgba(192, 27, 46, 0.2);
        }
        .btn-read-more:hover { background: #a11626; }

        /* --- MODAL DESIGN --- */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(27, 38, 79, 0.6); /* Navy tint i baggrunden */
            backdrop-filter: blur(4px);
            z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 20px;
            animation: fadeIn 0.2s ease-out;
        }

        .modal-content {
            background: white; width: 100%; max-width: 750px; max-height: 85vh;
            border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            display: flex; flex-direction: column; overflow: hidden;
            animation: slideUp 0.3s ease-out;
        }

        .modal-header {
            padding: 20px 30px; border-bottom: 1px solid var(--border-light);
            display: flex; justify-content: space-between; align-items: center;
            background: #FAFAFA;
        }
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