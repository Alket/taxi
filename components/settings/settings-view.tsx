"use client"

import useSWR from "swr"
import {
  BellIcon,
  CreditCardIcon,
  PlaneIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"

import { fetcher } from "@/lib/api"
import type { Settings } from "@/lib/types"
import { useIsMobile } from "@/hooks/use-mobile"
import { PageHeader } from "@/components/admin/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GeneralPanel } from "@/components/settings/general-panel"
import { NotificationsPanel } from "@/components/settings/notifications-panel"
import { FlightTrackingPanel } from "@/components/settings/flight-tracking-panel"
import { PaymentsPanel } from "@/components/settings/payments-panel"
import { TeamPanel } from "@/components/settings/team-panel"
import { cn } from "@/lib/utils"

const TABS = [
  { value: "general", label: "General", short: "General", icon: SettingsIcon },
  {
    value: "notifications",
    label: "Notifications",
    short: "Alerts",
    icon: BellIcon,
  },
  {
    value: "flight",
    label: "Flight Tracking",
    short: "Flights",
    icon: PlaneIcon,
  },
  {
    value: "payments",
    label: "Payments",
    short: "Pay",
    icon: CreditCardIcon,
  },
  { value: "team", label: "Team", short: "Team", icon: UsersIcon },
]

export function SettingsView() {
  const isMobile = useIsMobile()
  const { data, error, isLoading, mutate } = useSWR<{ settings: Settings }>(
    "/api/admin/settings",
    fetcher,
  )
  const settings = data?.settings

  return (
    <>
      <PageHeader title="Settings" description="Workspace configuration" />
      <div className="p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        <Tabs
          defaultValue="general"
          orientation={isMobile ? "horizontal" : "vertical"}
          className={cn(
            "gap-4 md:gap-6",
            isMobile ? "flex-col" : "items-start",
          )}
        >
          <TabsList
            variant="line"
            className={cn(
              "w-full shrink-0 gap-1",
              isMobile
                ? "h-auto max-w-full justify-start overflow-x-auto overscroll-x-contain pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                : "md:sticky md:top-20 md:w-52",
            )}
          >
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className={cn(
                  "gap-2 px-3 py-2.5 touch-manipulation sm:py-2",
                  isMobile
                    ? "shrink-0 justify-center"
                    : "w-full justify-start",
                )}
              >
                <t.icon data-icon="inline-start" />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <Skeleton className="h-96 w-full rounded-xl" />
            ) : error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-medium text-destructive">
                  Failed to load settings
                </p>
                <p className="mt-1 text-muted-foreground">
                  {(error as Error).message}
                </p>
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => mutate()}
                >
                  Try again
                </button>
              </div>
            ) : settings ? (
              <>
                <TabsContent value="general">
                  <GeneralPanel settings={settings} onSaved={() => mutate()} />
                </TabsContent>
                <TabsContent value="notifications">
                  <NotificationsPanel
                    settings={settings}
                    onSaved={() => mutate()}
                  />
                </TabsContent>
                <TabsContent value="flight">
                  <FlightTrackingPanel
                    settings={settings}
                    onSaved={() => mutate()}
                  />
                </TabsContent>
                <TabsContent value="payments">
                  <PaymentsPanel
                    settings={settings}
                    onSaved={() => mutate()}
                  />
                </TabsContent>
                <TabsContent value="team">
                  <TeamPanel />
                </TabsContent>
              </>
            ) : null}
          </div>
        </Tabs>
      </div>
    </>
  )
}
