import type { MetadataRoute } from "next"

import { getSettings } from "@/lib/settings"

/**
 * Dynamic robots.txt driven by Admin → Settings → “Allow search engines”.
 * When indexing is off, disallow everything (safe for pre-launch).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  let indexing = false
  try {
    const settings = await getSettings()
    indexing = settings.searchIndexingEnabled === true
  } catch {
    indexing = false
  }

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
  }
}
