"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import useSWR from "swr"
import {
  BarChart3,
  CarFront,
  CalendarClock,
  LogOut,
} from "lucide-react"

import { AdminThemeToggle } from "@/components/admin/theme-toggle"
import { StaffNotificationManager } from "@/components/admin/staff-notifications"
import { DriverLanguageSwitcher } from "@/components/driver/driver-language-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { apiPost, fetcher } from "@/lib/api"
import { useDriverT } from "@/lib/i18n/driver"
import type { Driver } from "@/lib/types"

function driverInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "DR"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

export function DriverSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useDriverT()
  const { isMobile, setOpenMobile } = useSidebar()
  const { data } = useSWR<{ driver: Driver }>("/api/driver/me", fetcher)
  const driver = data?.driver

  const navItems = [
    { title: t("nav.trips"), url: "/driver", icon: CalendarClock },
    { title: t("nav.analytics"), url: "/driver/analytics", icon: BarChart3 },
  ]

  async function handleLogout() {
    await apiPost("/api/driver/logout").catch(() => {})
    router.push("/driver/login")
    router.refresh()
  }

  function closeMobileNav() {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground sm:size-9 sm:rounded-lg">
            <CarFront className="size-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">
              {t("sidebar.portal")}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {driver?.name ?? t("sidebar.yourTrips")}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("nav.menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.url === "/driver"
                    ? pathname === "/driver"
                    : pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-11 touch-manipulation text-[15px] sm:h-8 sm:text-sm"
                      render={
                        <Link href={item.url} onClick={closeMobileNav}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2 rounded-xl bg-sidebar-accent/50 p-2.5">
          <div className="flex items-center gap-2.5 px-0.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-semibold text-sidebar-foreground">
              {driverInitials(driver?.name ?? t("sidebar.driver"))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">
                {driver?.name ?? t("sidebar.driver")}
              </span>
              <span className="truncate font-mono text-xs text-sidebar-foreground/60">
                {driver?.plateNumber ?? "—"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <StaffNotificationManager audience="driver" />
            <AdminThemeToggle
              showLabel
              variant="ghost"
              className="flex-1 hover:bg-sidebar-accent"
              labels={{
                light: t("theme.light"),
                dark: t("theme.dark"),
                toLight: t("theme.toLight"),
                toDark: t("theme.toDark"),
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-0.5">
            <span className="text-xs text-sidebar-foreground/60">
              {t("lang.label")}
            </span>
            <DriverLanguageSwitcher size="sm" />
          </div>
          <SidebarMenuButton
            tooltip={t("sidebar.logout")}
            className="h-10 w-full touch-manipulation justify-start gap-2 px-2.5 hover:bg-sidebar-accent"
            onClick={() => void handleLogout()}
            aria-label={t("sidebar.logout")}
          >
            <LogOut />
            <span>{t("sidebar.logout")}</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
