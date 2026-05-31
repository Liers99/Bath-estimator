import React, { useState } from "react";

/* ── DEFAULT PRICING ───────────────────────────────────────────────────────
   [low, high] per unit. sqftBased items are multiplied by entered sqft.
   tileShower: derived from shower floor sqft × 3 walls × ceiling height.
   paint: derived from room floor sqft × 4 walls × ceiling height.
   These are starting defaults — edit them in the Settings tab.
──────────────────────────────────────────────────────────────────────────── */
const DEFAULT_FEATURES = [
  { id: "demo",        label: "Demo & Haul-Off",       icon: "🔨", sqftBased: false, range: [900,   2400] },
  { id: "tileShower",  label: "Custom Tile Shower",     icon: "🚿", sqftBased: true,  range: [28,    85]   },
  { id: "tub",         label: "Tub & Surround",         icon: "🛁", sqftBased: false, range: [1400,  5500] },
  { id: "floor",       label: "Floor Tile / LVP",       icon: "▪", sqftBased: true,  range: [9,     30]   },
  { id: "vanity",      label: "Vanity & Countertop",    icon: "🪞", sqftBased: false, range: [900,   4500] },
  { id: "dblVanity",   label: "Double Vanity Upgrade",  icon: "⬌",  sqftBased: false, range: [500,   2000] },
  { id: "plumbing",    label: "Plumbing Fixtures",      icon: "🔧", sqftBased: false, range: [1200,  4000] },
  { id: "electrical",  label: "Electrical / Lighting",  icon: "💡", sqftBased: false, range: [600,   2200] },
  { id: "paint",       label: "Paint & Drywall",        icon: "🖌", sqftBased: true,  range: [2.5,   7]    },
  { id: "accessories", label: "Accessories & Mirrors",  icon: "🪟", sqftBased: false, range: [400,   2000] },
];

const BATH_TYPES = {
  half:   { label: "Half Bath",   sqft: 25,  showerFloorSqft: 0,  features: ["demo","vanity","plumbing","electrical","paint","accessories"] },
  full:   { label: "Full Bath",   sqft: 50,  showerFloorSqft: 0,  features: ["demo","tub","floor","vanity","plumbing","electrical","paint","accessories"] },
  master: { label: "Master Bath", sqft: 90,  showerFloorSqft: 36, features: ["demo","tileShower","floor","vanity","dblVanity","plumbing","electrical","paint","accessories"] },
};

function lerp(a, b, t) { return a + (b - a) * t; }

function calcRange(activeIds, pricing, sqft, ceilHeight, showerFloorSqft, grade) {
  // Paint: 4 walls, assume square room
  const paintSqft = 4 * Math.sqrt(sqft) * ceilHeight;
  // Shower tile: 3 walls, assume square shower footprint
  const showerWallSqft = 3 * Math.sqrt(showerFloorSqft) * ceilHeight;
  const t = grade / 100;
  let low = 0, high = 0;
  for (const f of pricing) {
    if (!activeIds.includes(f.id)) continue;
    let sf = sqft;
    if (f.id === "tileShower") sf = showerWallSqft;
    else if (f.id === "paint") sf = paintSqft;
    if (f.sqftBased) { low += f.range[0] * sf; high += f.range[1] * sf; }
    else             { low += f.range[0];       high += f.range[1]; }
  }
  const mid = lerp(low, high, t);
  return [Math.round(mid * 0.87), Math.round(mid * 1.13)];
}

const fmt = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/* ── STORAGE ── */
const EST_KEY     = "bath_est_v2";
const PRICING_KEY = "bath_pricing_v1";

function loadSaved()  { try { return JSON.parse(localStorage.getItem(EST_KEY) || "[]"); } catch { return []; } }
function persistEst(list) { localStorage.setItem(EST_KEY, JSON.stringify(list)); }

function loadPricing() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRICING_KEY) || "{}");
    return DEFAULT_FEATURES.map(f => ({ ...f, range: stored[f.id] ? [...stored[f.id]] : [...f.range] }));
  } catch { return DEFAULT_FEATURES.map(f => ({ ...f, range: [...f.range] })); }
}
function persistPricing(features) {
  const map = {};
  features.forEach(f => { map[f.id] = f.range; });
  localStorage.setItem(PRICING_KEY, JSON.stringify(map));
}

/* ── COMPONENT ── */
export default function BathEstimator() {
  const [bathType, setBathType]     = useState(null);
  const [active, setActive]         = useState([]);
  const [sqft, setSqft]             = useState(50);
  const [ceilHeight, setCeilHeight] = useState(9);
  const [showerFloorSqft, setShowerFloorSqft] = useState(36);
  const [grade, setGrade]           = useState(0);
  const [clientName, setClientName] = useState("");
  const [saved, setSaved]           = useState(loadSaved);
  const [view, setView]             = useState("build"); // build | saved | settings
  const [flash, setFlash]           = useState("");
  const [pricing, setPricing]       = useState(loadPricing);
  const [priceFlash, setPriceFlash] = useState("");
  const [printEntry, setPrintEntry] = useState(null);

  /* ── estimate logic ── */
  function pickType(key) {
    const t = BATH_TYPES[key];
    setBathType(key);
    setActive([...t.features]);
    setSqft(t.sqft);
    setShowerFloorSqft(t.showerFloorSqft);
  }

  function toggleFeature(id) {
    setActive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function snapGrade(val) {
    const v = parseInt(val);
    if (v <= 25) return 0;
    if (v <= 75) return 50;
    return 100;
  }

  const [lo, hi]   = active.length ? calcRange(active, pricing, sqft, ceilHeight, showerFloorSqft, grade) : [0, 0];
  const gradeLabel = grade === 0 ? "Builder Grade" : grade === 50 ? "Premium" : "Luxury";
  const gradeColor = grade === 0 ? "#7eb8d4" : grade === 50 ? "#81c784" : "#c8a96e";

  function handleSave() {
    const entry = { id: Date.now(), date: new Date().toLocaleDateString(), clientName: clientName || "Unnamed", bathType, active, sqft, ceilHeight, showerFloorSqft, grade, lo, hi, pricingSnapshot: pricing };
    const next = [entry, ...saved];
    setSaved(next); persistEst(next);
    setFlash("Saved ✓"); setTimeout(() => setFlash(""), 2000);
  }

  function handleLoad(e) {
    setBathType(e.bathType); setActive(e.active); setSqft(e.sqft);
    setCeilHeight(e.ceilHeight || 9); setShowerFloorSqft(e.showerFloorSqft || 36); setGrade(e.grade); setClientName(e.clientName);
    setView("build");
  }

  function handleDelete(id) {
    const next = saved.filter(e => e.id !== id);
    setSaved(next); persistEst(next);
  }

  function handlePrint(entry) {
    setPrintEntry(entry);
  }

  function handleClosePrint() {
    setPrintEntry(null);
  }

  /* ── pricing editor ── */
  function updatePrice(id, idx, val) {
    setPricing(prev => prev.map(f => {
      if (f.id !== id) return f;
      const r = [...f.range];
      r[idx] = parseFloat(val) || 0;
      return { ...f, range: r };
    }));
  }

  function savePricing() {
    persistPricing(pricing);
    setPriceFlash("Saved ✓"); setTimeout(() => setPriceFlash(""), 2000);
  }

  function resetPricing() {
    const reset = DEFAULT_FEATURES.map(f => ({ ...f, range: [...f.range] }));
    setPricing(reset); persistPricing(reset);
    setPriceFlash("Reset to defaults ✓"); setTimeout(() => setPriceFlash(""), 2000);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=Lato:wght@300;400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f2ede8; }
        .app { min-height: 100vh; background: #f2ede8; font-family: 'Lato', sans-serif; color: #1a1a1a; }

        /* header */
        .hdr { background: #1c2226; padding: 18px 24px 14px; display: flex; align-items: flex-end; justify-content: space-between; }
        .hdr-brand h1 { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #c8a96e; line-height: 1; }
        .hdr-brand p  { font-size: 10px; letter-spacing: 2px; color: #555f66; text-transform: uppercase; margin-top: 3px; }
        .hdr-tabs { display: flex; gap: 4px; }
        .tab { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; padding: 6px 16px; border: 1px solid #2e3a40; background: transparent; color: #556; cursor: pointer; border-radius: 2px; transition: all 0.15s; }
        .tab:hover { color: #c8a96e; border-color: #c8a96e; }
        .tab.on { background: #c8a96e; color: #1c2226; border-color: #c8a96e; font-weight: 600; }

        /* layout */
        .body { padding: 24px; max-width: 680px; }
        .section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #999; margin-bottom: 10px; margin-top: 24px; }

        /* type pills */
        .type-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .type-pill { font-family: 'Barlow Condensed', sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 10px 22px; border: 2px solid #d5cec6; background: #fff; color: #888; cursor: pointer; border-radius: 3px; transition: all 0.15s; }
        .type-pill:hover { border-color: #1c2226; color: #1c2226; }
        .type-pill.on { border-color: #1c2226; background: #1c2226; color: #c8a96e; }

        /* feature chips */
        .feat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; }
        .feat-chip { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1.5px solid #ddd8d0; border-radius: 4px; background: #fff; cursor: pointer; transition: all 0.15s; user-select: none; }
        .feat-chip:hover { border-color: #aaa; }
        .feat-chip.on { border-color: #1c2226; background: #1c2226; }
        .feat-chip.on .feat-label { color: #e8e4de; }
        .feat-icon  { font-size: 16px; flex-shrink: 0; line-height: 1; }
        .feat-label { font-size: 13px; font-weight: 400; color: #333; line-height: 1.2; }

        /* sqft */
        .sqft-row { display: flex; gap: 12px; }
        .input-wrap { flex: 1; }
        .input-wrap label { display: block; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #999; margin-bottom: 5px; }
        .input-wrap input { width: 100%; background: #fff; border: 1.5px solid #ddd8d0; border-radius: 3px; padding: 8px 10px; font-family: 'Lato', sans-serif; font-size: 14px; color: #1a1a1a; outline: none; transition: border-color 0.15s; }
        .input-wrap input:focus { border-color: #1c2226; }

        /* grade */
        .grade-wrap { background: #fff; border: 1.5px solid #ddd8d0; border-radius: 4px; padding: 14px 16px; }
        .grade-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .grade-label-text { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 2px; transition: color 0.2s; }
        .grade-stops { display: flex; justify-content: space-between; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #bbb; margin-top: 6px; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; background: linear-gradient(to right, #7eb8d4, #81c784, #c8a96e); outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #1c2226; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.25); transition: transform 0.1s; }
        input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.15); }

        /* result */
        .result-card { background: #1c2226; border-radius: 6px; padding: 24px 22px 20px; margin-top: 24px; position: relative; overflow: hidden; }
        .result-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(to right, #7eb8d4, #81c784, #c8a96e); }
        .result-eyebrow { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #556; margin-bottom: 6px; }
        .result-range { font-family: 'Barlow Condensed', sans-serif; font-size: 48px; font-weight: 700; color: #f2ede8; letter-spacing: 1px; line-height: 1; }
        .result-dash { color: #556; margin: 0 6px; }
        .result-sub { margin-top: 8px; font-size: 11px; color: #556; letter-spacing: 1px; }
        .result-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 18px; padding-top: 14px; border-top: 1px solid #2e3a40; gap: 10px; }
        .client-input { flex: 1; background: #252e34; border: 1px solid #2e3a40; border-radius: 3px; padding: 7px 10px; font-family: 'Lato', sans-serif; font-size: 13px; color: #e8e4de; outline: none; }
        .client-input::placeholder { color: #3d4d55; }
        .client-input:focus { border-color: #c8a96e; }
        .save-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 8px 20px; background: #c8a96e; color: #1c2226; border: none; border-radius: 3px; cursor: pointer; transition: background 0.15s; white-space: nowrap; }
        .save-btn:hover { background: #d9bb85; }
        .flash { font-size: 11px; color: #81c784; letter-spacing: 1px; white-space: nowrap; }

        /* saved */
        .saved-empty { color: #aaa; font-size: 13px; padding: 20px 0; }
        .saved-card { background: #fff; border: 1.5px solid #ddd8d0; border-radius: 4px; padding: 14px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 14px; }
        .sc-info { flex: 1; }
        .sc-name { font-weight: 700; font-size: 14px; color: #1a1a1a; }
        .sc-meta { font-size: 11px; color: #999; margin-top: 2px; letter-spacing: 0.5px; }
        .sc-range { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; color: #1c2226; letter-spacing: 0.5px; white-space: nowrap; }
        .sc-actions { display: flex; gap: 6px; }
        .sc-btn { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 12px; border-radius: 2px; cursor: pointer; border: 1.5px solid; transition: all 0.15s; }
        .sc-load { border-color: #1c2226; color: #1c2226; background: transparent; }
        .sc-load:hover { background: #1c2226; color: #c8a96e; }
        .sc-del  { border-color: #e0b0b0; color: #c97777; background: transparent; }
        .sc-del:hover { background: #fdf0f0; }
        .sc-print { border-color: #c8d8c0; color: #5a8a55; background: transparent; }
        .sc-print:hover { background: #f0f7ee; }

        /* settings / pricing editor */
        .pricing-note { font-size: 12px; color: #999; margin-bottom: 16px; line-height: 1.5; }
        .pricing-table { width: 100%; border-collapse: collapse; }
        .pricing-table th { font-family: 'Barlow Condensed', sans-serif; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #aaa; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e0d9d0; }
        .pricing-table th.right { text-align: right; }
        .pricing-table td { padding: 8px 8px; border-bottom: 1px solid #ede8e2; vertical-align: middle; }
        .pt-label { display: flex; align-items: center; gap: 7px; font-size: 13px; color: #1a1a1a; }
        .pt-icon  { font-size: 15px; }
        .pt-unit  { font-size: 10px; color: #bbb; margin-top: 1px; }
        .price-cell { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
        .price-cell span { font-size: 11px; color: #bbb; }
        .price-input { width: 76px; background: #fff; border: 1.5px solid #ddd8d0; border-radius: 3px; padding: 5px 8px; font-family: 'Lato', sans-serif; font-size: 13px; color: #1a1a1a; text-align: right; outline: none; transition: border-color 0.15s; }
        .price-input:focus { border-color: #1c2226; }
        .settings-footer { display: flex; align-items: center; gap: 12px; margin-top: 20px; padding-top: 16px; border-top: 1px solid #e0d9d0; }
        .btn-primary { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 9px 22px; background: #1c2226; color: #c8a96e; border: none; border-radius: 3px; cursor: pointer; transition: background 0.15s; }
        .btn-primary:hover { background: #252e34; }
        .btn-ghost { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; padding: 9px 18px; background: transparent; color: #aaa; border: 1.5px solid #ddd8d0; border-radius: 3px; cursor: pointer; transition: all 0.15s; }
        .btn-ghost:hover { border-color: #aaa; color: #555; }
        .price-flash { font-size: 11px; color: #81c784; letter-spacing: 1px; }

        .no-type-msg { color: #bbb; font-size: 13px; font-style: italic; padding: 6px 0; }

        /* print overlay */
        .print-overlay {
          position: fixed; inset: 0; background: #fff; z-index: 1000;
          padding: 48px 56px; overflow-y: auto;
          font-family: 'Lato', sans-serif; color: #1a1a1a;
        }
        .po-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .po-logo { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #c8a96e; line-height: 1; }
        .po-sub  { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #aaa; margin-top: 3px; }
        .po-close { font-family: 'Barlow Condensed', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 7px 16px; background: #1c2226; color: #c8a96e; border: none; border-radius: 3px; cursor: pointer; }
        .po-hr { border: none; border-top: 2px solid #c8a96e; margin: 16px 0 20px; }
        .po-meta { display: flex; gap: 32px; margin-bottom: 24px; flex-wrap: wrap; }
        .po-meta-block .po-label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #aaa; margin-bottom: 3px; }
        .po-meta-block .po-value { font-size: 15px; font-weight: 600; }
        .po-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .po-table th { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #aaa; text-align: left; padding: 6px 0; border-bottom: 1px solid #e0d9d0; }
        .po-table td { padding: 9px 0; border-bottom: 1px solid #f0ece8; font-size: 13px; }
        .po-range-box { background: #1c2226; border-radius: 6px; padding: 22px 24px; color: #f2ede8; margin-bottom: 32px; }
        .po-range-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #556; margin-bottom: 6px; }
        .po-range-val { font-family: 'Barlow Condensed', sans-serif; font-size: 44px; font-weight: 700; letter-spacing: 1px; line-height: 1; }
        .po-range-dash { color: #556; margin: 0 6px; }
        .po-range-sub { font-size: 11px; color: #556; margin-top: 6px; letter-spacing: 1px; }
        .po-footer { font-size: 10px; color: #bbb; letter-spacing: 1px; text-align: center; margin-top: 16px; }
        .po-print-btn { display: block; width: 100%; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; padding: 12px; background: #c8a96e; color: #1c2226; border: none; border-radius: 3px; cursor: pointer; margin-bottom: 24px; }
        .po-print-btn:hover { background: #d9bb85; }

        .po-tier-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-bottom: 16px; }
        .po-tier-card { border-radius: 5px; padding: 16px 14px; }
        .po-tier-bg  { background: #f2ede8; border: 1.5px solid #ddd8d0; }
        .po-tier-pr  { background: #fff; border: 2px solid #c8a96e; }
        .po-tier-lux { background: #1c2226; border: 2px solid #c8a96e; }
        .po-tier-name { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
        .po-tier-bg  .po-tier-name  { color: #888; }
        .po-tier-pr  .po-tier-name  { color: #c8a96e; }
        .po-tier-lux .po-tier-name  { color: #c8a96e; }
        .po-tier-range { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 700; line-height: 1.1; margin-bottom: 4px; }
        .po-tier-bg  .po-tier-range  { color: #1a1a1a; }
        .po-tier-pr  .po-tier-range  { color: #1a1a1a; }
        .po-tier-lux .po-tier-range  { color: #f2ede8; }
        .po-tier-dash { margin: 0 3px; opacity: 0.4; }
        .po-tier-note { font-size: 11px; }
        .po-tier-bg  .po-tier-note  { color: #aaa; }
        .po-tier-pr  .po-tier-note  { color: #999; }
        .po-tier-lux .po-tier-note  { color: #556; }
        .po-selected-note { font-size: 11px; color: #999; letter-spacing: 0.5px; margin-bottom: 16px; }
        .po-selected-note strong { color: #1a1a1a; }

        @media print {
          .print-overlay .po-close,
          .print-overlay .po-print-btn { display: none !important; }
          .print-overlay { padding: 24px 32px; }
          .po-tier-lux { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @media not print {
          /* hide main app when print overlay is showing — handled via JS */
        }
      `}</style>

      <div className="app">
        {/* ── HEADER ── */}
        <div className="hdr">
          <div className="hdr-brand">
            <h1>Bath Estimator</h1>
            <p>Stone Ridge Remodeling · Cleveland, TN</p>
          </div>
          <div className="hdr-tabs">
            <button className={`tab ${view === "build"    ? "on" : ""}`} onClick={() => setView("build")}>Estimate</button>
            <button className={`tab ${view === "saved"    ? "on" : ""}`} onClick={() => setView("saved")}>Saved ({saved.length})</button>
            <button className={`tab ${view === "settings" ? "on" : ""}`} onClick={() => setView("settings")}>Pricing</button>
          </div>
        </div>

        {/* ── ESTIMATE TAB ── */}
        {view === "build" && (
          <div className="body">
            <div className="section-title">Step 1 — Bathroom Type</div>
            <div className="type-row">
              {Object.entries(BATH_TYPES).map(([key, val]) => (
                <button key={key} className={`type-pill ${bathType === key ? "on" : ""}`} onClick={() => pickType(key)}>
                  {val.label}
                </button>
              ))}
            </div>

            <div className="section-title">Step 2 — Features Included</div>
            {!bathType
              ? <p className="no-type-msg">Select a bathroom type above to load default features.</p>
              : (
                <div className="feat-grid">
                  {pricing.map(f => (
                    <div key={f.id} className={`feat-chip ${active.includes(f.id) ? "on" : ""}`} onClick={() => toggleFeature(f.id)}>
                      <span className="feat-icon">{f.icon}</span>
                      <span className="feat-label">{f.label}</span>
                    </div>
                  ))}
                </div>
              )
            }

            <div className="section-title">Step 3 — Dimensions</div>
            <div className="sqft-row">
              <div className="input-wrap">
                <label>Floor Sqft</label>
                <input type="number" value={sqft} min={10} onChange={e => setSqft(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="input-wrap">
                <label>Ceiling Height (ft)</label>
                <input type="number" value={ceilHeight} min={6} max={20} step={0.5} onChange={e => setCeilHeight(parseFloat(e.target.value) || 8)} />
              </div>
              {active.includes("tileShower") && (
                <div className="input-wrap">
                  <label>Shower Floor Sqft</label>
                  <input type="number" value={showerFloorSqft} min={0} onChange={e => setShowerFloorSqft(parseFloat(e.target.value) || 0)} />
                </div>
              )}
            </div>

            <div className="section-title">Step 4 — Material Grade</div>
            <div className="grade-wrap">
              <div className="grade-top">
                <span style={{ fontSize: 13, color: "#999", letterSpacing: 1 }}>Builder Grade → Luxury</span>
                <span className="grade-label-text" style={{ color: gradeColor }}>{gradeLabel}</span>
              </div>
              <input type="range" min={0} max={100} value={grade} onChange={e => setGrade(snapGrade(e.target.value))} />
              <div className="grade-stops"><span>Builder Grade</span><span>Premium</span><span>Luxury</span></div>
            </div>

            {active.length > 0 && (
              <div className="result-card">
                <div className="result-eyebrow">Ballpark Estimate · {gradeLabel} Grade</div>
                <div className="result-range">
                  {fmt(lo)}<span className="result-dash">–</span>{fmt(hi)}
                </div>
                <div className="result-sub">
                  {bathType ? BATH_TYPES[bathType].label : ""} · {active.length} items · {sqft} sf · {ceilHeight}ft ceiling
                </div>
                <div className="result-footer">
                  <input className="client-input" type="text" placeholder="Client name (optional)" value={clientName} onChange={e => setClientName(e.target.value)} />
                  {flash
                    ? <span className="flash">{flash}</span>
                    : <button className="save-btn" onClick={handleSave}>Save</button>
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SAVED TAB ── */}
        {view === "saved" && (
          <div className="body">
            <div className="section-title" style={{ marginTop: 0 }}>Saved Estimates</div>
            {saved.length === 0
              ? <p className="saved-empty">No saved estimates yet.</p>
              : saved.map(e => (
                <div className="saved-card" key={e.id}>
                  <div className="sc-info">
                    <div className="sc-name">{e.clientName}</div>
                    <div className="sc-meta">{e.date} · {e.bathType ? BATH_TYPES[e.bathType]?.label : ""} · {e.active?.length} items</div>
                  </div>
                  <div className="sc-range">{fmt(e.lo)}–{fmt(e.hi)}</div>
                  <div className="sc-actions">
                    <button className="sc-btn sc-load" onClick={() => handleLoad(e)}>Load</button>
                    <button className="sc-btn sc-print" onClick={() => handlePrint(e)}>Print</button>
                    <button className="sc-btn sc-del"  onClick={() => handleDelete(e.id)}>✕</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── PRICING / SETTINGS TAB ── */}
        {view === "settings" && (
          <div className="body">
            <div className="section-title" style={{ marginTop: 0 }}>Pricing Ranges</div>
            <p className="pricing-note">
              Set your low and high installed sell prices per line item. The grade slider on the Estimate tab interpolates between these two numbers.
              Flat items are per-job totals; per-sqft items are multiplied by the sqft you enter.
            </p>
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="right" colSpan={3}>Builder Grade (low) &nbsp;→&nbsp; Luxury (high)</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div className="pt-label">
                        <span className="pt-icon">{f.icon}</span>
                        <div>
                          <div>{f.label}</div>
                          <div className="pt-unit">{f.sqftBased ? "per sqft" : "flat / job"}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="price-cell">
                        <span>$</span>
                        <input
                          className="price-input"
                          type="number"
                          min={0}
                          step={f.sqftBased ? 0.5 : 50}
                          value={f.range[0]}
                          onChange={e => updatePrice(f.id, 0, e.target.value)}
                        />
                        <span>→ $</span>
                        <input
                          className="price-input"
                          type="number"
                          min={0}
                          step={f.sqftBased ? 0.5 : 50}
                          value={f.range[1]}
                          onChange={e => updatePrice(f.id, 1, e.target.value)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="settings-footer">
              <button className="btn-primary" onClick={savePricing}>Save Pricing</button>
              <button className="btn-ghost"   onClick={resetPricing}>Reset to Defaults</button>
              {priceFlash && <span className="price-flash">{priceFlash}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── PRINT OVERLAY ── */}
      {printEntry && (() => {
        const e = printEntry;
        const bl = e.bathType ? BATH_TYPES[e.bathType]?.label : "";
        const feats = DEFAULT_FEATURES.filter(f => e.active?.includes(f.id));
        // Calculate all three tier ranges from saved pricing data
        const savedPricing = e.pricingSnapshot || pricing;
        const [bgLo, bgHi]  = calcRange(e.active, savedPricing, e.sqft, e.ceilHeight || 9, e.showerFloorSqft || 0, 0);
        const [prLo, prHi]  = calcRange(e.active, savedPricing, e.sqft, e.ceilHeight || 9, e.showerFloorSqft || 0, 50);
        const [luxLo, luxHi] = calcRange(e.active, savedPricing, e.sqft, e.ceilHeight || 9, e.showerFloorSqft || 0, 100);
        return (
          <div className="print-overlay">
            <div className="po-header">
              <div>
                <div className="po-logo">Stone Ridge Remodeling</div>
                <div className="po-sub">Cleveland, TN · Ballpark Estimate</div>
              </div>
              <button className="po-close" onClick={handleClosePrint}>✕ Close</button>
            </div>
            <div className="po-hr" />
            <div className="po-meta">
              <div className="po-meta-block"><div className="po-label">Client</div><div className="po-value">{e.clientName}</div></div>
              <div className="po-meta-block"><div className="po-label">Date</div><div className="po-value">{e.date}</div></div>
              <div className="po-meta-block"><div className="po-label">Type</div><div className="po-value">{bl}</div></div>
              <div className="po-meta-block"><div className="po-label">Floor</div><div className="po-value">{e.sqft} sf</div></div>
              <div className="po-meta-block"><div className="po-label">Ceiling</div><div className="po-value">{e.ceilHeight || 9}ft</div></div>
            </div>
            <table className="po-table">
              <thead><tr><th>Scope</th></tr></thead>
              <tbody>{feats.map(f => <tr key={f.id}><td>{f.label}</td></tr>)}</tbody>
            </table>
            <div className="po-tier-grid">
              <div className="po-tier-card po-tier-bg">
                <div className="po-tier-name">Builder Grade</div>
                <div className="po-tier-range">{fmt(bgLo)}<span className="po-tier-dash">–</span>{fmt(bgHi)}</div>
                <div className="po-tier-note">Functional &amp; code-compliant</div>
              </div>
              <div className="po-tier-card po-tier-pr">
                <div className="po-tier-name">Premium</div>
                <div className="po-tier-range">{fmt(prLo)}<span className="po-tier-dash">–</span>{fmt(prHi)}</div>
                <div className="po-tier-note">Elevated design &amp; materials</div>
              </div>
              <div className="po-tier-card po-tier-lux">
                <div className="po-tier-name">Luxury</div>
                <div className="po-tier-range">{fmt(luxLo)}<span className="po-tier-dash">–</span>{fmt(luxHi)}</div>
                <div className="po-tier-note">Custom everything</div>
              </div>
            </div>
            <div className="po-selected-note">
              Selected tier: <strong>{e.grade === 0 ? "Builder Grade" : e.grade === 50 ? "Premium" : "Luxury"}</strong>
            </div>
            <button className="po-print-btn" onClick={() => window.print()}>Print / Save as PDF</button>
            <div className="po-footer">This is a ballpark estimate only. Final pricing subject to full scope review. · Stone Ridge Remodeling</div>
          </div>
        );
      })()}
    </>
  );
}
