"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthMode = "signup" | "login" | "forgot";

// Always send Supabase email links to the deployed app, never a temporary Codespaces preview URL.
const AUTH_REDIRECT_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://connectx-sandy.vercel.app";

const passwordChecks = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /[0-9]/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [loading, setLoading] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [resending, setResending] = useState(false);

  const checks = useMemo(
    () => passwordChecks.map((item) => ({ ...item, passed: item.test(password) })),
    [password]
  );
  const passwordValid = checks.every((item) => item.passed);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function showMessage(text: string, type: "success" | "error" | "info") {
    setMessage(text);
    setMessageType(type);
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === "signup" && !passwordValid) {
      showMessage("Please meet all password requirements before creating your account.", "error");
      return;
    }
    setLoading(true);
    setMessage("");
    setVerificationPending(false);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${AUTH_REDIRECT_URL}/reset-password`,
        });
        if (error) throw error;
        showMessage("If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder.", "success");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: AUTH_REDIRECT_URL },
        });
        if (error) {
          const lower = error.message.toLowerCase();
          if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
            showMessage("An account with this email may already exist. Try signing in or use Forgot password.", "error");
          } else {
            throw error;
          }
        } else if (data.user && data.user.identities?.length === 0) {
          showMessage("An account with this email already exists. Sign in or use Forgot password.", "error");
        } else if (data.session) {
          setUser(data.user);
          showMessage("Your ConnectX account has been created successfully. Welcome!", "success");
        } else {
          setVerificationPending(true);
          showMessage("Account created successfully. We sent a verification link to your email. Verify it before signing in.", "success");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          const lower = error.message.toLowerCase();
          if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
            setVerificationPending(true);
            showMessage("Your email is not verified yet. Check your inbox or resend the verification email below.", "error");
          } else if (lower.includes("invalid login credentials")) {
            showMessage("Email or password is incorrect. If you don't have an account, create one first.", "error");
          } else {
            throw error;
          }
        } else {
          setUser(data.user);
          showMessage("Signed in successfully. Welcome back to ConnectX!", "success");
        }
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin + "/chat-preview" : AUTH_REDIRECT_URL,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Google sign-in could not start. Please try again.", "error");
      setLoading(false);
    }
  }
  async function resendVerification() {
    if (!email.trim()) {
      showMessage("Enter your email address first.", "error");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });
      if (error) throw error;
      showMessage("Verification email sent. Check your inbox and spam folder.", "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not resend the verification email.", "error");
    } finally {
      setResending(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showMessage(error.message, "error");
      return;
    }
    setUser(null);
    setPassword("");
    showMessage("You have logged out.", "success");
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setVerificationPending(false);
    setPassword("");
  }

  const emailVerified = Boolean(user?.email_confirmed_at);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-7 text-center">
          <div className="text-3xl font-bold tracking-tight"><span className="text-indigo-400">✦</span> ConnectX</div>
          <p className="mt-2 text-sm text-slate-400">Messages that bring us closer.</p>
        </div>

        {user ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300">✓</div>
            <h1 className="text-2xl font-semibold">Welcome to ConnectX</h1>
            <p className="mt-2 break-all text-sm text-slate-300">{user.email}</p>
            <p className={`mt-4 text-sm ${emailVerified ? "text-emerald-300" : "text-amber-300"}`}>
              {emailVerified ? "Email verified" : "Email verification pending"}
            </p>
            <a href="/chat-preview" className="mt-6 block rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400">Open ConnectX</a>
            <button onClick={logout} className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-300 hover:bg-white/5">Log out</button>
          </div>
        ) : (
          <>
            <h1 className="text-center text-2xl font-semibold">
              {mode === "signup" ? "Create your account" : mode === "login" ? "Welcome back" : "Reset your password"}
            </h1>
            <p className="mb-7 mt-2 text-center text-sm text-slate-400">
              {mode === "signup" ? "Join ConnectX and stay connected." : mode === "login" ? "Sign in to continue your conversations." : "We’ll email you a secure password-reset link."}
            </p>

            {mode !== "forgot" && (
              <div className="mb-5">
                <button type="button" onClick={continueWithGoogle} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
                  <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.04 13.22l7.98 6.19C11.91 13.72 17.47 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.98 46.98 31.86 46.98 24.55z"/><path fill="#FBBC05" d="M10.02 28.59A14.4 14.4 0 0 1 9.25 24c0-1.59.27-3.13.77-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.04 10.78l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-6.53 0-12.09-4.22-14.07-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  Continue with Google
                </button>
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-white/10"/><span>OR CONTINUE WITH EMAIL</span><span className="h-px flex-1 bg-white/10"/></div>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">Email address</label>
                <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
              </div>

              {mode !== "forgot" && (
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                  <input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
                  {mode === "signup" && (
                    <div className="mt-3 rounded-xl bg-slate-950/70 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Password requirements</p>
                      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {checks.map((item) => (
                          <li key={item.label} className={`flex items-center gap-2 text-xs ${item.passed ? "text-emerald-300" : "text-slate-500"}`}>
                            <span aria-hidden="true">{item.passed ? "✓" : "○"}</span>{item.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading || (mode === "signup" && !passwordValid)} className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? "Please wait…" : mode === "signup" ? "Create account" : mode === "login" ? "Sign in" : "Send reset link"}
              </button>
            </form>

            {mode === "login" && (
              <button type="button" onClick={() => changeMode("forgot")} className="mt-4 w-full text-center text-sm font-medium text-indigo-300 hover:text-indigo-200">Forgot password? Send an email reset link</button>
            )}

            {verificationPending && (
              <button type="button" onClick={resendVerification} disabled={resending} className="mt-4 w-full rounded-xl border border-amber-400/30 px-4 py-2.5 text-sm text-amber-200 hover:bg-amber-400/10 disabled:opacity-50">
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            )}

            <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">
              {mode === "signup" ? (
                <>Already have an account? <button onClick={() => changeMode("login")} className="font-semibold text-indigo-300 hover:text-indigo-200">Sign in</button></>
              ) : mode === "login" ? (
                <>New to ConnectX? <button onClick={() => changeMode("signup")} className="font-semibold text-indigo-300 hover:text-indigo-200">Create account</button></>
              ) : (
                <button onClick={() => changeMode("login")} className="font-semibold text-indigo-300 hover:text-indigo-200">Back to sign in</button>
              )}
            </div>
          </>
        )}

        {message && (
          <div role="status" aria-live="polite" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${messageType === "success" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : messageType === "error" ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200"}`}>
            {message}
          </div>
        )}
      </section>
    </main>
  );
}
