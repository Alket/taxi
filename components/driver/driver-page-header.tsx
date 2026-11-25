"use client"

import type { ReactNode } from "react"

import { StaffNotificationManager } from "@/components/admin/staff-notifications"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useDriverT } from "@/lib/i18n/driver"

export function DriverPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  const t = useDriverT()

  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-md supports-backdrop-filter:bg-background/75">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center gap-2 px-3 py-2.5 sm:min-h-16 sm:gap-3 sm:px-4 md:px-6">
        <SidebarTrigger className="-ml-0.5 size-10 shrink-0 touch-manipulation sm:size-8" />
        <Separator
          orientation="vertical"
          className="mr-0.5 hidden h-6 sm:block"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:hidden">
          <StaffNotificationManager audience="driver" />
          <AdminThemeToggle
            variant="ghost"
            className="shrink-0"
            labels={{
              light: t("theme.light"),
              dark: t("theme.dark"),
              toLight: t("theme.toLight"),
              toDark: t("theme.toDark"),
            }}
          />
        </div>
        {actions ? (
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {actions}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2 sm:hidden">
          <div className="flex w-full min-w-0 items-center gap-2 [&_button]:h-10 [&_button]:flex-1 [&_a]:h-10">
            {actions}
          </div>
        </div>
      ) : null}
    </header>
  )
}
