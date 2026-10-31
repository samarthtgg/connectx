import type { MetadataRoute } from "next";

const siteUrl = "https://connectx-sandy.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/chat-preview"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
