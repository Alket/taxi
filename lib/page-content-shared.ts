export const PAGE_SECTION_TYPES = [
  "heading",
  "text",
  "image",
  "faq_item",
  "attraction",
] as const

export type PageSectionType = (typeof PAGE_SECTION_TYPES)[number]

export const CORE_PAGE_SLUGS = [
  "home",
  "cancellation-policy",
  "privacy-policy",
  "terms",
  "cookies",
] as const

export type CorePageSlug = (typeof CORE_PAGE_SLUGS)[number]

export function isCorePageSlug(slug: string): boolean {
  return (CORE_PAGE_SLUGS as readonly string[]).includes(slug)
}

export type PageSection = {
  id: string
  type: PageSectionType
  /** Stable slot key used by frontend layouts (e.g. hero.heading). */
  key: string
  heading?: string
  body?: string
  src?: string
  alt?: string
  question?: string
  answer?: string
  level?: 1 | 2 | 3
  /** Lucide marketing icon id (e.g. headset, wallet). */
  icon?: string
}

export type PageContentRecord = {
  slug: string
  label: string
  title: string
  description: string
  ogImage: string
  sections: PageSection[]
  updatedAt?: string
  fromDatabase: boolean
  /** Locale of the loaded row (may be fallback). */
  locale?: string
  /** True when a DB row exists for the requested locale (not just EN fallback). */
  hasLocaleRow?: boolean
}

function newId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function parseSections(value: unknown): PageSection[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const type = PAGE_SECTION_TYPES.includes(item.type as PageSectionType)
        ? (item.type as PageSectionType)
        : "text"
      return {
        id: typeof item.id === "string" && item.id ? item.id : newId(),
        type,
        key: typeof item.key === "string" ? item.key : "",
        heading: typeof item.heading === "string" ? item.heading : undefined,
        body: typeof item.body === "string" ? item.body : undefined,
        src: typeof item.src === "string" ? item.src : undefined,
        alt: typeof item.alt === "string" ? item.alt : undefined,
        question: typeof item.question === "string" ? item.question : undefined,
        answer: typeof item.answer === "string" ? item.answer : undefined,
        level:
          item.level === 1 || item.level === 2 || item.level === 3
            ? item.level
            : undefined,
        icon: typeof item.icon === "string" ? item.icon : undefined,
      } satisfies PageSection
    })
}

export function sectionValue(
  sections: PageSection[],
  key: string,
  field: keyof PageSection = "body",
): string {
  const found = sections.find((s) => s.key === key)
  if (!found) return ""
  const value = found[field]
  return typeof value === "string" ? value : ""
}

export function sectionHeading(sections: PageSection[], key: string): string {
  return sectionValue(sections, key, "heading")
}

export function faqSections(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => s.type === "faq_item")
}

function pickText(
  localized: string | undefined,
  fallback: string | undefined,
): string | undefined {
  const local = localized?.trim()
  if (local) return localized
  const base = fallback?.trim()
  if (base) return fallback
  return localized ?? fallback
}

/**
 * Merge a locale's sections onto English (or defaults). Empty translated
 * text/fields fall back to the English value so partial translations still
 * render a complete page.
 */
export function mergeLocalizedSections(
  localized: PageSection[],
  fallback: PageSection[],
): PageSection[] {
  if (localized.length === 0) return fallback
  if (fallback.length === 0) return localized

  const byKey = new Map(
    localized.filter((s) => s.key).map((s) => [s.key, s] as const),
  )
  const usedKeys = new Set<string>()

  const merged = fallback.map((base) => {
    const loc = base.key ? byKey.get(base.key) : undefined
    if (!loc) return { ...base }
    if (base.key) usedKeys.add(base.key)

    if (loc.type === "heading") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        heading: pickText(loc.heading, base.heading),
        level: loc.level ?? base.level,
      }
    }
    if (loc.type === "text") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        body: pickText(loc.body, base.body),
      }
    }
    if (loc.type === "image") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        src: pickText(loc.src, base.src),
        alt: pickText(loc.alt, base.alt),
      }
    }
    if (loc.type === "faq_item") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        question: pickText(loc.question, base.question),
        answer: pickText(loc.answer, base.answer),
      }
    }
    if (loc.type === "attraction") {
      return {
        ...base,
        ...loc,
        id: loc.id || base.id,
        heading: pickText(loc.heading, base.heading),
        body: pickText(loc.body, base.body),
        src: pickText(loc.src, base.src),
        alt: pickText(loc.alt, base.alt),
      }
    }
    return { ...base, ...loc, id: loc.id || base.id }
  })

  // Locale-only sections (new keys) that aren't in English yet.
  for (const loc of localized) {
    if (!loc.key || usedKeys.has(loc.key)) continue
    if (fallback.some((s) => s.key === loc.key)) continue
    merged.push({ ...loc })
  }

  return merged
}

export type DestinationAttraction = {
  id: string
  title: string
  description: string
  image: string
  imageAlt: string
}

export function attractionSections(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => s.type === "attraction")
}

export function attractionsFromSections(
  sections: PageSection[],
): DestinationAttraction[] {
  return attractionSections(sections)
    .map((section) => ({
      id: section.id,
      title: section.heading?.trim() || "",
      description: section.body?.trim() || "",
      image: section.src?.trim() || "",
      imageAlt: section.alt?.trim() || section.heading?.trim() || "Attraction",
    }))
    .filter((item) => item.title || item.description || item.image)
}

export type HomeCompareItem = {
  label: string
  detail: string
}

export type HomeCompareColumn = {
  title: string
  subtitle?: string
  badge?: string
  tone: "negative" | "positive"
  items: HomeCompareItem[]
}

export type HomeMarketingCopy = {
  hero: {
    heading: string
    text: string
    image: string
    imageAlt: string
  }
  uberAlt: {
    eyebrow: string
    heading: string
    highlight: string
    text: string
    cta: string
    image: string
    imageAlt: string
    features: { title: string; description: string }[]
    floatingBadge: {
      title: string
      text: string
    }
  }
  whyBook: {
    heading: string
    items: { title: string; description: string; icon: string }[]
  }
  destinations: {
    heading: string
    text: string
  }
  compare: {
    eyebrow: string
    heading: string
    subtitle: string
    columns: HomeCompareColumn[]
  }
  testimonials: {
    eyebrow: string
    heading: string
  }
  peace: {
    eyebrow: string
    heading: string
    items: { title: string; description: string; icon: string }[]
  }
  safety: {
    heading: string
    items: {
      title: string
      description: string
      image: string
      alt: string
    }[]
  }
  faq: PageSection[]
}

function parseCompareItems(body: string): HomeCompareItem[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":")
      if (idx <= 0) return { label: "", detail: line }
      return {
        label: line.slice(0, idx).trim(),
        detail: line.slice(idx + 1).trim(),
      }
    })
}

/**
 * Insert any default sections that are missing from a saved page, preserving
 * existing content and placing new keys after their preceding default neighbor.
 */
export function ensureMissingDefaultSections(
  sections: PageSection[],
  defaults: PageSection[],
): PageSection[] {
  if (defaults.length === 0) return sections
  const existingKeys = new Set(
    sections.map((section) => section.key).filter(Boolean),
  )
  const missing = defaults.filter(
    (section) => section.key && !existingKeys.has(section.key),
  )
  if (missing.length === 0) return sections

  const result = [...sections]
  for (const miss of missing) {
    const defIndex = defaults.findIndex((section) => section.key === miss.key)
    let insertAt = result.length
    for (let i = defIndex - 1; i >= 0; i--) {
      const prevKey = defaults[i]?.key
      if (!prevKey) continue
      const idx = result.findIndex((section) => section.key === prevKey)
      if (idx >= 0) {
        insertAt = idx + 1
        break
      }
    }
    result.splice(insertAt, 0, {
      ...miss,
      id: newId(),
    })
  }
  return result
}

export function homeCopyFromSections(sections: PageSection[]): HomeMarketingCopy {
  return {
    hero: {
      heading:
        sectionHeading(sections, "hero.heading") ||
        "Arrive. Discover.\nExperience.",
      text:
        sectionValue(sections, "hero.text") ||
        "Personalised airport transfers designed for travel across Albania.",
      image:
        sectionValue(sections, "hero.image", "src") ||
        "https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg",
      imageAlt: sectionValue(sections, "hero.image", "alt"),
    },
    uberAlt: {
      eyebrow:
        sectionValue(sections, "uberAlt.eyebrow") || "No Uber in Albania?",
      heading:
        sectionHeading(sections, "uberAlt.heading") ||
        "The Seamless Uber Alternative at Tirana Airport",
      highlight:
        sectionValue(sections, "uberAlt.highlight") || "Uber Alternative",
      text:
        sectionValue(sections, "uberAlt.text") ||
        "Looking for Uber, Bolt, or Lyft after landing at Tirana International Airport (TIA)? Global ride-hailing apps do not operate in Albania. Instead of negotiating with unmetered airport street taxis, exchanging currency at high terminal rates, or waiting in line, Landed Albania provides the modern booking experience you expect.",
      cta: sectionValue(sections, "uberAlt.cta") || "Calculate Your Fixed Fare",
      image:
        sectionValue(sections, "uberAlt.image", "src") ||
        "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1200&auto=format&fit=crop",
      imageAlt:
        sectionValue(sections, "uberAlt.image", "alt") ||
        "Landed Albania premium airport transfer",
      features: (() => {
        const items = [1, 2]
          .map((n) => ({
            title: sectionHeading(sections, `uberAlt.feature${n}.heading`),
            description: sectionValue(sections, `uberAlt.feature${n}.text`),
          }))
          .filter((item) => item.title || item.description)
        if (items.length > 0) return items
        return [
          {
            title: "Fixed Pricing",
            description: "Zero surge fees or surprises",
          },
          {
            title: "Flight Tracking",
            description: "Automated driver pickup adjustments",
          },
        ]
      })(),
      floatingBadge: {
        title:
          sectionHeading(sections, "uberAlt.floatingBadge.heading") ||
          "Under 2 Minutes",
        text:
          sectionValue(sections, "uberAlt.floatingBadge.text") ||
          "Quick & Easy Online Booking",
      },
    },
    whyBook: {
      heading:
        sectionHeading(sections, "whyBook.heading") || "Why book with us?",
      items: [1, 2, 3]
        .map((n) => ({
          title: sectionHeading(sections, `whyBook.item${n}.heading`),
          description: sectionValue(sections, `whyBook.item${n}.text`),
          icon: sectionValue(sections, `whyBook.item${n}.heading`, "icon"),
        }))
        .filter((item) => item.title || item.description),
    },
    destinations: {
      heading:
        sectionHeading(sections, "destinations.heading") ||
        "Featured Destinations",
      text: sectionValue(sections, "destinations.text"),
    },
    compare: {
      eyebrow:
        sectionValue(sections, "compare.eyebrow") ||
        "Why Landed vs. Competitors",
      heading:
        sectionHeading(sections, "compare.heading") ||
        "The Clear Choice for Tirana Airport Transfers",
      subtitle:
        sectionValue(sections, "compare.subtitle") ||
        "Compare Landed Albania directly against local airport street taxis and global booking brokers.",
      columns: [
        {
          title:
            sectionHeading(sections, "compare.taxi.title") ||
            "Airport Terminal Taxis",
          tone: "negative" as const,
          items: parseCompareItems(
            sectionValue(sections, "compare.taxi.items") ||
              "Pricing: Metered or Negotiated Cash\nPayment: Cash Only (Euros/LEK)\nDrivers: Hit-or-Miss English\nTracking: None (Taxi leaves if delayed)\nMeet & Greet: Wait outside in crowded rank\nFocus: General Local Rides",
          ),
        },
        {
          title:
            sectionHeading(sections, "compare.landed.title") ||
            "Landed Albania",
          badge:
            sectionValue(sections, "compare.landed.badge") || "Best Experience",
          tone: "positive" as const,
          items: parseCompareItems(
            sectionValue(sections, "compare.landed.items") ||
              "Pricing: Fixed Flat Rate (Upfront)\nPayment: Yes (Deposit + Online Balance)\nDrivers: 100% Vetted English Drivers\nTracking: Included Free (Delays Covered)\nMeet & Greet: Driver holds name sign\nFocus: 100% Tirana Airport Specialist",
          ),
        },
        {
          title:
            sectionHeading(sections, "compare.broker.title") ||
            "Global Aggregators",
          subtitle:
            sectionValue(sections, "compare.broker.subtitle") ||
            "(e.g., GetTransfer)",
          tone: "negative" as const,
          items: parseCompareItems(
            sectionValue(sections, "compare.broker.items") ||
              "Pricing: Variable Bidding / Hidden Fees\nPayment: Card (High Commission)\nDrivers: Unverified Third-Party Fleet\nTracking: Extra Charges for Updates\nMeet & Greet: Dependent on driver choice\nFocus: Non-local Broker",
          ),
        },
      ],
    },
    testimonials: {
      eyebrow:
        sectionValue(sections, "testimonials.eyebrow") || "Traveller stories",
      heading:
        sectionHeading(sections, "testimonials.heading") ||
        "Trusted by travellers across Albania",
    },
    peace: {
      eyebrow:
        sectionValue(sections, "peace.eyebrow") || "Absolute Peace of Mind",
      heading:
        sectionHeading(sections, "peace.heading") ||
        "Why Book with Albania Transfers",
      items: (() => {
        const defaults = [
          {
            title: "Pay Cash on Arrival",
            description:
              "Zero upfront deposit. Pay in Euros (€) or Lek (ALL).",
            icon: "dollar",
          },
          {
            title: "100% Vetted Drivers",
            description: "Licensed, background-checked professionals.",
            icon: "shield",
          },
          {
            title: "Fixed Rates",
            description: "No meters, surge, or cash exchange markup.",
            icon: "wallet",
          },
          {
            title: "Live Flight Tracking",
            description:
              "Free pickup updates for delayed or early flights.",
            icon: "plane",
          },
          {
            title: "Terminal Meet-&-Greet",
            description: "Driver holds name sign inside arrivals hall.",
            icon: "user",
          },
          {
            title: "Know Your Driver",
            description: "See car model, name, & plate number.",
            icon: "map",
          },
        ]
        const legacyTitles = new Set([
          "Meet-and-Greet",
          "Flight Tracking",
          "Easy Booking",
          "Reliable Chauffeurs",
          "Fixed Prices",
          "Clear Cancellation Terms",
        ])
        return [1, 2, 3, 4, 5, 6]
          .map((n) => {
            const storedTitle = sectionHeading(sections, `peace.item${n}`)
            const description = sectionValue(sections, `peace.item${n}.text`)
            const icon = sectionValue(sections, `peace.item${n}`, "icon")
            const fallback = defaults[n - 1]!
            const title =
              !storedTitle || legacyTitles.has(storedTitle)
                ? fallback.title
                : storedTitle
            return {
              title,
              description: description || fallback.description,
              icon: icon || fallback.icon,
            }
          })
          .filter((item) => item.title || item.description)
      })(),
    },
    safety: {
      heading:
        sectionHeading(sections, "safety.heading") ||
        "Safety is our #1 priority",
      items: [1, 2]
        .map((n) => ({
          title: sectionHeading(sections, `safety.item${n}.heading`),
          description: sectionValue(sections, `safety.item${n}.text`),
          image: sectionValue(sections, `safety.item${n}.image`, "src"),
          alt: sectionValue(sections, `safety.item${n}.image`, "alt"),
        }))
        .filter((item) => item.title || item.description || item.image),
    },
    faq: faqSections(sections),
  }
}
