"use client";
import { useState } from 'react';
// VIGTIGT: Vi går to mapper tilbage (../../) for at finde data-mappen i roden
import newsData from '../../data/amr_news.json'; 

export default function NewsPage() {
  const [selectedArticle, setSelectedArticle] = useState<any>(null);

  return (
    <main style={{ backgroundColor: '#f3f4f6', minHeight: '100vh', padding: '40px', fontFamily: 'sans-serif', color: '#1f2937' }}>
      
      {/* HEADER MED TILBAGE-KNAP */}
      <header style={{ textAlign: 'center', marginBottom: '40px', maxWidth: '1200px', margin: '0 auto 40px' }}>
        <a href="/" style={{ display: 'inline-block', marginBottom: '20px', textDecoration: 'none', color: '#6b7280', fontWeight: 600 }}>← Tilbage til forsiden</a>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', fontWeight: 800 }}>🦠 AMR Intelligence Monitor</h1>
        <div style={{ color: '#6b7280', fontSize: '1.1rem' }}>Live overvågning af resistens-nyheder fra Norden</div>
      </header>

      {/* GRID LAYOUT */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: '30px', 
        maxWidth: '1200px', 
        margin: '0 auto' 
      }}>
        {newsData.map((article: any, index: number) => (
          <div key={index} style={{ 
            backgroundColor: 'white', 
            borderRadius: '12px', 
            overflow: 'hidden', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #e5e7eb'
          }}>
            {/* BILLEDE */}
            <div style={{ height: '180px', backgroundColor: '#e5e7eb' }}>
              <img 
                src={article.image || "https://placehold.co/600x400?text=No+Image"} 
                alt="News" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* KORT INDHOLD */}
            <div style={{ padding: '20px', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', marginBottom: '5px' }}>
                {article.source}
              </div>
              
              <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, marginBottom: '10px' }}>
                {article.relevance_msg}
              </div>

              <h2 style={{ fontSize: '1.2rem', margin: '0 0 10px 0', lineHeight: 1.4, fontWeight: 700 }}>
                <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {article.title}
                </a>
              </h2>

              <div 
                style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '15px', flexGrow: 1 }}
                dangerouslySetInnerHTML={{ __html: article.summary_html }}
              />

              <button 
                onClick={() => setSelectedArticle(article)}
                style={{
                  background: 'none',
                  border: '1px solid #2563eb',
                  color: '#2563eb',
                  padding: '8px 15px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  width: '100%',
                  marginBottom: '15px'
                }}
              >
                📖 Læs hele artiklen
              </button>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                {article.tags.slice(0, 3).map((tag: string, i: number) => (
                  <span key={i} style={{ background: '#f3f4f6', color: '#4b5563', padding: '3px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div style={{ width: '100%', height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px' }}>
                <div style={{
                   height: '100%',
                   borderRadius: '2px',
                   width: `${Math.abs(article.sentiment_score) * 100}%`,
                   backgroundColor: article.sentiment_score > 0.1 ? '#10b981' : article.sentiment_score < -0.1 ? '#ef4444' : '#9ca3af',
                   marginLeft: article.sentiment_score > 0 ? '0' : 'auto',
                   marginRight: article.sentiment_score > 0 ? 'auto' : '0'
                }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL (POP-UP) */}
      {selectedArticle && (
        <div 
          onClick={() => setSelectedArticle(null)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              backgroundColor: 'white', width: '100%', maxWidth: '800px', maxHeight: '90vh',
              borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f9fafb' }}>
              <span style={{ fontWeight: 'bold', color: '#6b7280' }}>Læsevisning</span>
              <button onClick={() => setSelectedArticle(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: '30px', overflowY: 'auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '10px', fontWeight: 800 }}>{selectedArticle.title}</h2>
              <div style={{ color: '#6b7280', marginBottom: '20px', fontSize: '0.9rem' }}>
                Kilde: {selectedArticle.source} | <a href={selectedArticle.url} target="_blank" style={{ color: '#2563eb' }}>Gå til original</a>
              </div>
              <div dangerouslySetInnerHTML={{ __html: selectedArticle.full_content_html }} />
            </div>
          </div>
        </div>
      )}
      
      <style jsx global>{`
        mark { background-color: #fef3c7; color: #92400e; padding: 0 2px; border-radius: 2px; }
        img { max-width: 100%; height: auto; }
      `}</style>
    </main>
  );
}