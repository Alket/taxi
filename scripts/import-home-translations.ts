/**
 * Import homepage marketing copy from landed-albania-translations.md
 * into PageContent (slug=home) for all locales.
 *
 * Usage:
 *   npx tsx scripts/import-home-translations.ts [path-to-md]
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const LOCALES = ["en", "it", "de", "pl", "tr", "uk", "ru"] as const
type Locale = (typeof LOCALES)[number]

const LOCALE_FROM_HEADING: Record<string, Locale> = {
  english: "en",
  italiano: "it",
  deutsch: "de",
  polski: "pl",
  türkçe: "tr",
  turkce: "tr",
  українська: "uk",
  русский: "ru",
}

/** Destinations section heading (not present in the MD pack). */
const DESTINATIONS_HEADING: Record<Locale, string> = {
  en: "Featured Destinations",
  it: "Destinazioni in evidenza",
  de: "Empfohlene Ziele",
  pl: "Polecane destynacje",
  tr: "Öne çıkan destinasyonlar",
  uk: "Популярні напрямки",
  ru: "Популярные направления",
}

const WHY_ICONS = ["headset", "wallet", "shield"] as const

type Faq = { question: string; answer: string }

type ParsedHome = {
  title: string
  description: string
  heroHeading: string
  heroText: string
  heroImageAlt: string
  whyHeading: string
  whyItems: { title: string; body: string }[]
  destinationsText: string
  testimonialsHeading: string
  testimonialsEyebrow: string
  peaceEyebrow: string
  peaceHeading: string
  peaceItems: string[]
  safetyHeading: string
  safetyLead: string
  safetyItems: { title: string; body: string; alt: string }[]
  faqs: Faq[]
}

function stripBold(s: string) {
  return s.replace(/^\*\*(.+)\*\*$/, "$1").trim()
}

function isBoldLine(s: string) {
  return /^\*\*.+\*\*$/.test(s.trim())
}

function isItalicLine(s: string) {
  return /^\*[^*].*\*$/.test(s.trim())
}

function stripItalic(s: string) {
  return s.replace(/^\*(.+)\*$/, "$1").trim()
}

function normalizeHeroHeading(heading: string) {
  // Prefer line break before the last sentence for the homepage layout.
  const parts = heading
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 3) {
    return `${parts[0]}. ${parts[1]}.\n${parts[2]}.`
  }
  return heading
}

function splitLocaleBlocks(md: string): { locale: Locale; body: string }[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const blocks: { locale: Locale; body: string }[] = []
  let current: Locale | null = null
  let buf: string[] = []

  const flush = () => {
    if (current) {
      blocks.push({ locale: current, body: buf.join("\n").trim() })
    }
    buf = []
  }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush()
      const heading = line
        .replace(/^##\s+/, "")
        .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
        .trim()
        .toLowerCase()
      const locale = LOCALE_FROM_HEADING[heading]
      if (!locale) {
        throw new Error(`Unknown locale heading: ${line}`)
      }
      current = locale
      continue
    }
    if (current) buf.push(line)
  }
  flush()
  return blocks
}

function parseLocaleBody(body: string, locale: Locale): ParsedHome {
  // Cut FAQ section (### …)
  const faqSplit = body.search(/\n###\s+/)
  const main = faqSplit >= 0 ? body.slice(0, faqSplit).trim() : body.trim()
  const faqPart = faqSplit >= 0 ? body.slice(faqSplit).replace(/^\n###[^\n]*\n*/, "").trim() : ""

  const lines = main.split("\n")
  const nonEmptyIdx = lines
    .map((l, i) => [l.trim(), i] as const)
    .filter(([l]) => l.length > 0)

  let i = 0
  const next = () => nonEmptyIdx[i++]?.[0] ?? ""
  const peek = () => nonEmptyIdx[i]?.[0] ?? ""

  const title = stripBold(next())
  const description = next()
  const heroHeading = normalizeHeroHeading(stripBold(next()))
  const heroText = next()
  let heroImageAlt = ""
  if (isItalicLine(peek())) heroImageAlt = stripItalic(next())

  const whyHeading = stripBold(next())
  const whyItems: { title: string; body: string }[] = []
  for (let n = 0; n < 3; n++) {
    const t = stripBold(next())
    const b = next()
    whyItems.push({ title: t, body: b })
  }

  const destinationsText = next()
  const testimonialsHeading = stripBold(next())
  const testimonialsEyebrow = next()
  const peaceEyebrow = stripBold(next())
  const peaceHeading = stripBold(next())

  const peaceItems: string[] = []
  while (peek().startsWith("- ")) {
    peaceItems.push(next().replace(/^- /, "").trim())
  }

  const safetyHeading = stripBold(next())
  let safetyLead = ""
  // Optional lead line before first safety card title
  if (!isBoldLine(peek()) && peek() && !isItalicLine(peek())) {
    safetyLead = next()
  }

  const safetyItems: { title: string; body: string; alt: string }[] = []
  while (i < nonEmptyIdx.length && isBoldLine(peek())) {
    const t = stripBold(next())
    const b = next()
    let alt = ""
    if (isItalicLine(peek())) alt = stripItalic(next())
    safetyItems.push({ title: t, body: b, alt })
  }

  // FAQs: **question** then answer paragraph(s) until next ** or end
  const faqs: Faq[] = []
  if (faqPart) {
    const faqLines = faqPart.split("\n")
    let q: string | null = null
    let a: string[] = []
    const pushFaq = () => {
      if (q) {
        faqs.push({ question: q, answer: a.join(" ").replace(/\s+/g, " ").trim() })
      }
      q = null
      a = []
    }
    for (const raw of faqLines) {
      const line = raw.trim()
      if (!line || line === "---") continue
      if (isBoldLine(line)) {
        pushFaq()
        q = stripBold(line)
        continue
      }
      if (q) a.push(line)
    }
    pushFaq()
  }

  if (whyItems.length !== 3) {
    throw new Error(`[${locale}] expected 3 whyBook items, got ${whyItems.length}`)
  }
  if (peaceItems.length < 6) {
    throw new Error(`[${locale}] expected 6 peace items, got ${peaceItems.length}`)
  }
  if (safetyItems.length < 2) {
    throw new Error(`[${locale}] expected 2 safety items, got ${safetyItems.length}`)
  }
  if (faqs.length < 5) {
    throw new Error(`[${locale}] expected FAQs, got ${faqs.length}`)
  }

  // If MD has a short lead + "Vetted Drivers" as item1, keep both cards as written.
  // Prefer lead as item1 title only when we somehow got one card — already handled.

  return {
    title,
    description,
    heroHeading,
    heroText,
    heroImageAlt,
    whyHeading,
    whyItems,
    destinationsText,
    testimonialsHeading,
    testimonialsEyebrow,
    peaceEyebrow,
    peaceHeading,
    peaceItems: peaceItems.slice(0, 6),
    safetyHeading,
    safetyLead,
    safetyItems: safetyItems.slice(0, 2),
    faqs,
  }
}

type Section = {
  id: string
  type: string
  key: string
  heading?: string
  body?: string
  src?: string
  alt?: string
  question?: string
  answer?: string
  level?: 1 | 2 | 3
  icon?: string
}

function section(
  type: string,
  key: string,
  fields: Partial<Omit<Section, "id" | "type" | "key">> = {},
): Section {
  return { id: randomUUID(), type, key, ...fields }
}

function buildSections(
  parsed: ParsedHome,
  locale: Locale,
  imageSrc: { hero: string; safety1: string; safety2: string },
): Section[] {
  // Map safety: MD has lead "Hundreds…" then Vetted + Know your driver.
  // UI has 2 cards — use Vetted / Know your driver; fold lead into item1 title if useful.
  const s1 = parsed.safetyItems[0]!
  const s2 = parsed.safetyItems[1]!
  const item1Title = s1.title
  const item1Body = parsed.safetyLead
    ? `${parsed.safetyLead}\n\n${s1.body}`
    : s1.body

  const sections: Section[] = [
    section("heading", "hero.heading", {
      heading: parsed.heroHeading,
      level: 1,
    }),
    section("text", "hero.text", { body: parsed.heroText }),
    section("image", "hero.image", {
      src: imageSrc.hero,
      alt: parsed.heroImageAlt,
    }),
    section("heading", "whyBook.heading", {
      heading: parsed.whyHeading,
      level: 2,
    }),
    ...parsed.whyItems.flatMap((item, idx) => [
      section("heading", `whyBook.item${idx + 1}.heading`, {
        heading: item.title,
        level: 3,
        icon: WHY_ICONS[idx],
      }),
      section("text", `whyBook.item${idx + 1}.text`, { body: item.body }),
    ]),
    section("heading", "destinations.heading", {
      heading: DESTINATIONS_HEADING[locale],
      level: 2,
    }),
    section("text", "destinations.text", { body: parsed.destinationsText }),
    section("heading", "testimonials.heading", {
      heading: parsed.testimonialsHeading,
      level: 2,
    }),
    section("text", "testimonials.eyebrow", {
      body: parsed.testimonialsEyebrow,
    }),
    section("text", "peace.eyebrow", { body: parsed.peaceEyebrow }),
    section("heading", "peace.heading", {
      heading: parsed.peaceHeading,
      level: 2,
    }),
    ...parsed.peaceItems.map((heading, idx) =>
      section("heading", `peace.item${idx + 1}`, { heading, level: 3 }),
    ),
    section("heading", "safety.heading", {
      heading: parsed.safetyHeading,
      level: 2,
    }),
    section("heading", "safety.item1.heading", {
      heading: item1Title,
      level: 3,
    }),
    section("text", "safety.item1.text", { body: item1Body }),
    section("image", "safety.item1.image", {
      src: imageSrc.safety1,
      alt: s1.alt,
    }),
    section("heading", "safety.item2.heading", {
      heading: s2.title,
      level: 3,
    }),
    section("text", "safety.item2.text", { body: s2.body }),
    section("image", "safety.item2.image", {
      src: imageSrc.safety2,
      alt: s2.alt,
    }),
    ...parsed.faqs.map((faq, idx) =>
      section("faq_item", `faq.${idx + 1}`, {
        question: faq.question,
        answer: faq.answer,
      }),
    ),
  ]

  return sections
}

async function loadExistingImageSrcs() {
  const row = await prisma.pageContent.findUnique({
    where: { slug_locale: { slug: "home", locale: "en" } },
  })
  const sections = Array.isArray(row?.sections) ? (row!.sections as Section[]) : []
  const byKey = new Map(sections.map((s) => [s.key, s]))
  return {
    hero:
      byKey.get("hero.image")?.src ||
      "https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg",
    safety1: byKey.get("safety.item1.image")?.src || "/marketing/safety-drivers.png",
    safety2:
      byKey.get("safety.item2.image")?.src || "/marketing/safety-know-driver.png",
  }
}

async function main() {
  const mdPath = resolve(
    process.argv[2] ||
      "/var/www/taxi/backups/landed-albania-translations.md",
  )
  const md = readFileSync(mdPath, "utf8")
  const blocks = splitLocaleBlocks(md)
  const images = await loadExistingImageSrcs()

  console.log(`Parsed ${blocks.length} locale blocks from ${mdPath}`)
  console.log(`Preserving images:`, images)

  for (const { locale, body } of blocks) {
    const parsed = parseLocaleBody(body, locale)
    const sections = buildSections(parsed, locale, images)
    await prisma.pageContent.upsert({
      where: { slug_locale: { slug: "home", locale } },
      create: {
        slug: "home",
        locale,
        label: "Homepage",
        title: parsed.title,
        description: parsed.description,
        ogImage: "",
        sections,
      },
      update: {
        label: "Homepage",
        title: parsed.title,
        description: parsed.description,
        sections,
      },
    })
    console.log(
      `Upserted home/${locale}: title="${parsed.title.slice(0, 48)}…" faqs=${parsed.faqs.length} sections=${sections.length}`,
    )
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
