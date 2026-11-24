import { getAppBaseUrl } from "@/lib/mail"

/** Minimal JSON-LD builders — kept dependency-free (no schema-dts) on purpose. */
type JsonLdObject = Record<string, unknown>

function baseUrl() {
  return getAppBaseUrl().replace(/\/+$/, "")
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const site = baseUrl()
  return `${site}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`
}

/** Raster logo fallback — Google Rich Results does not support SVG logos. */
const DEFAULT_RASTER_LOGO = "/marketing/favicon.png"

export function buildWebSiteJsonLd(input: {
  name: string
  alternateName?: string
  inLanguage?: string
}): JsonLdObject {
  const site = baseUrl()
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    ...(input.alternateName ? { alternateName: input.alternateName } : {}),
    url: site,
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
  }
}

export function buildLocalBusinessJsonLd(input: {
  name: string
  description?: string
  telephone?: string
  email?: string
  image?: string
  url?: string
  logoUrl?: string
  sameAs?: string[]
}): JsonLdObject {
  const site = baseUrl()
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "TaxiService"],
    name: input.name,
    description: input.description,
    url: input.url ? absoluteUrl(input.url) : site,
    logo: absoluteUrl(input.logoUrl || DEFAULT_RASTER_LOGO),
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "00:00",
        closes: "23:59",
      },
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Tirana",
      addressCountry: "AL",
    },
    areaServed: {
      "@type": "Country",
      name: "Albania",
    },
    priceRange: "€€",
  }
}

export function buildFaqPageJsonLd(
  items: { question: string; answer: string }[],
): JsonLdObject | null {
  const valid = items.filter((item) => item.question && item.answer)
  if (valid.length === 0) return null
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: valid.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

export function buildTouristDestinationJsonLd(input: {
  name: string
  description?: string
  image?: string
  url: string
  attractions?: { name: string; description?: string; image?: string }[]
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: input.name,
    description: input.description,
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
    url: absoluteUrl(input.url),
    touristType: "Airport transfer travellers",
    includesAttraction: (input.attractions ?? [])
      .filter((a) => typeof a.name === "string" && a.name.trim())
      .map((attraction) => ({
        "@type": "TouristAttraction",
        name: attraction.name,
        ...(attraction.description
          ? { description: attraction.description }
          : {}),
        ...(attraction.image ? { image: absoluteUrl(attraction.image) } : {}),
      })),
  }
}

export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  }
}

export function buildServiceJsonLd(input: {
  name: string
  description: string
  url: string
  priceEur: number
  currency?: string
  areaServed?: string
  providerName?: string
}): JsonLdObject {
  const site = baseUrl()
  const pageUrl = input.url.startsWith("http")
    ? input.url
    : `${site}${input.url}`
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: pageUrl,
    provider: {
      "@type": "LocalBusiness",
      name: input.providerName ?? "Landed Albania",
      url: site,
      address: {
        "@type": "PostalAddress",
        addressCountry: "AL",
      },
    },
    areaServed: {
      "@type": "Country",
      name: input.areaServed ?? "Albania",
    },
    offers: {
      "@type": "Offer",
      price: input.priceEur,
      priceCurrency: input.currency ?? "EUR",
      availability: "https://schema.org/InStock",
      url: pageUrl,
    },
  }
}

export function buildBlogPostingJsonLd(input: {
  headline: string
  description: string
  url: string
  image: string
  datePublished: string
  dateModified: string
  authorName: string
  authorType?: "Person" | "Organization"
  authorUrl?: string
  inLanguage?: string
  publisherName?: string
  publisherLogoUrl?: string
}): JsonLdObject {
  const site = baseUrl()
  const pageUrl = absoluteUrl(input.url)
  const imageUrl = absoluteUrl(input.image)
  const logoUrl = absoluteUrl(input.publisherLogoUrl || DEFAULT_RASTER_LOGO)

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline,
    description: input.description,
    image: [imageUrl],
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    ...(input.inLanguage ? { inLanguage: input.inLanguage } : {}),
    author: {
      "@type": input.authorType ?? "Organization",
      name: input.authorName,
      url: input.authorUrl ? absoluteUrl(input.authorUrl) : site,
    },
    publisher: {
      "@type": "Organization",
      name: input.publisherName ?? "Landed Albania",
      logo: {
        "@type": "ImageObject",
        url: logoUrl,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
  }
}
