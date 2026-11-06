import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about"],
      disallow: ["/api/", "/chat/", "/chat-preview/", "/messages/"],
    },
    sitemap: "https://connectx-sandy.vercel.app/sitemap.xml",
    host: "https://connectx-sandy.vercel.app",
  };
}
