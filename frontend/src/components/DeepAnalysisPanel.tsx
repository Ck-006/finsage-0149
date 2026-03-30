import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import { API_BASE } from "@/config/api.js";

// ─── Shared state (module-level singleton so trigger + panel stay in sync) ────
// We use a simple event-emitter pattern so both components share one source
// of truth without needing Context or Redux.

type AnalysisState = "idle" | "loading" | "complete" | "error";

interface PanelState {
  analysisState: AnalysisState;
  activeAgent: number;
  reportText: string;
  errorMsg: string;
  isOpen: boolean;
  isMinimized: boolean;
}

const listeners = new Set<(s: PanelState) => void>();
let sharedState: PanelState = {
  analysisState: "idle",
  activeAgent: 0,
  reportText: "",
  errorMsg: "",
  isOpen: false,
  isMinimized: false,
};

function setState(patch: Partial<PanelState>) {
  sharedState = { ...sharedState, ...patch };
  listeners.forEach((fn) => fn(sharedState));
}

function useSharedState(): PanelState {
  const [s, set] = useState(sharedState);
  useEffect(() => {
    listeners.add(set);
    return () => { listeners.delete(set); };
  }, []);
  return s;
}

// ─── Agent definitions ────────────────────────────────────────────────────────
const AGENTS = [
  { id: 1, icon: "📥", label: "Ingestion",  desc: "Reading your financial profile" },
  { id: 2, icon: "💸", label: "Expenses",   desc: "Analyzing your spending patterns" },
  { id: 3, icon: "💳", label: "Debt",       desc: "Analyzing your debt structure" },
  { id: 4, icon: "🎯", label: "Goals",      desc: "Evaluating your financial goals" },
  { id: 5, icon: "🛡️", label: "Validation", desc: "Cross-checking all findings" },
  { id: 6, icon: "📢", label: "Report",     desc: "Generating your action plan" },
];

// ─── Report section parser ────────────────────────────────────────────────────
function parseReportSections(text: string) {
  const PATTERNS = [
    { icon: "📊", color: "#7c3aed" },
    { icon: "⚠️", color: "#d97706" },
    { icon: "✅", color: "#059669" },
    { icon: "🔒", color: "#2563eb" },
  ];
  const parts = text.split(/(?=📊|⚠️|✅|🔒)/);
  const sections: { icon: string; color: string; title: string; content: string }[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const firstLine = trimmed.split("\n")[0];
    const rest = trimmed.slice(firstLine.length).trim();
    for (const pat of PATTERNS) {
      if (firstLine.startsWith(pat.icon)) {
        sections.push({ icon: pat.icon, color: pat.color, title: firstLine, content: rest || trimmed });
        break;
      }
    }
  }
  if (sections.length === 0) {
    sections.push({ icon: "🧠", color: "#7c3aed", title: "FinSage Full Analysis", content: text });
  }
  return sections;
}

// ─── Shared abort/timer refs (module-level so both components can cancel) ─────
const abortRef = { current: null as AbortController | null };
const timerRef = { current: null as ReturnType<typeof setInterval> | null };

function stopTicker() {
  if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
}

function startTicker() {
  stopTicker();
  let cur = 1;
  setState({ activeAgent: 1 });
  timerRef.current = setInterval(() => {
    cur += 1;
    if (cur <= AGENTS.length) setState({ activeAgent: cur });
    else stopTicker();
  }, 8000);
}

async function runAnalysis() {
  setState({ analysisState: "loading", reportText: "", errorMsg: "", isOpen: true, isMinimized: false });
  startTicker();

  const controller = new AbortController();
  abortRef.current = controller;
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const res = await fetch(`${API_BASE}/report/1`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true }).replace(/\x00/g, "");
      full += chunk;
      if (chunk) setState({ reportText: full });
    }
    clearTimeout(timeout);
    stopTicker();
    setState({ activeAgent: AGENTS.length + 1, analysisState: "complete" });
  } catch (err: unknown) {
    clearTimeout(timeout);
    stopTicker();
    const isAbort = err instanceof Error && err.name === "AbortError";
    setState({
      analysisState: "error",
      errorMsg: isAbort ? "Analysis timed out — please try again" : "Analysis failed — please try again",
    });
  }
}

function cancelAnalysis() {
  abortRef.current?.abort();
  stopTicker();
  setState({ analysisState: "idle", activeAgent: 0 });
}

// ─── Trigger button (place in sidebar / header) ───────────────────────────────
export function DeepAnalysisTrigger() {
  const s = useSharedState();
  const isRunning = s.analysisState === "loading";

  return (
    <button
      id="deep-analysis-trigger"
      onClick={() => setState({ isOpen: true, isMinimized: false })}
      className="relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-all duration-200"
      title="Open Deep Analysis"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>Deep Analysis</span>
      {isRunning && (
        <span
          style={{
            position: "absolute",
            top: "-3px",
            right: "-3px",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#a855f7",
            animation: "pulseDot 1.2s ease-in-out infinite",
          }}
        />
      )}
    </button>
  );
}

// ─── Floating panel (render once in App.tsx root) ─────────────────────────────
export function DeepAnalysisPanel() {
  const s = useSharedState();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(s.reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [s.reportText]);

  const handleRerun = useCallback(() => {
    setState({ analysisState: "idle", activeAgent: 0, reportText: "", errorMsg: "" });
    runAnalysis();
  }, []);

  if (!s.isOpen) return null;

  const agentLabel =
    s.activeAgent > 0 && s.activeAgent <= AGENTS.length
      ? `Agent ${s.activeAgent}/6: ${AGENTS[s.activeAgent - 1].desc}…`
      : "";

  const sections = s.analysisState === "complete" ? parseReportSections(s.reportText) : [];

  // Progress bar: 48s = 6 agents × 8s each
  const progressPct = Math.min(((s.activeAgent) / AGENTS.length) * 100, 100);

  return (
    <>
      {/* Keyframes — injected once */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.5; }
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes progressBar {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .da-panel {
          animation: panelIn 0.25s ease-out both;
        }
      `}</style>

      <div
        id="deep-analysis-panel"
        className="da-panel"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          width: "420px",
          maxHeight: s.isMinimized ? "52px" : "80vh",
          overflow: s.isMinimized ? "hidden" : "auto",
          borderRadius: "16px",
          background: "hsl(222,47%,11%)",
          border: "1px solid hsl(217,33%,20%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
          transition: "max-height 300ms cubic-bezier(0.16,1,0.3,1), min-height 300ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>
            {s.analysisState === "complete" ? "✅ Analysis Complete" : "🧠 Deep Analysis"}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              onClick={() => setState({ isMinimized: !s.isMinimized })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px", borderRadius: "6px", display: "flex" }}
              title={s.isMinimized ? "Expand" : "Minimize"}
            >
              {s.isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setState({ isOpen: false })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px", borderRadius: "6px", display: "flex" }}
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Purple gradient line under header */}
        <div style={{ height: "2px", background: "linear-gradient(90deg, #a855f7, #3b82f6)", flexShrink: 0 }} />

        {/* ── Body (hidden when minimized) ── */}
        {!s.isMinimized && (
          <div style={{ padding: "20px 20px 16px" }}>

            {/* ── IDLE / ERROR ── */}
            {(s.analysisState === "idle" || s.analysisState === "error") && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
                <Sparkles style={{ width: 32, height: 32, color: "#a855f7" }} />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>
                    Run a deep financial analysis
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#94a3b8", maxWidth: "300px", lineHeight: 1.5 }}>
                    6 AI agents will analyze your spending, debt, and goals in the background
                  </p>
                </div>

                {/* Agent pipeline preview */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                  {AGENTS.map((a, idx) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                        <span style={{ fontSize: "16px" }}>{a.icon}</span>
                        <span style={{ fontSize: "9px", color: "#64748b", fontWeight: 500 }}>{a.label}</span>
                      </div>
                      {idx < AGENTS.length - 1 && (
                        <span style={{ fontSize: "10px", color: "#334155" }}>→</span>
                      )}
                    </div>
                  ))}
                </div>

                {s.analysisState === "error" && (
                  <div style={{
                    background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "8px", padding: "8px 14px", fontSize: "11px", color: "#fca5a5",
                  }}>
                    ⚠️ {s.errorMsg}
                  </div>
                )}

                <button
                  id="run-full-analysis-btn"
                  onClick={runAnalysis}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                    color: "#fff", border: "none", borderRadius: "10px",
                    padding: "11px 20px", fontSize: "13px", fontWeight: 700,
                    cursor: "pointer", letterSpacing: "0.02em",
                    boxShadow: "0 4px 14px rgba(139,92,246,0.4)",
                    transition: "opacity 0.2s",
                  }}
                  onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
                  onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                >
                  Run Analysis →
                </button>
                <span style={{ fontSize: "11px", color: "#475569" }}>
                  Takes 1–4 minutes • Runs in background
                </span>
              </div>
            )}

            {/* ── LOADING ── */}
            {s.analysisState === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Agent pipeline — active */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", justifyContent: "center" }}>
                  {AGENTS.map((a, idx) => {
                    const isActive = s.activeAgent === a.id;
                    const isDone = s.activeAgent > a.id;
                    return (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <div style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                          padding: "6px 8px", borderRadius: "8px", position: "relative",
                          background: isActive ? "linear-gradient(135deg,#7c3aed,#9333ea)" : isDone ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)",
                          border: isActive ? "1.5px solid #9333ea" : "1.5px solid transparent",
                          transition: "all 0.4s ease",
                          minWidth: "48px",
                        }}>
                          {isActive && (
                            <span style={{
                              position: "absolute", top: "-3px", right: "-3px",
                              width: "8px", height: "8px", borderRadius: "50%",
                              background: "#a855f7", animation: "pulseDot 1.2s ease-in-out infinite",
                            }} />
                          )}
                          <span style={{ fontSize: "14px", lineHeight: 1 }}>{a.icon}</span>
                          <span style={{ fontSize: "8px", fontWeight: 600, color: isActive ? "#fff" : isDone ? "#a78bfa" : "#475569", textAlign: "center" }}>
                            {a.label}
                          </span>
                        </div>
                        {idx < AGENTS.length - 1 && <span style={{ fontSize: "10px", color: isDone ? "#7c3aed" : "#334155" }}>→</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "4px", height: "4px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${progressPct}%`,
                    background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
                    borderRadius: "4px",
                    transition: "width 8s linear",
                  }} />
                </div>

                {agentLabel && (
                  <p style={{ margin: 0, fontSize: "11px", color: "#a78bfa", fontWeight: 600, textAlign: "center" }}>
                    {agentLabel}
                  </p>
                )}

                {/* Live text preview */}
                {s.reportText && (
                  <div style={{
                    maxHeight: "120px", overflowY: "auto",
                    background: "rgba(0,0,0,0.3)", borderRadius: "8px",
                    padding: "10px 12px", fontSize: "10px", color: "#94a3b8",
                    fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap",
                  }}>
                    {s.reportText}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button
                    id="cancel-analysis-btn"
                    onClick={cancelAnalysis}
                    style={{
                      background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "none",
                      borderRadius: "6px", padding: "6px 14px", fontSize: "11px", cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setState({ isMinimized: true })}
                    style={{ background: "none", border: "none", color: "#64748b", fontSize: "11px", cursor: "pointer" }}
                  >
                    Minimize ↓
                  </button>
                </div>
              </div>
            )}

            {/* ── COMPLETE ── */}
            {s.analysisState === "complete" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Section cards */}
                <div>
                  {sections.map((sec, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.05)", borderRadius: "10px",
                        padding: "12px 14px", marginBottom: "8px",
                        borderLeft: `3px solid ${sec.color}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "14px" }}>{sec.icon}</span>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: sec.color }}>{sec.title}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: "11px", color: "#cbd5e1", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {sec.content}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <span style={{ fontSize: "10px", color: "#475569" }}>
                    ✅ Validated by 6 agents • GPT-4o mini
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      id="copy-report-btn"
                      onClick={handleCopy}
                      style={{
                        background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                        color: copied ? "#86efac" : "#94a3b8",
                        border: "none", borderRadius: "6px", padding: "5px 10px",
                        fontSize: "10px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      {copied ? "✅ Copied!" : "📋 Copy"}
                    </button>
                    <button
                      id="rerun-analysis-btn"
                      onClick={handleRerun}
                      style={{ background: "none", border: "none", color: "#7c3aed", fontSize: "10px", cursor: "pointer", fontWeight: 600 }}
                    >
                      ↺ Re-run
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
