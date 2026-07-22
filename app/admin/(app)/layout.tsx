import { AppSidebar } from "@/components/admin/app-sidebar"
import { SessionGuard } from "@/components/admin/session-guard"
import { PushNotificationClickHandler } from "@/components/staff/push-notification-click-handler"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function AdminAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="admin-app">
      <SessionGuard />
      <PushNotificationClickHandler />
      <AppSidebar />
      <SidebarInset className="bg-background">{children}</SidebarInset>
    </SidebarProvider>
  )
}
