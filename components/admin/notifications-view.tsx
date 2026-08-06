"use client"

import * as React from "react"
import useSWR, { useSWRConfig } from "swr"
import {
  BellIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  CircleDollarSignIcon,
  FlagIcon,
  InboxIcon,
  MapPinIcon,
  Trash2Icon,
  UserXIcon,
  CalendarPlusIcon,
  BanIcon,
} from "lucide-react"
import { toast } from "sonner"

import { apiDelete, apiPatch, fetcher } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAdminSession } from "@/hooks/use-admin-session"
import { PageHeader } from "@/components/admin/page-header"
import { BookingDetail } from "@/components/bookings/booking-detail"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type StaffNotificationItem = {
  id: string
  type: string
  title: string
  body: string
  url: string
  bookingId: string | null
  read: boolean
  readAt: string | null
  createdAt: string
}

type NotificationsPayload = {
  unreadCount: number
  notifications: StaffNotificationItem[]
}

function TypeIcon({ type }: { type: string }) {
  const className = "size-4"
  if (type === "driver_rejected") return <UserXIcon className={className} />
  if (type === "driver_accepted") return <CheckCheckIcon className={className} />
  if (type === "driver_arrived") return <MapPinIcon className={className} />
  if (type === "cash_paid") return <CircleDollarSignIcon className={className} />
  if (type === "trip_completed") return <FlagIcon className={className} />
  if (type === "payment") return <CircleDollarSignIcon className={className} />
  if (type === "new_booking") return <CalendarPlusIcon className={className} />
  if (type === "date_change") return <CalendarClockIcon className={className} />
  if (type === "booking_cancelled") return <BanIcon className={className} />
  return <BellIcon className={className} />
}

export function NotificationsView() {
  const { isAdmin } = useAdminSession()
  const { mutate: mutateMatching } = useSWRConfig()
  const { data, isLoading, mutate } = useSWR<NotificationsPayload>(
    "/api/admin/notifications?limit=80",
    fetcher,
    { refreshInterval: 15_000 },
  )
  const [filter, setFilter] = React.useState<"all" | "unread">("all")
  const [pending, setPending] = React.useState(false)
  const [clearOpen, setClearOpen] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)
  const [selectedBookingId, setSelectedBookingId] = React.useState<
    string | null
  >(null)

  const items = React.useMemo(() => {
    const list = data?.notifications ?? []
    if (filter === "unread") return list.filter((n) => !n.read)
    return list
  }, [data?.notifications, filter])

  const unreadCount = data?.unreadCount ?? 0
  const totalCount = data?.notifications.length ?? 0

  async function refreshNotificationCaches() {
    await mutateMatching(
      (key) =>
        typeof key === "string" && key.startsWith("/api/admin/notifications"),
    )
  }

  async function markAllRead() {
    if (unreadCount === 0) return
    setPending(true)
    try {
      await apiPatch("/api/admin/notifications")
      await refreshNotificationCaches()
      toast.success("All notifications marked as read")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function clearAllNotifications() {
    setClearing(true)
    try {
      const res = await apiDelete<{ deleted: number }>(
        "/api/admin/notifications",
      )
      setClearOpen(false)
      await refreshNotificationCaches()
      toast.success(
        res.deleted === 0
          ? "Inbox already empty"
          : `Cleared ${res.deleted} notification${res.deleted === 1 ? "" : "s"}`,
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setClearing(false)
    }
  }

  async function openNotification(item: StaffNotificationItem) {
    if (!item.read) {
      try {
        await apiPatch(`/api/admin/notifications/${item.id}`)
        await mutate()
      } catch {
        // ignore mark-read failures
      }
    }

    if (item.bookingId) {
      setSelectedBookingId(item.bookingId)
      return
    }

    toast.message("No booking linked to this notification.")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Notifications"
        description="Booking alerts and driver responses for your ops team."
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
              disabled={pending || unreadCount === 0}
              onClick={() => void markAllRead()}
            >
              <CheckCheckIcon data-icon="inline-start" />
              Mark all read
            </Button>
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-full touch-manipulation text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-8 sm:w-auto"
                disabled={clearing || (totalCount === 0 && unreadCount === 0)}
                onClick={() => setClearOpen(true)}
              >
                <Trash2Icon data-icon="inline-start" />
                Clear notifications
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
          >
            Unread
            {unreadCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-background/20 px-1.5 text-xs tabular-nums">
                {unreadCount}
              </span>
            ) : null}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty className="border border-dashed py-16">
            <InboxIcon className="size-8 text-muted-foreground" />
            <EmptyTitle>
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </EmptyTitle>
            <EmptyDescription>
              New bookings, payments, and driver rejections will show up here.
            </EmptyDescription>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openNotification(item)}
                  className={cn(
                    "flex w-full gap-3 rounded-xl border p-3.5 text-left transition-colors hover:bg-muted/40",
                    !item.read && "border-primary/25 bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      item.type === "driver_rejected"
                        ? "bg-destructive/10 text-destructive"
                        : item.type === "driver_accepted"
                          ? "bg-success/15 text-success"
                          : "bg-primary/10 text-primary",
                    )}
                  >
                    <TypeIcon type={item.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      {!item.read ? (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">
                      {item.body}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BookingDetail
        bookingId={selectedBookingId}
        open={!!selectedBookingId}
        onOpenChange={(open) => {
          if (!open) setSelectedBookingId(null)
        }}
        onMutated={() => {
          void mutate()
        }}
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every admin inbox notification. Driver
              notifications are not affected. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearing}
              onClick={(e) => {
                e.preventDefault()
                void clearAllNotifications()
              }}
            >
              {clearing ? "Clearing…" : "Clear notifications"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
