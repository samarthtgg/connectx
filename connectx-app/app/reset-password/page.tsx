"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Step = "phone" | "otp" | "password";

const passwordRules = [
  (value: string) => value.length >= 8,
  (value: string) => /[A-Z]/.test(value),
  (value: string) => /[a-z]/.test(value),
  (value: string) => /[0-9]/.test(value),
  (value: string) => /[^A-Za-z0-9]/.test(value),
];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const validPassword = passwordRules.every((rule) => rule(password));

  function normalizedPhone() {
    return phone.trim().replace(/[\\s()-]/g, "");
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const number = normalizedPhone();
    if (!/^\\+[1-9]\\d{7,14}$/.test(number)) {
      setMessage("Enter the mobile number with country code, for example +91 followed by your 10-digit number.");
      return;
    }
    setLoading(true); setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: number,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setStep("otp");
      setMessage("If this number is verified on a ConnectX account, an SMS code has been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the SMS code. Try again later.");
    } finally { setLoading(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\\d{6}$/.test(otp)) { setMessage("Enter the 6-digit code from your SMS."); return; }
    setLoading(true); setMessage("");
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone(),
        token: otp,
        type: "sms",
      });
      if (error) throw error;
      setStep("password");
      setMessage("Mobile number verified. Choose a new password.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The code is invalid or expired.");
    } finally { setLoading(false); }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validPassword) { setMessage("Meet all password requirements first."); return; }
    if (password !== confirmPassword) { setMessage("The passwords do not match."); return; }
    setLoading(true); setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.phone !== normalizedPhone() || !user.phone_confirmed_at) {
        throw new Error("Phone verification session is missing. Start recovery again.");
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setMessage("Your password has been changed successfully. Sign in using your new password.");
      await supabase.auth.signOut();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update the password.");
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <div className="mb-7 text-center">
          <div className="text-3xl font-bold tracking-tight"><span className="text-indigo-400">✦</span> ConnectX</div>
          <h1 className="mt-5 text-2xl font-semibold">Recover your account</h1>
          <p className="mt-2 text-sm text-slate-400">Verify your connected mobile number to create a new password.</p>
        </div>

        {step === "phone" && <form onSubmit={requestCode} className="space-y-4">
          <label className="block text-sm font-medium text-slate-300">Connected mobile number
            <input type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
          </label>
          <button disabled={loading} className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">{loading ? "Sending code…" : "Send SMS code"}</button>
        </form>}

        {step === "otp" && <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-sm text-slate-300">Enter the 6-digit code sent to <strong>{phone}</strong>.</p>
          <label className="block text-sm font-medium text-slate-300">SMS verification code
            <input type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\\D/g, "").slice(0,6))} placeholder="••••••" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-center text-xl tracking-[0.4em] text-white outline-none focus:border-indigo-400" />
          </label>
          <button disabled={loading || otp.length !== 6} className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">{loading ? "Verifying…" : "Verify code"}</button>
          <button type="button" onClick={() => { setStep("phone"); setOtp(""); setMessage(""); }} className="w-full text-sm text-indigo-300">Change mobile number</button>
        </form>}

        {step === "password" && <form onSubmit={updatePassword} className="space-y-4">
          <label className="block text-sm font-medium text-slate-300">New password
            <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
          </label>
          <ul className="space-y-1 text-xs text-slate-400">
            {["At least 8 characters", "One uppercase letter", "One lowercase letter", "One number", "One special character"].map((label, i) => <li key={label} className={passwordRules[i](password) ? "text-emerald-300" : ""}>{passwordRules[i](password) ? "✓" : "○"} {label}</li>)}
          </ul>
          <label className="block text-sm font-medium text-slate-300">Confirm new password
            <input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
          </label>
          <button disabled={loading || !validPassword || password !== confirmPassword} className="w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">{loading ? "Updating…" : "Set new password"}</button>
        </form>}

        {message && <p role="status" aria-live="polite" className={`mt-5 rounded-xl border px-4 py-3 text-sm ${success ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-sky-400/30 bg-sky-400/10 text-sky-200"}`}>{message}</p>}
        <button onClick={() => router.push("/")} className="mt-6 w-full text-sm font-medium text-indigo-300 hover:text-indigo-200">Back to sign in</button>
      </section>
    </main>
  );
}
