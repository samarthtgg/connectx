"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("ConnectX route error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-indigo-500/15 text-2xl text-indigo-300">!</div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-300">ConnectX · Bumpy</p>
        <h1 className="mt-3 text-2xl font-bold">That didn’t go as planned.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">This screen hit an unexpected error. Your account and conversations haven’t been intentionally changed. Try loading this screen again.</p>
        {error.digest && <p className="mt-3 text-xs text-slate-500">Reference: {error.digest}</p>}
        <button onClick={() => reset()} className="mt-6 w-full rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white transition hover:bg-indigo-400">Try again</button>
        <a href="/chat-preview" className="mt-3 block rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5">Back to ConnectX</a>
      </section>
    </main>
  );
}
