"use client";
import { useState, useEffect } from 'react';

// --- KATEGORI LISTE ---
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
  
  // State til de gemte værdier (det der sendes til API)
  const [inputs, setInputs] = useState<{[key: number]: {cat: string, multi: string}}>({});
  
  // NYT: State til det man er "i gang med at skrive" i multi-feltet lige nu
  const [typingMulti, setTypingMulti] = useState<{[key: number]: string}>({});

  // State til Primary dropdown logik
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [primarySearch, setPrimarySearch] = useState<{[key: number]: string}>({});

  useEffect(() => {
    fetch('/api/findit')
      .then(res => res.json())
      .then(data => {
        if(data.success) setArticles(data.data);
        setLoading(false);
      });
  }, []);

  // --- LOGIK ---

  const isValidId = (id: string) => CATEGORIES.some(c => c.id === id);

  // Gem data til hoved-staten (inputs)
  const handleInputChange = (rowIndex: number, field: 'cat' | 'multi', value: string) => {
    setInputs(prev => ({
      ...prev,
      [rowIndex]: { 
          cat: field === 'cat' ? value : (prev[rowIndex]?.cat || ""),
          multi: field === 'multi' ? value : (prev[rowIndex]?.multi || "")
      }
    }));
  };

  // --- PRIMARY CATEGORY LOGIK ---
  const handlePrimarySearch = (rowIndex: number, value: string) => {
    setPrimarySearch(prev => ({ ...prev, [rowIndex]: value }));
  };

  const selectPrimary = (rowIndex: number, catId: string) => {
    handleInputChange(rowIndex, 'cat', catId);
    handlePrimarySearch(rowIndex, catId); 
    setActiveDropdown(null);
  };

  // --- MULTIPLE CATEGORY LOGIK ---
  
  // Tilføj et ID til listen af tags
  const addTag = (rowIndex: number, idToAdd: string) => {
      if (!isValidId(idToAdd)) {
          alert(`Ups: "${idToAdd}" findes ikke i kategorilisten.`);
          return false; // Returner false så vi ved det fejlede
      }

      const currentMulti = inputs[rowIndex]?.multi || "";
      const currentIds = currentMulti ? currentMulti.split(',').map(s => s.trim()).filter(Boolean) : [];
      
      if (!currentIds.includes(idToAdd)) {
          const newValue = [...currentIds, idToAdd].join(', ');
          handleInputChange(rowIndex, 'multi', newValue);
      }
      return true; // Succes
  };

  // Fjern et tag
  const removeTag = (rowIndex: number, idToRemove: string) => {
      const currentMulti = inputs[rowIndex]?.multi || "";
      const currentIds = currentMulti ? currentMulti.split(',').map(s => s.trim()) : [];
      const newValue = currentIds.filter(id => id !== idToRemove).join(', ');
      handleInputChange(rowIndex, 'multi', newValue);
  };

  // Håndter tastetryk i Multi-feltet (Enter, Komma, Backspace)
  const handleMultiKeyDown = (e: React.KeyboardEvent, rowIndex: number) => {
      const val = typingMulti[rowIndex]?.trim();

      // ENTER eller KOMMA -> Prøv at lave til tag
      if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          if (val) {
              const success = addTag(rowIndex, val);
              if (success) {
                  // Ryd kun skrivefeltet hvis det lykkedes at tilføje
                  setTypingMulti(prev => ({ ...prev, [rowIndex]: "" }));
              }
          }
      }
      // BACKSPACE -> Slet sidste tag hvis feltet er tomt
      else if (e.key === 'Backspace' && !val) {
          const currentMulti = inputs[rowIndex]?.multi || "";
          const currentIds = currentMulti ? currentMulti.split(',').map(s => s.trim()).filter(Boolean) : [];
          if (currentIds.length > 0) {
              removeTag(rowIndex, currentIds[currentIds.length - 1]);
          }
      }
  };

  const getFilteredCategories = (searchTerm: string) => {
      const lower = searchTerm.toLowerCase();
      return CATEGORIES.filter(c => 
          c.id.toLowerCase().includes(lower) || c.label.toLowerCase().includes(lower)
      );
  };

  const handleApprove = async (article: Article) => {
    const inputData = inputs[article.rowIndex];
    const cat = inputData?.cat;

    if (!cat) return alert("Du SKAL vælge en Primary Category");
    if (!isValidId(cat)) return alert(`Fejl: "${cat}" er ikke et gyldigt kategori-ID.`);

    // Tjek om der står noget tekst i multi-feltet, som brugeren glemte at trykke Enter på
    const pendingMulti = typingMulti[article.rowIndex]?.trim();
    if (pendingMulti) {
        if(!confirm(`Du har skrevet "${pendingMulti}" i multiple feltet uden at trykke Enter. Vil du gemme uden dette?`)) {
            return;
        }
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
        alert("Fejl ved gemning.");
    }
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
          {articles.map((article) => {
             const rowPrimary = inputs[article.rowIndex]?.cat || "";
             const rowMulti = inputs[article.rowIndex]?.multi || "";
             const selectedMultiIds = rowMulti ? rowMulti.split(',').map(s => s.trim()).filter(Boolean) : [];
             
             // Primary display logic
             const primaryDisplayValue = activeDropdown === article.rowIndex 
                ? (primarySearch[article.rowIndex] || "") 
                : (rowPrimary ? `${rowPrimary} - ${CATEGORIES.find(c=>c.id===rowPrimary)?.label || ''}` : "");

             return (
            <div key={article.id} className="card-item">
              
              {/* META INFO */}
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                  <span style={{fontSize: '0.8rem', fontWeight: 'bold', color: '#C01B2E', textTransform: 'uppercase'}}>{article.source}</span>
                  <span style={{fontSize: '0.8rem', color: '#6B7280'}}>{article.date}</span>
              </div>
              <h2 style={{marginTop: 0, color: '#1B264F', fontSize: '1.25rem'}}>
                  <a href={article.url} target="_blank" rel="noreferrer" style={{textDecoration: 'none', color: 'inherit'}}>{article.title} ↗</a>
              </h2>
              <p style={{color: '#4B5563', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px'}}>
                  {article.abstract.length > 300 ? article.abstract.substring(0, 300) + "..." : article.abstract}
              </p>

              {/* INPUT OMRÅDE */}
              <div className="input-area">
                
                {/* --- 1. PRIMARY CATEGORY (Dropdown) --- */}
                <div style={{flex: '1 1 300px', position: 'relative'}}>
                  <label className="input-label">PRIMARY CATEGORY</label>
                  <input 
                    type="text"
                    placeholder="Søg..."
                    className={`sheet-input ${rowPrimary && !isValidId(rowPrimary) ? 'invalid' : ''}`}
                    value={primaryDisplayValue}
                    onChange={(e) => {
                        handlePrimarySearch(article.rowIndex, e.target.value);
                        if (isValidId(e.target.value)) handleInputChange(article.rowIndex, 'cat', e.target.value);
                    }}
                    onFocus={() => {
                        setActiveDropdown(article.rowIndex);
                        handlePrimarySearch(article.rowIndex, "");
                    }}
                    onBlur={() => setTimeout(() => setActiveDropdown(null), 200)}
                  />
                  {activeDropdown === article.rowIndex && (
                      <div className="custom-dropdown">
                          {getFilteredCategories(primarySearch[article.rowIndex] || "").map(cat => (
                              <div key={cat.id} className="dropdown-item" onMouseDown={() => selectPrimary(article.rowIndex, cat.id)}>
                                  <span className="cat-id">{cat.id}</span>
                                  <span className="cat-label">{cat.label}</span>
                              </div>
                          ))}
                      </div>
                  )}
                </div>

                {/* --- 2. MULTIPLE CATEGORY (Tags + Input) --- */}
                <div style={{flex: '2 1 300px', position: 'relative'}}>
                  <label className="input-label">MULTIPLE CATEGORY (Skriv ID + Enter)</label>
                  
                  {/* Container der ser ud som ét input felt */}
                  <div className="multi-select-container" onClick={() => document.getElementById(`multi-input-${article.rowIndex}`)?.focus()}>
                    
                    {/* De valgte tags */}
                    {selectedMultiIds.map(id => (
                        <span key={id} className="tag-badge">
                            {id}
                            <button className="tag-remove" onClick={(e) => { e.stopPropagation(); removeTag(article.rowIndex, id); }}>×</button>
                        </span>
                    ))}
                    
                    {/* Det faktiske skrivefelt */}
                    <input 
                        id={`multi-input-${article.rowIndex}`}
                        type="text"
                        placeholder={selectedMultiIds.length === 0 ? "Fx: 14" : ""}
                        className="multi-input-ghost"
                        value={typingMulti[article.rowIndex] || ""}
                        onChange={(e) => setTypingMulti(prev => ({...prev, [article.rowIndex]: e.target.value}))}
                        onKeyDown={(e) => handleMultiKeyDown(e, article.rowIndex)}
                        // VIGTIGT: Ingen onBlur der sletter teksten!
                    />
                  </div>
                </div>

                <button onClick={() => handleApprove(article)} className="save-btn">Gem</button>

              </div>
            </div>
          );})}
        </div>
        
        {articles.length === 0 && (
            <div style={{textAlign: 'center', color: '#6B7280', marginTop: '40px', padding: '40px'}}>
              <h3>Alt er ryddet! 🎉</h3>
              <p>Ingen artikler i arket mangler kategori.</p>
            </div>
        )}
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
        .input-area { background: #F3F4F6; padding: 20px; border-radius: 8px; margin-top: 20px; display: flex; gap: 15px; align-items: flex-start; flex-wrap: wrap; }
        .input-label { display: block; font-size: 0.7rem; font-weight: bold; color: #4B5563; margin-bottom: 6px; }
        
        .sheet-input { width: 100%; padding: 10px; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.9rem; box-sizing: border-box; background: white; height: 42px; }
        .sheet-input.invalid { border-color: #EF4444; background-color: #FEF2F2; }

        /* Multi Select Tags Container */
        .multi-select-container {
            background: white;
            border: 1px solid #D1D5DB;
            border-radius: 6px;
            padding: 4px 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            min-height: 42px;
            align-items: center;
            cursor: text;
        }
        .multi-select-container:focus-within { border-color: #1B264F; outline: 1px solid #1B264F; }

        .tag-badge {
            background: #E0E7FF;
            color: #1B264F;
            font-size: 0.85rem;
            padding: 3px 8px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
        }

        .tag-remove {
            background: none;
            border: none;
            color: #6B7280;
            cursor: pointer;
            font-size: 1.1rem;
            line-height: 1;
            padding: 0;
            display: flex;
            align-items: center;
        }
        .tag-remove:hover { color: #EF4444; }

        .multi-input-ghost {
            border: none;
            outline: none;
            font-size: 0.9rem;
            flex-grow: 1;
            min-width: 60px;
            padding: 4px 0;
            background: transparent;
            color: #111827;
        }

        .save-btn { background: #10B981; color: white; border: none; padding: 0 24px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; flex: 0 0 auto; height: 42px; }
        .save-btn:hover { background: #059669; }

        .custom-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #D1D5DB; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); max-height: 250px; overflow-y: auto; z-index: 50; margin-top: 4px; }
        .dropdown-item { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; gap: 10px; font-size: 0.9rem; }
        .dropdown-item:hover { background-color: #EEF2FF; }
        .cat-id { background: #E0E7FF; color: #1B264F; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; min-width: 30px; text-align: center; }
      `}</style>
    </div>
  );
}