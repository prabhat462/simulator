import { useState, useEffect, useRef, useCallback } from "react";

// ─── Color palette ──────────────────────────────────────────────
const C = {
  bg: "#0a0d14",
  surface: "#111520",
  border: "#1e2435",
  accent: "#00d4aa",
  accentDim: "#00d4aa22",
  warn: "#f59e0b",
  danger: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  text: "#e2e8f0",
  muted: "#64748b",
  green: "#22c55e",
};

// ─── Gateway Config ─────────────────────────────────────────────
const GATEWAYS = [
  { id: "razorpay",  label: "Razorpay",  color: "#3b82f6", baseSR: 0.91 },
  { id: "payu",      label: "PayU",      color: "#8b5cf6", baseSR: 0.84 },
  { id: "cashfree",  label: "Cashfree",  color: "#00d4aa", baseSR: 0.78 },
  { id: "stripe",    label: "Stripe",    color: "#f59e0b", baseSR: 0.72 },
];

// ─── Algorithm: SW-UCB + Thompson Sampling Hybrid ───────────────
function createArmState(windowSize = 200) {
  return { window: [], alpha: 1, beta: 1, totalPulls: 0 };
}

function windowSR(state) {
  if (!state.window.length) return 0.5;
  return state.window.reduce((a, b) => a + b, 0) / state.window.length;
}

function ucbScore(state, totalContext) {
  const n = Math.max(state.window.length, 1);
  const N = Math.max(totalContext, 1);
  const bonus = Math.sqrt((2 * Math.log(N)) / n);
  return windowSR(state) + bonus;
}

function tsSample(state) {
  // Beta distribution via gamma ratio approximation
  const a = state.alpha, b = state.beta;
  const x = -Math.log(Math.random() + 1e-10) ** (1 / a);
  const y = -Math.log(Math.random() + 1e-10) ** (1 / b);
  return x / (x + y + 1e-10);
}

function hybridScore(state, totalContext) {
  return 0.6 * ucbScore(state, totalContext) + 0.4 * tsSample(state);
}

function updateArm(state, success, windowSize) {
  const newWindow = [...state.window, success ? 1 : 0];
  if (newWindow.length > windowSize) newWindow.shift();
  return {
    ...state,
    window: newWindow,
    alpha: state.alpha + (success ? 1 : 0),
    beta: state.beta + (success ? 0 : 1),
    totalPulls: state.totalPulls + 1,
  };
}

// ─── Circuit Breaker ─────────────────────────────────────────────
function recentSR(window, n = 20) {
  const slice = window.slice(-n);
  if (!slice.length) return 1;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// ─── Main App ────────────────────────────────────────────────────
export default function App() {
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(100); // ms per txn
  const [windowSize, setWindowSize] = useState(200);
  const [txnCount, setTxnCount] = useState(0);
  const [totalSR, setTotalSR] = useState(0);
  const [uplift, setUplift] = useState(0);

  // Per gateway state
  const [armStates, setArmStates] = useState(() =>
    Object.fromEntries(GATEWAYS.map(g => [g.id, createArmState()]))
  );
  const [circuitOpen, setCircuitOpen] = useState(() =>
    Object.fromEntries(GATEWAYS.map(g => [g.id, false]))
  );
  const [routingDist, setRoutingDist] = useState(() =>
    Object.fromEntries(GATEWAYS.map(g => [g.id, 0]))
  );
  const [srHistory, setSrHistory] = useState([]); // [{t, sr, gw}]
  const [routeLog, setRouteLog] = useState([]);

  // Simulated "true SR" for each gateway (changes over time)
  const trueSR = useRef(Object.fromEntries(GATEWAYS.map(g => [g.id, g.baseSR])));
  const contextPulls = useRef(0);
  const baselineSR = useRef(0);
  const engineSR = useRef(0);
  const txnRef = useRef(0);
  const timer = useRef(null);

  // Simulate SR drift (non-stationary)
  const driftSR = useCallback(() => {
    GATEWAYS.forEach(g => {
      const drift = (Math.random() - 0.5) * 0.02;
      trueSR.current[g.id] = Math.max(0.3, Math.min(0.99, trueSR.current[g.id] + drift));
    });
    // Occasionally simulate an outage
    if (Math.random() < 0.003) {
      const victim = GATEWAYS[Math.floor(Math.random() * GATEWAYS.length)];
      trueSR.current[victim.id] = 0.15 + Math.random() * 0.1;
    }
  }, []);

  const runOneTxn = useCallback(() => {
    setArmStates(prev => {
      const states = { ...prev };

      // Drift SR
      driftSR();

      // Find available gateways
      const available = GATEWAYS.filter(g => !circuitOpen[g.id]);
      if (!available.length) return states;

      contextPulls.current += 1;
      const total = contextPulls.current;

      // Score each gateway
      const scored = available.map(g => ({
        id: g.id,
        score: hybridScore(states[g.id], total),
        degraded: recentSR(states[g.id].window) < 0.5,
      })).map(x => ({
        ...x,
        score: x.degraded ? x.score - 0.15 : x.score,
      }));

      scored.sort((a, b) => b.score - a.score);
      const chosen = scored[0].id;

      // Simulate outcome
      const sr = trueSR.current[chosen];
      const success = Math.random() < sr;

      // Update arm
      states[chosen] = updateArm(states[chosen], success, windowSize);

      // Baseline: always route to first gateway
      const baseGW = GATEWAYS[0].id;
      const baseSuccess = Math.random() < trueSR.current[baseGW];
      baselineSR.current += baseSuccess ? 1 : 0;
      engineSR.current += success ? 1 : 0;

      // Update circuit breakers
      setCircuitOpen(prev => {
        const next = { ...prev };
        GATEWAYS.forEach(g => {
          const recent = recentSR(states[g.id].window, 20);
          if (recent < 0.3 && states[g.id].window.length >= 10) next[g.id] = true;
          else if (recent > 0.5) next[g.id] = false;
        });
        return next;
      });

      // Routing distribution
      setRoutingDist(prev => ({
        ...prev,
        [chosen]: (prev[chosen] || 0) + 1,
      }));

      // SR history (sample every 10 txns)
      txnRef.current += 1;
      setTxnCount(txnRef.current);
      if (txnRef.current % 10 === 0) {
        const eng = engineSR.current / txnRef.current;
        const bas = baselineSR.current / txnRef.current;
        setSrHistory(h => [...h.slice(-59), { t: txnRef.current, engine: eng, baseline: bas }]);
        setTotalSR(eng);
        setUplift(((eng - bas) / bas) * 100);
      }

      // Route log
      setRouteLog(log => [{
        t: txnRef.current,
        chosen,
        success,
        score: scored[0].score.toFixed(3),
        sr: (trueSR.current[chosen] * 100).toFixed(1),
      }, ...log.slice(0, 6)]);

      return states;
    });
  }, [windowSize, circuitOpen, driftSR]);

  useEffect(() => {
    if (running) {
      timer.current = setInterval(runOneTxn, speed);
    } else {
      clearInterval(timer.current);
    }
    return () => clearInterval(timer.current);
  }, [running, speed, runOneTxn]);

  const reset = () => {
    setRunning(false);
    setArmStates(Object.fromEntries(GATEWAYS.map(g => [g.id, createArmState()])));
    setCircuitOpen(Object.fromEntries(GATEWAYS.map(g => [g.id, false])));
    setRoutingDist(Object.fromEntries(GATEWAYS.map(g => [g.id, 0])));
    setSrHistory([]);
    setRouteLog([]);
    setTxnCount(0);
    setTotalSR(0);
    setUplift(0);
    contextPulls.current = 0;
    baselineSR.current = 0;
    engineSR.current = 0;
    txnRef.current = 0;
    trueSR.current = Object.fromEntries(GATEWAYS.map(g => [g.id, g.baseSR]));
  };

  const maxDist = Math.max(...Object.values(routingDist), 1);

  // SVG sparkline
  const sparkPoints = srHistory.map((d, i) => {
    const x = (i / Math.max(srHistory.length - 1, 1)) * 340;
    const yEng = (1 - d.engine) * 60;
    const yBas = (1 - d.baseline) * 60;
    return { x, yEng, yBas };
  });

  const polyEngine = sparkPoints.map(p => `${p.x},${p.yEng}`).join(" ");
  const polyBaseline = sparkPoints.map(p => `${p.x},${p.yBas}`).join(" ");

  return (
    <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", background: C.bg, minHeight: "100vh", padding: "24px", color: C.text }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: running ? C.accent : C.muted, boxShadow: running ? `0 0 8px ${C.accent}` : "none", transition: "all 0.3s" }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "0.05em", color: C.accent }}>
            PG ROUTING ENGINE
          </h1>
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>
            Hybrid SW-UCB + Thompson Sampling
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
          Based on: Dream11 (ACM 2023) · Razorpay (IEEE 2021) · PayU (WWW 2018) · Adyen (arXiv 2024)
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={() => setRunning(r => !r)}
          style={{
            padding: "8px 20px", borderRadius: 6, border: `1px solid ${running ? C.danger : C.accent}`,
            background: running ? "#ef444420" : `${C.accent}20`, color: running ? C.danger : C.accent,
            cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em",
          }}
        >
          {running ? "⏸ PAUSE" : "▶ RUN"}
        </button>
        <button
          onClick={reset}
          style={{
            padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.border}`,
            background: "transparent", color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 12,
          }}
        >
          ↺ RESET
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.muted }}>SPEED</span>
          <input type="range" min={20} max={500} value={500 - speed + 20}
            onChange={e => setSpeed(500 - Number(e.target.value) + 20)}
            style={{ width: 80, accentColor: C.accent }} />
          <span style={{ fontSize: 11, color: C.muted }}>{speed}ms</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.muted }}>WINDOW W=</span>
          <select value={windowSize} onChange={e => setWindowSize(Number(e.target.value))}
            style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 4, padding: "4px 8px", fontFamily: "inherit", fontSize: 11 }}>
            {[50, 100, 200, 500].map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "TRANSACTIONS", val: txnCount.toLocaleString(), unit: "", color: C.text },
          { label: "ENGINE SR", val: (totalSR * 100).toFixed(2), unit: "%", color: C.accent },
          { label: "SR UPLIFT vs BASELINE", val: uplift >= 0 ? `+${uplift.toFixed(2)}` : uplift.toFixed(2), unit: "%", color: uplift >= 0 ? C.green : C.danger },
          { label: "ACTIVE GWs", val: GATEWAYS.filter(g => !circuitOpen[g.id]).length, unit: `/ ${GATEWAYS.length}`, color: C.text },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, letterSpacing: "0.08em" }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color }}>
              {kpi.val}<span style={{ fontSize: 13, color: C.muted }}>{kpi.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* SR Trend Chart */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: "0.08em" }}>
            SUCCESS RATE TREND
          </div>
          <svg width="100%" viewBox="0 0 340 80" style={{ overflow: "visible" }}>
            {/* Grid lines */}
            {[0.7, 0.8, 0.9].map(v => (
              <g key={v}>
                <line x1={0} y1={(1-v)*60} x2={340} y2={(1-v)*60} stroke={C.border} strokeWidth={0.5} />
                <text x={345} y={(1-v)*60 + 3} fill={C.muted} fontSize={8}>{(v*100).toFixed(0)}%</text>
              </g>
            ))}
            {/* Baseline */}
            {sparkPoints.length > 1 && (
              <polyline points={polyBaseline} fill="none" stroke={C.muted} strokeWidth={1} strokeDasharray="4,2" />
            )}
            {/* Engine */}
            {sparkPoints.length > 1 && (
              <>
                <defs>
                  <linearGradient id="srGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <polygon
                  points={`0,60 ${polyEngine} 340,60`}
                  fill="url(#srGrad)"
                />
                <polyline points={polyEngine} fill="none" stroke={C.accent} strokeWidth={1.5} />
              </>
            )}
            {sparkPoints.length === 0 && (
              <text x={170} y={40} fill={C.muted} fontSize={10} textAnchor="middle">Run simulation to see data</text>
            )}
          </svg>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 2, background: C.accent }} />
              <span style={{ fontSize: 10, color: C.muted }}>Engine</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 2, background: C.muted, opacity: 0.5 }} />
              <span style={{ fontSize: 10, color: C.muted }}>Baseline (fixed rule)</span>
            </div>
          </div>
        </div>

        {/* Gateway Status Panel */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: "0.08em" }}>
            GATEWAY BANDIT STATE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GATEWAYS.map(g => {
              const state = armStates[g.id];
              const sr = windowSR(state);
              const recent = recentSR(state.window, 20);
              const isOpen = circuitOpen[g.id];
              const isDegraded = !isOpen && recent < 0.5;
              const pulls = routingDist[g.id] || 0;
              const bayesianMean = state.alpha / (state.alpha + state.beta);

              return (
                <div key={g.id} style={{
                  border: `1px solid ${isOpen ? C.danger + "60" : isDegraded ? C.warn + "40" : C.border}`,
                  borderRadius: 6, padding: "8px 12px",
                  background: isOpen ? "#ef444408" : "transparent",
                  opacity: isOpen ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: isOpen ? C.danger : isDegraded ? C.warn : C.green }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: g.color }}>{g.label}</span>
                      {isOpen && <span style={{ fontSize: 9, color: C.danger, letterSpacing: "0.1em" }}>CIRCUIT OPEN</span>}
                      {isDegraded && !isOpen && <span style={{ fontSize: 9, color: C.warn }}>DEGRADED</span>}
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: C.muted }}>WIN SR</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: sr > 0.8 ? C.green : sr > 0.6 ? C.warn : C.danger }}>
                          {(sr * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: C.muted }}>β MEAN</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>
                          {(bayesianMean * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 9, color: C.muted }}>ROUTES</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{pulls}</div>
                      </div>
                    </div>
                  </div>
                  {/* Bar */}
                  <div style={{ height: 3, background: C.border, borderRadius: 2 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      width: `${(pulls / Math.max(maxDist, 1)) * 100}%`,
                      background: `linear-gradient(90deg, ${g.color}, ${g.color}88)`,
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Algorithm Details + Route Log */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Algorithm Breakdown */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: "0.08em" }}>
            ALGORITHM ARCHITECTURE
          </div>
          {[
            { layer: "L0", name: "Circuit Breaker", desc: "Hard block: SR < 30% in last 20 txns → exclude 20 min", color: C.danger, ref: "Juspay P7" },
            { layer: "L1", name: "Context Segment", desc: "Per (mode · bank · amount_bucket) independent bandit", color: C.warn, ref: "Adyen P6" },
            { layer: "L2A", name: "SW-UCB (W=200)", desc: "SR_W + √(2·ln N / n_W) — abrupt change detection", color: C.blue, ref: "Dream11 P2" },
            { layer: "L2B", name: "Thompson Sampling", desc: "Sample θ ~ Beta(α,β) — Bayesian exploration bonus", color: C.purple, ref: "PayU P3" },
            { layer: "L2C", name: "D-UCB (γ=0.6)", desc: "Discounted SR — gradual drift adaptation", color: C.accent, ref: "Garivier P12" },
            { layer: "L3", name: "Hybrid Ensemble", desc: "0.6×UCB + 0.4×TS | 0.7×SW + 0.3×D — final score", color: C.green, ref: "Original" },
          ].map(item => (
            <div key={item.layer} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
              <div style={{
                minWidth: 32, height: 20, borderRadius: 4, background: item.color + "20",
                border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: item.color, fontWeight: 700,
              }}>{item.layer}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 1 }}>{item.name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{item.desc}</div>
              </div>
              <div style={{ fontSize: 9, color: item.color, minWidth: 70, textAlign: "right" }}>{item.ref}</div>
            </div>
          ))}
        </div>

        {/* Live Route Log */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, letterSpacing: "0.08em" }}>
            LIVE ROUTING LOG
          </div>
          {routeLog.length === 0 && (
            <div style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 40 }}>
              Press ▶ RUN to start simulation
            </div>
          )}
          {routeLog.map((r, i) => {
            const gw = GATEWAYS.find(g => g.id === r.chosen);
            return (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderBottom: `1px solid ${C.border}`,
                opacity: i === 0 ? 1 : 0.6 - i * 0.05,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10, color: C.muted, minWidth: 40 }}>#{r.t}</span>
                  <span style={{ fontSize: 11, color: gw?.color || C.text, fontWeight: 600 }}>{gw?.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 10, color: C.muted }}>score: {r.score}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>SR: {r.sr}%</span>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: r.success ? C.green : C.danger,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 20, padding: "12px 0", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: C.muted }}>
          Algorithm: Hybrid SW-UCB + Thompson Sampling + Discounted UCB Ensemble
        </span>
        <span style={{ fontSize: 10, color: C.muted }}>
          Target: &lt;5ms P99 · 10K+ TPS (horizontal scale via Redis + Ray)
        </span>
      </div>
    </div>
  );
}
