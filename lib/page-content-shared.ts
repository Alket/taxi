export const PAGE_SECTION_TYPES = [
  "heading",
  "text",
  "image",
  "faq_item",
] as const

export type PageSectionType = (typeof PAGE_SECTION_TYPES)[number]

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

export type HomeMarketingCopy = {
  hero: {
    heading: string
    text: string
    image: string
    imageAlt: string
  }
  whyBook: {
    heading: string
    items: { title: string; description: string; icon: string }[]
  }
  destinations: {
    heading: string
    text: string
  }
  testimonials: {
    eyebrow: string
    heading: string
  }
  peace: {
    eyebrow: string
    heading: string
    items: string[]
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
      items: [1, 2, 3, 4, 5, 6]
        .map((n) => sectionHeading(sections, `peace.item${n}`))
        .filter(Boolean),
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
