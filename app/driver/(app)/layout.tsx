import { DriverSidebar } from "@/components/driver/driver-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function DriverAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="driver-app">
      <DriverSidebar />
      <SidebarInset className="bg-background">{children}</SidebarInset>
    </SidebarProvider>
  )
}
