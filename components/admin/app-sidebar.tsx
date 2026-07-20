"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Plane,
  Settings,
  Users,
} from "lucide-react"

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
import { apiPost } from "@/lib/api"
import { AdminThemeToggle } from "@/components/admin/theme-toggle"

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Bookings", url: "/admin/bookings", icon: CalendarClock },
  { title: "Drivers", url: "/admin/drivers", icon: Users },
  { title: "Pricing", url: "/admin/pricing", icon: MapPinned },
  { title: "Notifications", url: "/admin/notifications", icon: Bell },
  { title: "Settings", url: "/admin/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isMobile, setOpenMobile } = useSidebar()

  async function handleLogout() {
    await apiPost("/api/admin/logout")
    router.push("/admin/login")
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
            <Plane className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Transfer Ops</span>
            <span className="text-xs text-sidebar-foreground/60">
              Admin Console
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
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
              OP
            </div>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium">Ops Team</span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                ops@transfers.co
              </span>
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
