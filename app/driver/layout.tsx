import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Driver",
  // iOS “Add to Home Screen” uses the manifest start_url — keep /driver, not /.
  manifest: "/driver.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Driver",
    statusBarStyle: "default",
  },
}

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {children}
    </div>
  )
}
