import { redirect } from "next/navigation"

import { DriverSidebar } from "@/components/driver/driver-sidebar"
import { PushNotificationClickHandler } from "@/components/staff/push-notification-click-handler"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getDriverSession } from "@/lib/driver-auth"

export default async function DriverAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const driver = await getDriverSession()
  if (!driver) {
    redirect("/driver/login")
  }

  return (
    <SidebarProvider className="driver-app">
      <PushNotificationClickHandler />
      <DriverSidebar />
      <SidebarInset className="bg-background">{children}</SidebarInset>
    </SidebarProvider>
  )
}
