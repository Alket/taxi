import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  // iOS “Add to Home Screen” uses the manifest start_url — keep /admin, not /.
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Admin",
    statusBarStyle: "default",
  },
}

/** Shared wrapper for all /admin routes (login + app). */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="admin-app min-h-svh">{children}</div>
}
