"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Bell,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Plane,
  Settings,
  Users,
} from "lucide-react"

import { AdminThemeToggle } from "@/components/admin/theme-toggle"
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
import { useAdminSession } from "@/hooks/use-admin-session"
import { apiPost } from "@/lib/api"
import {
  ADMIN_ROLE_LABELS,
  initialsFromName,
} from "@/lib/auth-client"
import { Skeleton } from "@/components/ui/skeleton"

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Bookings", url: "/admin/bookings", icon: CalendarClock },
  { title: "Drivers", url: "/admin/drivers", icon: Users },
  { title: "Pricing", url: "/admin/pricing", icon: MapPinned },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
  { title: "Settings", url: "/admin/settings", icon: Settings, adminOnly: true },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()
  const { user, isLoading, isAdmin } = useAdminSession()

  async function handleLogout() {
    await apiPost("/api/admin/logout")
    router.push("/admin/login")
    router.refresh()
  }

  function closeMobileNav() {
    if (isMobile) setOpenMobile(false)
  }

  const visibleNav = navItems.filter(
    (item) => !("adminOnly" in item && item.adminOnly) || isAdmin,
  )

  const displayName = user?.name?.trim() || "Account"
  const displayEmail = user?.email ?? ""
  const roleLabel = user ? ADMIN_ROLE_LABELS[user.role] : null
  const initials = initialsFromName(displayName)

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground sm:size-9 sm:rounded-lg">
            <Plane className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Transfer Ops</span>
            <span className="text-xs text-sidebar-foreground/60">
              {roleLabel ? `${roleLabel} console` : "Admin Console"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleNav.map((item) => {
                const isActive =
                  item.url === "/admin"
                    ? pathname === "/admin"
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
              {isLoading ? "…" : initials}
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              {isLoading ? (
                <>
                  <Skeleton className="mb-1 h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </>
              ) : (
                <>
                  <span className="truncate text-sm font-medium">
                    {displayName}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/60">
                    {displayEmail || roleLabel || "Signed in"}
                  </span>
                </>
              )}
            </div>
          </div>
          <AdminThemeToggle showLabel variant="ghost" className="hover:bg-sidebar-accent" />
          <SidebarMenuButton
            tooltip="Log out"
            className="h-10 w-full touch-manipulation justify-start gap-2 px-2.5 hover:bg-sidebar-accent"
            onClick={() => void handleLogout()}
            aria-label="Log out"
          >
            <LogOut />
            <span>Log out</span>
          </SidebarMenuButton>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
