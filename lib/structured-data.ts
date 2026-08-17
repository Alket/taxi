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
  attractions?: { name: string; description?: string; image?: string }[]
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: input.name,
    description: input.description,
    ...(input.image ? { image: input.image } : {}),
    url: `${baseUrl()}${input.url}`,
    touristType: "Airport transfer travellers",
    includesAttraction: (input.attractions ?? [])
      .filter((a) => typeof a.name === "string" && a.name.trim())
      .map((attraction) => ({
        "@type": "TouristAttraction",
        name: attraction.name,
        ...(attraction.description
          ? { description: attraction.description }
          : {}),
        ...(attraction.image ? { image: attraction.image } : {}),
      })),
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
  publisherName?: string
  publisherLogoUrl?: string
}): JsonLdObject {
  const site = baseUrl()
  const pageUrl = input.url.startsWith("http")
    ? input.url
    : `${site}${input.url}`
  const imageUrl = input.image.startsWith("http")
    ? input.image
    : `${site}${input.image}`
  const logoUrl =
    input.publisherLogoUrl ??
    `${site}/marketing/logo.svg`

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline,
    description: input.description,
    image: [imageUrl],
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: {
      "@type": "Person",
      name: input.authorName,
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
