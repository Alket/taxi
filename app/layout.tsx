import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono, Mulish } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppThemeProvider } from "@/components/admin/theme-provider"
import {
  GoogleTagManager,
} from "@/components/marketing/google-tag-manager"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { getAppBaseUrl } from "@/lib/mail"
import { DEFAULT_OG_IMAGE } from "@/lib/page-content"
import { getSettings } from "@/lib/settings"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

/**
 * Museo Sans is not on Google Fonts. Mulish is the closest free alternative.
 * Loaded as `--font-museo-sans` and applied only via `.brand-frontend`
 * (homepage + /book), not admin.
 */
const museoSans = Mulish({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-museo-sans",
  display: "swap",
})

const FALLBACK_BRAND = "Albania Transfers"
const FALLBACK_FAVICON = "/marketing/favicon.png"

async function resolveBrandName() {
  try {
    const settings = await getSettings()
    const name = settings.companyName?.trim()
    return name || FALLBACK_BRAND
  } catch {
    return FALLBACK_BRAND
  }
}

async function resolveFaviconUrl() {
  try {
    const settings = await getSettings()
    const url = settings.faviconUrl?.trim()
    return url || FALLBACK_FAVICON
  } catch {
    return FALLBACK_FAVICON
  }
}

async function resolveSearchIndexingEnabled() {
  try {
    const settings = await getSettings()
    return settings.searchIndexingEnabled === true
  } catch {
    return false
  }
}

async function resolveGtmContainerId() {
  try {
    const settings = await getSettings()
    return settings.gtmContainerId?.trim() || ""
  } catch {
    return ""
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const [brand, favicon, indexingEnabled] = await Promise.all([
    resolveBrandName(),
    resolveFaviconUrl(),
    resolveSearchIndexingEnabled(),
  ])
  const isSvg = favicon.toLowerCase().endsWith(".svg")
  const isIco = favicon.toLowerCase().endsWith(".ico")
  const type = isSvg
    ? "image/svg+xml"
    : isIco
      ? "image/x-icon"
      : favicon.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/png"

  const description =
    "Book airport transfers across Albania, or manage operations from the admin console."

  return {
    metadataBase: new URL(getAppBaseUrl()),
    title: {
      default: brand,
      template: `%s · ${brand}`,
    },
    description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: favicon, type }],
      apple: [{ url: favicon }],
      shortcut: [favicon],
    },
    appleWebApp: {
      capable: true,
      title: brand,
      statusBarStyle: "default",
    },
    openGraph: {
      siteName: brand,
      title: brand,
      description,
      images: [
        { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: brand },
      ],
    },
    twitter: {
      card: "summary_large_image",
    },
    robots: indexingEnabled
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
  }
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#141a24" },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [locale, gtmContainerId] = await Promise.all([
    getRequestLocale(),
    resolveGtmContainerId(),
  ])
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${museoSans.variable}`}
    >
      <body className="font-sans antialiased">
        <GoogleTagManager containerId={gtmContainerId} />
        <AppThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-right" />
        </AppThemeProvider>
      </body>
    </html>
  )
}
