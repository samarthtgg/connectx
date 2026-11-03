"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const rules = [
  (v: string) => v.length >= 8,
  (v: string) => /[A-Z]/.test(v),
  (v: string) => /[a-z]/.test(v),
  (v: string) => /[0-9]/.test(v),
  (v: string) => /[^A-Za-z0-9]/.test(v),
];
const labels = ["At least 8 characters", "One uppercase letter", "One lowercase letter", "One number", "One special character"];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const valid = rules.every((rule) => rule(password));

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setReady(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || session)) setReady(true);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) { setMessage("Meet all password requirements first."); return; }
    if (password !== confirm) { setMessage("The passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setMessage("Password updated successfully. You can now sign in with your new password.");
      await supabase.auth.signOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update your password. Request a fresh reset link.");
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-7 text-center">
          <div className="text-3xl font-bold tracking-tight"><span className="text-indigo-400">✦</span> ConnectX</div>
          <h1 className="mt-5 text-2xl font-semibold">Create a new password</h1>
          <p className="mt-2 text-sm text-slate-400">Open this page using the secure password-reset link sent to your email.</p>
        </div>
        {!ready ? <p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-300">Waiting for a valid recovery link. If this page was opened directly, request a new link from the sign-in screen.</p> : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">New password
              <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
            </label>
            <ul className="space-y-1 text-xs text-slate-400">{labels.map((label, i) => <li key={label} className={rules[i](password) ? "text-emerald-300" : ""}>{rules[i](password) ? "✓" : "○"} {label}</li>)}</ul>
            <label className="block text-sm font-medium text-slate-300">Confirm new password
              <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
            </label>
            <button disabled={busy || success || !valid || password !== confirm} className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">{busy ? "Updating…" : "Set new password"}</button>
          </form>
        )}
        {message && <p role="status" aria-live="polite" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${success ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200"}`}>{message}</p>}
        <button onClick={() => router.push("/")} className="mt-6 w-full text-sm font-medium text-indigo-300 hover:text-indigo-200">Back to sign in</button>
      </section>
    </main>
  );
}
