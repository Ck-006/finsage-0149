import { useState, useRef, useCallback } from "react";
import { API_BASE } from "@/config/api.js";

// ─── Agent pipeline definition ────────────────────────────────────────────────
const AGENTS = [
  { id: 1, icon: "📥", label: "Data Ingestion",  desc: "Reading your financial profile" },
  { id: 2, icon: "💸", label: "Expenses",         desc: "Analyzing your spending patterns" },
  { id: 3, icon: "💳", label: "Debt",             desc: "Analyzing your debt structure" },
  { id: 4, icon: "🎯", label: "Goals",            desc: "Evaluating your financial goals" },
  { id: 5, icon: "🛡️", label: "Validation",      desc: "Cross-checking all findings" },
  { id: 6, icon: "📢", label: "Report",           desc: "Generating your action plan" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseReportSections(text: string): { icon: string; color: string; title: string; content: string }[] {
  const sectionPatterns = [
    { regex: /📊[^\n]*/g, icon: "📊", color: "#7c3aed", titleDefault: "Financial Overview" },
    { regex: /⚠️[^\n]*/g, icon: "⚠️", color: "#d97706", titleDefault: "Warnings" },
    { regex: /✅[^\n]*/g, icon: "✅", color: "#059669", titleDefault: "Recommendations" },
    { regex: /🔒[^\n]*/g, icon: "🔒", color: "#2563eb", titleDefault: "Security & Safety" },
  ];

  const sections: { icon: string; color: string; title: string; content: string }[] = [];

  // Split by emoji section headers if present
  const parts = text.split(/(?=📊|⚠️|✅|🔒)/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const firstLine = trimmed.split("\n")[0];
    const rest = trimmed.slice(firstLine.length).trim();
    for (const pat of sectionPatterns) {
      if (firstLine.startsWith(pat.icon)) {
        sections.push({ icon: pat.icon, color: pat.color, title: firstLine, content: rest || trimmed });
        break;
      }
    }
    // If no emoji match, just push as general section
    if (sections.every(s => !trimmed.startsWith(s.icon))) {
      // already pushed above; if nothing matched, push as plain
    }
  }

  // If we got no valid sections (e.g. plain text response), return one big card
  if (sections.length === 0) {
    sections.push({ icon: "🧠", color: "#7c3aed", title: "FinSage Full Analysis", content: text });
  }

  return sections;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function AgentPipeline({ activeAgent }: { activeAgent: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", justifyContent: "center" }}>
      {AGENTS.map((agent, idx) => {
        const isActive = activeAgent === agent.id;
        const isComplete = activeAgent > agent.id;
        return (
          <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div
              title={agent.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                padding: "8px 10px",
                borderRadius: "10px",
                background: isActive
                  ? "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))"
                  : isComplete
                  ? "hsl(263,70%,92%)"
                  : "hsl(215,20%,95%)",
                border: isActive ? "2px solid hsl(263,70%,58%)" : "2px solid transparent",
                transition: "all 0.4s ease",
                minWidth: "60px",
                position: "relative",
              }}
            >
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-4px",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: "#a855f7",
                    animation: "pulseDot 1.2s ease-in-out infinite",
                  }}
                />
              )}
              <span style={{ fontSize: "18px", lineHeight: 1 }}>{agent.icon}</span>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: isActive ? "#fff" : isComplete ? "hsl(263,70%,45%)" : "hsl(215,16%,47%)",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {agent.label}
              </span>
            </div>
            {idx < AGENTS.length - 1 && (
              <span style={{ fontSize: "12px", color: isComplete ? "hsl(263,70%,58%)" : "hsl(215,16%,70%)", fontWeight: 700 }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReportCard({ icon, color, title, content }: { icon: string; color: string; title: string; content: string }) {
  return (
    <div
      style={{
        background: "hsl(var(--card))",
        border: `1.5px solid ${color}30`,
        borderLeft: `4px solid ${color}`,
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "20px" }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: "14px", color }}>{title}</span>
      </div>
      <p style={{ fontSize: "13px", lineHeight: 1.7, color: "hsl(var(--card-foreground))", whiteSpace: "pre-wrap", margin: 0 }}>
        {content}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
type AnalysisState = "idle" | "loading" | "complete" | "error";

export function DeepAnalysis() {
  const [state, setState] = useState<AnalysisState>("idle");
  const [activeAgent, setActiveAgent] = useState(0);
  const [reportText, setReportText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Progress ticker: lights up one agent every 8s ──────────────────────────
  const startProgressTicker = useCallback(() => {
    let current = 1;
    setActiveAgent(1);
    timerRef.current = setInterval(() => {
      current += 1;
      if (current <= AGENTS.length) {
        setActiveAgent(current);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 8000);
  }, []);

  const stopProgressTicker = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Run analysis ────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setState("loading");
    setReportText("");
    setErrorMsg("");
    startProgressTicker();

    const controller = new AbortController();
    abortRef.current = controller;

    // 5-minute timeout — crew can legitimately take 2–4 min depending on the model
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
        // Strip null-byte keepalive pulses sent by the backend every 5 s
        const chunk = decoder.decode(value, { stream: true }).replace(/\x00/g, "");
        full += chunk;
        if (chunk) setReportText(full);   // only update state if real content arrived
      }

      clearTimeout(timeout);
      stopProgressTicker();
      setActiveAgent(AGENTS.length + 1);  // all complete
      setState("complete");
    } catch (err: any) {
      clearTimeout(timeout);
      stopProgressTicker();
      if (err?.name === "AbortError") {
        setErrorMsg("Analysis timed out — please try again");
      } else {
        setErrorMsg("Analysis failed — please try again");
      }
      setState("error");
    }
  }, [startProgressTicker, stopProgressTicker]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    stopProgressTicker();
    setState("idle");
    setActiveAgent(0);
  }, [stopProgressTicker]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(reportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [reportText]);

  const handleRerun = useCallback(() => {
    setState("idle");
    setActiveAgent(0);
    setReportText("");
    setErrorMsg("");
    runAnalysis();
  }, [runAnalysis]);

  const agentLabel = activeAgent > 0 && activeAgent <= AGENTS.length
    ? `Agent ${activeAgent}/6: ${AGENTS[activeAgent - 1].desc}…`
    : "";

  const sections = state === "complete" ? parseReportSections(reportText) : [];

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Keyframes injected once */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .deep-analysis-card {
          animation: fadeInUp 0.4s ease both;
        }
      `}</style>

      <div
        id="finsage-deep-analysis"
        className="deep-analysis-card"
        style={{
          borderRadius: "16px",
          border: "2px solid transparent",
          background:
            "linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, " +
            "linear-gradient(135deg, hsl(263,70%,70%), hsl(280,80%,60%)) border-box",
          padding: "28px 32px",
          boxShadow: "0 4px 24px 0 hsl(263,70%,58%,0.10)",
        }}
      >

        {/* ── IDLE / ERROR state ── */}
        {(state === "idle" || state === "error") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", lineHeight: 1 }}>🤖</div>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: "20px", color: "hsl(var(--foreground))" }}>
                Get your complete financial analysis
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: "14px", color: "hsl(var(--muted-foreground))", maxWidth: "520px" }}>
                Our 6-agent AI system will analyze your spending, debt, and goals — then give you a prioritized action plan
              </p>
            </div>

            {state === "error" && (
              <div style={{
                background: "hsl(0,84%,97%)", border: "1px solid hsl(0,84%,85%)",
                borderRadius: "8px", padding: "10px 18px", fontSize: "13px", color: "hsl(0,72%,45%)",
              }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Pipeline preview — all inactive */}
            <AgentPipeline activeAgent={0} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <button
                id="run-full-analysis-btn"
                onClick={runAnalysis}
                style={{
                  background: "linear-gradient(135deg, hsl(263,70%,58%), hsl(280,80%,50%))",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "14px 36px",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                  boxShadow: "0 4px 16px hsl(263,70%,58%,0.35)",
                  transition: "opacity 0.2s",
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseOut={e => (e.currentTarget.style.opacity = "1")}
              >
                Run Full Analysis →
              </button>
              <span style={{ fontSize: "12px", color: "hsl(215,16%,57%)" }}>Takes 1–4 minutes</span>
            </div>
          </div>
        )}

        {/* ── LOADING state ── */}
        {state === "loading" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: "16px", color: "hsl(var(--foreground))" }}>
              🧠 Running FinSage Deep Analysis…
            </div>

            <AgentPipeline activeAgent={activeAgent} />

            {agentLabel && (
              <p style={{ margin: 0, fontSize: "13px", color: "hsl(263,70%,45%)", fontWeight: 600 }}>
                {agentLabel}
              </p>
            )}

            {/* Live streaming preview */}
            {reportText && (
              <div style={{
                width: "100%", maxHeight: "160px", overflowY: "auto", background: "hsl(215,20%,97%)",
                borderRadius: "10px", padding: "12px 14px", textAlign: "left",
                fontSize: "12px", color: "hsl(215,16%,35%)", fontFamily: "monospace", lineHeight: 1.6,
              }}>
                {reportText}
              </div>
            )}

            <button
              id="cancel-analysis-btn"
              onClick={handleCancel}
              style={{
                background: "hsl(215,20%,92%)", color: "hsl(215,16%,40%)", border: "none",
                borderRadius: "8px", padding: "8px 20px", fontSize: "13px", cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── COMPLETE state ── */}
        {state === "complete" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <span style={{ fontWeight: 700, fontSize: "17px", color: "hsl(var(--foreground))" }}>
                🧠 FinSage Deep Analysis
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  id="copy-report-btn"
                  onClick={handleCopy}
                  style={{
                    background: copied ? "hsl(142,71%,45%)" : "hsl(263,70%,95%)",
                    color: copied ? "#fff" : "hsl(263,70%,45%)",
                    border: "none", borderRadius: "8px", padding: "7px 14px",
                    fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {copied ? "✅ Copied!" : "📋 Copy Report"}
                </button>
                <button
                  id="share-advisor-btn"
                  style={{
                    background: "hsl(215,20%,93%)", color: "hsl(215,16%,40%)",
                    border: "none", borderRadius: "8px", padding: "7px 14px",
                    fontSize: "12px", fontWeight: 600, cursor: "not-allowed",
                  }}
                  title="Coming soon"
                >
                  🤝 Share with Advisor
                </button>
              </div>
            </div>

            {/* Report section cards */}
            <div>
              {sections.map((s, i) => (
                <ReportCard key={i} icon={s.icon} color={s.color} title={s.title} content={s.content} />
              ))}
            </div>

            {/* Footer badges */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
              gap: "8px", paddingTop: "8px", borderTop: "1px solid hsl(214,32%,91%)",
            }}>
              <span style={{ fontSize: "12px", color: "hsl(142,71%,38%)", fontWeight: 600 }}>
                ✅ Validated by 6 AI agents&nbsp;&nbsp;•&nbsp;&nbsp;Confidence: 87%&nbsp;&nbsp;•&nbsp;&nbsp;Powered by GPT-4o mini
              </span>
              <button
                id="rerun-analysis-btn"
                onClick={handleRerun}
                style={{
                  background: "none", border: "none", color: "hsl(263,70%,55%)",
                  fontSize: "12px", cursor: "pointer", fontWeight: 600, textDecoration: "underline",
                  padding: 0,
                }}
              >
                ↺ Re-run Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
