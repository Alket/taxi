import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono, Mulish } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppThemeProvider } from "@/components/admin/theme-provider"
import { getRequestLocale } from "@/lib/i18n/get-locale"
import { getSettings } from "@/lib/settings"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
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

async function resolveBrandName() {
  try {
    const settings = await getSettings()
    const name = settings.companyName?.trim()
    return name || FALLBACK_BRAND
  } catch {
    return FALLBACK_BRAND
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveBrandName()
  return {
    title: {
      default: brand,
      template: `%s · ${brand}`,
    },
    description:
      "Book airport transfers across Albania, or manage operations from the admin console.",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/marketing/favicon.png", type: "image/png", sizes: "512x512" }],
      apple: [{ url: "/marketing/favicon.png", type: "image/png", sizes: "512x512" }],
      shortcut: ["/marketing/favicon.png"],
    },
    appleWebApp: {
      capable: true,
      title: brand,
      statusBarStyle: "default",
    },
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
  const locale = await getRequestLocale()
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${museoSans.variable}`}
    >
      <body className="font-sans antialiased">
        <AppThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-right" />
        </AppThemeProvider>
      </body>
    </html>
  )
}
