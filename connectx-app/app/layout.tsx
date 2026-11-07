import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://connectx-sandy.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ConnectX – Chat with Friends | Messaging, Groups & Calls",
    template: "%s | ConnectX",
  },
  description:
    "Chat with friends on ConnectX. Send private messages, join group conversations, share status updates, and connect with voice and video calls.",
  applicationName: "ConnectX",
  keywords: [
    "ConnectX",
    "ConnectX chat",
    "chat with friends",
    "messaging app",
    "voice and video calls",
    "status updates",
    "group chat",
    "online messaging",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "ConnectX",
    title: "ConnectX – Chat with Friends | Messaging, Groups & Calls",
    description:
      "Connect with friends on ConnectX through private messages, group conversations, status updates, and voice and video calls.",
  },
  twitter: {
    card: "summary",
    title: "ConnectX – Chat, Share and Stay Connected",
    description:
      "Chat with friends, share status updates, make voice and video calls, and stay connected with ConnectX.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
