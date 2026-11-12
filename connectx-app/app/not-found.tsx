export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-7 text-center shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-300">ConnectX · Bumpy</p>
        <p className="mt-5 text-6xl font-black tracking-tight">404</p>
        <h1 className="mt-3 text-xl font-bold">This page doesn’t exist.</h1>
        <p className="mt-2 text-sm text-slate-400">The link may be old, or the page may have moved.</p>
        <a href="/chat-preview" className="mt-6 block rounded-xl bg-indigo-500 px-4 py-3 font-semibold text-white hover:bg-indigo-400">Open ConnectX</a>
      </section>
    </main>
  );
}
