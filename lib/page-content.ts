import { prisma } from "@/lib/db"
import { DESTINATIONS, type Destination } from "@/lib/destinations"
import {
  isUploadHashLabel,
  resolveMediaAlt,
} from "@/lib/media-shared"
import { mediaMetaByUrls } from "@/lib/media"
import {
  type HomeMarketingCopy,
  type PageContentRecord,
  type PageSection,
  type PageSectionType,
  homeCopyFromSections,
  parseSections,
  sectionHeading,
  sectionValue,
} from "@/lib/page-content-shared"

export {
  PAGE_SECTION_TYPES,
  type PageSectionType,
  type PageSection,
  type PageContentRecord,
  type HomeMarketingCopy,
  parseSections,
  sectionValue,
  sectionHeading,
  faqSections,
  homeCopyFromSections,
} from "@/lib/page-content-shared"

export type PageDefinition = {
  slug: string
  label: string
  path: string
  defaults: Omit<
    PageContentRecord,
    "slug" | "label" | "fromDatabase" | "updatedAt"
  >
}

function newId() {
  return globalThis.crypto.randomUUID()
}

function section(
  type: PageSectionType,
  key: string,
  fields: Partial<Omit<PageSection, "id" | "type" | "key">> = {},
): PageSection {
  return { id: newId(), type, key, ...fields }
}

const HOME_DEFAULTS: PageDefinition["defaults"] = {
  title: "Albania Transfers · Airport transfers",
  description:
    "Book reliable airport transfers across Albania. Fixed prices, vetted drivers, clear cancellation terms.",
  ogImage: "",
  sections: [
    section("heading", "hero.heading", {
      heading: "Arrive. Discover.\nExperience.",
      level: 1,
    }),
    section("text", "hero.text", {
      body: "Personalised airport transfers designed for travel across Albania.",
    }),
    section("image", "hero.image", {
      src: "https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg",
    }),
    section("heading", "whyBook.heading", {
      heading: "Why book with us?",
      level: 2,
    }),
    section("heading", "whyBook.item1.heading", {
      heading: "24/7 Help Center",
      level: 3,
      icon: "headset",
    }),
    section("text", "whyBook.item1.text", {
      body: "No matter the time zone, we're always here to assist you and answer your questions.",
    }),
    section("heading", "whyBook.item2.heading", {
      heading: "Best Price Guarantee",
      level: 3,
      icon: "wallet",
    }),
    section("text", "whyBook.item2.text", {
      body: "Find a lower price? We'll match it or refund the difference, hassle-free.",
    }),
    section("heading", "whyBook.item3.heading", {
      heading: "Quality & Reliability",
      level: 3,
      icon: "shield",
    }),
    section("text", "whyBook.item3.text", {
      body: "Book with confidence knowing our services meet the highest standards of safety and trust.",
    }),
    section("heading", "destinations.heading", {
      heading: "Featured Destinations",
      level: 2,
    }),
    section("text", "destinations.text", {
      body: "Discover our most popular hand-picked locations for your next unforgettable journey.",
    }),
    section("heading", "testimonials.heading", {
      heading: "Trusted by travellers across Albania",
      level: 2,
    }),
    section("text", "testimonials.eyebrow", {
      body: "Traveller stories",
    }),
    section("text", "peace.eyebrow", {
      body: "Absolute Peace of Mind",
    }),
    section("heading", "peace.heading", {
      heading: "Why Book with Albania Transfers",
      level: 2,
    }),
    section("heading", "peace.item1", { heading: "Meet-and-Greet", level: 3 }),
    section("heading", "peace.item2", { heading: "Flight Tracking", level: 3 }),
    section("heading", "peace.item3", { heading: "Easy Booking", level: 3 }),
    section("heading", "peace.item4", {
      heading: "Reliable Chauffeurs",
      level: 3,
    }),
    section("heading", "peace.item5", { heading: "Fixed Prices", level: 3 }),
    section("heading", "peace.item6", {
      heading: "Clear Cancellation Terms",
      level: 3,
    }),
    section("heading", "safety.heading", {
      heading: "Safety is our #1 priority",
      level: 2,
    }),
    section("heading", "safety.item1.heading", {
      heading: "1000s of experienced drivers",
      level: 3,
    }),
    section("text", "safety.item1.text", {
      body: "With thousands of drivers in one app, you can book a transfer wherever you are, even in times of high demand.",
    }),
    section("image", "safety.item1.image", {
      src: "/marketing/safety-drivers.png",
      alt: "Using the booking app to find nearby drivers",
    }),
    section("heading", "safety.item2.heading", {
      heading: "Know your driver",
      level: 3,
    }),
    section("text", "safety.item2.text", {
      body: "When you hop on an Albania Transfers ride, you'll know your driver's details, rating, and driving experience to make sure you're in safe hands.",
    }),
    section("image", "safety.item2.image", {
      src: "/marketing/safety-know-driver.png",
      alt: "Friendly professional driver ready for pickup",
    }),
    section("faq_item", "faq.1", {
      question: "How far in advance should I book?",
      answer:
        "We recommend booking as soon as your flight is confirmed. Same-day transfers are often available subject to driver capacity.",
    }),
    section("faq_item", "faq.2", {
      question: "What is included in the price?",
      answer:
        "Your fare is fixed and includes meet-and-greet, flight tracking, and door-to-door transfer. Tolls and child seats may be added where selected.",
    }),
  ],
}

const CANCELLATION_DEFAULTS: PageDefinition["defaults"] = {
  title: "Cancellation Policy",
  description:
    "Customer cancellations forfeit the deposit. No free-cancellation window. Full refund only if the driver fails to show or the service is not delivered.",
  ogImage: "",
  sections: [
    section("text", "eyebrow", { body: "Booking terms" }),
    section("heading", "title", {
      heading: "Cancellation Policy",
      level: 1,
    }),
    section("text", "intro", {
      body: "Clear rules so you know exactly what happens if a booking is cancelled.",
    }),
    section("heading", "customer.heading", {
      heading: "Customer cancellations",
      level: 2,
    }),
    section("text", "customer.text", {
      body: "There is no free-cancellation window. If you cancel a booking for any reason:\n• The deposit paid (typically 30% of the trip total) is forfeited — no refund is issued.\n• The remaining balance (typically 70%) is never charged.\n• Cancellation cannot be undone once confirmed.",
    }),
    section("heading", "refund.heading", {
      heading: "When a full refund applies",
      level: 2,
    }),
    section("text", "refund.text", {
      body: "If the driver fails to show or the service is not delivered, that is not treated as a customer-initiated cancellation. In those cases you are entitled to a full refund of amounts paid. Contact support with your booking reference and we will resolve it.",
    }),
    section("heading", "how.heading", {
      heading: "How to cancel",
      level: 2,
    }),
    section("text", "how.text", {
      body: "Use My booking with your reference code and email, or contact support. Online cancellation is available until the driver has arrived.",
    }),
    section("faq_item", "faq.1", {
      question: "Do I get my deposit back if I cancel?",
      answer:
        "No. Customer-initiated cancellations forfeit the deposit. The remaining balance is never charged.",
    }),
  ],
}

function destinationDefaults(slug: string): PageDefinition | null {
  const dest = DESTINATIONS.find((d) => d.id === slug)
  if (!dest) return null
  return {
    slug: `destinations/${dest.id}`,
    label: `Destination · ${dest.name}`,
    path: `/destinations/${dest.id}`,
    defaults: {
      title: `${dest.name} airport transfer`,
      description: dest.description,
      ogImage: dest.image,
      sections: [
        section("heading", "title", { heading: dest.name, level: 1 }),
        section("text", "region", { body: dest.region }),
        section("text", "description", { body: dest.description }),
        section("image", "hero", { src: dest.image, alt: dest.name }),
        section("text", "badge", { body: dest.badge }),
        section("text", "priceFrom", { body: dest.priceFrom }),
        section("heading", "more.heading", {
          heading: "More destinations",
          level: 2,
        }),
      ],
    },
  }
}

export const PAGE_DEFINITIONS: PageDefinition[] = [
  {
    slug: "home",
    label: "Homepage",
    path: "/",
    defaults: HOME_DEFAULTS,
  },
  {
    slug: "cancellation-policy",
    label: "Cancellation Policy",
    path: "/cancellation-policy",
    defaults: CANCELLATION_DEFAULTS,
  },
  ...DESTINATIONS.map((d) => destinationDefaults(d.id)!),
]

export function getPageDefinition(slug: string): PageDefinition | undefined {
  return PAGE_DEFINITIONS.find((p) => p.slug === slug)
}

export function serializePageContent(row: {
  slug: string
  label: string
  title: string
  description: string
  ogImage: string
  sections: unknown
  updatedAt: Date
}): PageContentRecord {
  return {
    slug: row.slug,
    label: row.label,
    title: row.title,
    description: row.description,
    ogImage: row.ogImage,
    sections: parseSections(row.sections),
    updatedAt: row.updatedAt.toISOString(),
    fromDatabase: true,
  }
}

/** Resolved page content: DB row merged over defaults when present. */
export async function resolvePageContent(
  slug: string,
): Promise<PageContentRecord | null> {
  const def = getPageDefinition(slug)
  if (!def) return null

  const row = await prisma.pageContent.findUnique({ where: { slug } })
  if (!row) {
    return {
      slug: def.slug,
      label: def.label,
      title: def.defaults.title,
      description: def.defaults.description,
      ogImage: def.defaults.ogImage,
      sections: def.defaults.sections,
      fromDatabase: false,
    }
  }

  const parsed = parseSections(row.sections)
  const sections = parsed.length > 0 ? parsed : def.defaults.sections
  const ogImage = slug.startsWith("destinations/")
    ? destinationCardImage(sections, row.ogImage, def.defaults.ogImage)
    : row.ogImage || def.defaults.ogImage
  return {
    slug: row.slug,
    label: row.label || def.label,
    title: row.title || def.defaults.title,
    description: row.description || def.defaults.description,
    ogImage,
    sections,
    updatedAt: row.updatedAt.toISOString(),
    fromDatabase: true,
  }
}

export async function listAdminPages() {
  const rows = await prisma.pageContent.findMany({
    select: {
      slug: true,
      label: true,
      title: true,
      updatedAt: true,
    },
  })
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  return PAGE_DEFINITIONS.map((def) => {
    const row = bySlug.get(def.slug)
    return {
      slug: def.slug,
      label: row?.label || def.label,
      path: def.path,
      title: row?.title || def.defaults.title,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      fromDatabase: Boolean(row),
    }
  })
}

export function pageMetadataFields(page: PageContentRecord) {
  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      ...(page.ogImage ? { images: [{ url: page.ogImage }] } : {}),
    },
  }
}

function destinationCardImage(
  sections: PageSection[],
  ogImage: string,
  fallback: string,
) {
  const hero = sectionValue(sections, "hero", "src")
  const anyImage =
    sections.find((s) => s.type === "image" && s.src)?.src ?? ""
  const candidates = [hero, ogImage, anyImage, fallback].filter(Boolean)
  // Prefer a local upload over stock Unsplash defaults.
  const uploaded = candidates.find((url) => url.startsWith("/uploads/"))
  if (uploaded) return uploaded
  return hero || ogImage || anyImage || fallback
}

/** Destination cards for the homepage carousel (CMS with code fallbacks). */
export async function resolveDestinationCards(): Promise<Destination[]> {
  const cards = await Promise.all(
    DESTINATIONS.map(async (dest) => {
      const page = await resolvePageContent(`destinations/${dest.id}`)
      const sections = page?.sections ?? []
      return {
        ...dest,
        name: sectionHeading(sections, "title") || dest.name,
        region: sectionValue(sections, "region") || dest.region,
        description:
          sectionValue(sections, "description") || dest.description,
        badge: sectionValue(sections, "badge") || dest.badge,
        priceFrom: sectionValue(sections, "priceFrom") || dest.priceFrom,
        image: destinationCardImage(
          sections,
          page?.ogImage ?? "",
          dest.image,
        ),
        imageAlt: "",
      }
    }),
  )

  const byUrl = await mediaMetaByUrls(cards.map((card) => card.image))
  return cards.map((card) => {
    const meta = byUrl.get(card.image)
    return {
      ...card,
      imageAlt: resolveMediaAlt(meta, card.name),
    }
  })
}

/**
 * Homepage copy with media-library title / description / alt applied.
 * Non-empty Media fields win so library edits show on the site;
 * page section values remain the fallback.
 */
export async function resolveHomeMarketingCopy(
  sections: PageSection[],
): Promise<HomeMarketingCopy> {
  const copy = homeCopyFromSections(sections)
  const urls = [
    copy.hero.image,
    ...copy.safety.items.map((item) => item.image),
  ]
  const byUrl = await mediaMetaByUrls(urls)

  const heroMeta = byUrl.get(copy.hero.image)
  const heroTitle = heroMeta?.title?.trim()
  copy.hero.imageAlt =
    (heroMeta?.alt?.trim() && !isUploadHashLabel(heroMeta.alt)
      ? heroMeta.alt.trim()
      : "") ||
    copy.hero.imageAlt.trim() ||
    (heroTitle && !isUploadHashLabel(heroTitle) ? heroTitle : "") ||
    ""

  copy.safety.items = copy.safety.items.map((item) => {
    const meta = byUrl.get(item.image)
    const mediaTitle =
      meta?.title?.trim() && !isUploadHashLabel(meta.title)
        ? meta.title.trim()
        : ""
    const title = mediaTitle || item.title.trim()
    const description =
      meta?.description?.trim() || item.description.trim()
    return {
      ...item,
      title,
      description,
      alt: resolveMediaAlt(meta, title || item.alt.trim()),
    }
  })

  return copy
}
