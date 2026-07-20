"use client"

import Link from "next/link"
import useSWR from "swr"
import { InboxIcon } from "lucide-react"

import { fetcher } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type UnreadPayload = {
  unreadCount: number
  notifications: unknown[]
}

/** Header shortcut to the admin notification center with unread badge. */
export function NotificationInboxLink() {
  const { data } = useSWR<UnreadPayload>(
    "/api/admin/notifications?limit=1",
    fetcher,
    { refreshInterval: 15_000 },
  )
  const unread = data?.unreadCount ?? 0

  return (
    <Button
      render={<Link href="/admin/notifications" />}
      nativeButton={false}
      variant="outline"
      size="icon"
      className="relative size-10 shrink-0 touch-manipulation sm:size-8"
      aria-label={
        unread > 0
          ? `Notifications, ${unread} unread`
          : "Notification center"
      }
    >
      <InboxIcon className="size-4" />
      {unread > 0 ? (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white",
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Button>
  )
}
