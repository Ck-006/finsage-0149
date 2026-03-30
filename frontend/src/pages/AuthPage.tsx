import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type Tab = "signin" | "signup";

function getErrorMessage(code: string): string {
  const map: Record<string, string> = {
    "auth/user-not-found": "No account with this email",
    "auth/wrong-password": "Incorrect password",
    "auth/invalid-credential": "Incorrect email or password",
    "auth/email-already-in-use": "Email already registered",
    "auth/weak-password": "Password must be 8+ characters",
    "auth/network-request-failed": "Check your connection",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/invalid-email": "Please enter a valid email address",
  };
  return map[code] ?? "Something went wrong. Try again.";
}

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Sign In state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign Up state
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");

  const googleProvider = new GoogleAuthProvider();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, siEmail, siPassword);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suPassword !== suConfirm) {
      setError("Passwords don't match");
      return;
    }
    if (suPassword.length < 8) {
      setError("Password must be 8+ characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, suEmail, suPassword);
      if (suName.trim()) {
        await updateProfile(cred.user, { displayName: suName.trim() });
      }
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!siEmail) {
      setError("Enter your email above first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, siEmail);
      setResetSent(true);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? "";
      setError(getErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
    setResetSent(false);
  };

  const inputCls =
    "w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(222, 47%, 6%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <style>{`
        @keyframes authFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes errSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .auth-card { animation: authFadeIn 0.35s ease-out both; }
        .err-msg   { animation: errSlide 0.2s ease-out both; }
        .auth-btn-spin {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: fsSpinner 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 6px;
        }
        @keyframes fsSpinner { to { transform: rotate(360deg); } }
      `}</style>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            background: "linear-gradient(135deg, #7c3aed, #9333ea)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            margin: "0 auto 12px",
            boxShadow: "0 8px 24px rgba(139,92,246,0.35)",
          }}
        >
          💼
        </div>
        <p style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.03em" }}>
          FinSage
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
          Your AI-powered finance advisor
        </p>
      </div>

      {/* Card */}
      <div
        className="auth-card"
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "hsl(222, 47%, 10%)",
          border: "1px solid hsl(217, 33%, 18%)",
          borderRadius: "20px",
          padding: "28px 28px 24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Tab toggle */}
        <div
          style={{
            display: "flex",
            background: "hsl(222, 47%, 8%)",
            borderRadius: "12px",
            padding: "4px",
            marginBottom: "24px",
          }}
        >
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                transition: "all 0.2s",
                background: tab === t ? "#7c3aed" : "transparent",
                color: tab === t ? "#fff" : "#64748b",
              }}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            className="err-msg"
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "12px",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        {resetSent && (
          <div
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "16px",
              fontSize: "12px",
              color: "#86efac",
            }}
          >
            ✅ Password reset email sent!
          </div>
        )}

        {/* SIGN IN */}
        {tab === "signin" && (
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              className={inputCls}
              type="email"
              placeholder="Email address"
              value={siEmail}
              onChange={(e) => setSiEmail(e.target.value)}
              required
            />
            <input
              className={inputCls}
              type="password"
              placeholder="Password"
              value={siPassword}
              onChange={(e) => setSiPassword(e.target.value)}
              required
            />
            <div style={{ textAlign: "right" }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                style={{
                  background: "none",
                  border: "none",
                  color: "#a78bfa",
                  fontSize: "12px",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {loading ? <><span className="auth-btn-spin" />Signing in…</> : "Sign In"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "hsl(217,33%,18%)" }} />
              <span style={{ fontSize: "11px", color: "#475569" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "hsl(217,33%,18%)" }} />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: "12px",
                border: "1px solid hsl(217,33%,22%)",
                background: "hsl(222,47%,12%)",
                color: "#e2e8f0",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "background 0.2s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        )}

        {/* SIGN UP */}
        {tab === "signup" && (
          <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <input
              className={inputCls}
              type="text"
              placeholder="Full Name"
              value={suName}
              onChange={(e) => setSuName(e.target.value)}
            />
            <input
              className={inputCls}
              type="email"
              placeholder="Email address"
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              required
            />
            <input
              className={inputCls}
              type="password"
              placeholder="Password (min 8 characters)"
              value={suPassword}
              onChange={(e) => setSuPassword(e.target.value)}
              minLength={8}
              required
            />
            <input
              className={inputCls}
              type="password"
              placeholder="Confirm Password"
              value={suConfirm}
              onChange={(e) => setSuConfirm(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "none",
                background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {loading ? <><span className="auth-btn-spin" />Creating account…</> : "Create Account"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "hsl(217,33%,18%)" }} />
              <span style={{ fontSize: "11px", color: "#475569" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "hsl(217,33%,18%)" }} />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: "12px",
                border: "1px solid hsl(217,33%,22%)",
                background: "hsl(222,47%,12%)",
                color: "#e2e8f0",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <p style={{ fontSize: "11px", color: "#475569", textAlign: "center", margin: "4px 0 0" }}>
              By creating an account you agree to our Terms of Service
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
