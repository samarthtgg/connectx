import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ConnectX — Bumpy",
    short_name: "ConnectX",
    description: "Private conversations, groups, status updates and calls with your people.",
    start_url: "/chat-preview",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    categories: ["social", "communication"],
    icons: [{ src: "/connectx-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
