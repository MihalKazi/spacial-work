import { useEffect, useRef, useState, useMemo } from "react";
import Globe from "react-globe.gl"; 

// --- TERMINAL DATA LOGS ---
const EARTH_LINES = [
  { t: 0.00, text: "[ WARP DRIVE ONLINE ]",               color: "#00d8ff" },
  { t: 0.15, text: "> ORIGIN: KHULNA, BANGLADESH",        color: "#ffcc00" },
  { t: 0.30, text: "> SCANNING BIO-SIGNATURE...",         color: "#00d8ff" },
  { t: 0.45, text: "> MATCH CONFIRMED: ABIDA SULTANA ETY",color: "#ff6fff" },
  { t: 0.60, text: "> REROUTING TRAJECTORY...",           color: "#00d8ff" },
  { t: 0.75, text: "> DESTINATION: NORTHERN CAPE, S.A.",  color: "#ffcc00" },
  { t: 0.85, text: "> BIRTHDAY PROTOCOL: ACTIVE ✦",       color: "#ff6fff" },
  { t: 0.95, text: "[ WARP COMPLETE — PREPARE ]",         color: "#ffffff" },
];

interface EarthIntroProps {
  startLat: number;
  startLon: number;
  targetLat: number;
  targetLon: number;
  onComplete: () => void;
}

export function EarthIntro({ startLat, startLon, targetLat, targetLon, onComplete }: EarthIntroProps) {
  const globeEl = useRef<any>(undefined);
  
  // HUD State
  const [showLabel, setShowLabel] = useState(false);
  const [scanPct, setScanPct] = useState(0);
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [warpActive, setWarpActive] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);

  const arcData = useMemo(() => [
    {
      startLat: startLat, startLng: startLon,
      endLat: targetLat, endLng: targetLon,
      color: ['#00d8ff', '#ff6fff']
    }
  ], [startLat, startLon, targetLat, targetLon]);

  const pointsData = useMemo(() => [
    { lat: startLat, lng: startLon, color: '#ffcc00' },
    { lat: targetLat, lng: targetLon, color: '#ff6fff' },
  ], [startLat, startLon, targetLat, targetLon]);

  const midLat = (startLat + targetLat) / 2;
  const midLon = (startLon + targetLon) / 2;

  useEffect(() => {
    if (!globeEl.current || !globeReady) return;

    // 1. Initial Camera — start zoomed on Khulna
    globeEl.current.pointOfView({ lat: startLat, lng: startLon, altitude: 1.6 }, 0);

    // 2. Zoom OUT to reveal both locations (starts almost immediately, no dead pause)
    const timeout1 = setTimeout(() => {
        globeEl.current?.pointOfView({ lat: midLat, lng: midLon, altitude: 2.8 }, 2000);
        setWarpActive(true);
    }, 150);

    // 3. Hold on the wide view (both pointers visible) — the one deliberate pause
    const timeout2 = setTimeout(() => {
        globeEl.current?.pointOfView({ lat: targetLat, lng: targetLon, altitude: 1.5 }, 2000);
    }, 2850);

    // 4. Zoom IN close to target — chained immediately when the pan ends, no gap
    const timeout3 = setTimeout(() => {
        globeEl.current?.pointOfView({ lat: targetLat, lng: targetLon, altitude: 0.4 }, 1800);
        setWarpActive(false);
    }, 4850);

    // 5. Arrival + end scene
    const timeout4 = setTimeout(() => setShowLabel(true), 6650);
    const timeout5 = setTimeout(() => onComplete(), 7050);

    // --- HUD Progress Sync ---
    const TOTAL_DURATION = 6650;
    const startTime = Date.now();

    const uiInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / TOTAL_DURATION, 1);

        setScanPct(Math.floor(progress * 100));
        setVisibleLines(EARTH_LINES.filter(l => l.t <= progress).map(l => l.text));

        if (progress >= 1) clearInterval(uiInterval);
    }, 50);

    return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        clearTimeout(timeout3);
        clearTimeout(timeout4);
        clearTimeout(timeout5);
        clearInterval(uiInterval);
    };
  }, [startLat, startLon, targetLat, targetLon, midLat, midLon, onComplete, globeReady]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, background: '#000', zIndex: 50, overflow: 'hidden' }}>
      <Globe
        ref={globeEl}
        globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
        onGlobeReady={() => setGlobeReady(true)}
        backgroundColor="#000000"
        arcsData={arcData}
        arcColor="color"
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={1500}
        arcStroke={1.5}
        pointsData={pointsData}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.01}
        pointRadius={0.4}
        atmosphereColor="#00d8ff"
        atmosphereAltitude={0.2}
      />
      
      {/* Overlays */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)", pointerEvents: "none", zIndex: 10 }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)", pointerEvents: "none", zIndex: 11 }} />
      {warpActive && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,140,255,0.14) 0%, transparent 65%)", animation: "eWarpPulse 0.18s linear infinite", pointerEvents: "none", zIndex: 12 }} />}

      {/* HUD Elements */}
      <div style={{ position: "absolute", top: "8%", left: "5%", fontFamily: "'Courier Prime', monospace", fontSize: "clamp(0.6rem, 1.4vw, 0.8rem)", pointerEvents: "none", zIndex: 20, lineHeight: 1.8 }}>
        <div style={{ color: "#ffcc00", textShadow: "0 0 8px #ffcc00", letterSpacing: 2 }}>◆ ORIGIN: KHULNA, BD</div>
        <div style={{ color: "#ff6fff", textShadow: "0 0 8px #ff6fff", letterSpacing: 2, opacity: scanPct > 30 ? 1 : 0, transition: "opacity 0.9s ease" }}>✦ DEST: NORTHERN CAPE, S.A.</div>
      </div>

      <div style={{ position: "absolute", top: "8%", right: "5%", fontFamily: "'Courier Prime', monospace", fontSize: "clamp(0.5rem, 1.2vw, 0.72rem)", color: "#00d8ff", textShadow: "0 0 6px #00d8ff", textAlign: "right", pointerEvents: "none", zIndex: 20 }}>
        <div style={{ marginBottom: 5, letterSpacing: 3 }}>WARP TRAJECTORY</div>
        <div style={{ width: "clamp(120px, 20vw, 220px)", height: 3, background: "#002233", border: "1px solid #00d8ff", marginLeft: "auto" }}>
          <div style={{ width: `${scanPct}%`, height: "100%", background: "linear-gradient(90deg, #00d8ff, #ff6fff)", boxShadow: "0 0 8px #00d8ff", transition: "width 0.25s ease" }} />
        </div>
        <div style={{ marginTop: 5 }}>{scanPct}%</div>
      </div>

      <div style={{ position: 'absolute', bottom: '50px', left: '50px', color: '#00d8ff', fontFamily: "'Courier Prime', monospace", pointerEvents: 'none', zIndex: 20, textShadow: "0 0 8px #00d8ff" }}>
        <div style={{ marginBottom: '15px', fontSize: 'clamp(0.55rem, 1.4vw, 0.82rem)', lineHeight: 1.6, maxWidth: "min(420px, 88vw)" }}>
          {visibleLines.map((line, i) => {
            const entry = EARTH_LINES.find(l => l.text === line);
            return <div key={i} style={{ color: entry?.color || "#00d8ff", textShadow: `0 0 7px ${entry?.color || "#00d8ff"}`, animation: "eFadeIn 0.35s ease forwards" }}>{line}</div>;
          })}
        </div>
        <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 24px)', margin: 0, letterSpacing: '2px', animation: "blink 1.5s step-end infinite" }}>FLIGHT PROTOCOL INITIATED</h2>
        <p style={{ margin: '8px 0', fontSize: 'clamp(12px, 1.5vw, 16px)' }}>Trajectory: KHULNA, BD {'->'} NORTHERN CAPE, SA</p>
        <p style={{ margin: '4px 0', fontSize: 'clamp(12px, 1.5vw, 16px)' }}>Speed: 1 LightSpeed Year</p>
        {showLabel && <h1 style={{ color: '#ffffff', fontSize: 'clamp(30px, 5vw, 40px)', textShadow: '0 0 15px #00d8ff, 0 0 30px #ffffff', marginTop: '15px', animation: 'eFadeIn 0.8s ease forwards' }}>ARRIVED</h1>}
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes eWarpPulse { 0% { opacity: 0.5; } 50% { opacity: 1.0; } 100% { opacity: 0.5; } }
        @keyframes eFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}