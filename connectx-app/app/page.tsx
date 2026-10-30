"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success" | "info">("info");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setMessage(error.message);
          setMessageKind("error");
        } else {
          setUser(data.session?.user ?? null);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setMessage("Can't connect to the authentication server. Check the Supabase project URL and network/DNS, then try again.");
        setMessageKind("error");
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageKind("info");

    try {
      const result = mode === "signup"
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (result.error) {
        setMessage(result.error.message);
        setMessageKind("error");
      } else if (mode === "signup" && !result.data.session) {
        setMessage("Account created. Check your inbox for the confirmation email before signing in.");
        setMessageKind("success");
        setMode("login");
      } else {
        setUser(result.data.user ? { email: result.data.user.email } : null);
        setMessage(mode === "signup" ? "Your account is ready." : "You're signed in.");
        setMessageKind("success");
      }
    } catch {
      setMessage("Failed to reach Supabase. This is usually a project URL, DNS, or network problem—not an incorrect password. Try again after the Supabase endpoint is reachable.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setMessage("You have signed out.");
      setMessageKind("success");
    } catch {
      setMessage("Could not contact Supabase to sign out. Try again when the service is reachable.");
      setMessageKind("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.logo}><span style={styles.logoMark}>✦</span> ConnectX</div>
        <p style={styles.tagline}>A little closer, wherever you are.</p>

        {checkingSession ? (
          <div style={styles.status}>Checking your session…</div>
        ) : user ? (
          <div style={styles.content}>
            <div style={styles.avatar}>{(user.email ?? "U").slice(0, 1).toUpperCase()}</div>
            <h1 style={styles.heading}>You're connected.</h1>
            <p style={styles.muted}>{user.email}</p>
            <a href="/chat-preview" style={styles.secondaryLink}>Open chat preview</a>
            <button style={styles.button} onClick={logout} disabled={loading}>{loading ? "Please wait…" : "Log out"}</button>
          </div>
        ) : (
          <>
            <div style={styles.tabs}>
              <button type="button" style={mode === "signup" ? styles.activeTab : styles.tab} onClick={() => { setMode("signup"); setMessage(""); }}>Create account</button>
              <button type="button" style={mode === "login" ? styles.activeTab : styles.tab} onClick={() => { setMode("login"); setMessage(""); }}>Log in</button>
            </div>
            <h1 style={styles.heading}>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
            <p style={styles.muted}>{mode === "signup" ? "Start conversations with your people." : "Sign in to continue to ConnectX."}</p>

            <form onSubmit={handleAuth} style={styles.form}>
              <label style={styles.label} htmlFor="email">Email address</label>
              <input id="email" style={styles.input} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <label style={styles.label} htmlFor="password">Password</label>
              <input id="password" style={styles.input} type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              <button style={styles.button} type="submit" disabled={loading}>{loading ? "Connecting…" : mode === "signup" ? "Create account" : "Log in"}</button>
            </form>
            {message && <p role="status" style={{ ...styles.notice, ...(messageKind === "error" ? styles.error : messageKind === "success" ? styles.success : {}) }}>{message}</p>}
            <p style={styles.footnote}>By continuing, you agree to use ConnectX responsibly.</p>
          </>
        )}

        {!user && !message && <p style={styles.footnote}>Having trouble? The chat preview is available without signing in.</p>}
        <a href="/chat-preview" style={styles.previewLink}>Explore chat preview →</a>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20, background: "radial-gradient(circle at 20% 10%, #24204c 0, #10172a 38%, #090e19 100%)", color: "#f5f6ff", fontFamily: "Inter, system-ui, Arial, sans-serif" },
  card: { width: "100%", maxWidth: 430, padding: "34px 30px 26px", border: "1px solid #303956", borderRadius: 24, background: "rgba(18, 26, 45, .96)", boxShadow: "0 24px 80px rgba(0,0,0,.35)" },
  logo: { display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 27, fontWeight: 850, letterSpacing: "-1px" },
  logoMark: { color: "#a99aff" },
  tagline: { margin: "8px 0 28px", textAlign: "center", color: "#8f9bb5", fontSize: 13 },
  content: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  avatar: { width: 58, height: 58, display: "grid", placeItems: "center", borderRadius: "50%", background: "#6658ca", fontSize: 22, fontWeight: 800 },
  heading: { margin: "12px 0 6px", textAlign: "center", fontSize: 24, letterSpacing: "-.7px" },
  muted: { margin: "0 0 20px", textAlign: "center", color: "#96a1b8", fontSize: 13, lineHeight: 1.5 },
  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, padding: 5, borderRadius: 12, background: "#0c1424", marginBottom: 24 },
  tab: { padding: 10, border: 0, borderRadius: 9, background: "transparent", color: "#929db4", fontWeight: 650, cursor: "pointer" },
  activeTab: { padding: 10, border: 0, borderRadius: 9, background: "#29264a", color: "#d4ceff", fontWeight: 750, cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  label: { marginTop: 5, color: "#c5cce0", fontSize: 12, fontWeight: 650 },
  input: { width: "100%", padding: "14px 13px", border: "1px solid #39445e", borderRadius: 11, outline: "none", background: "#0c1424", color: "#fff", fontSize: 14 },
  button: { width: "100%", marginTop: 12, padding: 14, border: 0, borderRadius: 11, background: "#7868eb", color: "#fff", fontWeight: 750, fontSize: 14, cursor: "pointer", opacity: 1 },
  notice: { padding: 12, borderRadius: 10, background: "#202a40", color: "#cbd5ea", fontSize: 12, lineHeight: 1.5, overflowWrap: "anywhere" },
  error: { background: "#3a202c", color: "#ffb9c4" },
  success: { background: "#17372f", color: "#a9ebd2" },
  status: { padding: 22, textAlign: "center", color: "#aeb8ce", fontSize: 13 },
  footnote: { margin: "20px 0 0", textAlign: "center", color: "#77839c", fontSize: 10, lineHeight: 1.5 },
  secondaryLink: { color: "#c9bfff", fontSize: 13, textDecoration: "none" },
  previewLink: { display: "block", marginTop: 22, textAlign: "center", color: "#b9adff", fontSize: 12, textDecoration: "none" },
};
