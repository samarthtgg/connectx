"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) setMessage("This reset link is invalid or expired. Request a new password-reset email.");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setReady(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setMessage("Use at least 8 characters with uppercase, lowercase, a number, and a special character.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSuccess(true);
    setMessage("Your password has been updated successfully. You can now sign in with your new password.");
    await supabase.auth.signOut();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-7 text-center">
          <div className="text-3xl font-bold tracking-tight"><span className="text-indigo-400">✦</span> ConnectX</div>
          <h1 className="mt-5 text-2xl font-semibold">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-400">Make sure it’s strong and unique.</p>
        </div>
        {ready && !success ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-300">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-300">Confirm new password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
            </div>
            <button disabled={loading} className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">{loading ? "Updating…" : "Update password"}</button>
          </form>
        ) : null}
        {message && <p role="status" aria-live="polite" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${success ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}>{message}</p>}
        <button onClick={() => router.push("/")} className="mt-6 w-full text-sm font-medium text-indigo-300 hover:text-indigo-200">Back to ConnectX sign in</button>
      </section>
    </main>
  );
}
