"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
  doc,
} from "firebase/firestore";
// We import the server action from the new isolated file
import { fetchAndSaveTenders } from "@/app/tender-actions";

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
  assigned_categories?: string;
}

export default function BusinessOpportunityPage() {
  // --- STATE ---
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection & Inputs
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [categoryInputs, setCategoryInputs] = useState<{
    [key: string]: string;
  }>({});

  // Modal & API State
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [isFetchingAPI, setIsFetchingAPI] = useState(false);
  const [searchConfig, setSearchConfig] = useState({
    query: "", // Removed default text to allow broad search
    daysBack: 3,
    limit: 5,
  });

  // --- 1. LOAD FROM FIREBASE ---
  const fetchDbTenders = async () => {
    setLoading(true);
    try {
      // Fetch from the new collection "tender-unresolved"
      const querySnapshot = await getDocs(collection(db, "tender-unresolved"));
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
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

  // --- 2. HANDLE API ACTION ---
  const handleApiFetch = async () => {
    setIsFetchingAPI(true);
    try {
      // Call the Server Action
      const result = await fetchAndSaveTenders(searchConfig);

      if (result.success) {
        alert(result.message);
        setShowFetchModal(false);
        fetchDbTenders(); // Refresh list to show new items
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
    setCategoryInputs((prev) => ({ ...prev, [id]: value }));
  };

  const handleDelete = async (item: Tender) => {
    if (!confirm(`Slet tender ${item.NoticeID} permanent?`)) return;
    try {
      await deleteDoc(doc(db, "tender-unresolved", item.id!));
      setTenders((prev) => prev.filter((t) => t.id !== item.id));
    } catch (e) {
      alert("Kunne ikke slette.");
    }
  };

  const handleResolve = async (item: Tender) => {
    const input = categoryInputs[item.id!] || "";
    if (!input.trim()) {
      alert("Indtast venligst en kategori eller note før godkendelse.");
      return;
    }

    try {
      const batch = writeBatch(db);
      const newRef = doc(db, "tender-resolved", item.id!);
      const originalRef = doc(db, "tender-unresolved", item.id!);

      batch.set(newRef, {
        ...item,
        assigned_categories: input,
        resolved_at: new Date().toISOString(),
      });
      batch.delete(originalRef);

      await batch.commit();
      setTenders((prev) => prev.filter((t) => t.id !== item.id));

      // Clear input state
      const newInputs = { ...categoryInputs };
      delete newInputs[item.id!];
      setCategoryInputs(newInputs);
    } catch (error) {
      console.error("Fejl ved godkendelse:", error);
      alert("Kunne ikke flytte tender.");
    }
  };

  if (loading)
    return (
      <div style={{ padding: 50, textAlign: "center" }}>
        Indlæser Tenders...
      </div>
    );

  return (
    <main className="page-wrapper">
      {/* --- HEADER --- */}
      <div className="header-bg">
        <header className="header-content">
          <div className="header-top">
            <a href="/" className="back-link">
              ← Tilbage
            </a>
            <span className="brand-tag">TENDER INTELLIGENCE</span>
          </div>
          <h1>Udbudsovervågning</h1>
          <p>EU Funding & Tenders Pipeline</p>

          <button
            onClick={() => setShowFetchModal(true)}
            className="mt-6 bg-white text-[#1B264F] px-6 py-3 rounded font-bold hover:bg-gray-100 transition-colors shadow-lg"
          >
            + Hent nye udbud
          </button>
        </header>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="main-container">
        <div className="grid">
          {tenders.map((tender) => (
            <article key={tender.id} className="card">
              {/* Visual Header (Mocking an image with CPV data) */}
              <div
                className="card-image-wrapper flex flex-col items-center justify-center bg-gray-100 text-[#1B264F] relative"
                onClick={() => setSelectedTender(tender)}
                style={{ cursor: "pointer", height: "200px" }}
              >
                <div className="text-center p-4">
                  <div className="text-4xl font-bold mb-2">
                    {tender.BuyerCountry}
                  </div>
                  <div className="text-xs font-mono bg-white px-2 py-1 rounded inline-block shadow-sm">
                    {tender.CPV}
                  </div>
                </div>
                <div
                  className="card-source-badge"
                  style={{
                    backgroundColor:
                      tender.TenderStatus === "Open" ? "#10B981" : "#EF4444",
                    color: "white",
                  }}
                >
                  {tender.TenderStatus}
                </div>
              </div>

              <div className="card-body">
                <div className="meta-row">
                  <span className="date">
                    Deadline: {tender.TenderApplicationDate}
                  </span>
                  <span className="font-bold text-[#C41D26]">
                    {tender.EstimatedValue}
                  </span>
                </div>

                <h2 className="card-title">
                  <span
                    onClick={() => setSelectedTender(tender)}
                    style={{ cursor: "pointer" }}
                  >
                    {tender.Title}
                  </span>
                </h2>

                <p className="text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">
                  {tender.BuyerName}
                </p>
                <p className="card-summary">
                  {tender.Description?.substring(0, 150)}...
                </p>

                {/* Workflow Area */}
                <div className="workflow-area">
                  <label className="input-label">Action Note:</label>
                  <input
                    type="text"
                    className="category-input"
                    placeholder="Internt notat / Kategori..."
                    value={categoryInputs[tender.id!] || ""}
                    onChange={(e) =>
                      handleInputChange(tender.id!, e.target.value)
                    }
                  />
                  <div className="button-row">
                    <button
                      onClick={() => handleDelete(tender)}
                      className="btn-icon delete"
                      title="Slet"
                    >
                      🗑
                    </button>
                    <button
                      onClick={() => handleResolve(tender)}
                      className="btn-action resolve"
                      disabled={!(categoryInputs[tender.id!] || "").trim()}
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

      {/* --- SEARCH CONFIG MODAL --- */}
      {showFetchModal && (
        <div
          className="modal-overlay"
          onClick={() => !isFetchingAPI && setShowFetchModal(false)}
        >
          <div
            className="modal-content"
            style={{ maxWidth: "500px", overflow: "visible" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="text-xl font-bold text-[#1B264F]">
                Konfigurer Udbudssøgning
              </h3>
              {!isFetchingAPI && (
                <button
                  className="btn-close"
                  onClick={() => setShowFetchModal(false)}
                >
                  Luk
                </button>
              )}
            </div>
            <div className="p-6">

              {/* Input: Fritekst */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Søgeord (Fritekst)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded"
                  value={searchConfig.query}
                  onChange={(e) =>
                    setSearchConfig({ ...searchConfig, query: e.target.value })
                  }
                />
              </div>

              {/* Input: Range of days */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Hvor langt tilbage?
                </label>
                <select
                  className="w-full p-2 border rounded bg-white"
                  value={searchConfig.daysBack}
                  onChange={(e) =>
                    setSearchConfig({
                      ...searchConfig,
                      daysBack: parseInt(e.target.value),
                    })
                  }
                >
                  <option value={1}>I dag (1 dag)</option>
                  <option value={3}>Sidste 3 dage</option>
                  <option value={5}>Sidste 5 dage</option>
                  <option value={7}>Sidste uge (7 dage)</option>
                  <option value={14}>Sidste 2 uger</option>
                </select>
              </div>

              {/* Input: Max Antal (Limit) */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Max Antal (Limit)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="w-full p-2 border rounded"
                  value={searchConfig.limit}
                  onChange={(e) =>
                    setSearchConfig({
                      ...searchConfig,
                      limit: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <button
                onClick={handleApiFetch}
                disabled={isFetchingAPI}
                className="w-full bg-[#1B264F] text-white py-3 rounded font-bold hover:bg-[#2a386f] disabled:bg-gray-400 transition-colors flex justify-center items-center gap-2"
              >
                {isFetchingAPI ? (
                  <>
                    <span>Henter XML fra EU...</span>
                    <span className="animate-spin">⏳</span>
                  </>
                ) : (
                  "Kør Søgning"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAIL MODAL --- */}
      {selectedTender && (
        <div className="modal-overlay" onClick={() => setSelectedTender(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-meta">
                <span className="modal-source">
                  NOTICE: {selectedTender.NoticeID}
                </span>
                <span className="modal-date">
                  Deadline: {selectedTender.TenderApplicationDate}
                </span>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedTender(null)}
              >
                Luk
              </button>
            </div>
            <div className="modal-scroll-area">
              <h2 className="modal-title">{selectedTender.Title}</h2>
              <a
                href={selectedTender.ExternalURI}
                target="_blank"
                className="original-link"
              >
                Åbn på TED Portal →
              </a>

              <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-6 rounded-lg border border-gray-100">
                <div>
                  <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">
                    Køber
                  </span>
                  <span className="font-medium text-gray-900">
                    {selectedTender.BuyerName}
                  </span>
                  <span className="block text-sm text-gray-500 mt-1">
                    {selectedTender.BuyerCountry}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">
                    Estimeret Værdi
                  </span>
                  <span className="font-bold text-[#C41D26] text-lg">
                    {selectedTender.EstimatedValue}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">
                    CPV Klassifikation
                  </span>
                  <span className="text-gray-800 bg-white px-2 py-1 rounded border border-gray-200 inline-block text-sm">
                    {selectedTender.CPV_Description}
                  </span>
                </div>
              </div>

              <div className="article-prose">
                <h3 className="text-lg font-bold mb-2 text-[#1B264F]">
                  Beskrivelse
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {selectedTender.Description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- STYLES (Reused from News Page) --- */}
      <style jsx global>{`
        :root {
          --brand-navy: #1b264f;
          --brand-red: #c01b2e;
          --bg-page: #f8f9fa;
          --bg-card: #ffffff;
          --text-main: #111827;
          --text-muted: #6b7280;
          --border-light: #e5e7eb;
        }
        body {
          margin: 0;
          font-family: "Inter", sans-serif;
          background-color: var(--bg-page);
          color: var(--text-main);
        }
        .page-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* HEADER */
        .header-bg {
          background-color: var(--brand-navy);
          color: white;
          padding: 60px 20px 80px 20px;
        }
        .header-content {
          max-width: 1280px;
          margin: 0 auto;
          text-align: center;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .back-link {
          color: rgba(255, 255, 255, 0.7);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.2s;
        }
        .back-link:hover {
          color: white;
        }
        .brand-tag {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }
        h1 {
          font-size: 3rem;
          font-weight: 700;
          margin: 0 0 10px 0;
          letter-spacing: -0.02em;
        }
        .header-content p {
          color: rgba(255, 255, 255, 0.8);
          font-size: 1.25rem;
          font-weight: 300;
          margin: 0;
        }

        /* GRID & CARDS */
        .main-container {
          max-width: 1280px;
          margin: -40px auto 0 auto;
          padding: 0 20px 40px 20px;
          width: 100%;
          box-sizing: border-box;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 32px;
        }
        .card {
          background: var(--bg-card);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.05);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }
        .card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .card-image-wrapper {
          position: relative;
          background: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .card-source-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 4px 8px;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .card-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          flex-grow: 1;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 0.75rem;
        }
        .date {
          color: var(--text-muted);
          font-weight: 500;
        }
        .card-title {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.3;
          margin: 0 0 12px 0;
          color: var(--text-main);
        }
        .card-summary {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--text-muted);
          margin-bottom: 20px;
          flex-grow: 1;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* WORKFLOW & INPUTS */
        .workflow-area {
          background-color: #f9fafb;
          border-top: 1px solid #e5e7eb;
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
          border: 1px solid #d1d5db;
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
          background: #fef2f2;
          color: #ef4444;
          border: 1px solid #fca5a5;
          border-radius: 6px;
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          font-size: 1.2rem;
        }
        .btn-action.resolve {
          background: #10b981;
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
          background: #d1d5db;
          cursor: not-allowed;
        }

        /* MODALS */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(27, 38, 79, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }
        .modal-content {
          background: white;
          width: 100%;
          max-width: 750px;
          max-height: 85vh;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }
        .modal-header {
          padding: 20px 30px;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
        }
        .modal-meta {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 0.85rem;
          color: var(--text-muted);
        }
        .modal-source {
          font-weight: 700;
          color: var(--brand-navy);
          text-transform: uppercase;
        }
        .btn-close {
          background: none;
          border: none;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
        }
        .modal-scroll-area {
          padding: 40px;
          overflow-y: auto;
        }
        .modal-title {
          font-size: 2rem;
          font-weight: 800;
          line-height: 1.2;
          margin: 0 0 10px 0;
          color: var(--brand-navy);
        }
        .original-link {
          display: inline-block;
          color: var(--brand-red);
          margin-bottom: 30px;
          text-decoration: none;
          font-weight: 600;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
