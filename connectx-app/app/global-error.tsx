"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("ConnectX global application error", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <main className="flex min-h-screen items-center justify-center px-5 py-12">
          <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/10 text-2xl text-rose-300">!</div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-300">ConnectX · Bumpy</p>
            <h1 className="mt-3 text-2xl font-bold">ConnectX hit an unexpected error.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">The app could not render this screen. Try again, or return to the sign-in page.</p>
            {error.digest && <p className="mt-3 text-xs text-slate-500">Reference: {error.digest}</p>}
            <button onClick={() => reset()} className="mt-6 w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400">Try again</button>
            <a href="/" className="mt-3 block rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5">Back to sign in</a>
          </section>
        </main>
      </body>
    </html>
  );
}
