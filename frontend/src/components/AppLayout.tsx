import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { DeepAnalysisTrigger } from "@/components/DeepAnalysisPanel";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useState, useRef, useEffect } from "react";

function UserAvatar({ displayName, email, photoURL }: {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = displayName?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? "U";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        id="user-avatar-btn"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "2px solid hsl(var(--border))",
          overflow: "hidden",
          cursor: "pointer",
          padding: 0,
          background: "linear-gradient(135deg, #7c3aed, #9333ea)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 700,
          flexShrink: 0,
        }}
        aria-label="User menu"
      >
        {photoURL ? (
          <img src={photoURL} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : initial}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 220,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid hsl(var(--border))" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName ?? "FinSage User"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {email}
            </p>
          </div>

          {/* Profile Settings (grayed) */}
          <button
            disabled
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "none",
              border: "none",
              textAlign: "left",
              fontSize: "13px",
              color: "hsl(var(--muted-foreground))",
              cursor: "not-allowed",
              opacity: 0.5,
            }}
          >
            Profile Settings (coming soon)
          </button>

          <div style={{ height: 1, background: "hsl(var(--border))", margin: "0 14px" }} />

          {/* Sign Out */}
          <button
            id="sign-out-btn"
            onClick={() => { setOpen(false); signOut(auth); }}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "none",
              border: "none",
              textAlign: "left",
              fontSize: "13px",
              color: "#ef4444",
              cursor: "pointer",
              fontWeight: 600,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 gap-3">
            <SidebarTrigger />

            {/* Right-side navbar controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
              {/* Ask FinSage */}
              <button
                id="ask-finsage-navbar-btn"
                onClick={() => navigate("/ai-advisor")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all duration-200"
              >
                <MessageCircle size={14} />
                <span>Ask FinSage</span>
              </button>

              {/* Deep Analysis */}
              <DeepAnalysisTrigger />

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* User Avatar */}
              {user && (
                <UserAvatar
                  displayName={user.displayName}
                  email={user.email}
                  photoURL={user.photoURL}
                />
              )}
            </div>
          </header>

          {/* key={pathname} triggers page-enter animation on every route change */}
          <main key={pathname} className="page-enter flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
