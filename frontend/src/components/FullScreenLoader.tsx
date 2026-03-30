export default function FullScreenLoader() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "hsl(222, 47%, 8%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes fsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.92); }
        }
        @keyframes fsSpinner {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Logo */}
      <div style={{ animation: "fsPulse 2s ease-in-out infinite" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "18px",
            background: "linear-gradient(135deg, #7c3aed, #9333ea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "32px",
            boxShadow: "0 8px 32px rgba(139,92,246,0.4)",
          }}
        >
          💼
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
          FinSage
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
          Loading your finances…
        </p>
      </div>

      {/* Spinner */}
      <div
        style={{
          width: 28,
          height: 28,
          border: "2px solid rgba(139,92,246,0.2)",
          borderTop: "2px solid #9333ea",
          borderRadius: "50%",
          animation: "fsSpinner 0.8s linear infinite",
        }}
      />
    </div>
  );
}
