"use client";
import { useState, useEffect, useRef } from 'react';

// --- KONFIGURATION AF KATEGORIER ---
const CATEGORIES = [
  { id: "14", label: "Antibiotics" },
  { id: "29", label: "Antimicrobial Stewardship & Patient Safety" },
  { id: "26", label: "-- Existing (Antibiotics)" },
  { id: "25", label: "-- Novel (Antibiotics)" },
  { id: "15", label: "Alternative remedies" },
  { id: "16", label: "Behavioral Intervention" },
  { id: "28", label: "-- Cultural corner" },
  { id: "17", label: "Cleaning, Disinfection & Hygiene" },
  { id: "18", label: "Construction & facilities" },
  { id: "19", label: "Devices & Materials" },
  { id: "20", label: "Diagnostics" },
  { id: "21", label: "Food & farming (One Health)" },
  { id: "22", label: "eSolutions, mHealth & HealthIT" },
  { id: "23", label: "Antimicrobial insights" },
  { id: "30", label: "Solutions" },
  { id: "36", label: "People and Positions" },
  { id: "36a", label: "-- Academia & R&D" },
  { id: "36b", label: "-- Industry & Business" },
  { id: "36c", label: "-- Clinical & Healthcare" },
  { id: "41", label: "Funds & Grants" },
  { id: "42", label: "Matchmaking & Partnering" },
  { id: "43", label: "Resources, Links & Learnings" },
  { id: "44", label: "Innovation & Entrepreneurship" },
  { id: "40", label: "Events & Conferences" },
];

interface Article {
  rowIndex: number;
  id: string;
  title: string;
  abstract: string;
  url: string;
  date: string;
  source: string;
}

export default function FindItPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [inputs, setInputs] = useState<{[key: number]: {cat: string, multi: string}}>({});
  
  // State til at styre hvilken række der har dropdown åben
  const [focusedRow, setFocusedRow] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/findit')
      .then(res => res.json())
      .then(data => {
        if(data.success) setArticles(data.data);
        setLoading(false);
      });
  }, []);

  const handleInputChange = (rowIndex: number, field: 'cat' | 'multi', value: string) => {
    setInputs(prev => ({
      ...prev,
      [rowIndex]: { 
          cat: field === 'cat' ? value : (prev[rowIndex]?.cat || ""),
          multi: field === 'multi' ? value : (prev[rowIndex]?.multi || "")
      }
    }));
  };

  const selectCategory = (rowIndex: number, catId: string) => {
    handleInputChange(rowIndex, 'cat', catId);
    setFocusedRow(null); // Luk dropdown efter valg
  };

  const handleApprove = async (article: Article) => {
    const inputData = inputs[article.rowIndex];
    
    if (!inputData?.cat) {
        alert("Du SKAL indtaste en Primary Category");
        return;
    }

    setArticles(prev => prev.filter(a => a.rowIndex !== article.rowIndex));

    try {
        await fetch('/api/findit', {
            method: 'POST',
            body: JSON.stringify({
                rowIndex: article.rowIndex,
                primaryCategory: inputData.cat,
                multipleCategory: inputData.multi
            })
        });
    } catch (error) {
        alert("Der skete en fejl. Prøv at opdatere siden.");
    }
  };

  // Hjælpefunktion til at filtrere listen baseret på hvad man skriver
  const getFilteredCategories = (searchTerm: string) => {
      if (!searchTerm) return CATEGORIES;
      const lower = searchTerm.toLowerCase();
      return CATEGORIES.filter(c => 
          c.id.toLowerCase().includes(lower) || 
          c.label.toLowerCase().includes(lower)
      );
  };

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}>Henter artikler fra FindIt...</div>;

  return (
    <div className="page-wrapper">
      
      <div className="header-bg">
          <div className="header-content">
            <div className="header-top">
                <a href="/" className="back-link">← Tilbage til forsiden</a>
                <span className="brand-tag">FINDIT MANAGER</span>
            </div>
            <h1>FindIt Manager</h1>
            <p>Artikler fra Google Sheets der mangler kategori</p>
          </div>
      </div>
      
      <div className="main-container">
        <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
          {articles.map((article) => (
            <div key={article.id} className="card-item">
              
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                  <span style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#C01B2E', textTransform: 'uppercase'}}>
                      {article.source}
                  </span>
                  <span style={{fontSize: '0.8rem', color: '#6B7280'}}>
                      {article.date}
                  </span>
              </div>

              <h2 style={{marginTop: 0, color: '#1B264F', fontSize: '1.25rem'}}>
                  <a href={article.url} target="_blank" rel="noreferrer" style={{textDecoration: 'none', color: 'inherit'}}>
                      {article.title} ↗
                  </a>
              </h2>

              <p style={{color: '#4B5563', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px'}}>
                  {article.abstract.length > 300 ? article.abstract.substring(0, 300) + "..." : article.abstract}
              </p>

              <div className="input-area">
                
                {/* --- PRIMARY CATEGORY MED CUSTOM DROPDOWN --- */}
                <div style={{flex: '1 1 300px', position: 'relative'}}>
                  <label className="input-label">
                      PRIMARY CATEGORY
                  </label>
                  
                  <input 
                    type="text"
                    placeholder="Søg eller skriv ID..."
                    className="sheet-input"
                    onChange={(e) => handleInputChange(article.rowIndex, 'cat', e.target.value)}
                    onFocus={() => setFocusedRow(article.rowIndex)}
                    // Lille forsinkelse på blur, så man kan nå at klikke på listen
                    onBlur={() => setTimeout(() => setFocusedRow(null), 200)}
                    value={inputs[article.rowIndex]?.cat || ""}
                    autoComplete="off"
                  />

                  {/* Viser kun dropdown hvis denne række er i fokus */}
                  {focusedRow === article.rowIndex && (
                      <div className="custom-dropdown">
                          {getFilteredCategories(inputs[article.rowIndex]?.cat || "").map(cat => (
                              <div 
                                key={cat.id} 
                                className="dropdown-item"
                                // onMouseDown kører før onBlur, så vi er sikre på valget registreres
                                onMouseDown={() => selectCategory(article.rowIndex, cat.id)}
                              >
                                  <span className="cat-id">{cat.id}</span>
                                  <span className="cat-label">{cat.label}</span>
                              </div>
                          ))}
                          {getFilteredCategories(inputs[article.rowIndex]?.cat || "").length === 0 && (
                              <div className="dropdown-empty">Ingen match fundet</div>
                          )}
                      </div>
                  )}
                </div>
                {/* ------------------------------------------- */}

                <div style={{flex: '2 1 300px'}}>
                  <label className="input-label">
                      MULTIPLE CATEGORY (Fx: 15, 21)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Skriv ID'er adskilt af komma..."
                    className="sheet-input"
                    onChange={(e) => handleInputChange(article.rowIndex, 'multi', e.target.value)}
                    value={inputs[article.rowIndex]?.multi || ""}
                  />
                </div>

                <button 
                  onClick={() => handleApprove(article)}
                  className="save-btn"
                >
                  Gem
                </button>

              </div>
            </div>
          ))}
        
          {articles.length === 0 && (
            <div style={{textAlign: 'center', color: '#6B7280', marginTop: '40px', padding: '40px'}}>
              <h3>Alt er ryddet! 🎉</h3>
              <p>Ingen artikler i arket mangler kategori.</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-wrapper { min-height: 100vh; background-color: #F8F9FA; font-family: 'Inter', sans-serif; }
        .header-bg { background-color: #1B264F; color: white; padding: 40px 20px 60px 20px; text-align: center; }
        .header-content { max-width: 1000px; margin: 0 auto; }
        .header-top { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: center; }
        .back-link { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 0.9rem; }
        .brand-tag { background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; }
        h1 { margin: 0; font-size: 2.5rem; font-weight: 700; }
        .main-container { max-width: 1000px; margin: -40px auto 40px auto; padding: 0 20px; }
        
        .card-item { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #E5E7EB; }
        .input-area { background: #F3F4F6; padding: 20px; border-radius: 8px; margin-top: 20px; display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap; }
        .input-label { display: block; font-size: 0.7rem; font-weight: bold; color: #4B5563; margin-bottom: 6px; }
        .sheet-input { width: 100%; padding: 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; }
        .save-btn { background: #10B981; color: white; border: none; padding: 11px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; flex: 0 0 auto; }
        .save-btn:hover { background: #059669; }

        /* --- NY CSS TIL CUSTOM DROPDOWN --- */
        .custom-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #D1D5DB;
            border-radius: 6px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            max-height: 250px;
            overflow-y: auto;
            z-index: 50;
            margin-top: 4px;
        }

        .dropdown-item {
            padding: 10px 15px;
            cursor: pointer;
            border-bottom: 1px solid #f3f4f6;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
            transition: background 0.1s;
        }

        .dropdown-item:hover {
            background-color: #EEF2FF;
        }

        .dropdown-item:last-child {
            border-bottom: none;
        }

        .cat-id {
            background: #E0E7FF;
            color: #1B264F;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8rem;
            min-width: 30px;
            text-align: center;
        }

        .cat-label {
            color: #374151;
        }
        
        .dropdown-empty {
            padding: 15px;
            color: #9CA3AF;
            text-align: center;
            font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}