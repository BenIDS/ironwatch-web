import { useState, useEffect, useRef } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── DATA ──────────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "bidspotter", name: "Bidspotter", color: "#E8500A", url: "https://www.bidspotter.co.uk" },
  { id: "ebay", name: "eBay", color: "#E53238", url: "https://www.ebay.co.uk/b/Heavy-Equipment/183071" },
  { id: "euroauctions", name: "Euro Auctions", color: "#0057B8", url: "https://www.euroauctions.com" },
  { id: "mascus", name: "Mascus", color: "#1BBDB5", url: "https://www.mascus.co.uk" },
  { id: "ritchie", name: "Ritchie Bros", color: "#00843D", url: "https://www.rbauction.com" },
  { id: "ibidder", name: "i-bidder", color: "#7B2D8B", url: "https://www.i-bidder.com" },
  { id: "proxibid", name: "Proxibid", color: "#1A3A6B", url: "https://www.proxibid.com" },
];



const CONDITION_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
const UK_CITIES = ["London", "Birmingham", "Manchester", "Leeds", "Sheffield", "Bristol", "Glasgow", "Edinburgh", "Cardiff", "Liverpool", "Nottingham", "Newcastle"];

function getPlatform(id) { return PLATFORMS.find(p => p.id === id) || { name: id, color: "#666", url: "#" }; }
function formatTimeLeft(date) {
  const ms = date - Date.now();
  if (ms < 0) return "Ended";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h < 24 ? `${h}h ${m}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
function isEndingSoon(date) { const ms = date - Date.now(); return ms > 0 && ms < 24 * 3600000; }

// ─── RANGE SLIDER ──────────────────────────────────────────────────────────────
function RangeSlider({ label, min, max, value, onChange, format, color = "#1BBDB5" }) {
  const [low, high] = value;
  const trackRef = useRef(null);
  function getPct(v) { return ((v - min) / (max - min)) * 100; }

  function getValFromClientX(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(min + pct * (max - min));
  }

  function handleDragStart(which) {
    return (e) => {
      e.preventDefault();
      const isTouch = e.type === "touchstart";

      const move = (ev) => {
        const clientX = isTouch ? ev.touches[0].clientX : ev.clientX;
        const val = getValFromClientX(clientX);
        if (which === "low") onChange([Math.min(val, high - 1), high]);
        else onChange([low, Math.max(val, low + 1)]);
      };
      const up = () => {
        if (isTouch) {
          window.removeEventListener("touchmove", move);
          window.removeEventListener("touchend", up);
        } else {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        }
      };
      if (isTouch) {
        window.addEventListener("touchmove", move, { passive: false });
        window.addEventListener("touchend", up);
      } else {
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }
    };
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {label && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#5A6478" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 500 }}>{format(low)} — {format(high)}</span>
      </div>}
      <div ref={trackRef} style={{ position: "relative", height: 4, background: "#1A2530", borderRadius: 2, margin: "12px 8px", cursor: "pointer" }}>
        <div style={{ position: "absolute", height: "100%", borderRadius: 2, background: color, opacity: 0.8, left: `${getPct(low)}%`, width: `${getPct(high) - getPct(low)}%` }} />
        {[["low", low], ["high", high]].map(([which, val]) => (
          <div key={which}
            onMouseDown={handleDragStart(which)}
            onTouchStart={handleDragStart(which)}
            style={{ position: "absolute", top: "50%", left: `${getPct(val)}%`, transform: "translate(-50%, -50%)", width: 24, height: 24, borderRadius: "50%", background: color, border: "2px solid #0A0C0F", cursor: "grab", zIndex: 2, boxShadow: `0 0 6px ${color}66`, touchAction: "none" }} />
        ))}
      </div>
    </div>
  );
}

// ─── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("ironwatch_token", data.token);
        onLogin(data.token);
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch {
      setError("Cannot connect to server. Please try again shortly.");
    }
    setLoading(false);
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "#0A0C0F", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Montserrat:wght@700;800;900&display=swap');`}</style>

      {/* Background grid */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(27,189,181,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(27,189,181,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

      <div style={{ width: 380, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><div style={{ width: 56, height: 56, background: "linear-gradient(135deg, #1BBDB5, #44D62C)", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 12, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color: "#000" }}>IDS</span></div></div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 42, letterSpacing: "0.12em", color: "#1BBDB5", lineHeight: 1 }}>IRONWATCH</div>
          <div style={{ fontSize: 10, color: "#3A4458", letterSpacing: "0.2em", marginTop: 6 }}>MARKET INTELLIGENCE · POWERED BY IDS</div>
        </div>

        {/* Login box */}
        <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 32 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 24, textAlign: "center" }}>TEAM ACCESS — ENTER PASSWORD</div>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              placeholder="Enter team password..."
              autoFocus
              style={{ width: "100%", background: "#1A2530", border: `1px solid ${error ? "#FF4444" : "#1A2530"}`, color: "#E0E4EC", padding: "12px 14px", fontSize: 13, fontFamily: "'DM Mono', monospace", marginBottom: 12, outline: "none", letterSpacing: "0.1em" }}
            />
            {error && <div style={{ color: "#FF4444", fontSize: 10, marginBottom: 12, letterSpacing: "0.08em" }}>⚠ {error}</div>}
            <button type="submit" disabled={loading || !password} style={{ width: "100%", background: loading || !password ? "#1A2530" : "#1BBDB5", color: loading || !password ? "#3A4458" : "#000", padding: "12px", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em", fontWeight: 500, cursor: loading || !password ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s" }}>
              {loading ? "VERIFYING..." : "ACCESS IRONWATCH →"}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: "12px", background: "rgba(255,107,0,0.05)", border: "1px solid rgba(255,107,0,0.15)" }}>
            <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 4 }}>DEFAULT PASSWORD</div>
            <div style={{ fontSize: 11, color: "#1BBDB5", fontFamily: "'DM Mono', monospace" }}>ironwatch2024</div>
            <div style={{ fontSize: 9, color: "#3A4458", marginTop: 4 }}>Change this in your server environment variables</div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 9, color: "#2A3448", letterSpacing: "0.1em" }}>
          INTELLIGENT DISPOSAL SOLUTIONS · SECURE ACCESS
        </div>
      </div>
    </div>
  );
}

// ─── PHOTO ANALYSER ────────────────────────────────────────────────────────────
function PhotoAnalyser({ token }) {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [machineType, setMachineType] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setImage(URL.createObjectURL(file));
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setImageBase64({ base64: e.target.result.split(",")[1], mediaType: file.type });
    reader.readAsDataURL(file);
  }

  async function analyse() {
    if (!imageBase64) return;
    setAnalysing(true); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: imageBase64.mediaType, data: imageBase64.base64 } },
              { type: "text", text: `You are an expert heavy plant and machinery valuator. Analyse this photograph${machineType ? ` of a ${machineType}` : ""}.\n\nProvide:\n**MACHINE IDENTIFIED:** [make/model if visible]\n**ESTIMATED YEAR RANGE:** [e.g. 2015–2019]\n**VISIBLE CONDITION:** [rating] — what you can see\n**CONDITION INDICATORS:** 3–5 specific observations\n**ESTIMATED MARKET VALUE (UK):**\n- Private sale: £X – £Y\n- Auction estimate: £X – £Y\n- Dealer retail: £X – £Y\n**COMPARABLE RECENT SALES:** 2–3 typical results\n**HOURS ESTIMATE:** likely range based on condition\n**BUY RECOMMENDATION:** STRONG BUY / BUY / INSPECT FIRST / PASS\n**KEY RISKS:** 2–3 things to inspect before bidding\n\nBe specific and practical.` }
            ]
          }]
        })
      });
      const data = await res.json();
      setResult(data.content?.map(c => c.text || "").join("\n") || "Analysis unavailable.");
    } catch { setResult("⚠️ Connection error. Please try again."); }
    setAnalysing(false);
  }

  function renderResult(text) {
    return text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
      const m = line.match(/^\*\*(.*?)\*\*:?\s*(.*)/);
      if (m) {
        const isRec = m[1].includes("RECOMMENDATION") || m[1].includes("BUY");
        const isBuy = line.includes("STRONG BUY") || (line.includes("BUY") && !line.includes("PASS"));
        const isPass = line.includes("PASS");
        return <div key={i} style={{ background: isRec ? (isBuy ? "rgba(0,200,150,0.1)" : isPass ? "rgba(200,50,50,0.1)" : "rgba(255,107,0,0.1)") : "transparent", borderLeft: isRec ? (isBuy ? "3px solid #44D62C" : isPass ? "3px solid #FF4444" : "3px solid #1BBDB5") : "none", paddingLeft: isRec ? 10 : 0, paddingTop: isRec ? 6 : 0, paddingBottom: isRec ? 6 : 0, marginBottom: 3 }}>
          <span style={{ color: "#1BBDB5", fontWeight: 600, fontSize: 11 }}>{m[1]}: </span>
          <span style={{ color: "#C0C8D8", fontSize: 11 }}>{m[2]}</span>
        </div>;
      }
      if (line.startsWith("- ")) return <div key={i} style={{ color: "#A0A8B8", fontSize: 11, paddingLeft: 14, marginBottom: 2 }}>{line}</div>;
      return <div key={i} style={{ color: "#C0C8D8", fontSize: 11, marginBottom: 2 }}>{line}</div>;
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="iw-photo-grid">
      <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 16 }}>📷 UPLOAD MACHINE PHOTOGRAPH</div>
        <div onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onClick={() => fileRef.current.click()}
          style={{ border: `2px dashed ${dragOver ? "#1BBDB5" : "#1A2530"}`, background: dragOver ? "rgba(255,107,0,0.05)" : "#080B10", borderRadius: 2, cursor: "pointer", minHeight: image ? "auto" : 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all 0.2s", overflow: "hidden", marginBottom: 14 }}>
          {image ? <img src={image} alt="Upload" style={{ width: "100%", maxHeight: 280, objectFit: "contain" }} /> :
            <div style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>⊕</div>
              <div style={{ fontSize: 12, color: "#5A6478", marginBottom: 6 }}>Drop a photo here or click to browse</div>
              <div style={{ fontSize: 10, color: "#3A4458" }}>JPG, PNG, WEBP — any angle</div>
            </div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
        <input value={machineType} onChange={e => setMachineType(e.target.value)} placeholder="Machine type hint (optional)..." style={{ width: "100%", background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "9px 12px", fontSize: 11, fontFamily: "'DM Mono', monospace", marginBottom: 10, outline: "none" }} />
        <button onClick={analyse} disabled={!image || analysing} style={{ width: "100%", background: image && !analysing ? "#1BBDB5" : "#1A2530", color: image && !analysing ? "#000" : "#3A4458", padding: "11px", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em", fontWeight: 500, cursor: image && !analysing ? "pointer" : "not-allowed", border: "none" }}>
          {analysing ? "◎ ANALYSING..." : "◎ ANALYSE & VALUATE"}
        </button>
        {image && <button onClick={() => { setImage(null); setImageBase64(null); setResult(null); setMachineType(""); }} style={{ width: "100%", marginTop: 8, background: "transparent", border: "1px solid #1A2530", color: "#5A6478", padding: "7px", fontSize: 10, cursor: "pointer", letterSpacing: "0.1em" }}>✕ CLEAR</button>}
      </div>
      <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          ◈ VALUATION REPORT
          {analysing && <span style={{ color: "#1BBDB5", animation: "pulse 1.5s infinite" }}>● PROCESSING...</span>}
        </div>
        {!result && !analysing && <div style={{ color: "#1A2530", fontSize: 12, lineHeight: 2, paddingTop: 40, textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>📷</div>Upload a photograph to get an instant AI valuation.</div>}
        {analysing && <div style={{ color: "#5A6478", fontSize: 11, lineHeight: 2.2 }}>{["Identifying machine...", "Assessing condition...", "Checking UK auction results...", "Calculating value range..."].map((s, i) => <div key={i} style={{ opacity: 0, animation: `slideIn 0.4s ease ${i * 0.5}s forwards` }}>▸ {s}</div>)}</div>}
        {result && !analysing && <div style={{ lineHeight: 1.8, overflowY: "auto", maxHeight: 500 }}>{renderResult(result)}</div>}
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ironwatch_token"));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filterOpen, setFilterOpen] = useState(false);
  const [listings, setListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsSource, setListingsSource] = useState("mock");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchTerms, setSearchTerms] = useState(["excavator", "wheel loader", "backhoe", "crane", "bulldozer"]);
  const [newTerm, setNewTerm] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterEnding, setFilterEnding] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");
  const [locationSearch, setLocationSearch] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [priceRange, setPriceRange] = useState([0, 200000]);
  const [hoursRange, setHoursRange] = useState([0, 12000]);
  const [yearRange, setYearRange] = useState([2010, 2025]);
  const [conditionRange, setConditionRange] = useState([1, 5]);
  const [analysing, setAnalysing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState([]);
  const [emailConfig, setEmailConfig] = useState({ email: "pm@yourcompany.com", alertHours: 24 });

  // Fetch live listings on load
  useEffect(() => {
    if (!token) return;
    fetchListings(false);
  }, [token]);

  async function fetchListings(forceRefresh = false) {
    setListingsLoading(true);
    try {
      const kw = searchTerms.join(',');
      const res = await fetch(`${API_BASE}/listings?keywords=${encodeURIComponent(kw)}&refresh=${forceRefresh}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (data.listings && data.listings.length > 0) {
        setListings(data.listings.map(l => ({ ...l, endsAt: new Date(l.endsAt) })));
        setListingsSource(data.fromCache ? 'cache' : 'live');
        setLastUpdated(data.lastUpdated ? new Date(data.lastUpdated) : new Date());
      }
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    }
    setListingsLoading(false);
  }

  if (!token) return <LoginScreen onLogin={setToken} />;

  function logout() { localStorage.removeItem("ironwatch_token"); setToken(null); }

  function getCityCoords(city) {
    const coords = { london: [51.51, -0.12], birmingham: [52.48, -1.89], manchester: [53.48, -2.24], leeds: [53.80, -1.55], sheffield: [53.38, -1.47], bristol: [51.45, -2.59], glasgow: [55.86, -4.25], edinburgh: [55.95, -3.19], cardiff: [51.48, -3.18], liverpool: [53.41, -2.98], nottingham: [52.95, -1.15], newcastle: [54.97, -1.61] };
    return coords[city.toLowerCase().trim()] || null;
  }
  function distanceMiles(lat1, lng1, lat2, lng2) {
    const R = 3958.8, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const filtered = listings
    .filter(l => filterPlatform === "all" || l.platform === filterPlatform)
    .filter(l => !filterEnding || isEndingSoon(l.endsAt))
    .filter(l => { const p = l.price || l.guidePrice || 0; return p >= priceRange[0] && p <= priceRange[1]; })
    .filter(l => (l.hours == null) || (l.hours >= hoursRange[0] && l.hours <= hoursRange[1]))
    .filter(l => (l.year || 2018) >= yearRange[0] && (l.year || 2018) <= yearRange[1])
    .filter(l => (l.conditionScore || 3) >= conditionRange[0] && (l.conditionScore || 3) <= conditionRange[1])
    .filter(l => {
      if (!locationSearch.trim()) return true;
      const coords = getCityCoords(locationSearch);
      if (!coords) return l.location.toLowerCase().includes(locationSearch.toLowerCase());
      return distanceMiles(coords[0], coords[1], l.lat, l.lng) <= radiusMiles;
    })
    .sort((a, b) => sortBy === "relevance" ? b.relevanceScore - a.relevanceScore : sortBy === "price" ? a.price - b.price : a.endsAt - b.endsAt);

  const endingSoon = listings.filter(l => isEndingSoon(l.endsAt));
  const newToday = listings.filter(l => l.isNew);

  async function analyseListing(listing) {
    setSelectedListing(listing); setAnalysing(true); setAiAnalysis(""); setActiveTab("analyse");
    try {
      const res = await fetch(`${API_BASE}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: `You are an expert heavy plant and machinery valuator. Analyse this auction listing.\n\nListing: ${listing.title}\nPlatform: ${getPlatform(listing.platform).name}\nPrice: £${(listing.price||0).toLocaleString()}\nYear: ${listing.year} | Hours: ${listing.hours != null ? listing.hours.toLocaleString() : 'unknown'} | Condition: ${listing.condition}\nLocation: ${listing.location} | Ends: ${formatTimeLeft(listing.endsAt)}\nRelevance: ${listing.relevanceScore}%\n\nProvide:\n1. **Market Value Assessment**\n2. **Key Risk Factors**\n3. **Recommendation** — BUY / INSPECT FIRST / PASS\n4. **Maximum Bid**\n5. **Urgency**\n\nBe direct. Under 300 words.` }]
        })
      });
      const data = await res.json();
      if (res.status === 401) { logout(); return; }
      setAiAnalysis(data.content?.map(c => c.text || "").join("\n") || "Analysis unavailable.");
    } catch { setAiAnalysis("⚠️ Connection error. Please try again."); }
    setAnalysing(false);
  }

  async function runScan() {
    setScanning(true); setScanLog([]);
    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keywords: searchTerms })
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data:'));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.replace('data:', '').trim());
            if (json.msg) setScanLog(prev => [...prev, json.msg]);
            if (json.done) await fetchListings(false);
          } catch {}
        }
      }
    } catch (err) {
      setScanLog(prev => [...prev, '⚠️ Scan error — check server logs']);
    }
    setScanning(false);
  }

  const tabs = [{ id: "dashboard", label: "Dashboard", icon: "◈" }, { id: "listings", label: "Listings", icon: "⊞" }, { id: "photo", label: "Photo Valuator", icon: "📷" }, { id: "analyse", label: "AI Analysis", icon: "◎" }, { id: "settings", label: "Settings", icon: "⚙" }];

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Montserrat:wght@700;800;900&display=swap');
    .card { transition: transform 0.18s ease, border-color 0.18s ease; }
    .card:hover { transform: translateY(-2px); border-color: #1BBDB5 !important; }
    .tab-btn { transition: all 0.15s; }
    .tab-btn:hover { background: rgba(255,107,0,0.08) !important; }
    .pulse { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .scan-in { animation: slideIn 0.3s ease both; }
    @keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
    .abtn { cursor: pointer; transition: filter 0.15s, transform 0.12s; }
    .abtn:hover { filter: brightness(1.12); transform: translateY(-1px); }
    input, select { outline: none; }
    input:focus, select:focus { border-color: #1BBDB5 !important; }
  `;

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#0A0C0F", height: "100%", display: "flex", flexDirection: "column", color: "#E0E4EC", overflow: "hidden" }}>
      <style>{css}</style>

      {/* Header */}
      <div style={{ background: "#0D1117", borderBottom: "1px solid #1A2530", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, background: "linear-gradient(135deg, #1BBDB5, #44D62C)", clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontSize: 8, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color: "#000" }}>IDS</span></div>
          <div>
            <div className="iw-header-title" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, letterSpacing: "0.1em", color: "#1BBDB5", lineHeight: 1 }}>IRONWATCH</div>
            <div className="iw-header-sub" style={{ fontSize: 9, color: "#8A9AB8", letterSpacing: "0.15em" }}>MARKET INTELLIGENCE · POWERED BY IDS</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {endingSoon.length > 0 && <div className="iw-header-ending" style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(220,60,30,0.12)", border: "1px solid rgba(220,60,30,0.35)", padding: "5px 12px", fontSize: 10, color: "#FF4444" }}><span className="pulse">●</span> {endingSoon.length} ENDING</div>}
          <div className="iw-header-count" style={{ fontSize: 10, color: "#3A4458" }}>
            {listingsLoading ? <span style={{ color: "#1BBDB5" }}>● LOADING...</span> : listings.length === 0 ? <span style={{ color: "#5A6478" }}>No listings — click refresh</span> : <span>{filtered.length}/{listings.length} {listingsSource === 'live' ? <span style={{ color: "#44D62C" }}>● LIVE</span> : '(cached)'}</span>}
          </div>
          <button className="abtn iw-header-scan" onClick={runScan} disabled={scanning} style={{ background: scanning ? "#1A2530" : "#1BBDB5", color: scanning ? "#5A6478" : "#000", padding: "7px 16px", fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 500, letterSpacing: "0.1em", border: "none" }}>
            {scanning ? "SCANNING..." : "▶ RUN SCAN"}
          </button>
          <button className="iw-header-logout" onClick={logout} style={{ background: "transparent", border: "1px solid #1A2530", color: "#5A6478", padding: "7px 12px", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", cursor: "pointer" }}>LOGOUT</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="iw-tabs" style={{ background: "#0D1117", borderBottom: "1px solid #1A2530", display: "flex", padding: "0 24px", flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)} style={{ background: activeTab === t.id ? "rgba(255,107,0,0.1)" : "transparent", color: activeTab === t.id ? "#1BBDB5" : "#8A9AB8", borderBottom: `2px solid ${activeTab === t.id ? "#1BBDB5" : "transparent"}`, padding: "11px 18px", fontSize: 10, letterSpacing: "0.12em", marginBottom: -1, whiteSpace: "nowrap", border: "none", cursor: "pointer" }}>
            {t.icon} {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Filter overlay backdrop — mobile only */}
      <div className={`iw-filter-backdrop ${filterOpen ? "open" : ""}`} onClick={() => setFilterOpen(false)} />

      {/* Content */}
      <div className="iw-content" style={{ padding: 24, maxWidth: 1260, margin: "0 auto", width: "100%", flex: 1, overflowY: "auto" }}>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div>
            <div className="iw-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
              {[{ label: "ACTIVE LISTINGS", value: listings.length, sub: `${newToday.length} new today`, accent: "#1BBDB5" }, { label: "FILTERED RESULTS", value: filtered.length, sub: "matching criteria", accent: "#1BBDB5" }, { label: "ENDING < 24H", value: endingSoon.length, sub: "Require attention", accent: "#FF4444" }, { label: "AVG RELEVANCE", value: listings.length ? `${Math.round(listings.reduce((a, b) => a + b.relevanceScore, 0) / listings.length)}%` : 'N/A', sub: "AI scored", accent: "#44D62C" }].map(k => (
                <div key={k.label} style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "16px 18px" }}>
                  <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.15em", marginBottom: 6 }}>{k.label}</div>
                  <div className="iw-kpi-value" style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 34, color: k.accent, lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 9, color: "#5A6478", marginTop: 4 }}>{k.sub}</div>
                </div>
              ))}
            </div>
            {endingSoon.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#FF4444", marginBottom: 10 }}>⚠ URGENT — ENDING WITHIN 24 HOURS</div>
                {endingSoon.map(l => (
                  <div key={l.id} style={{ background: "rgba(220,60,30,0.07)", border: "1px solid rgba(220,60,30,0.25)", padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF4444" }} className="pulse" />
                      <div>
                        <a href={l.listingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#E0E4EC", fontSize: 12, fontWeight: 500, textDecoration: "none" }} onMouseOver={e => e.currentTarget.style.color = "#1BBDB5"} onMouseOut={e => e.currentTarget.style.color = "#E0E4EC"}>{l.title} ↗</a>
                        <div style={{ fontSize: 10, color: "#5A6478", marginTop: 2 }}>{getPlatform(l.platform).name} · {l.location}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}><div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 18, color: "#FF4444" }}>{formatTimeLeft(l.endsAt)}</div><div style={{ fontSize: 9, color: "#5A6478" }}>remaining</div></div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, fontWeight: 500 }}>{l.price > 0 ? <span>{l.platform === 'bidspotter' && <span style={{fontSize:9,color:'#A0A8B8',marginRight:2}}>BID</span>}£{l.price.toLocaleString()}</span> : l.guidePrice > 0 ? <span><span style={{fontSize:9,color:'#5A6478',marginRight:2}}>GUIDE</span>£{l.guidePrice.toLocaleString()}</span> : <span style={{color:'#5A6478'}}>No bids</span>}</div><div style={{ fontSize: 9, color: "#44D62C" }}>Score {l.relevanceScore}%</div></div>
                      <button className="abtn" onClick={() => analyseListing(l)} style={{ background: "#1BBDB5", color: "#000", padding: "7px 12px", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", fontWeight: 500, border: "none" }}>ANALYSE →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="iw-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "18px 20px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>PLATFORM ACTIVITY</div>
                {PLATFORMS.map(p => { const count = listings.filter(l => l.platform === p.id).length; if (!count) return null; return (<div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} /><div style={{ fontSize: 11, width: 100, color: "#A0A8B8" }}>{p.name}</div><div style={{ flex: 1, background: "#1A2530", height: 3, borderRadius: 2 }}><div style={{ width: `${(count / listings.length) * 100}%`, background: p.color, height: "100%", borderRadius: 2 }} /></div><div style={{ fontSize: 11, color: "#5A6478", width: 16, textAlign: "right" }}>{count}</div></div>); })}
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478" }}>SCAN LOG</div>
                  {!scanning && <button className="abtn" onClick={runScan} style={{ background: "rgba(255,107,0,0.12)", color: "#1BBDB5", padding: "4px 10px", fontSize: 9, letterSpacing: "0.1em", border: "1px solid rgba(255,107,0,0.2)" }}>RUN NOW</button>}
                </div>
                <div style={{ height: 180, overflowY: "auto", fontSize: 10, lineHeight: "22px" }}>
                  {!scanLog.length && <div style={{ color: "#2A3448" }}>No recent scans. Press RUN SCAN to start.</div>}
                  {scanLog.map((e, i) => <div key={i} className="scan-in" style={{ color: e.startsWith("✅") ? "#44D62C" : e.startsWith("🤖") || e.startsWith("📍") ? "#1BBDB5" : e.startsWith("🎯") ? "#1BBDB5" : "#A0A8B8" }}>{e}</div>)}
                  {scanning && <div style={{ color: "#1BBDB5" }} className="pulse">▌</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LISTINGS */}
        {activeTab === "listings" && (
          <div className="iw-listings-grid" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
            <div className={`iw-filter-sidebar ${filterOpen ? "open" : ""}`}>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "18px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#1BBDB5", marginBottom: 16 }}>📍 LOCATION SEARCH</div>
                <input value={locationSearch} onChange={e => setLocationSearch(e.target.value)} list="city-list" placeholder="City or region..." style={{ width: "100%", background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "8px 10px", fontSize: 11, fontFamily: "'DM Mono',monospace", marginBottom: 10 }} />
                <datalist id="city-list">{UK_CITIES.map(c => <option key={c} value={c} />)}</datalist>
                <div style={{ fontSize: 10, color: "#5A6478", marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>RADIUS</span><span style={{ color: "#1BBDB5" }}>{radiusMiles} miles</span></div>
                <input type="range" min={10} max={500} step={10} value={radiusMiles} onChange={e => setRadiusMiles(+e.target.value)} style={{ width: "100%", accentColor: "#1BBDB5", cursor: "pointer" }} />
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "18px 16px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#1BBDB5", marginBottom: 16 }}>⊟ FILTERS</div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 6 }}>PLATFORM</div>
                  <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={{ width: "100%", background: "#1A2530", border: "1px solid #1A2530", color: "#A0A8B8", padding: "8px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                    <option value="all">ALL PLATFORMS</option>
                    {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 6 }}>SORT BY</div>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: "100%", background: "#1A2530", border: "1px solid #1A2530", color: "#A0A8B8", padding: "8px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>
                    <option value="relevance">RELEVANCE</option>
                    <option value="ending">ENDING SOONEST</option>
                    <option value="price">PRICE LOW–HIGH</option>
                  </select>
                </div>
                <RangeSlider label="PRICE (£)" min={0} max={200000} value={priceRange} onChange={setPriceRange} format={v => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`} />
                <RangeSlider label="HOURS" min={0} max={12000} value={hoursRange} onChange={setHoursRange} format={v => `${v.toLocaleString()}h`} color="#1BBDB5" />
                <RangeSlider label="YEAR" min={2005} max={2025} value={yearRange} onChange={setYearRange} format={v => `${v}`} color="#44D62C" />
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#5A6478" }}>CONDITION</span><span style={{ fontSize: 11, color: "#44D62C" }}>{CONDITION_LABELS[conditionRange[0]]} — {CONDITION_LABELS[conditionRange[1]]}</span></div>
                  <RangeSlider label="" min={1} max={5} value={conditionRange} onChange={setConditionRange} format={v => CONDITION_LABELS[v]} color="#44D62C" />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 10, color: "#A0A8B8", marginBottom: 12 }}>
                  <input type="checkbox" checked={filterEnding} onChange={e => setFilterEnding(e.target.checked)} style={{ accentColor: "#FF4444" }} />ENDING &lt; 24H ONLY
                </label>
                <button onClick={() => { setPriceRange([0, 200000]); setHoursRange([0, 12000]); setYearRange([2010, 2025]); setConditionRange([1, 5]); setFilterPlatform("all"); setFilterEnding(false); setLocationSearch(""); setSortBy("relevance"); }} style={{ width: "100%", background: "transparent", border: "1px solid #1A2530", color: "#5A6478", padding: "7px", fontSize: 9, cursor: "pointer", letterSpacing: "0.1em" }}>↺ RESET ALL</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#5A6478", marginBottom: 14, letterSpacing: "0.1em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{filtered.length} LISTINGS{locationSearch && <span style={{ color: "#1BBDB5" }}> · within {radiusMiles}mi of {locationSearch}</span>}</span>
                <button className="iw-filter-toggle abtn" onClick={() => setFilterOpen(o => !o)} style={{ background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)", color: "#1BBDB5", padding: "6px 12px", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em" }}>⊟ FILTERS</button>
              </div>
              {filtered.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#3A4458" }}><div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 36, letterSpacing: "0.1em", marginBottom: 8 }}>NO MATCHES</div><div style={{ fontSize: 11 }}>Try adjusting your filters</div></div>}
              <div className="iw-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {filtered.map(listing => {
                  const plat = getPlatform(listing.platform);
                  const urgent = isEndingSoon(listing.endsAt);
                  return (
                    <div key={listing.id} className="card" style={{ background: "#0D1117", border: `1px solid ${urgent ? "rgba(220,60,30,0.3)" : "#1A2530"}`, overflow: "hidden", position: "relative" }}>
                      {listing.isNew && <div style={{ position: "absolute", top: 8, right: 8, background: "#1BBDB5", color: "#000", fontSize: 8, padding: "2px 6px", letterSpacing: "0.1em", fontWeight: 600, zIndex: 2 }}>NEW</div>}
                      <div style={{ height: 5, background: `linear-gradient(90deg, ${listing.imageColor}, ${plat.color})` }} />
                      <div style={{ padding: "12px 14px" }}>
                        <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: 8, textDecoration: "none" }}>
                          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.35, color: "#E0E4EC", transition: "color 0.15s" }} onMouseOver={e => e.currentTarget.style.color = "#1BBDB5"} onMouseOut={e => e.currentTarget.style.color = "#E0E4EC"}>{listing.title} <span style={{ fontSize: 10, color: "#3A4458" }}>↗</span></div>
                        </a>
                        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ background: "rgba(255,107,0,0.08)", color: plat.color, fontSize: 9, padding: "2px 7px", border: `1px solid ${plat.color}28` }}>{plat.name}</span>
                          <span style={{ background: "#1A2530", color: "#A0A8B8", fontSize: 9, padding: "2px 7px" }}>{listing.year}</span>
                          <span style={{ background: "#1A2530", color: "#A0A8B8", fontSize: 9, padding: "2px 7px" }}>{listing.hours != null ? listing.hours.toLocaleString() + 'h' : 'hrs N/A'}</span>
                          <span style={{ background: "#1A2530", color: listing.conditionScore >= 4 ? "#44D62C" : listing.conditionScore >= 3 ? "#44D62C" : "#1BBDB5", fontSize: 9, padding: "2px 7px" }}>{listing.condition}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#5A6478", marginBottom: 10 }}>📍 {listing.location}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <div>
                            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 22, color: "#E0E4EC", lineHeight: 1 }}>{listing.price > 0 ? <><span style={{fontSize:11,color:'#A0A8B8',marginRight:3}}>{listing.platform === 'bidspotter' ? 'BID' : ''}</span>£{listing.price.toLocaleString()}</> : listing.guidePrice > 0 ? <><span style={{fontSize:11,color:'#5A6478',marginRight:3}}>GUIDE</span>£{listing.guidePrice.toLocaleString()}</> : <span style={{fontSize:16,color:'#5A6478'}}>No bids</span>}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                              <div style={{ width: 60, background: "#1A2530", height: 3, borderRadius: 2 }}><div style={{ width: `${listing.relevanceScore}%`, background: listing.relevanceScore > 90 ? "#44D62C" : "#1BBDB5", height: "100%", borderRadius: 2 }} /></div>
                              <span style={{ fontSize: 9, color: listing.relevanceScore > 90 ? "#44D62C" : "#1BBDB5" }}>{listing.relevanceScore}%</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 16, color: urgent ? "#FF4444" : "#5A6478" }}>{formatTimeLeft(listing.endsAt)}</div>
                            <div style={{ fontSize: 9, color: "#3A4458" }}>remaining</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: "rgba(107,143,255,0.1)", border: "1px solid rgba(107,143,255,0.25)", color: "#1BBDB5", padding: "7px 0", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", textDecoration: "none", textAlign: "center", display: "block" }}>VIEW ↗</a>
                          <button className="abtn" onClick={() => analyseListing(listing)} style={{ flex: 1, background: "rgba(255,107,0,0.1)", border: "1px solid rgba(255,107,0,0.25)", color: "#1BBDB5", padding: "7px 0", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em" }}>AI ANALYSIS ◎</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PHOTO VALUATOR */}
        {activeTab === "photo" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 28, color: "#1BBDB5", letterSpacing: "0.08em" }}>PHOTO VALUATION ENGINE</div>
              <div style={{ fontSize: 11, color: "#5A6478", marginTop: 4 }}>Upload any photograph — AI will identify the machine, assess condition, and estimate current UK auction value.</div>
            </div>
            <PhotoAnalyser token={token} />
          </div>
        )}

        {/* AI ANALYSIS */}
        {activeTab === "analyse" && (
          <div>
            {!selectedListing ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#3A4458" }}>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 44, letterSpacing: "0.1em", marginBottom: 10 }}>SELECT A LISTING</div>
                <div style={{ fontSize: 11 }}>Go to Listings and click "AI Analysis" on any lot</div>
              </div>
            ) : (
              <div className="iw-analysis-grid" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
                <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 18 }}>
                  <div style={{ height: 4, background: `linear-gradient(90deg, ${selectedListing.imageColor}, ${getPlatform(selectedListing.platform).color})`, marginBottom: 14 }} />
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, lineHeight: 1.4 }}>{selectedListing.title}</div>
                  {[["Platform", getPlatform(selectedListing.platform).name], ["Guide Price", `£${(selectedListing.price||0).toLocaleString()}`], ["Year", selectedListing.year], ["Hours", selectedListing.hours != null ? `${selectedListing.hours.toLocaleString()}h` : 'N/A'], ["Condition", selectedListing.condition], ["Location", selectedListing.location], ["Ends in", formatTimeLeft(selectedListing.endsAt)], ["AI Score", `${selectedListing.relevanceScore}%`]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1A2530", fontSize: 11 }}><span style={{ color: "#5A6478" }}>{k}</span><span style={{ color: "#E0E4EC" }}>{v}</span></div>
                  ))}
                  <a href={selectedListing.listingUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, background: "rgba(107,143,255,0.1)", border: "1px solid rgba(107,143,255,0.25)", color: "#1BBDB5", padding: "9px", fontSize: 10, textDecoration: "none", textAlign: "center", letterSpacing: "0.1em" }}>VIEW LIVE LISTING ↗</a>
                  <button className="abtn" onClick={() => analyseListing(selectedListing)} style={{ width: "100%", marginTop: 8, background: "#1BBDB5", color: "#000", padding: "9px", fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", fontWeight: 500, border: "none" }}>↺ RE-ANALYSE</button>
                </div>
                <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 22 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>◎ AI VALUATION ANALYSIS {analysing && <span style={{ color: "#1BBDB5" }} className="pulse">● ANALYSING...</span>}</div>
                  {analysing && <div style={{ color: "#5A6478", fontSize: 11, lineHeight: 2.2 }}>{["Checking market comparables...", "Analysing hours vs depreciation...", "Reviewing platform history...", "Generating recommendation..."].map((s, i) => <div key={i} style={{ opacity: 0, animation: `slideIn 0.4s ease ${i * 0.35}s forwards` }}>▸ {s}</div>)}</div>}
                  {!analysing && aiAnalysis && (
                    <div style={{ fontSize: 12, lineHeight: 2, color: "#C0C8D8", whiteSpace: "pre-wrap" }}>
                      {aiAnalysis.split('\n').map((line, i) => {
                        if (line.startsWith('**') && line.includes('**')) {
                          const parts = line.split(/\*\*(.*?)\*\*/g);
                          const isRec = line.includes("Recommendation") || line.includes("RECOMMEND");
                          const isBuy = line.includes("BUY"); const isPass = line.includes("PASS");
                          return <div key={i} style={{ background: isRec ? (isBuy ? "rgba(0,200,150,0.1)" : isPass ? "rgba(200,50,50,0.1)" : "rgba(255,107,0,0.1)") : "transparent", borderLeft: isRec ? (isBuy ? "3px solid #44D62C" : isPass ? "3px solid #FF4444" : "3px solid #1BBDB5") : "none", paddingLeft: isRec ? 10 : 0, paddingTop: isRec ? 6 : 0, paddingBottom: isRec ? 6 : 0, marginBottom: 2 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#1BBDB5" }}>{p}</strong> : p)}</div>;
                        }
                        if (line.startsWith("- ")) return <div key={i} style={{ paddingLeft: 14, color: "#A0A8B8" }}>{line}</div>;
                        return <div key={i}>{line}</div>;
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div className="iw-settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>SEARCH KEYWORDS</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={newTerm} onChange={e => setNewTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTerm.trim()) { setSearchTerms(p => [...p, newTerm.trim().toLowerCase()]); setNewTerm(""); } }} placeholder="add keyword..." style={{ flex: 1, background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "8px 10px", fontSize: 11, fontFamily: "'DM Mono',monospace" }} />
                <button onClick={() => { if (newTerm.trim()) { setSearchTerms(p => [...p, newTerm.trim().toLowerCase()]); setNewTerm(""); } }} style={{ background: "#1BBDB5", color: "#000", padding: "8px 12px", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>+</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {searchTerms.map(t => <div key={t} style={{ background: "rgba(255,107,0,0.08)", border: "1px solid rgba(255,107,0,0.25)", padding: "3px 9px", fontSize: 10, display: "flex", alignItems: "center", gap: 7 }}><span style={{ color: "#1BBDB5" }}>{t}</span><button onClick={() => setSearchTerms(p => p.filter(x => x !== t))} style={{ background: "none", border: "none", color: "#5A6478", cursor: "pointer", fontSize: 12 }}>×</button></div>)}
              </div>
            </div>
            <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>EMAIL ALERTS</div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 5 }}>PRODUCT MANAGER EMAIL</div>
                <input value={emailConfig.email} onChange={e => setEmailConfig(p => ({ ...p, email: e.target.value }))} style={{ width: "100%", background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "8px 10px", fontSize: 11, fontFamily: "'DM Mono',monospace" }} />
              </div>
              <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 8 }}>ALERT THRESHOLD</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[4, 12, 24, 48].map(h => <button key={h} onClick={() => setEmailConfig(p => ({ ...p, alertHours: h }))} style={{ flex: 1, padding: "7px 0", background: emailConfig.alertHours === h ? "#1BBDB5" : "rgba(255,107,0,0.08)", color: emailConfig.alertHours === h ? "#000" : "#1BBDB5", border: `1px solid ${emailConfig.alertHours === h ? "#1BBDB5" : "rgba(255,107,0,0.2)"}`, fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>{h}h</button>)}
              </div>
            </div>
            <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>MONITORED PLATFORMS</div>
              {PLATFORMS.map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #1A2530" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} /><span style={{ fontSize: 11, color: "#A0A8B8" }}>{p.name}</span></div><a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#3A4458", textDecoration: "none" }} onMouseOver={e => e.currentTarget.style.color = "#1BBDB5"} onMouseOut={e => e.currentTarget.style.color = "#3A4458"}>visit ↗</a></div>)}
            </div>
            <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>ACCOUNT</div>
              <div style={{ fontSize: 11, color: "#A0A8B8", marginBottom: 16, lineHeight: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1A2530", paddingBottom: 8, marginBottom: 8 }}><span style={{ color: "#5A6478" }}>Version</span><span>1.0.0</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1A2530", paddingBottom: 8, marginBottom: 8 }}><span style={{ color: "#5A6478" }}>Access</span><span style={{ color: "#44D62C" }}>Authenticated ✓</span></div>
              </div>
              <button onClick={logout} style={{ width: "100%", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.25)", color: "#FF4444", padding: "10px", fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em", cursor: "pointer" }}>LOGOUT →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
