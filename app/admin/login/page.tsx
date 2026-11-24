import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { LoginForm } from "@/components/admin/login-form"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"

export const metadata: Metadata = {
  title: "Admin Sign In",
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <AdminThemeToggle variant="ghost" />
      </div>

      <div className="w-full max-w-[24.5rem]">
        <LoginForm />

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            <span>Back to website</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
