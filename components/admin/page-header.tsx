"use client"

import type { ReactNode } from "react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { NotificationInboxLink } from "@/components/admin/notification-inbox-link"
import { StaffNotificationManager } from "@/components/admin/staff-notifications"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-md supports-backdrop-filter:bg-background/75">
      <div className="flex min-h-14 items-center gap-2 px-3 py-2.5 sm:min-h-16 sm:gap-3 sm:px-4 md:px-6">
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
            <p className="mt-0.5 hidden truncate text-sm text-muted-foreground sm:block">
              {description}
            </p>
          ) : null}
        </div>
        <NotificationInboxLink />
        <StaffNotificationManager audience="admin" />
        <AdminThemeToggle className="shrink-0" />
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
