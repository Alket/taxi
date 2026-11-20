# Landed Albania (`https://landedalbania.com/`) — Technical SEO & Core Web Vitals Action Plan

This document contains every technical SEO, multilingual (`hreflang`/canonical), metadata, structured data, crawl/indexing, and Core Web Vitals task identified in the codebase review, ordered by priority (**P0 → P3**).

---

## Master Task Checklist

### Priority 0 — Critical Crawl, Indexing & LCP Blockers
- [x] **Task 1 (P0):** Forward `x-locale` on request headers in `middleware.ts` so stateless crawlers (Googlebot) and first-time visitors receive localized SSR metadata, canonicals, and content instead of English.
- [x] **Task 2 (P0):** Preserve the requested `locale` on code-default CMS pages in `lib/page-content.ts` so localized pages (`/it/terms`, `/de/privacy-policy`, etc.) do not emit English canonical tags.
- [x] **Task 3 (P0):** Prevent transient database errors from flipping the live site to `noindex` / `Disallow: /` / empty sitemap in `app/layout.tsx`, `app/robots.ts`, and `app/sitemap.ts`.
- [x] **Task 4 (P0):** Remove the SSR full-screen blocking `MarketingPreloader` and remove `opacity: 0` initial animations from the Hero LCP image and page wrapper (`components/marketing/marketing-preloader.tsx`, `components/marketing/home-landing.tsx`, `app/globals.css`).

### Priority 1 — High-Impact On-Page & International SEO (`EN, IT, DE, PL, TR, UK, RU`)
- [x] **Task 5 (P1):** Respect Admin CMS SEO Title, Meta Description, and Hero `H1` overrides on Destination (`/destinations/[slug]`) and Transfer (`/transfers/[slug]`) pages instead of unconditionally overriding them with hardcoded templates.
- [x] **Task 6 (P1):** Stop publishing 7-language `hreflang` clusters and self-referential localized canonicals on untranslated pages (`/blog/[slug]`, `/transfers/[slug]`, legal pages) by using `englishOnlyAlternates()` when `hasLocaleRow` is `false`.
- [x] **Task 7 (P1):** Stop listing untranslated locale URLs in `app/sitemap.ts` and replace dynamic `new Date()` `<lastmod>` timestamps with real content modification dates.
- [x] **Task 8 (P1):** Replace the competitor-hosted `DEFAULT_OG_IMAGE` (`welcomepickups.com`) with a first-party image, fix the root fallback brand/description in `app/layout.tsx`, and add `generateMetadata()` / `openGraph.locale` across public routes (`/book`, `/blog`, etc.).

### Priority 2 — Structured Data (JSON-LD), Semantic Headings & Crawl Hygiene
- [x] **Task 9 (P2):** Add missing `FAQPage` and `Service` (`Offer`) JSON-LD to Destination pages (`app/(booking)/destinations/[slug]/page.tsx`).
- [x] **Task 10 (P2):** Convert relative image paths (`/uploads/...`) to absolute URLs in `LocalBusiness` and `TouristDestination` JSON-LD (`lib/structured-data.ts`), fix the homepage `LocalBusiness` fallback name, and localize `"Home"` / `"Blog"` breadcrumb labels on `/blog` and `/blog/[slug]`.
- [x] **Task 11 (P2):** Fix heading hierarchy: replace the homepage `sr-only` `<h1>` + duplicate `<p aria-hidden>` hero blocks with a single visible `<h1>` (`components/marketing/home-landing.tsx`), and wrap FAQ question buttons in `<h3>` inside `components/marketing/blog/blog-faq.tsx`.
- [x] **Task 12 (P2):** Add `robots: { index: false, follow: false }` metadata to transactional and staff routes (`/book/confirmation/[referenceCode]`, `/book/continue/[referenceCode]`, `/review`, `/admin`, `/driver`) and add corresponding `Disallow` rules in `app/robots.ts`.

### Priority 3 — Core Web Vitals, TTFB, Font Subsets & Security Hygiene
- [x] **Task 13 (P3):** Add `"latin-ext"` and `"cyrillic"` Google Font subsets in `app/layout.tsx` for Polish, Turkish, Albanian, Ukrainian, and Russian glyph rendering without fallback CLS.
- [x] **Task 14 (P3):** Wrap server data loaders (`resolvePageContent`, `resolveDestinationCards`, `resolveDestinationPage`, `getRouteData`, `getBlogPostFromCms`) in React `cache()` to eliminate 2×–3× duplicate Prisma queries per request.
- [x] **Task 15 (P3):** Remove `priority` (`fetchPriority="high"`) from below-the-fold `DestinationCard` images and preloader logos, and replace raw `<img>` tags on legal pages and attraction cards with `next/image`.
- [ ] **Task 16 (P3):** Server-render initial customer reviews / testimonials (or reserve layout height) to eliminate client-side `useSWR` layout shift and expose review copy to search engine crawlers, and scope Trustpilot `<head>` scripts away from `/admin` and `/driver`.
- [ ] **Task 17 (P3):** Rotate and remove plaintext credentials/secrets from `.env` and ensure production secrets (`JWT_SECRET`, `CRON_SECRET`, `SMTP_PASS`, `DATABASE_URL`, `VAPID_PRIVATE_KEY`) are managed exclusively via environment secret injection.

---

## Task 1 (P0): Forward `x-locale` on Request Headers in `middleware.ts`

### Files Affected
- `middleware.ts` (lines 24–79)
- `lib/i18n/get-locale.ts` (lines 12–21)

### What Is Wrong
In `middleware.ts`, `withLocaleHeaders(response, locale)` calls `response.headers.set("x-locale", locale)` and `response.cookies.set("NEXT_LOCALE", locale)` on `NextResponse.rewrite(url)` and `NextResponse.next()`.

In Next.js App Router, setting a header on `response.headers` only attaches an **outgoing HTTP response header** to the client—it does **not** inject the header into the upstream request read by `await headers()` inside `generateMetadata()` and Server Components unless `{ request: { headers } }` is passed to `NextResponse.rewrite(url, { request: { headers } })` / `NextResponse.next({ request: { headers } })`.

- **Impact on Googlebot & stateless crawlers:** Crawlers do not click the client-side language switcher or pre-seed `NEXT_LOCALE` cookies. When Googlebot requests `/it`, `/de`, `/pl`, `/tr`, `/uk`, `/ru` (or `/it/destinations/sarande`, `/de/transfers/...`), `(await headers()).get("x-locale")` is `null` and `(await cookies()).get("NEXT_LOCALE")` is `undefined`. `getRequestLocale()` falls back to `"en"`, rendering `<html lang="en">`, **English `<title>` and `<meta name="description">`**, **English `<link rel="canonical">` pointing to the unprefixed English URL**, and **English SSR body copy** on every non-English URL.
- **Impact on browser users:** When a user visits `/it` (which sets the `NEXT_LOCALE=it` cookie) and then navigates to an unprefixed English URL (`/`), `headers().get("x-locale")` is `null`, so `getRequestLocale()` reads the stale `NEXT_LOCALE=it` cookie and renders Italian metadata/content on the English URL.

### How to Fix
Pass `{ request: { headers } }` with `x-locale` into both `NextResponse.rewrite()` and `NextResponse.next()` in `middleware.ts`:

```ts
// middleware.ts
function requestWithLocaleHeader(request: NextRequest, locale: Locale): Headers {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(LOCALE_HEADER, locale)
  return requestHeaders
}

function applyPublicLocale(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname

  // Skip APIs, admin, driver, Next internals, and static files.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  ) {
    return null
  }

  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]

  // /en or /en/... → redirect to unprefixed English URL.
  if (first === "en") {
    const rest = segments.slice(1).join("/")
    const url = request.nextUrl.clone()
    url.pathname = rest ? `/${rest}` : "/"
    const redirect = NextResponse.redirect(url, 308)
    return withLocaleHeaders(redirect, DEFAULT_LOCALE)
  }

  // /it/... → rewrite to unprefixed path with locale header on request + response.
  if (first && isPrefixedLocale(first)) {
    const locale = first
    const rest = segments.slice(1).join("/")
    const url = request.nextUrl.clone()
    url.pathname = rest ? `/${rest}` : "/"
    const rewrite = NextResponse.rewrite(url, {
      request: { headers: requestWithLocaleHeader(request, locale) },
    })
    return withLocaleHeaders(rewrite, locale)
  }

  // Default English (unprefixed) — forward DEFAULT_LOCALE on request headers
  // so a previous NEXT_LOCALE cookie cannot leak onto English URLs.
  const response = NextResponse.next({
    request: { headers: requestWithLocaleHeader(request, DEFAULT_LOCALE) },
  })
  return withLocaleHeaders(response, DEFAULT_LOCALE)
}
```

---

## Task 2 (P0): Preserve Requested `locale` on Code-Default CMS Pages in `lib/page-content.ts`

### Files Affected
- `lib/page-content.ts` (lines 987–1003 and 1086–1100)

### What Is Wrong
In `assembleDestinationPage()` (line 993) and `resolvePageContent()` (line 1091), when a page has no database row yet (`!row`, falling back to code defaults such as `/terms`, `/privacy-policy`, `/cookies`, `/cancellation-policy`, or built-in destinations without DB overrides), the returned object hardcodes `locale: DEFAULT_LOCALE` (`"en"`) instead of the requested `locale`.

When `pageMetadataFields(page)` (line 1404) builds `alternates`, it calls `localizedAlternates(path, (page.locale as Locale) || DEFAULT_LOCALE)`, which emits `<link rel="canonical" href="https://landedalbania.com/terms">` (English) on `/it/terms`, `/de/terms`, `/pl/terms`, `/tr/terms`, `/uk/terms`, and `/ru/terms`.

### How to Fix
Return `locale` instead of `DEFAULT_LOCALE` in both fallback blocks in `lib/page-content.ts`:

```ts
// lib/page-content.ts — inside assembleDestinationPage() (around line 987):
  const row = localized ?? english
  if (!row) {
    if (isCustomDestination) return null
    const hero = destinationHeroImage(document)
    return {
      slug: def.slug,
      locale, // <-- replace DEFAULT_LOCALE with locale
      label: def.label,
      title: def.defaults.title,
      description: def.defaults.description,
      ogImage: hero || def.defaults.ogImage,
      sections: [],
      destinationDocument: document,
      fromDatabase: false,
      hasLocaleRow: false,
    }
  }

// lib/page-content.ts — inside resolvePageContent() (around line 1086):
  const row = localized ?? english
  if (!row) {
    if (isCustomBlog) return null
    return {
      slug: def.slug,
      locale, // <-- replace DEFAULT_LOCALE with locale
      label: def.label,
      title: def.defaults.title,
      description: def.defaults.description,
      ogImage: def.defaults.ogImage,
      sections: def.defaults.sections,
      fromDatabase: false,
      hasLocaleRow: false,
    }
  }
```

---

## Task 3 (P0): Prevent Transient Database Errors from Triggering Site-Wide `noindex` & `Disallow: /`

### Files Affected
- `app/layout.tsx` (lines 63–70)
- `app/robots.ts` (lines 13–29)
- `app/sitemap.ts` (lines 36–47)

### What Is Wrong
In `app/layout.tsx`, `app/robots.ts`, and `app/sitemap.ts`, `getSettings()` is wrapped in a `try / catch` block that defaults `searchIndexingEnabled` to `false` on any exception. If the database experiences even a momentary connection timeout while Googlebot is crawling:
- `app/layout.tsx` serves `<meta name="robots" content="noindex, nofollow, nocache">` on every page.
- `app/robots.ts` serves `Disallow: /`.
- `app/sitemap.ts` returns an empty sitemap `[]`.

### How to Fix
Only disable indexing when the database row explicitly has `searchIndexingEnabled === false` (or when not on the canonical production origin); if the database query throws an unexpected runtime error on production (`landedalbania.com`), fail-open to `true` so a transient DB glitch cannot de-index the site:

```ts
// Helper (can be exported from lib/settings.ts and used in app/layout.tsx, app/robots.ts, app/sitemap.ts):
export async function isSearchIndexingEnabled(): Promise<boolean> {
  try {
    const settings = await getSettings()
    return settings.searchIndexingEnabled === true
  } catch (error) {
    console.error("[seo] getSettings failed while checking searchIndexingEnabled", error)
    const appUrl = process.env.EMAIL_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || ""
    return appUrl.includes("landedalbania.com")
  }
}
```

---

## Task 4 (P0): Remove Full-Screen SSR `MarketingPreloader` & `opacity: 0` Hero LCP Animations

### Files Affected
- `components/marketing/marketing-preloader.tsx` (lines 114–194)
- `components/marketing/home-landing.tsx` (lines 73–126)
- `app/(booking)/layout.tsx` (line 13)
- `components/marketing/marketing-page-enter.tsx` (lines 28–32)
- `app/globals.css` (lines 253–266)

### What Is Wrong
1. `MarketingPreloader` initializes `visible = true` during SSR on both the homepage (`scope="home"`) and all `(booking)` routes (`/destinations/*`, `/transfers/*`, `/blog/*`). It renders a full-screen fixed overlay (`fixed inset-0 z-[200] bg-brand-page`) that hides the entire page until client JS downloads, hydrates, and a `700ms` timer + `420ms` fade (`1.12s` post-hydration) completes.
2. In `components/marketing/home-landing.tsx`, `.home-hero-bg` applies `animation: home-fade-in 1.2s ease both` starting at `opacity: 0` on the Hero `<Image priority fetchPriority="high" />` container.
3. In `app/globals.css`, `.marketing-page-enter` animates the entire page wrapper from `opacity: 0`.
4. Chrome/Lighthouse does not count an element as painted for **Largest Contentful Paint (LCP)** while its opacity is `0` or while covered by an opaque full-viewport overlay.

### How to Fix
1. Remove `<MarketingPreloader scope="home" />` from `components/marketing/home-landing.tsx` and `<MarketingPreloader scope="booking" />` from `app/(booking)/layout.tsx` (or initialize `visible` to `false` on SSR so initial page loads paint immediately).
2. Remove the `opacity: 0` keyframe from `.home-hero-bg` in `components/marketing/home-landing.tsx` and `.marketing-page-enter` in `app/globals.css`:

```tsx
// components/marketing/home-landing.tsx — remove .home-hero-bg fade-in from opacity 0:
<style>{`
  @keyframes home-fade-up {
    from { opacity: 0.01; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .home-fade-up {
    animation: home-fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .home-fade-up-delay {
    animation: home-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.05s both;
  }
  .home-card-enter {
    animation: home-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.08s both;
  }
  @media (prefers-reduced-motion: reduce) {
    .home-fade-up,
    .home-fade-up-delay,
    .home-card-enter {
      animation: none;
    }
  }
`}</style>
```

```css
/* app/globals.css — do not hide the entire page at opacity: 0 on initial SSR paint */
@keyframes marketing-page-enter {
  from {
    transform: translateY(6px);
  }
  to {
    transform: translateY(0);
  }
}
```

---

## Task 5 (P1): Respect Admin CMS SEO Title, Description & `H1` Overrides on Destination & Transfer Pages

### Files Affected
- `app/(booking)/destinations/[slug]/page.tsx` (lines 81–86 and 174–178)
- `app/(booking)/transfers/[slug]/page.tsx` (lines 74–82 and 193–195)
- `lib/seo/search-meta.ts` (lines 247–257)

### What Is Wrong
- On `app/page.tsx` (lines 43–46), Admin CMS `page.title` and `page.description` take priority over the hardcoded `homeSearchCopy(locale)` fallback.
- On `app/(booking)/destinations/[slug]/page.tsx` (lines 81–86 and 174–178), the order is reversed:
  ```ts
  const seo = destinationSearchCopy(destination.id, locale)
  const title = searchTitle(seo?.heading || page.title || document.meta.title || "Airport transfer")
  const description = seo?.description || page.description || meta.description
  ```
  Because `destinationSearchCopy()` returns hardcoded values for the 9 built-in destinations, any custom SEO Title, Meta Description, or Hero `H1` saved in the Admin panel is ignored.
- Furthermore, if a new custom destination is added in Admin (not in the 9 hardcoded `CITY` entries in `lib/seo/search-meta.ts`), `destinationSearchCopy()` returns `null`, and non-English locales without a DB translation row fall back to an untranslated English title/description.

### How to Fix
1. In `lib/seo/search-meta.ts`, allow `destinationSearchCopy` to accept a `fallbackName` so custom destinations also get localized route titles/descriptions across all 7 languages:
```ts
// lib/seo/search-meta.ts
export function destinationSearchCopy(
  id: string,
  locale: Locale,
  fallbackName?: string,
): Copy | null {
  const city = CITY[id]?.[locale] || fallbackName?.trim()
  if (!city) return null
  return {
    heading: fill(DESTINATION_HEADING[locale], { city }),
    description: fill(DESTINATION_DESCRIPTION[locale], { city }),
  }
}
```
2. In `app/(booking)/destinations/[slug]/page.tsx`, prefer custom Admin CMS `page.title`, `page.description`, and `hero.heading` when the current locale has a saved CMS row (`page.hasLocaleRow`) and the value differs from the seed default:
```ts
// app/(booking)/destinations/[slug]/page.tsx — inside generateMetadata():
const seo = destinationSearchCopy(destination.id, locale, destination.name)
const seedDefaultTitle = `${destination.name} airport transfer`.toLowerCase()
const cmsTitle = page.title?.trim()
const cmsDesc = page.description?.trim()

const useCmsTitle =
  Boolean(cmsTitle) &&
  page.hasLocaleRow &&
  cmsTitle.toLowerCase() !== seedDefaultTitle
const useCmsDesc =
  Boolean(cmsDesc) &&
  page.hasLocaleRow &&
  cmsDesc !== destination.description?.trim()

const title = searchTitle(
  (useCmsTitle ? cmsTitle : null) ||
    seo?.heading ||
    cmsTitle ||
    document.meta.title ||
    "Airport transfer",
)
const description =
  (useCmsDesc ? cmsDesc : null) ||
  seo?.description ||
  cmsDesc ||
  meta.description
```
And for the visible `<h1>` in `DestinationPage()` (lines 174–178):
```ts
const seoHeading = destinationSearchCopy(destination.id, locale, name)?.heading
const customHeroHeading =
  resolved.page.hasLocaleRow &&
  hero?.heading?.trim() &&
  hero.heading.trim() !== destination.name
    ? hero.heading.trim()
    : null

const pageHeading =
  customHeroHeading ||
  seoHeading ||
  hero?.heading?.trim() ||
  t(locale, "destinations.airportTransfer", { name })
```

---

## Task 6 (P1): Use `englishOnlyAlternates()` on Untranslated Blog Posts, Transfer Routes & Legal Pages

### Files Affected
- `app/(booking)/blog/[slug]/page.tsx` (lines 39–71)
- `app/(booking)/transfers/[slug]/page.tsx` (lines 64–89)
- `lib/page-content.ts` (lines 1388–1422)
- `lib/i18n/locales.ts` (lines 89–98)

### What Is Wrong
`lib/i18n/locales.ts` defines `englishOnlyAlternates(path)` specifically for pages whose body copy has not been translated yet, with the comment:
> *"Non-EN URLs must not claim to be unique language versions — that causes Search Console 'Duplicate, Google chose different canonical than user'. Canonical + hreflang point at the English URL until real translations ship."*

However, `englishOnlyAlternates()` is never called:
- **Blog posts (`app/(booking)/blog/[slug]/page.tsx`):** When a blog post has no translation for `locale` (`!page.hasLocaleRow`), `/it/blog/...`, `/de/blog/...`, `/ru/blog/...` render the entire English article, append `" (Italian)"` or `" (German)"` to the English title via `localizeFallbackSearchCopy()`, and emit `localizedAlternates()` for all 7 languages.
- **Transfer routes (`app/(booking)/transfers/[slug]/page.tsx`):** When `hasTransferLocaleRow(slug, locale)` is `false`, `/it/transfers/...`, `/de/transfers/...`, etc. render 100% English body paragraphs, English comparison table cells, English route insights, and English FAQs + English `FAQPage` JSON-LD while claiming to be localized pages via `localizedAlternates()`.
- **Legal pages (`/terms`, `/privacy-policy`, `/cookies`, `/cancellation-policy`):** When `!page.hasLocaleRow`, `/it/terms`, `/de/terms`, etc. render English legal copy with a 7-language `hreflang` cluster.

### How to Fix
1. In `app/(booking)/blog/[slug]/page.tsx`, check `pageRecord?.hasLocaleRow` and use `englishOnlyAlternates(path)` when a non-English locale has no translation row:
```ts
// app/(booking)/blog/[slug]/page.tsx — inside generateMetadata():
const pageRecord = await resolvePageContent(`blog/${slug}`, locale)
if (!pageRecord) return { title: "Guide not found" }
const post = pageContentToBlogPost(pageRecord)
if (!post) return { title: "Guide not found" }

const isTranslated = locale === DEFAULT_LOCALE || Boolean(pageRecord.hasLocaleRow)
const alternates = isTranslated
  ? localizedAlternates(path, locale)
  : englishOnlyAlternates(path)
```
2. In `app/(booking)/transfers/[slug]/page.tsx`, check `await hasTransferLocaleRow(route.slug, locale)` for non-English locales:
```ts
// app/(booking)/transfers/[slug]/page.tsx — inside generateMetadata():
import { hasTransferLocaleRow } from "@/lib/transfers/cms"
import { DEFAULT_LOCALE, englishOnlyAlternates, localizedAlternates, localePath } from "@/lib/i18n/locales"

const isTranslated =
  locale === DEFAULT_LOCALE || (await hasTransferLocaleRow(route.slug, locale))
const alternates = isTranslated
  ? localizedAlternates(path, locale)
  : englishOnlyAlternates(path)
```
3. In `lib/page-content.ts` (`pageMetadataFields`), for core legal pages (`terms`, `privacy-policy`, `cookies`, `cancellation-policy`), use `englishOnlyAlternates(path)` when `page.locale !== DEFAULT_LOCALE && !page.hasLocaleRow`:
```ts
// lib/page-content.ts — inside pageMetadataFields(page):
const pageLocale = (page.locale as Locale) || DEFAULT_LOCALE
const isTranslated =
  pageLocale === DEFAULT_LOCALE ||
  Boolean(page.hasLocaleRow) ||
  page.slug === "home" ||
  isDestinationSlug(page.slug)

const alternates = isTranslated
  ? localizedAlternates(path, pageLocale)
  : englishOnlyAlternates(path)
```

---

## Task 7 (P1): Fix Sitemap Locale Enumeration & `<lastmod>` Timestamps in `app/sitemap.ts`

### Files Affected
- `app/sitemap.ts` (lines 53–147)

### What Is Wrong
1. `addPath()` supports `englishOnly?: boolean`, **but `englishOnly: true` is never passed**. Untranslated blog posts, untranslated transfer routes, and English-only legal pages are multiplied across all 7 locales in `sitemap.xml`, sending Googlebot to dozens of duplicate English pages that should canonicalize to English.
2. Blog posts are processed twice: once in `listAdminPages()` (priority `0.3`) and again in `listBlogPostsFromCms()` (priority `0.6`, triggering N sequential Prisma queries).
3. `/destinations`, `/blog`, and all `/transfers/${slug}` entries set `lastModified: now` (`new Date()`) on every request. Search engines ignore `<lastmod>` across a domain when it changes on every fetch without actual content edits.

### How to Fix
Query the existing `(slug, locale, updatedAt)` rows from `prisma.pageContent` in a single query so `sitemap.ts` knows exactly which locales have translated rows for blog posts, transfer routes, and legal pages, and uses real `updatedAt` timestamps:

```ts
// app/sitemap.ts
import { prisma } from "@/lib/db"
import { isBlogSlug, isDestinationSlug } from "@/lib/page-content"
import { TRANSFER_CMS_PREFIX } from "@/lib/transfers/routes"

const STATIC_FALLBACK_DATE = new Date("2026-09-01T00:00:00.000Z")

// Inside sitemap():
const localeRows = await prisma.pageContent.findMany({
  select: { slug: true, locale: true, updatedAt: true },
})
const localesBySlug = new Map<string, Map<string, Date>>()
for (const row of localeRows) {
  let map = localesBySlug.get(row.slug)
  if (!map) {
    map = new Map()
    localesBySlug.set(row.slug, map)
  }
  map.set(row.locale, row.updatedAt)
}

// For blog posts, legal pages, and transfer routes, emit only locales that
// are translated (or all locales for homepage, /destinations, and destination pages
// which have translated route templates in lib/seo/search-meta.ts).
```

---

## Task 8 (P1): Replace Competitor `DEFAULT_OG_IMAGE`, Fix Root Layout Metadata & Add Missing Route Metadata

### Files Affected
- `lib/page-content.ts` (lines 104–105 and 120–122)
- `app/layout.tsx` (lines 40 and 97–128)
- `app/(booking)/book/page.tsx`
- `app/(booking)/blog/page.tsx` (lines 52–59)

### What Is Wrong
1. `DEFAULT_OG_IMAGE` in `lib/page-content.ts` (line 105) and `HOME_DEFAULTS` (line 121) points to `"https://www.welcomepickups.com/wp-content/themes/welcomepickups_new/images/conversion-v2/hero_photo_desktop_2.jpg"`—hotlinking a direct competitor's domain in OpenGraph social cards.
2. `app/layout.tsx` sets `FALLBACK_BRAND = "Albania Transfers"` (line 40) and root fallback `description = "Book airport transfers across Albania, or manage operations from the admin console."` (line 98).
3. `app/(booking)/book/page.tsx` has no `generateMetadata()`, so `/book` inherits `"…or manage operations from the admin console."` and has no canonical tag.
4. `app/(booking)/blog/page.tsx` falls back to English title `"Tirana Airport Transport Guides"` and English description across all 7 locales when no localized DB row exists for `slug: "blog"`.

### How to Fix
1. In `lib/page-content.ts`:
```ts
export const DEFAULT_OG_IMAGE =
  "/uploads/pages/book-your-tirana-airport-transfer.webp"
```
2. In `app/layout.tsx`:
```ts
const FALLBACK_BRAND = "Landed Albania"
const FALLBACK_FAVICON = "/marketing/favicon.png"

// Inside generateMetadata():
const description =
  "Book a private Tirana Airport transfer across Albania. Fixed fares, flight tracking, meet-and-greet, and cash on arrival."
```
3. In `app/(booking)/book/page.tsx`, export `generateMetadata()`:
```ts
import type { Metadata } from "next"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { localizedAlternates } from "@/lib/i18n/locales"
import { t } from "@/lib/i18n/t"
import { homeSearchCopy, searchTitle } from "@/lib/seo/search-meta"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const fallback = homeSearchCopy(locale)
  const title = searchTitle(`${t(locale, "nav.book")} — ${fallback.heading}`)
  return {
    title,
    description: fallback.description,
    alternates: localizedAlternates("/book", locale),
  }
}
```
4. Add a helper for `openGraph.locale` in `lib/i18n/locales.ts`:
```ts
export const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  it: "it_IT",
  de: "de_DE",
  pl: "pl_PL",
  tr: "tr_TR",
  uk: "uk_UA",
  ru: "ru_RU",
}
```

---

## Task 9 (P2): Add Missing `FAQPage` and `Service` (`Offer`) JSON-LD to Destination Pages

### Files Affected
- `app/(booking)/destinations/[slug]/page.tsx` (lines 40–43 and 230–244)

### What Is Wrong
1. `DestinationPage` builds `faqItems` (lines 230–236) and renders `<BlogFaq items={faqItems} />` (line 426), but never calls `buildFaqPageJsonLd(faqItems)` or outputs `<JsonLd data={faqJsonLd} />`.
2. Destination pages target commercial transfer keywords (`"Tirana Airport to Sarandë Transfer"`) and display `"Book a transfer · from €55"`, but only emit `BreadcrumbList` and `TouristDestination` JSON-LD—not `Service` with an `Offer` (`price`, `priceCurrency: "EUR"`).

### How to Fix
In `app/(booking)/destinations/[slug]/page.tsx`:

```tsx
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildServiceJsonLd,
  buildTouristDestinationJsonLd,
} from "@/lib/structured-data"

// Inside DestinationPage() after faqItems (line 237):
const faqJsonLd = buildFaqPageJsonLd(faqItems)
const numericPrice = Number(String(priceFrom).replace(/[^\d.]/g, ""))
const serviceJsonLd =
  Number.isFinite(numericPrice) && numericPrice > 0
    ? buildServiceJsonLd({
        name: pageHeading,
        description,
        url: localePath(`/destinations/${publicSlug}`, locale),
        priceEur: numericPrice,
      })
    : null

// In the return statement (line 240):
return (
  <>
    <JsonLd data={breadcrumbJsonLd} />
    <JsonLd data={touristDestinationJsonLd} />
    {serviceJsonLd ? <JsonLd data={serviceJsonLd} /> : null}
    {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}
```

---

## Task 10 (P2): Fix Relative Image URLs & Hardcoded English Breadcrumbs in JSON-LD

### Files Affected
- `lib/structured-data.ts` (lines 10–85)
- `app/page.tsx` (lines 92–98)
- `app/(booking)/blog/page.tsx` (lines 113–118)
- `app/(booking)/blog/[slug]/page.tsx` (lines 126–136)

### What Is Wrong
1. `buildLocalBusinessJsonLd()` (line 27) and `buildTouristDestinationJsonLd()` (lines 71 & 81) output `input.image` and `attraction.image` as raw relative paths (e.g., `"/uploads/pages/visit-saranda.webp"`), whereas Schema.org and Google Rich Results require absolute URLs (`"https://landedalbania.com/uploads/pages/visit-saranda.webp"`).
2. `app/page.tsx` (line 93) passes `name: settings?.companyName || "Albania Transfers"` to `buildLocalBusinessJsonLd`, while `Service` and `BlogPosting` use `"Landed Albania"`.
3. `app/(booking)/blog/page.tsx` (lines 114–117) and `app/(booking)/blog/[slug]/page.tsx` (lines 128–129) hardcode `"Home"` and `"Blog"` in English inside `buildBreadcrumbJsonLd` on all 7 locales.

### How to Fix
1. In `lib/structured-data.ts`, normalize all `image` and `url` fields with an `absoluteUrl()` helper:
```ts
// lib/structured-data.ts
function baseUrl() {
  return getAppBaseUrl().replace(/\/+$/, "")
}

function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const site = baseUrl()
  return `${site}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`
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
    url: input.url ? absoluteUrl(input.url) : site,
    logo: `${site}/marketing/logo.svg`,
    ...(input.telephone ? { telephone: input.telephone } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
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
```
2. In `app/page.tsx` (line 93), change `"Albania Transfers"` to `"Landed Albania"`.
3. In `app/(booking)/blog/page.tsx` and `app/(booking)/blog/[slug]/page.tsx`, replace `"Home"` and `"Blog"` in `buildBreadcrumbJsonLd` with `t(locale, "nav.home")` and `t(locale, "nav.blog")`.

---

## Task 11 (P2): Fix Homepage `sr-only` `<h1>` Duplication & Wrap `BlogFaq` Questions in `<h3>`

### Files Affected
- `components/marketing/home-landing.tsx` (lines 115–163)
- `components/marketing/blog/blog-faq.tsx` (lines 44–59)

### What Is Wrong
1. In `components/marketing/home-landing.tsx`, line 115 renders `<h1 className="sr-only">{copy.hero.heading.replace(/\n/g, " ")}</h1>`, while lines 132 and 151 render two separate `<p aria-hidden>` elements for mobile and desktop viewports. Crawlers see duplicated hero copy in the HTML and an invisible `<h1>`.
2. In `components/marketing/blog/blog-faq.tsx` (used on `/destinations/[slug]`, `/transfers/[slug]`, and `/blog/[slug]`), each FAQ question is a bare `<button><span>{item.question}</span></button>` without an `<h3>` wrapper (unlike `components/marketing/faq-section.tsx` on the homepage, which wraps the `<button>` in `<h3>`).

### How to Fix
1. In `components/marketing/blog/blog-faq.tsx` (lines 44–59), wrap the FAQ accordion `<button>` in an `<h3>`:
```tsx
// components/marketing/blog/blog-faq.tsx
<h3 className="m-0">
  <button
    type="button"
    aria-expanded={open}
    aria-controls={panelId}
    className="flex min-h-14 w-full touch-manipulation items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
    onClick={() => setOpenId(open ? null : itemId)}
  >
    <span
      className={cn(
        "font-brand text-base font-bold leading-snug transition-colors sm:text-lg",
        open ? "text-brand-accent" : "text-brand",
      )}
    >
      {item.question}
    </span>
    {/* Chevron icon span */}
  </button>
</h3>
```
2. In `components/marketing/home-landing.tsx`, render the visible desktop/mobile hero heading as a single responsive `<h1>` inside the container grid instead of an `sr-only` `<h1>` + two `<p aria-hidden>` blocks.

---

## Task 12 (P2): Add `noindex` Metadata to Transactional/Staff Pages & Expand `robots.txt` Disallow Rules

### Files Affected
- `app/robots.ts` (lines 31–38)
- `app/(booking)/book/confirmation/[referenceCode]/page.tsx`
- `app/(booking)/book/continue/[referenceCode]/page.tsx`
- `app/(booking)/review/page.tsx`
- `app/admin/layout.tsx`
- `app/driver/layout.tsx`

### What Is Wrong
1. `app/robots.ts` only disallows `["/admin/", "/api/", "/driver/"]`, leaving transactional booking routes (`/book/confirmation/*`, `/book/continue/*`, `/book/payment/*`, `/book/lookup`, `/bookings/*`) open to crawling.
2. `app/(booking)/book/confirmation/[referenceCode]/page.tsx`, `app/(booking)/book/continue/[referenceCode]/page.tsx`, and `app/(booking)/review/page.tsx` do not export `robots: { index: false, follow: false }` metadata, inheriting `index: true, follow: true` from `app/layout.tsx`.
3. `app/admin/layout.tsx` and `app/driver/layout.tsx` lack `robots: { index: false, follow: false }` as a defense-in-depth header alongside `robots.txt`.

### How to Fix
1. Update `app/robots.ts`:
```ts
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/driver/",
        "/book/confirmation/",
        "/*/book/confirmation/",
        "/book/continue/",
        "/*/book/continue/",
        "/book/payment/",
        "/*/book/payment/",
        "/book/lookup",
        "/*/book/lookup",
        "/bookings/",
      ],
    },
    sitemap: `${getAppBaseUrl().replace(/\/+$/, "")}/sitemap.xml`,
  }
```
2. Add `robots: { index: false, follow: false }` to the metadata of `app/(booking)/book/confirmation/[referenceCode]/page.tsx`, `app/(booking)/book/continue/[referenceCode]/page.tsx`, `app/(booking)/review/page.tsx`, `app/admin/layout.tsx`, and `app/driver/layout.tsx`:
```ts
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}
```

---

## Task 13 (P3): Add `"latin-ext"` and `"cyrillic"` Google Font Subsets in `app/layout.tsx`

### Files Affected
- `app/layout.tsx` (lines 17–38)

### What Is Wrong
`Inter`, `JetBrains_Mono`, and `Mulish` are loaded with `subsets: ["latin"]` only. The website supports Polish (`pl`), Turkish (`tr`), Ukrainian (`uk`), and Russian (`ru`), plus Albanian diacritics (`ë`, `ç`). Missing `"latin-ext"` and `"cyrillic"` causes fallback font rendering or late font swaps (CLS) on non-English pages.

### How to Fix
Update the font declarations in `app/layout.tsx`:
```ts
const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})
const museoSans = Mulish({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-museo-sans",
  display: "swap",
})
```

---

## Task 14 (P3): Deduplicate Per-Request Prisma Queries with React `cache()`

### Files Affected
- `lib/page-content.ts` (`resolvePageContent`, `resolveDestinationCards`, `resolveDestinationPage`, `getBlogPostFromCms`)
- `lib/transfers/routes.ts` (`getRouteData`)

### What Is Wrong
Because all pages run dynamically (`force-dynamic`), Next.js runs `generateMetadata()` and the page Server Component on every request:
- On `/destinations/[slug]`, `resolveDestinationCards(locale)` runs **3 times** and `resolveDestinationPage(id, locale)` runs **2 times** per request.
- On `/transfers/[slug]`, `getRouteData(slug, locale)` runs **3 times** per request (`generateMetadata`, `TransferRoutePage`, and `getRelatedRoutes`).
- On `/blog/[slug]`, `getBlogPostFromCms(slug, locale)` runs **2 times** per request.

### How to Fix
Wrap the read functions in `cache()` from `"react"`:
```ts
// lib/page-content.ts
import { cache } from "react"

export const resolvePageContent = cache(async function resolvePageContent(
  slug: string,
  localeInput?: string | null,
): Promise<PageContentRecord | null> {
  // existing implementation
})

export const resolveDestinationCards = cache(async function resolveDestinationCards(
  localeInput?: string | null,
  options?: { featuredOnly?: boolean },
): Promise<Destination[]> {
  // Note: since options is an object reference, normalize primitive args or cache an inner function(locale, Boolean(options?.featuredOnly))
})
```
```ts
// lib/transfers/routes.ts
import { cache } from "react"

export const getRouteData = cache(async function getRouteData(
  slug: string,
  locale?: string | null,
): Promise<TransferRoute | null> {
  const { resolveTransferSeed, hydrateTransferRoute } = await import(
    "@/lib/transfers/cms"
  )
  const seed = await resolveTransferSeed(slug, locale)
  if (!seed) return null
  return hydrateTransferRoute(seed)
})
```

---

## Task 15 (P3): Fix Competing `priority` Images & Convert Raw `<img>` Tags to `next/image`

### Files Affected
- `components/marketing/destinations-section.tsx` (line 147)
- `components/marketing/destinations-archive.tsx` (line 185)
- `components/marketing/legal-document-view.tsx` (lines 93–97)
- `components/marketing/cancellation-policy-view.tsx` (lines 101–105)
- `components/marketing/destination-attractions-section.tsx` (lines 29–34)

### What Is Wrong
1. `DestinationsSection` sets `priority={index < 2}` (`fetchPriority="high"`) on carousel cards below the fold on the homepage, and `DestinationsArchive` sets `priority={index < 3}` on archive grid cards while the Hero banner and Header logo also have `priority`. Multiple `fetchPriority="high"` images compete for bandwidth with the actual Hero LCP image.
2. `LegalDocumentView`, `CancellationPolicyView`, and `DestinationAttractionsSection` use raw `<img>` elements instead of Next.js `<Image>`, serving unoptimized full-resolution images without `sizes` or WebP/AVIF resizing.

### How to Fix
1. In `components/marketing/destinations-section.tsx` (line 147) and `components/marketing/destinations-archive.tsx` (line 185), remove `priority={index < 2}` and `priority={index < 3}` so only the Hero banner image has `priority` + `fetchPriority="high"`.
2. In `components/marketing/legal-document-view.tsx` and `components/marketing/cancellation-policy-view.tsx`, replace the hero `<img src={heroImage} ... />` with `<Image src={heroImage} alt={title} fill priority sizes="100vw" className="object-cover object-center" />`.
3. In `components/marketing/destination-attractions-section.tsx`, replace `<img src={attraction.image} ... />` with `<Image src={attraction.image} alt={attraction.imageAlt || attraction.title} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-105" />`.

---

## Task 16 (P3): SSR Customer Testimonials & Scope Third-Party Scripts Away from Staff Routes

### Files Affected
- `components/marketing/testimonials-section.tsx` (lines 177–256)
- `app/layout.tsx` (lines 160–165)

### What Is Wrong
1. `TestimonialsSection` fetches `/api/reviews/public` and `/api/trustpilot-testimonials/public` purely on the client via `useSWR`. Search engine crawlers see no customer testimonials in the SSR HTML under `"Trusted by travellers across Albania"`, and the section shifts layout when data resolves on the client.
2. `app/layout.tsx` injects `TrustpilotInviteBootstrap` and `TrustpilotWidgetBootstrap` into `<head>` on every route, including `/admin` and `/driver`.

### How to Fix
1. Pass initial server-fetched reviews (`initialReviews`) from `HomePage` (`app/page.tsx`) and `DestinationPage` (`app/(booking)/destinations/[slug]/page.tsx`) into `TestimonialsSection` (or pass them as SWR `fallbackData`) so real customer testimonials are present in the initial SSR HTML and do not cause layout shift.
2. Move `TrustpilotInviteBootstrap` and `TrustpilotWidgetBootstrap` out of the root `app/layout.tsx` `<head>` (or guard them so they only render on public marketing/booking pages, not `/admin` or `/driver`).

---

## Task 17 (P3): Secure & Rotate Plaintext Secrets Found in `.env`

### Files Affected
- `.env` (lines 3–5, 11, 18, 24–25, 30, 34)
- `.env.local`

### What Is Wrong
Sensitive credentials and keys are stored in plaintext in `.env` in the workspace:
- **Lines 3–5:** `DATABASE_URL` and `POSTGRES_PASSWORD`
- **Line 11:** `JWT_SECRET` (currently set to a weak placeholder default)
- **Line 18:** `VAPID_PRIVATE_KEY`
- **Lines 24–25:** `SMTP_USER` and plaintext `SMTP_PASS` for the production mail server
- **Line 30:** `CRON_SECRET` (currently set to a weak placeholder default)
- **Line 34:** `NEXT_PUBLIC_TRUSTPILOT_INTEGRATION_KEY`

### How to Fix
1. Verify `.env` and `.env.local` are untracked in Git (`git ls-files .env .env.local` should return empty).
2. Rotate the production `SMTP_PASS` (or store it encrypted via Admin → Settings → SMTP, which uses `lib/secret-box.ts` AES-256-GCM encryption, and remove `SMTP_PASS` from `.env`).
3. Replace `JWT_SECRET` (line 11) and `CRON_SECRET` (line 30) with cryptographically random 32+ byte secrets (`openssl rand -base64 48`).

