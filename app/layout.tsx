import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono, Mulish } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppThemeProvider } from "@/components/admin/theme-provider"
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

export const metadata: Metadata = {
  title: {
    default: "Albania Transfers",
    template: "%s · Albania Transfers",
  },
  description:
    "Book airport transfers across Albania, or manage operations from the admin console.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Albania Transfers",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#141a24" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
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
