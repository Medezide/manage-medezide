"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { fetchAndSaveTenders, translateText } from '@/app/tender-actions';
import { MONITORED_CPV_CODES, CPV_MAPPING } from '@/lib/tenderUtils';

// --- DATA TYPES ---
interface Tender {
  id?: string;
  NoticeID: string;
  Title: string;
  Description: string;
  BuyerName: string;
  BuyerCountry: string;
  EstimatedValue: string;
  TenderStatus: string;
  TenderApplicationDate: string;
  ExternalURI: string;
  CPV: string;
  CPV_Description: string;
  MatchedTrigger?: string;
  internal_note?: string; // Renamed from assigned_categories
  translated_description?: string; 
}

export default function BusinessOpportunityPage() {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  // Input state: Key = Tender ID, Value = Note text
  const [noteInputs, setNoteInputs] = useState<{[key: string]: string}>({}); 

  const [showFetchModal, setShowFetchModal] = useState(false);
  const [showCpvModal, setShowCpvModal] = useState(false);
  const [isFetchingAPI, setIsFetchingAPI] = useState(false);
  
  // Search State
  const [searchConfig, setSearchConfig] = useState({ 
    query: '', 
    cpvCode: '', 
    noticeId: '', // New field
    daysBack: 3,
    limit: 10
  });

  // Translation State
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const openModal = (tender: Tender) => {
      if (tender.translated_description) {
          setTranslatedDesc(tender.translated_description);
      } else {
          setTranslatedDesc(null);
      }
      setSelectedTender(tender);
  };

  // --- 1. LOAD FROM FIREBASE ---
  const fetchDbTenders = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "tender-unresolved"));
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Tender[];
      setTenders(items);
    } catch (error) {
      console.error("Error loading tenders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbTenders();
  }, []);

  // --- 2. API ACTION ---
  const handleApiFetch = async () => {
    setIsFetchingAPI(true);
    try {
      // @ts-ignore - Ignore type check temporarily during update
      const result = await fetchAndSaveTenders(searchConfig);
      
      if(result.success) {
        alert(
            `✅ Success!\n\n` +
            `Hentet: ${result.count} nye\n` +
            `Dubletter ignoreret: ${result.duplicates}\n` +
            `Total fundet på TED: ${result.totalFound}\n` 
        );
        setShowFetchModal(false);
        fetchDbTenders(); 
      } else {
        alert("Fejl: " + result.message);
      }
    } catch (e) {
      console.error(e);
      alert("Systemfejl ved API kald");
    } finally {
      setIsFetchingAPI(false);
    }
  };

  // --- 3. WORKFLOW ACTIONS ---
  const handleInputChange = (id: string, value: string) => {
    setNoteInputs(prev => ({ ...prev, [id]: value }));
  };

  // NEW: Discard Logic (Moves to tender-discarded)
  const handleDiscard = async (item: Tender) => {
    if (!confirm(`Vil du arkivere ${item.NoticeID} som ikke-relevant?`)) return;
    
    const note = noteInputs[item.id!] || "";

    try {
        const batch = writeBatch(db);
        const newRef = doc(db, "tender-discarded", item.id!); // New collection
        const originalRef = doc(db, "tender-unresolved", item.id!);

        batch.set(newRef, { 
            ...item, 
            internal_note: note, // Save the note (why it was discarded)
            discarded_at: new Date().toISOString() 
        });
        batch.delete(originalRef);
        
        await batch.commit();
        setTenders(prev => prev.filter(t => t.id !== item.id));
        
        // Clean up input
        const newInputs = {...noteInputs};
        delete newInputs[item.id!];
        setNoteInputs(newInputs);

    } catch (e) { 
        console.error(e);
        alert("Kunne ikke arkivere."); 
    }
  };

  // Approve Logic (Moves to tender-resolved)
  const handleResolve = async (item: Tender) => {
    // Note is now optional for approval, but we still save it if present
    const note = noteInputs[item.id!] || "";
    
    try {
        const batch = writeBatch(db);
        const newRef = doc(db, "tender-resolved", item.id!);
        const originalRef = doc(db, "tender-unresolved", item.id!);

        batch.set(newRef, { 
            ...item, 
            internal_note: note, 
            resolved_at: new Date().toISOString() 
        });
        batch.delete(originalRef);
        
        await batch.commit();
        setTenders(prev => prev.filter(t => t.id !== item.id));
        
        const newInputs = {...noteInputs};
        delete newInputs[item.id!];
        setNoteInputs(newInputs);

    } catch (error) {
        console.error("Fejl:", error);
        alert("Kunne ikke flytte tender.");
    }
  };

  const isDateCritical = (dateStr: string) => {
      if(!dateStr || dateStr === 'N/A') return false;
      const days = (new Date(dateStr).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return days < 7 && days > 0;
  };

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}>Indlæser Tenders...</div>;

  return (
    <main className="page-wrapper">
      {/* HEADER */}
      <div className="header-bg">
          <header className="header-content">
            <div className="header-top">
                <a href="/" className="back-link">← Tilbage</a>
                <span className="brand-tag">TENDER INTELLIGENCE</span>
            </div>
            <div className="flex justify-between items-end">
                <div className="text-left">
                    <h1>Udbudsovervågning</h1>
                    <p>EU Funding & Tenders Pipeline</p>
                    <button 
                onClick={() => setShowCpvModal(true)}
                className="text-xs font-bold text-blue-200 bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition-colors"
            >
                ℹ️ Se aktive koder
            </button>
                </div>
                <button 
                    onClick={() => setShowFetchModal(true)}
                    className="bg-white text-[#1B264F] px-6 py-3 rounded font-bold hover:bg-gray-100 transition-colors shadow-lg"
                >
                    + Hent nye udbud
                </button>
            </div>
          </header>
      </div>

      {/* LIST CONTAINER */}
      <div className="main-container">
        <div className="list-wrapper">
            {tenders.map((tender) => (
            <article key={tender.id} className="list-item">
                
                <div className="item-left">
                    <div className={`status-badge ${tender.TenderStatus === 'Open' ? 'open' : 'closed'}`}>
                        {tender.TenderStatus}
                    </div>
                    <div className="date-block">
                        <span className="label">Deadline</span>
                        <span className={`date-val ${isDateCritical(tender.TenderApplicationDate) ? 'text-red-600 font-bold' : ''}`}>
                            {tender.TenderApplicationDate}
                        </span>
                    </div>
                    <a href={tender.ExternalURI} target="_blank" className="btn-ted-link">TED ↗</a>
                </div>

                <div className="item-main">
                    <h2 className="item-title" onClick={() => openModal(tender)}>
                        {tender.Title}
                    </h2>
                    <div className="tags-row">
                        {tender.MatchedTrigger && (
                            <span className="tag-found-via">
                                🔍 Monitored CPV: {tender.MatchedTrigger}
                            </span>
                        )}
                        <span className="tag-cpv" title={tender.CPV_Description}>
                           🏷️ CPV: {tender.CPV_Description}
                        </span>
                    </div>
                    <div className="buyer-row">
                        <span className="buyer-name">🏢 {tender.BuyerName}</span>
                        <span className="country-tag">🌍 {tender.BuyerCountry}</span>
                    </div>
                    <p className="item-desc">
                        {tender.Description?.substring(0, 180)}...
                        <span className="read-more" onClick={() => openModal(tender)}>Læs mere</span>
                    </p>
                </div>

                <div className="item-right">
                    <div className="value-display">
                        {tender.EstimatedValue !== 'N/A' && tender.EstimatedValue}
                    </div>

                    <div className="workflow-box">
                        <input 
                            type="text" 
                            className="workflow-input"
                            placeholder="Note (Valgfri)..."
                            value={noteInputs[tender.id!] || ""}
                            onChange={(e) => handleInputChange(tender.id!, e.target.value)}
                        />
                        <div className="workflow-buttons">
                            {/* Discard Button */}
                            <button onClick={() => handleDiscard(tender)} className="btn-del" title="Arkivér som irrelevant">
                                🗑
                            </button>
                            {/* Approve Button */}
                            <button 
                                onClick={() => handleResolve(tender)} 
                                className="btn-approve"
                            >
                                ✓ Godkend
                            </button>
                        </div>
                    </div>
                </div>

            </article>
            ))}
        </div>
      </div>

      {/* MODAL: SEARCH CONFIG */}
      {showFetchModal && (
        <div className="modal-overlay" onClick={() => !isFetchingAPI && setShowFetchModal(false)}>
            <div className="modal-content" style={{maxWidth: '500px', overflow: 'visible'}} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="text-xl font-bold text-[#1B264F]">Konfigurer Søgning</h3>
                    {!isFetchingAPI && <button className="btn-close" onClick={() => setShowFetchModal(false)}>Luk</button>}
                </div>
                <div className="p-6">
                    
                    {/* NOTICE ID SEARCH */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded">
                        <label className="block text-sm font-bold text-blue-900 mb-2">Søg på specifikt ID</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border border-blue-200 rounded text-sm"
                            placeholder="Fx. 42229-2026 (Overskriver andre filtre)"
                            value={searchConfig.noticeId}
                            onChange={(e) => setSearchConfig({...searchConfig, noticeId: e.target.value})}
                        />
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Søgeord (Fritekst)</label>
                        <input type="text" className="w-full p-2 border rounded" placeholder="Antimicrobial..." 
                            value={searchConfig.query} onChange={(e) => setSearchConfig({...searchConfig, query: e.target.value})} 
                            disabled={!!searchConfig.noticeId}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Periode</label>
                            <select 
                                className="w-full p-2 border rounded bg-white" 
                                value={searchConfig.daysBack} 
                                onChange={(e) => setSearchConfig({...searchConfig, daysBack: parseInt(e.target.value)})}
                                disabled={!!searchConfig.noticeId}
                            >
                                <option value={1}>I dag</option>
                                <option value={3}>3 dage</option>
                                <option value={7}>1 uge</option>
                                <option value={14}>2 uger</option>
                                <option value={-1}>Altid (Ingen dato)</option> {/* NEW */}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Max Antal</label>
                            <input type="number" className="w-full p-2 border rounded" value={searchConfig.limit} onChange={(e) => setSearchConfig({...searchConfig, limit: parseInt(e.target.value)})} />
                        </div>
                    </div>
                    <button onClick={handleApiFetch} disabled={isFetchingAPI} className="w-full bg-[#1B264F] text-white py-3 rounded font-bold hover:bg-[#2a386f] disabled:bg-gray-400 flex justify-center items-center gap-2">
                        {isFetchingAPI ? <span>Henter data... ⏳</span> : "Kør Søgning"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: CPV CODES LIST */}
      {showCpvModal && (
        <div className="modal-overlay" onClick={() => setShowCpvModal(false)}>
            <div className="modal-content" style={{maxWidth: '600px', maxHeight: '80vh'}} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="text-xl font-bold text-[#1B264F]">Overvågede CPV Koder</h3>
                    <button className="btn-close" onClick={() => setShowCpvModal(false)}>Luk</button>
                </div>
                <div className="modal-scroll-area p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 top-0">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b">Kode</th>
                                <th className="p-4 text-xs font-bold text-gray-500 uppercase border-b">Beskrivelse</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MONITORED_CPV_CODES.map((code, index) => (
                                <tr key={code} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                    <td className="p-3 border-b font-mono text-sm font-bold text-blue-800">
                                        {code}
                                    </td>
                                    <td className="p-3 border-b text-sm text-gray-700">
                                        {CPV_MAPPING[code] || <span className="text-gray-400 italic">Ingen beskrivelse</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="p-4 bg-yellow-50 text-xs text-yellow-800 border-t border-yellow-100">
                        <strong>Note:</strong> Disse koder bruges til både at filtrere søgninger på TED API'et og til at generere "Matched Trigger" badges på listen.
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: DETAIL WITH TRANSLATION */}
      {selectedTender && (
        <div className="modal-overlay" onClick={() => setSelectedTender(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-meta">
                <span className="modal-source">NOTICE: {selectedTender.NoticeID}</span>
                <span className="modal-date">Deadline: {selectedTender.TenderApplicationDate}</span>
              </div>
              <button className="btn-close" onClick={() => setSelectedTender(null)}>Luk</button>
            </div>
            
            <div className="modal-scroll-area">
              <div className="flex justify-between items-start gap-4 mb-4">
                  <h2 className="modal-title flex-1">{selectedTender.Title}</h2>
                  <button 
                    onClick={async () => {
                        if (translatedDesc) {
                            setTranslatedDesc(null);
                        } else {
                            if (selectedTender.translated_description) {
                                setTranslatedDesc(selectedTender.translated_description);
                            } else {
                                setIsTranslating(true);
                                const res = await translateText(selectedTender.Description, selectedTender.NoticeID);
                                setIsTranslating(false);
                                if (res.success && res.text) {
                                    setTranslatedDesc(res.text);
                                    setTenders(prev => prev.map(t => 
                                        t.NoticeID === selectedTender.NoticeID 
                                        ? { ...t, translated_description: res.text } 
                                        : t
                                    ));
                                    setSelectedTender(prev => prev ? ({ ...prev, translated_description: res.text }) : null);
                                } else {
                                    alert("Oversættelse fejlede: " + res.text);
                                }
                            }
                        }
                    }}
                    className={`
                        px-4 py-2 rounded font-bold text-sm transition-colors flex items-center gap-2
                        ${translatedDesc ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                    `}
                  >
                    {isTranslating ? <span>Oversætter... ⏳</span> : translatedDesc ? <><span>↺ Vis Original</span></> : <><span>A→Z</span> <span>Oversæt til Engelsk</span></>}
                  </button>
              </div>
              <a href={selectedTender.ExternalURI} target="_blank" className="original-link">Åbn på TED Portal →</a>
              <div className="article-prose">
                  {translatedDesc ? (
                      <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 animate-in fade-in">
                          <p className="text-xs font-bold text-blue-500 uppercase mb-2">Oversat fra originalt sprog</p>
                          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{translatedDesc}</p>
                      </div>
                  ) : (
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedTender.Description}</p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        :root { --brand-navy: #1B264F; --brand-red: #C01B2E; --bg-page: #F3F4F6; --text-main: #111827; --text-muted: #6B7280; }
        button { cursor: pointer; }
        body { margin: 0; font-family: 'Inter', sans-serif; background-color: var(--bg-page); color: var(--text-main); }
        .page-wrapper { min-height: 100vh; display: flex; flex-direction: column; }
        .header-bg { background-color: var(--brand-navy); color: white; padding: 40px 20px 60px 20px; }
        .header-content { max-width: 1400px; margin: 0 auto; width: 100%; }
        .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .back-link { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 0.9rem; font-weight: 500; }
        .brand-tag { background: rgba(255,255,255,0.1); color: white; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 4px; }
        h1 { font-size: 2.5rem; font-weight: 700; margin: 0; }
        .main-container { max-width: 1400px; margin: -40px auto 0 auto; padding: 0 0 40px 0; width: 100%; box-sizing: border-box; }
        .list-wrapper { display: flex; flex-direction: column; gap: 16px; }
        .list-item { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; flex-direction: row; overflow: hidden; border: 1px solid #E5E7EB; }
        .item-left { width: 140px; background: #F9FAFB; border-right: 1px solid #E5E7EB; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 16px; flex-shrink: 0; text-align: center; }
        .status-badge { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; padding: 4px 8px; border-radius: 4px; margin-bottom: 10px; }
        .status-badge.open { background: #D1FAE5; color: #065F46; }
        .status-badge.closed { background: #FEE2E2; color: #991B1B; }
        .date-block { display: flex; flex-direction: column; margin-bottom: 12px; }
        .date-block .label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
        .date-block .date-val { font-size: 0.9rem; font-weight: 500; color: var(--text-main); }
        .btn-ted-link { font-size: 0.75rem; font-weight: 700; color: #2563EB; text-decoration: none; border: 1px solid #BFDBFE; background: #EFF6FF; padding: 4px 12px; border-radius: 4px; transition: all 0.2s; }
        .btn-ted-link:hover { background: #DBEAFE; border-color: #3B82F6; }
        .item-main { flex-grow: 1; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
        .tags-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; align-items: center; }
        .tag-found-via { background: #E0F2FE; color: #075985; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
        .tag-cpv { background: #F3F4F6; color: #374151; font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; border: 1px solid #E5E7EB; }
        .item-title { font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); margin: 0; cursor: pointer; }
        .item-title:hover { text-decoration: underline; }
        .buyer-row { font-size: 0.85rem; color: #4B5563; font-weight: 500; display: flex; align-items: center; gap: 12px; }
        .country-tag { font-weight: 600; color: var(--text-main); background: #F3F4F6; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;}
        .item-desc { font-size: 0.9rem; color: var(--text-muted); margin: 0; line-height: 1.5; }
        .read-more { color: var(--brand-navy); font-size: 0.8rem; font-weight: 600; cursor: pointer; margin-left: 8px; }
        .item-right { width: 280px; background: white; border-left: 1px solid #E5E7EB; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; flex-shrink: 0; }
        .value-display { font-size: 1.1rem; font-weight: 700; color: var(--brand-red); text-align: right; margin-bottom: 10px; }
        .workflow-box { display: flex; flex-direction: column; gap: 8px; }
        .workflow-input { width: 100%; padding: 8px; font-size: 0.85rem; border: 1px solid #D1D5DB; border-radius: 4px; }
        .workflow-buttons { display: flex; gap: 8px; }
        .btn-del { width: 36px; background: #FEF2F2; color: #EF4444; border: 1px solid #FCA5A5; border-radius: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .btn-approve { flex: 1; background: #10B981; color: white; border: none; border-radius: 4px; font-weight: 600; font-size: 0.85rem; padding: 8px; cursor: pointer; }
        .btn-approve:disabled { background: #D1D5DB; cursor: not-allowed; }
        .modal-meta { display: flex; flex-direction: row; gap: 25px; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center; }
        .modal-content { background: white; width: 90%; max-width: 800px; max-height: 90vh; border-radius: 8px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        .modal-header { padding: 20px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between;}
        .modal-scroll-area { padding: 30px; overflow-y: auto; }
        .article-prose { font-size: 1rem; line-height: 1.6; color: #374151; }
        .original-link { display: inline-block; color: var(--brand-red); margin-bottom: 30px; text-decoration: none; font-weight: 600; }
      `}</style>
    </main>
  );
}