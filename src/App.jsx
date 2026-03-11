import { useState, useEffect, useRef } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── DATA ──────────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { id: "bidspotter", name: "Bidspotter", color: "#E8500A", url: "https://www.bidspotter.co.uk" },
  { id: "ebay", name: "eBay", color: "#E53238", url: "https://www.ebay.co.uk/b/Heavy-Equipment/183071" },
  { id: "euroauctions", name: "Euro Auctions", color: "#0057B8", url: "https://www.euroauctions.com" },
  { id: "mascus", name: "Mascus", color: "#FF6B00", url: "https://www.mascus.co.uk" },
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

// ─── GLOBAL STYLES ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Montserrat:wght@400;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0A0C0F; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0D1117; }
  ::-webkit-scrollbar-thumb { background: #1BBDB5; border-radius: 2px; }
  .ids-btn { cursor: pointer; transition: all 0.15s; border: none; }
  .ids-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
  .abtn { cursor: pointer; transition: all 0.15s; }
  .abtn:hover { opacity: 0.8; }
  .card { transition: border-color 0.15s, transform 0.15s; }
  .card:hover { border-color: rgba(27,189,181,0.35) !important; transform: translateY(-1px); }
  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
  .pulse { animation: pulse 1.2s ease infinite; }
  @keyframes slideIn { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
  .scan-in { animation: slideIn 0.3s ease forwards; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
  .fade-up { animation: fadeUp 0.35s ease forwards; }
  @media (max-width: 900px) {
    .iw-listings-grid { grid-template-columns: 1fr !important; }
    .iw-analysis-grid { grid-template-columns: 1fr !important; }
    .iw-settings-grid { grid-template-columns: 1fr !important; }
    .iw-filter-sidebar { display: none !important; }
    .iw-filter-sidebar.open { display: block !important; position: fixed; top:0; left:0; right:0; bottom:0; overflow-y:auto; z-index:100; background:#0A0C0F; padding:20px; }
    .iw-filter-toggle { display: flex !important; }
    .iw-cards-grid { grid-template-columns: 1fr !important; }
    .iw-dash-stats { grid-template-columns: repeat(2,1fr) !important; }
    .iw-nav-tabs { gap: 2px !important; overflow-x: auto; }
    .iw-nav-tabs button { font-size: 8px !important; padding: 5px 7px !important; white-space: nowrap; }
    .iw-scan-grid { grid-template-columns: 1fr !important; }
  }
  @media (min-width: 901px) {
    .iw-filter-toggle { display: none !important; }
  }
  input, select, textarea { color-scheme: dark; }
  input:focus, select:focus, textarea:focus { outline: 1px solid #1BBDB5 !important; }
`;

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
        if (isTouch) { window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up); }
        else { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }
      };
      if (isTouch) { window.addEventListener("touchmove", move, { passive: false }); window.addEventListener("touchend", up); }
      else { window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }
    };
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {label && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#5A6478" }}>{label}</span>
        <span style={{ fontSize: 11, color, fontWeight: 500 }}>{format(low)} — {format(high)}</span>
      </div>}
      <div ref={trackRef} style={{ position: "relative", height: 4, background: "#1A2530", borderRadius: 2, margin: "12px 8px", cursor: "pointer" }}>
        <div style={{ position: "absolute", height: "100%", borderRadius: 2, background: color, opacity: 0.85, left: `${getPct(low)}%`, width: `${getPct(high) - getPct(low)}%` }} />
        {[["low", low], ["high", high]].map(([which, val]) => (
          <div key={which}
            onMouseDown={handleDragStart(which)}
            onTouchStart={handleDragStart(which)}
            style={{ position: "absolute", top: "50%", left: `${getPct(val)}%`, transform: "translate(-50%, -50%)", width: 22, height: 22, borderRadius: "50%", background: color, border: "2px solid #0A0C0F", cursor: "grab", zIndex: 2, boxShadow: `0 0 8px ${color}55`, touchAction: "none" }} />
        ))}
      </div>
    </div>
  );
}

// ─── IDS HEXAGON LOGO MARK ─────────────────────────────────────────────────────
function HexMark({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: "linear-gradient(135deg, #1BBDB5 0%, #44D62C 100%)",
      clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: size * 0.22, fontFamily: "'Montserrat',sans-serif", fontWeight: 900, color: "#000", letterSpacing: "-0.02em" }}>IDS</span>
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
    <div style={{ width: "100%", minHeight: "100vh", background: "#0A0C0F", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", position: "relative", overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      {/* IDS teal-green grid */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(27,189,181,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(27,189,181,0.025) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
      {/* Glow */}
      <div style={{ position: "fixed", top: "-10%", left: "50%", transform: "translateX(-50%)", width: "70%", height: "50%", background: "radial-gradient(ellipse, rgba(27,189,181,0.055) 0%, transparent 65%)", pointerEvents: "none" }} />

      <div style={{ width: 400, position: "relative", zIndex: 1 }} className="fade-up">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <HexMark size={68} />
          </div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 38, letterSpacing: "0.08em", background: "linear-gradient(135deg, #1BBDB5, #44D62C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1 }}>IRONWATCH</div>
          <div style={{ fontSize: 9, color: "#3A4458", letterSpacing: "0.2em", marginTop: 10 }}>MARKET INTELLIGENCE · POWERED BY IDS</div>
        </div>

        {/* Login box */}
        <div style={{ background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
          <div style={{ padding: 32 }}>
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
              <button type="submit" disabled={loading || !password} className="ids-btn" style={{ width: "100%", background: loading || !password ? "#1A2530" : "linear-gradient(135deg, #1BBDB5, #44D62C)", color: loading || !password ? "#3A4458" : "#000", padding: "12px", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.15em", fontWeight: 700, cursor: loading || !password ? "not-allowed" : "pointer", border: "none", transition: "all 0.15s" }}>
                {loading ? "VERIFYING..." : "ACCESS IRONWATCH →"}
              </button>
            </form>
            <div style={{ marginTop: 20, padding: "12px", background: "rgba(27,189,181,0.05)", border: "1px solid rgba(27,189,181,0.12)" }}>
              <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 4 }}>DEFAULT PASSWORD</div>
              <div style={{ fontSize: 11, color: "#1BBDB5", fontFamily: "'DM Mono', monospace" }}>ironwatch2024</div>
              <div style={{ fontSize: 9, color: "#3A4458", marginTop: 4 }}>Change this in your server environment variables</div>
            </div>
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
              { type: "text", text: `You are an expert plant and machinery valuation consultant with 20+ years of experience in UK auction markets. Analyse this image of plant/machinery and provide:

1. **Machine Identification**: Make, model, estimated year, category
2. **Condition Assessment**: Visual condition score (1-5) and observations
3. **Hours Estimate**: Typical hours for apparent age/condition
4. **UK Market Valuation**: Current estimated auction value range in GBP
5. **Recommendation**: BUY / PASS / MONITOR — with clear reasoning

${machineType ? `Additional context provided: ${machineType}` : ""}

Format your response with bold headers using **Header** syntax.` }
            ]
          }],
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000
        })
      });
      const data = await res.json();
      setResult(data.content?.[0]?.text || "Analysis failed.");
    } catch {
      setResult("Error contacting analysis service. Please try again.");
    }
    setAnalysing(false);
  }

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !image && fileRef.current?.click()}
        style={{ border: `2px dashed ${dragOver ? "#1BBDB5" : "#1A2530"}`, background: dragOver ? "rgba(27,189,181,0.05)" : "#0D1117", padding: image ? 0 : "60px 20px", textAlign: "center", cursor: image ? "default" : "pointer", marginBottom: 16, overflow: "hidden", transition: "border-color 0.15s, background 0.15s" }}
      >
        {!image && <>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 13, color: "#A0A8B8", marginBottom: 6 }}>Drop an image here or click to upload</div>
          <div style={{ fontSize: 10, color: "#3A4458", letterSpacing: "0.1em" }}>JPG · PNG · WEBP · Any plant or machinery</div>
        </>}
        {image && <img src={image} alt="upload" style={{ width: "100%", maxHeight: 340, objectFit: "contain", display: "block" }} />}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input value={machineType} onChange={e => setMachineType(e.target.value)} placeholder="Optional: add context (e.g. '2019 Caterpillar 320, 4500hrs')" style={{ flex: 1, background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "10px 12px", fontSize: 11, fontFamily: "'DM Mono',monospace" }} />
        {image && <button onClick={() => { setImage(null); setImageBase64(null); setResult(null); setMachineType(""); }} className="abtn" style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.2)", color: "#FF4444", padding: "10px 14px", fontSize: 11, cursor: "pointer" }}>✕</button>}
      </div>

      <button onClick={analyse} disabled={!imageBase64 || analysing} className="ids-btn" style={{ width: "100%", background: !imageBase64 || analysing ? "#1A2530" : "linear-gradient(135deg, #1BBDB5, #44D62C)", color: !imageBase64 || analysing ? "#3A4458" : "#000", padding: "12px", fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: "0.15em", fontWeight: 700, border: "none", cursor: !imageBase64 || analysing ? "not-allowed" : "pointer" }}>
        {analysing ? <span className="pulse">◎ ANALYSING...</span> : "◎ ANALYSE & VALUE"}
      </button>

      {result && (
        <div style={{ marginTop: 20, background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>◎ VALUATION RESULT</div>
            <div style={{ fontSize: 12, lineHeight: 2, color: "#C0C8D8" }}>
              {result.split('\n').map((line, i) => {
                if (line.startsWith('**') && line.includes('**')) {
                  const parts = line.split(/\*\*(.*?)\*\*/g);
                  const isRec = line.includes("Recommendation") || line.includes("RECOMMEND");
                  const isBuy = line.includes("BUY"); const isPass = line.includes("PASS");
                  return <div key={i} style={{ background: isRec ? (isBuy ? "rgba(68,214,44,0.1)" : isPass ? "rgba(200,50,50,0.1)" : "rgba(27,189,181,0.1)") : "transparent", borderLeft: isRec ? (isBuy ? "3px solid #44D62C" : isPass ? "3px solid #FF4444" : "3px solid #1BBDB5") : "none", paddingLeft: isRec ? 10 : 0, paddingTop: isRec ? 6 : 0, paddingBottom: isRec ? 6 : 0, marginBottom: 2 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#1BBDB5" }}>{p}</strong> : p)}</div>;
                }
                if (line.startsWith("- ")) return <div key={i} style={{ paddingLeft: 14, color: "#A0A8B8" }}>{line}</div>;
                return <div key={i}>{line}</div>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ironwatch_token") || "");
  const [listings, setListings] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanLog, setScanLog] = useState([]);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [filterOpen, setFilterOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(100);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [sortBy, setSortBy] = useState("relevance");
  const [priceRange, setPriceRange] = useState([0, 200000]);
  const [hoursRange, setHoursRange] = useState([0, 12000]);
  const [yearRange, setYearRange] = useState([2010, 2025]);
  const [conditionRange, setConditionRange] = useState([1, 5]);
  const [filterEnding, setFilterEnding] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [searchTerms, setSearchTerms] = useState(["excavator", "telehandler", "dumper", "bulldozer"]);
  const [emailConfig, setEmailConfig] = useState({ email: "", alertHours: 24 });
  const [selectedListing, setSelectedListing] = useState(null);
  const [analysing, setAnalysing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  function logout() {
    localStorage.removeItem("ironwatch_token");
    setToken("");
  }

  async function runScan() {
    if (scanning) return;
    setScanning(true);
    setScanLog([]);
    try {
      const res = await fetch(`${API_BASE}/scrape`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.log) data.log.forEach(l => setScanLog(p => [...p, l]));
      if (data.listings) {
        setListings(data.listings);
        setScanLog(p => [...p, `✅ Loaded ${data.listings.length} listings`]);
      }
    } catch {
      setScanLog(p => [...p, "⚠ Scan failed — check server connection"]);
    }
    setScanning(false);
  }

  async function analyseListing(listing) {
    setSelectedListing(listing);
    setActiveTab("analyse");
    setAnalysing(true);
    setAiAnalysis(null);
    try {
      const res = await fetch(`${API_BASE}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `You are an expert plant and machinery valuation consultant. Analyse this auction listing and provide a detailed market analysis:

**Listing Details:**
- Title: ${listing.title}
- Platform: ${getPlatform(listing.platform).name}
- Current Price: £${(listing.price||0).toLocaleString()}
- Year: ${listing.year}
- Hours: ${listing.hours != null ? listing.hours.toLocaleString() + 'h' : 'N/A'}
- Condition: ${listing.condition}
- Location: ${listing.location}
- Ends: ${formatTimeLeft(listing.endsAt)}

Provide:
1. **Market Context**: How does this compare to typical UK auction prices?
2. **Value Assessment**: Is the current bid/guide price fair, below, or above market?
3. **Risk Factors**: Any concerns about age, hours, condition, or platform?
4. **Recommendation**: BUY / PASS / MONITOR — with specific price guidance

Format with bold **Headers** and be direct and specific.`
          }],
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000
        })
      });
      const data = await res.json();
      setAiAnalysis(data.content?.[0]?.text || "Analysis failed.");
    } catch {
      setAiAnalysis("Error contacting analysis service.");
    }
    setAnalysing(false);
  }

  // ─── FILTER + SORT ───────────────────────────────────────────────────────────
  const filtered = listings.filter(l => {
    if (filterPlatform !== "all" && l.platform !== filterPlatform) return false;
    if (l.price > 0 && (l.price < priceRange[0] || l.price > priceRange[1])) return false;
    if (l.hours != null && (l.hours < hoursRange[0] || l.hours > hoursRange[1])) return false;
    if (l.year && (l.year < yearRange[0] || l.year > yearRange[1])) return false;
    if (l.conditionScore && (l.conditionScore < conditionRange[0] || l.conditionScore > conditionRange[1])) return false;
    if (filterEnding && !isEndingSoon(l.endsAt)) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "ending") return new Date(a.endsAt) - new Date(b.endsAt);
    if (sortBy === "price") return (a.price || 0) - (b.price || 0);
    return (b.relevanceScore || 0) - (a.relevanceScore || 0);
  });

  if (!token) return <LoginScreen onLogin={setToken} />;

  // ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
  const endingSoon = listings.filter(l => isEndingSoon(l.endsAt)).length;
  const pricedListings = listings.filter(l => l.price > 0);
  const avgPrice = pricedListings.length ? Math.round(pricedListings.reduce((s, l) => s + l.price, 0) / pricedListings.length) : 0;
  const activePlatforms = [...new Set(listings.map(l => l.platform))].length;

  const TABS = [
    { id: "dashboard", label: "DASHBOARD" },
    { id: "scan", label: "SCAN" },
    { id: "listings", label: listings.length ? `LISTINGS (${listings.length})` : "LISTINGS" },
    { id: "photo", label: "PHOTO VALUATION" },
    { id: "analyse", label: "AI ANALYSIS" },
    { id: "settings", label: "SETTINGS" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0A0C0F", fontFamily: "'DM Mono', monospace", color: "#E0E4EC" }}>
      <style>{GLOBAL_CSS}</style>

      {/* ─── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "#0D1117", borderBottom: "1px solid #1A2530", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <HexMark size={34} />
          <div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: "0.08em", background: "linear-gradient(135deg, #1BBDB5, #44D62C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1.1 }}>IRONWATCH</div>
            <div style={{ fontSize: 7, color: "#3A4458", letterSpacing: "0.14em" }}>POWERED BY IDS</div>
          </div>
        </div>
        <div className="iw-nav-tabs" style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className="abtn" style={{ background: activeTab === t.id ? "rgba(27,189,181,0.12)" : "transparent", border: activeTab === t.id ? "1px solid rgba(27,189,181,0.3)" : "1px solid transparent", color: activeTab === t.id ? "#1BBDB5" : "#5A6478", padding: "6px 12px", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", cursor: "pointer" }}>{t.label}</button>
          ))}
          <div style={{ width: 1, height: 18, background: "#1A2530", margin: "0 4px" }} />
          <button onClick={logout} className="abtn" style={{ background: "transparent", border: "1px solid transparent", color: "#3A4458", padding: "6px 10px", fontSize: 9, cursor: "pointer", letterSpacing: "0.1em" }}>LOGOUT →</button>
        </div>
      </div>

      {/* ─── CONTENT ────────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 24px 48px" }}>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="fade-up">
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 24, letterSpacing: "0.04em", color: "#E0E4EC" }}>MARKET OVERVIEW</div>
              <div style={{ fontSize: 11, color: "#5A6478", marginTop: 5 }}>Live auction intelligence across UK plant &amp; machinery markets</div>
            </div>
            <div className="iw-dash-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 22 }}>
              {[
                { label: "ACTIVE LISTINGS", value: listings.length || "—", color: "#1BBDB5" },
                { label: "ENDING < 24H", value: endingSoon || "—", color: "#FF4444" },
                { label: "AVG PRICE", value: avgPrice > 0 ? `£${(avgPrice/1000).toFixed(0)}k` : "—", color: "#44D62C" },
                { label: "PLATFORMS", value: activePlatforms || "—", color: "#1BBDB5" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "18px 20px", overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 32, color: s.color, lineHeight: 1, marginTop: 8 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.12em", marginTop: 8 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {!listings.length ? (
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "48px 40px", textAlign: "center", overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 18, color: "#3A4458", marginBottom: 10, letterSpacing: "0.04em" }}>NO LISTINGS LOADED</div>
                <div style={{ fontSize: 11, color: "#3A4458", marginBottom: 24 }}>Run a scan to pull live auction data from all monitored platforms</div>
                <button onClick={() => setActiveTab("scan")} className="ids-btn" style={{ background: "linear-gradient(135deg, #1BBDB5, #44D62C)", color: "#000", padding: "10px 28px", fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: "0.15em", fontWeight: 700, border: "none", cursor: "pointer" }}>GO TO SCAN →</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 16, marginTop: 8 }}>PLATFORM BREAKDOWN</div>
                  {PLATFORMS.filter(p => listings.some(l => l.platform === p.id)).map(p => {
                    const count = listings.filter(l => l.platform === p.id).length;
                    const pct = Math.round((count / listings.length) * 100);
                    return (
                      <div key={p.id} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: "#A0A8B8" }}>{p.name}</span>
                          <span style={{ fontSize: 10, color: "#1BBDB5" }}>{count}</span>
                        </div>
                        <div style={{ height: 3, background: "#1A2530", borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #1BBDB5, #44D62C)", borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 16, marginTop: 8 }}>ENDING SOON</div>
                  {listings.filter(l => isEndingSoon(l.endsAt)).slice(0, 5).map(l => (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1A2530" }}>
                      <span style={{ fontSize: 10, color: "#A0A8B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{l.title}</span>
                      <span style={{ fontSize: 10, color: "#FF4444", flexShrink: 0 }}>{formatTimeLeft(l.endsAt)}</span>
                    </div>
                  ))}
                  {!endingSoon && <div style={{ fontSize: 11, color: "#3A4458" }}>No lots ending in next 24h</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCAN */}
        {activeTab === "scan" && (
          <div className="fade-up">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 24, color: "#E0E4EC", letterSpacing: "0.04em" }}>LIVE MARKET SCAN</div>
              <div style={{ fontSize: 11, color: "#5A6478", marginTop: 5 }}>Pull current listings from all monitored auction platforms</div>
            </div>
            <div className="iw-scan-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 18, marginTop: 8 }}>SCAN CONTROLS</div>
                <button onClick={runScan} disabled={scanning} className="ids-btn" style={{ width: "100%", background: scanning ? "#1A2530" : "linear-gradient(135deg, #1BBDB5, #44D62C)", color: scanning ? "#3A4458" : "#000", padding: "14px", fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: "0.15em", fontWeight: 700, border: "none", cursor: scanning ? "not-allowed" : "pointer", marginBottom: 20 }}>
                  {scanning ? <span className="pulse">◉ SCANNING PLATFORMS...</span> : "◉ RUN SCAN"}
                </button>
                <div style={{ fontSize: 10, color: "#5A6478", marginBottom: 10, letterSpacing: "0.1em" }}>MONITORED PLATFORMS</div>
                {PLATFORMS.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
                    <span style={{ fontSize: 10, color: "#A0A8B8" }}>{p.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: 20, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>SCAN LOG</span>
                  {scanLog.length > 0 && <button onClick={() => setScanLog([])} className="abtn" style={{ background: "none", border: "none", color: "#3A4458", fontSize: 9, cursor: "pointer" }}>CLEAR</button>}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, lineHeight: 2.1, maxHeight: 320, overflowY: "auto" }}>
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
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "18px 16px", marginBottom: 14, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#1BBDB5", marginBottom: 16, marginTop: 6 }}>📍 LOCATION SEARCH</div>
                <input value={locationSearch} onChange={e => setLocationSearch(e.target.value)} list="city-list" placeholder="City or region..." style={{ width: "100%", background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "8px 10px", fontSize: 11, fontFamily: "'DM Mono',monospace", marginBottom: 10 }} />
                <datalist id="city-list">{UK_CITIES.map(c => <option key={c} value={c} />)}</datalist>
                <div style={{ fontSize: 10, color: "#5A6478", marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>RADIUS</span><span style={{ color: "#1BBDB5" }}>{radiusMiles} miles</span></div>
                <input type="range" min={10} max={500} step={10} value={radiusMiles} onChange={e => setRadiusMiles(+e.target.value)} style={{ width: "100%", accentColor: "#1BBDB5", cursor: "pointer" }} />
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", padding: "18px 16px", overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#1BBDB5", marginBottom: 16, marginTop: 6 }}>⊟ FILTERS</div>
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
                <RangeSlider label="PRICE (£)" min={0} max={200000} value={priceRange} onChange={setPriceRange} format={v => v >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${v}`} color="#1BBDB5" />
                <RangeSlider label="HOURS" min={0} max={12000} value={hoursRange} onChange={setHoursRange} format={v => `${v.toLocaleString()}h`} color="#44D62C" />
                <RangeSlider label="YEAR" min={2005} max={2025} value={yearRange} onChange={setYearRange} format={v => `${v}`} color="#1BBDB5" />
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#5A6478" }}>CONDITION</span><span style={{ fontSize: 11, color: "#44D62C" }}>{CONDITION_LABELS[conditionRange[0]]} — {CONDITION_LABELS[conditionRange[1]]}</span></div>
                  <RangeSlider label="" min={1} max={5} value={conditionRange} onChange={setConditionRange} format={v => CONDITION_LABELS[v]} color="#44D62C" />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 10, color: "#A0A8B8", marginBottom: 12 }}>
                  <input type="checkbox" checked={filterEnding} onChange={e => setFilterEnding(e.target.checked)} style={{ accentColor: "#FF4444" }} />ENDING &lt; 24H ONLY
                </label>
                <button onClick={() => { setPriceRange([0, 200000]); setHoursRange([0, 12000]); setYearRange([2010, 2025]); setConditionRange([1, 5]); setFilterPlatform("all"); setFilterEnding(false); setLocationSearch(""); setSortBy("relevance"); }} className="abtn" style={{ width: "100%", background: "transparent", border: "1px solid #1A2530", color: "#5A6478", padding: "7px", fontSize: 9, cursor: "pointer", letterSpacing: "0.1em" }}>↺ RESET ALL</button>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#5A6478", marginBottom: 14, letterSpacing: "0.1em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{filtered.length} LISTINGS{locationSearch && <span style={{ color: "#1BBDB5" }}> · within {radiusMiles}mi of {locationSearch}</span>}</span>
                <button className="iw-filter-toggle abtn" onClick={() => setFilterOpen(o => !o)} style={{ background: "rgba(27,189,181,0.1)", border: "1px solid rgba(27,189,181,0.25)", color: "#1BBDB5", padding: "6px 12px", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em" }}>⊟ FILTERS</button>
              </div>
              {filtered.length === 0 && <div style={{ textAlign: "center", padding: "60px 0", color: "#3A4458" }}><div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: "0.04em", marginBottom: 8 }}>NO MATCHES</div><div style={{ fontSize: 11 }}>Try adjusting your filters</div></div>}
              <div className="iw-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {filtered.map(listing => {
                  const plat = getPlatform(listing.platform);
                  const urgent = isEndingSoon(listing.endsAt);
                  return (
                    <div key={listing.id} className="card" style={{ background: "#0D1117", border: `1px solid ${urgent ? "rgba(255,68,68,0.3)" : "#1A2530"}`, overflow: "hidden", position: "relative" }}>
                      {listing.isNew && <div style={{ position: "absolute", top: 8, right: 8, background: "linear-gradient(135deg, #1BBDB5, #44D62C)", color: "#000", fontSize: 8, padding: "2px 6px", letterSpacing: "0.1em", fontWeight: 700, zIndex: 2 }}>NEW</div>}
                      <div style={{ height: 4, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                      <div style={{ padding: "12px 14px" }}>
                        <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginBottom: 8, textDecoration: "none" }}>
                          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.35, color: "#E0E4EC", transition: "color 0.15s" }} onMouseOver={e => e.currentTarget.style.color = "#1BBDB5"} onMouseOut={e => e.currentTarget.style.color = "#E0E4EC"}>{listing.title} <span style={{ fontSize: 10, color: "#3A4458" }}>↗</span></div>
                        </a>
                        <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                          <span style={{ background: "rgba(27,189,181,0.08)", color: plat.color, fontSize: 9, padding: "2px 7px", border: `1px solid ${plat.color}28` }}>{plat.name}</span>
                          <span style={{ background: "#1A2530", color: "#A0A8B8", fontSize: 9, padding: "2px 7px" }}>{listing.year}</span>
                          <span style={{ background: "#1A2530", color: "#A0A8B8", fontSize: 9, padding: "2px 7px" }}>{listing.hours != null ? listing.hours.toLocaleString() + 'h' : 'hrs N/A'}</span>
                          <span style={{ background: "#1A2530", color: listing.conditionScore >= 4 ? "#44D62C" : listing.conditionScore >= 3 ? "#1BBDB5" : "#FF6B00", fontSize: 9, padding: "2px 7px" }}>{listing.condition}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#5A6478", marginBottom: 10 }}>📍 {listing.location}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                          <div>
                            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 20, color: "#E0E4EC", lineHeight: 1 }}>
                              {listing.price > 0 ? <><span style={{fontSize:10,color:'#A0A8B8',marginRight:3,fontFamily:"'DM Mono',monospace"}}>{listing.platform === 'bidspotter' ? 'BID' : ''}</span>£{listing.price.toLocaleString()}</> : listing.guidePrice > 0 ? <><span style={{fontSize:10,color:'#5A6478',marginRight:3,fontFamily:"'DM Mono',monospace"}}>GUIDE</span>£{listing.guidePrice.toLocaleString()}</> : <span style={{fontSize:14,color:'#5A6478',fontFamily:"'DM Mono',monospace"}}>No bids</span>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                              <div style={{ width: 60, background: "#1A2530", height: 3, borderRadius: 2 }}><div style={{ width: `${listing.relevanceScore}%`, background: listing.relevanceScore > 90 ? "#44D62C" : "#1BBDB5", height: "100%", borderRadius: 2 }} /></div>
                              <span style={{ fontSize: 9, color: listing.relevanceScore > 90 ? "#44D62C" : "#1BBDB5" }}>{listing.relevanceScore}%</span>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 14, color: urgent ? "#FF4444" : "#5A6478" }}>{formatTimeLeft(listing.endsAt)}</div>
                            <div style={{ fontSize: 9, color: "#3A4458" }}>remaining</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, background: "rgba(27,189,181,0.08)", border: "1px solid rgba(27,189,181,0.2)", color: "#1BBDB5", padding: "7px 0", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", textDecoration: "none", textAlign: "center", display: "block" }}>VIEW ↗</a>
                          <button className="abtn" onClick={() => analyseListing(listing)} style={{ flex: 1, background: "rgba(68,214,44,0.08)", border: "1px solid rgba(68,214,44,0.2)", color: "#44D62C", padding: "7px 0", fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em" }}>AI ANALYSIS ◎</button>
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
          <div className="fade-up">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 24, color: "#E0E4EC", letterSpacing: "0.04em" }}>PHOTO VALUATION ENGINE</div>
              <div style={{ fontSize: 11, color: "#5A6478", marginTop: 5 }}>Upload any photograph — AI will identify the machine, assess condition, and estimate current UK auction value.</div>
            </div>
            <PhotoAnalyser token={token} />
          </div>
        )}

        {/* AI ANALYSIS */}
        {activeTab === "analyse" && (
          <div className="fade-up">
            {!selectedListing ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#3A4458" }}>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 900, fontSize: 36, letterSpacing: "0.04em", marginBottom: 10 }}>SELECT A LISTING</div>
                <div style={{ fontSize: 11 }}>Go to Listings and click "AI Analysis" on any lot</div>
              </div>
            ) : (
              <div className="iw-analysis-grid" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
                <div style={{ background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
                  <div style={{ height: 4, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                  <div style={{ padding: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12, lineHeight: 1.4 }}>{selectedListing.title}</div>
                    {[["Platform", getPlatform(selectedListing.platform).name], ["Guide Price", `£${(selectedListing.price||0).toLocaleString()}`], ["Year", selectedListing.year], ["Hours", selectedListing.hours != null ? `${selectedListing.hours.toLocaleString()}h` : 'N/A'], ["Condition", selectedListing.condition], ["Location", selectedListing.location], ["Ends in", formatTimeLeft(selectedListing.endsAt)], ["AI Score", `${selectedListing.relevanceScore}%`]].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1A2530", fontSize: 11 }}><span style={{ color: "#5A6478" }}>{k}</span><span style={{ color: "#E0E4EC" }}>{v}</span></div>
                    ))}
                    <a href={selectedListing.listingUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, background: "rgba(27,189,181,0.08)", border: "1px solid rgba(27,189,181,0.2)", color: "#1BBDB5", padding: "9px", fontSize: 10, textDecoration: "none", textAlign: "center", letterSpacing: "0.1em" }}>VIEW LIVE LISTING ↗</a>
                    <button className="ids-btn" onClick={() => analyseListing(selectedListing)} style={{ width: "100%", marginTop: 8, background: "linear-gradient(135deg, #1BBDB5, #44D62C)", color: "#000", padding: "9px", fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em", fontWeight: 700, border: "none" }}>↺ RE-ANALYSE</button>
                  </div>
                </div>
                <div style={{ background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
                  <div style={{ height: 4, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                  <div style={{ padding: 22 }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>◎ AI VALUATION ANALYSIS {analysing && <span style={{ color: "#1BBDB5" }} className="pulse">● ANALYSING...</span>}</div>
                    {analysing && <div style={{ color: "#5A6478", fontSize: 11, lineHeight: 2.2 }}>{["Checking market comparables...", "Analysing hours vs depreciation...", "Reviewing platform history...", "Generating recommendation..."].map((s, i) => <div key={i} style={{ opacity: 0, animation: `slideIn 0.4s ease ${i * 0.35}s forwards` }}>▸ {s}</div>)}</div>}
                    {!analysing && aiAnalysis && (
                      <div style={{ fontSize: 12, lineHeight: 2, color: "#C0C8D8", whiteSpace: "pre-wrap" }}>
                        {aiAnalysis.split('\n').map((line, i) => {
                          if (line.startsWith('**') && line.includes('**')) {
                            const parts = line.split(/\*\*(.*?)\*\*/g);
                            const isRec = line.includes("Recommendation") || line.includes("RECOMMEND");
                            const isBuy = line.includes("BUY"); const isPass = line.includes("PASS");
                            return <div key={i} style={{ background: isRec ? (isBuy ? "rgba(68,214,44,0.1)" : isPass ? "rgba(200,50,50,0.1)" : "rgba(27,189,181,0.1)") : "transparent", borderLeft: isRec ? (isBuy ? "3px solid #44D62C" : isPass ? "3px solid #FF4444" : "3px solid #1BBDB5") : "none", paddingLeft: isRec ? 10 : 0, paddingTop: isRec ? 6 : 0, paddingBottom: isRec ? 6 : 0, marginBottom: 2 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#1BBDB5" }}>{p}</strong> : p)}</div>;
                          }
                          if (line.startsWith("- ")) return <div key={i} style={{ paddingLeft: 14, color: "#A0A8B8" }}>{line}</div>;
                          return <div key={i}>{line}</div>;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === "settings" && (
          <div className="fade-up">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 24, color: "#E0E4EC", letterSpacing: "0.04em" }}>SETTINGS</div>
              <div style={{ fontSize: 11, color: "#5A6478", marginTop: 5 }}>Configure keywords, alerts, and platform monitoring</div>
            </div>
            <div className="iw-settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
                <div style={{ height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>SEARCH KEYWORDS</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input value={newTerm} onChange={e => setNewTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTerm.trim()) { setSearchTerms(p => [...p, newTerm.trim().toLowerCase()]); setNewTerm(""); } }} placeholder="add keyword..." style={{ flex: 1, background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "8px 10px", fontSize: 11, fontFamily: "'DM Mono',monospace" }} />
                    <button onClick={() => { if (newTerm.trim()) { setSearchTerms(p => [...p, newTerm.trim().toLowerCase()]); setNewTerm(""); } }} className="ids-btn" style={{ background: "linear-gradient(135deg, #1BBDB5, #44D62C)", color: "#000", padding: "8px 14px", fontSize: 16, fontWeight: 900, border: "none", cursor: "pointer" }}>+</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {searchTerms.map(t => <div key={t} style={{ background: "rgba(27,189,181,0.08)", border: "1px solid rgba(27,189,181,0.2)", padding: "3px 9px", fontSize: 10, display: "flex", alignItems: "center", gap: 7 }}><span style={{ color: "#1BBDB5" }}>{t}</span><button onClick={() => setSearchTerms(p => p.filter(x => x !== t))} style={{ background: "none", border: "none", color: "#5A6478", cursor: "pointer", fontSize: 12 }}>×</button></div>)}
                  </div>
                </div>
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
                <div style={{ height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>EMAIL ALERTS</div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 5 }}>PRODUCT MANAGER EMAIL</div>
                    <input value={emailConfig.email} onChange={e => setEmailConfig(p => ({ ...p, email: e.target.value }))} style={{ width: "100%", background: "#1A2530", border: "1px solid #1A2530", color: "#E0E4EC", padding: "8px 10px", fontSize: 11, fontFamily: "'DM Mono',monospace" }} />
                  </div>
                  <div style={{ fontSize: 9, color: "#5A6478", letterSpacing: "0.1em", marginBottom: 8 }}>ALERT THRESHOLD</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[4, 12, 24, 48].map(h => <button key={h} onClick={() => setEmailConfig(p => ({ ...p, alertHours: h }))} className="abtn" style={{ flex: 1, padding: "7px 0", background: emailConfig.alertHours === h ? "linear-gradient(135deg, #1BBDB5, #44D62C)" : "rgba(27,189,181,0.06)", color: emailConfig.alertHours === h ? "#000" : "#1BBDB5", border: `1px solid ${emailConfig.alertHours === h ? "transparent" : "rgba(27,189,181,0.2)"}`, fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer", fontWeight: emailConfig.alertHours === h ? 700 : 400 }}>{h}h</button>)}
                  </div>
                </div>
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
                <div style={{ height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>MONITORED PLATFORMS</div>
                  {PLATFORMS.map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #1A2530" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} /><span style={{ fontSize: 11, color: "#A0A8B8" }}>{p.name}</span></div><a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#3A4458", textDecoration: "none" }} onMouseOver={e => e.currentTarget.style.color = "#1BBDB5"} onMouseOut={e => e.currentTarget.style.color = "#3A4458"}>visit ↗</a></div>)}
                </div>
              </div>
              <div style={{ background: "#0D1117", border: "1px solid #1A2530", overflow: "hidden" }}>
                <div style={{ height: 3, background: "linear-gradient(90deg, #1BBDB5, #44D62C)" }} />
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#5A6478", marginBottom: 14 }}>ACCOUNT</div>
                  <div style={{ fontSize: 11, color: "#A0A8B8", marginBottom: 16, lineHeight: 2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1A2530", paddingBottom: 8, marginBottom: 8 }}><span style={{ color: "#5A6478" }}>Version</span><span>1.0.0</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1A2530", paddingBottom: 8, marginBottom: 8 }}><span style={{ color: "#5A6478" }}>Access</span><span style={{ color: "#44D62C" }}>Authenticated ✓</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #1A2530", paddingBottom: 8, marginBottom: 8 }}><span style={{ color: "#5A6478" }}>Provider</span><span style={{ color: "#1BBDB5" }}>Intelligent Disposal Solutions</span></div>
                  </div>
                  <button onClick={logout} className="abtn" style={{ width: "100%", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", color: "#FF4444", padding: "10px", fontSize: 10, fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em", cursor: "pointer" }}>LOGOUT →</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
