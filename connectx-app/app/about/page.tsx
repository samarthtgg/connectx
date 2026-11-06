import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About ConnectX – Chat with Friends",
  description:
    "Discover ConnectX, a messaging app for chatting with friends, sharing status updates, joining group conversations, and making voice and video calls.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    title: "About ConnectX – Chat with Friends",
    description:
      "Chat with friends, share status updates, join groups, and make voice and video calls with ConnectX.",
    url: "https://connectx-sandy.vercel.app/about",
    siteName: "ConnectX",
  },
};

export default function AboutConnectXPage() {
  return (
    <main className="min-h-screen bg-[#101018] px-6 py-16 text-white">
      <article className="mx-auto max-w-3xl">
        <p className="mb-4 text-sm font-semibold tracking-[0.2em] text-violet-300">
          CONNECTX
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Chat with friends. Stay connected.
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-300">
          ConnectX is a messaging app that brings your conversations and
          connections together. Find friends by username and keep in touch
          through direct messages.
        </p>

        <section className="mt-12 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold">Private conversations</h2>
            <p className="mt-3 leading-7 text-slate-300">
              Send messages, share voice recordings, and continue one-to-one
              conversations with your friends.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Groups and communities</h2>
            <p className="mt-3 leading-7 text-slate-300">
              Create group conversations, bring people together, and use group
              features to stay in sync.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Status and calls</h2>
            <p className="mt-3 leading-7 text-slate-300">
              Share status updates and connect through voice and video calls.
            </p>
          </div>
        </section>

        <div className="mt-12">
          <Link
            href="/"
            className="inline-flex rounded-full bg-violet-600 px-7 py-3 font-semibold text-white transition hover:bg-violet-500"
          >
            Open ConnectX
          </Link>
        </div>
      </article>
    </main>
  );
}
