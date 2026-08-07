import { getAppBaseUrl } from "@/lib/mail"

/** Minimal JSON-LD builders — kept dependency-free (no schema-dts) on purpose. */
type JsonLdObject = Record<string, unknown>

function baseUrl() {
  return getAppBaseUrl().replace(/\/+$/, "")
}

export function buildLocalBusinessJsonLd(input: {
  name: string
  description?: string
  telephone?: string
  email?: string
  image?: string
  url?: string
}): JsonLdObject {
  const site = baseUrl()
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: input.name,
    description: input.description,
    url: input.url ?? site,
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.image ? { image: input.image } : {}),
    address: {
      "@type": "PostalAddress",
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
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: input.name,
    description: input.description,
    ...(input.image ? { image: input.image } : {}),
    url: `${baseUrl()}${input.url}`,
    touristType: "Airport transfer travellers",
    includesAttraction: [],
  }
}

export function buildBreadcrumbJsonLd(
  items: { name: string; url: string }[],
): JsonLdObject {
  const site = baseUrl()
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${site}${item.url}`,
    })),
  }
}
