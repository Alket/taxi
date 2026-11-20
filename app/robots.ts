import type { MetadataRoute } from "next"

import { getAppBaseUrl } from "@/lib/mail"
import { isSearchIndexingEnabled } from "@/lib/settings"

// Must re-read Admin → Settings on every request (indexing can be toggled live).
export const dynamic = "force-dynamic"

/**
 * Dynamic robots.txt driven by Admin → Settings → “Allow search engines”.
 * When indexing is off, disallow everything (safe for pre-launch).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const indexing = await isSearchIndexingEnabled()

  if (!indexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/driver/"],
    },
    sitemap: `${getAppBaseUrl().replace(/\/+$/, "")}/sitemap.xml`,
  }
}
