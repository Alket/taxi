"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { useSearchParams } from "next/navigation"
import {
  CheckIcon,
  ClockIcon,
  InboxIcon,
  StarIcon,
  XIcon,
} from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { PanelCard } from "@/components/settings/shared"
import { apiPatch, fetcher } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type ReviewStatus = "pending" | "approved" | "rejected"

type AdminReview = {
  id: string
  status: ReviewStatus
  driverRating: number
  driverComment: string | null
  platformRating: number
  platformComment: string | null
  createdAt: string
  moderatedAt: string | null
  driver: { id: string; name: string; avgRating: number }
  booking: {
    id: string
    referenceCode: string
    pickupAddress: string
    dropoffAddress: string
    pickupDateTime: string
    customerName: string
    customerEmail: string
  }
}

const TABS = [
  {
    value: "pending",
    label: "Pending",
    short: "Pending",
    icon: ClockIcon,
    title: "Pending reviews",
    description: "Awaiting moderation before they can appear publicly.",
  },
  {
    value: "approved",
    label: "Approved",
    short: "Approved",
    icon: CheckIcon,
    title: "Approved reviews",
    description: "Visible on the site and counted toward driver ratings.",
  },
  {
    value: "rejected",
    label: "Rejected",
    short: "Rejected",
    icon: XIcon,
    title: "Rejected reviews",
    description: "Kept for records and hidden from the public site.",
  },
  {
    value: "all",
    label: "All reviews",
    short: "All",
    icon: InboxIcon,
    title: "All reviews",
    description: "Every submitted review across all moderation states.",
  },
] as const

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums">
      {value.toFixed(1)}
      <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
    </span>
  )
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "approved") {
    return <Badge className="bg-success/15 text-success">Approved</Badge>
  }
  if (status === "rejected") {
    return <Badge variant="secondary">Rejected</Badge>
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
      Pending
    </Badge>
  )
}

function ReviewList({ status }: { status: ReviewStatus | "all" }) {
  const query =
    status === "all"
      ? "/api/admin/reviews"
      : `/api/admin/reviews?status=${status}`
  const { data, isLoading, mutate, error } = useSWR<{ reviews: AdminReview[] }>(
    query,
    fetcher,
  )
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const reviews = data?.reviews ?? []

  async function moderate(id: string, next: "approved" | "rejected") {
    setPendingId(id)
    try {
      await apiPatch(`/api/admin/reviews/${id}`, { status: next })
      toast.success(
        next === "approved" ? "Review approved." : "Review rejected.",
      )
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <p className="font-medium text-destructive">Failed to load reviews</p>
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
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No {status === "all" ? "" : `${status} `}reviews yet.
      </div>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="rounded-xl border bg-muted/20 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-semibold">
                  {review.booking.referenceCode}
                </p>
                <p className="text-xs text-muted-foreground">
                  {review.booking.customerName} · {review.driver.name}
                </p>
              </div>
              <StatusBadge status={review.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {review.booking.pickupAddress} → {review.booking.dropoffAddress}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <span>
                Driver <Stars value={review.driverRating} />
              </span>
              <span>
                Platform <Stars value={review.platformRating} />
              </span>
            </div>
            {(review.driverComment || review.platformComment) && (
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                {review.driverComment ? (
                  <p>
                    <span className="font-medium text-foreground">Driver: </span>
                    {review.driverComment}
                  </p>
                ) : null}
                {review.platformComment ? (
                  <p>
                    <span className="font-medium text-foreground">
                      Platform:{" "}
                    </span>
                    {review.platformComment}
                  </p>
                ) : null}
              </div>
            )}
            {review.status === "pending" ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-10 touch-manipulation"
                  disabled={pendingId === review.id}
                  onClick={() => void moderate(review.id, "approved")}
                >
                  <CheckIcon data-icon="inline-start" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 touch-manipulation"
                  disabled={pendingId === review.id}
                  onClick={() => void moderate(review.id, "rejected")}
                >
                  <XIcon data-icon="inline-start" />
                  Reject
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Booking</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Ratings</TableHead>
              <TableHead>Comments</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell className="pl-4 align-top">
                  <p className="font-mono text-sm font-medium">
                    {review.booking.referenceCode}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {review.booking.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(review.createdAt)}
                  </p>
                </TableCell>
                <TableCell className="align-top">
                  <p className="text-sm font-medium">{review.driver.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg <Stars value={review.driver.avgRating} />
                  </p>
                </TableCell>
                <TableCell className="align-top text-sm">
                  <p>
                    Driver <Stars value={review.driverRating} />
                  </p>
                  <p className="mt-1">
                    Platform <Stars value={review.platformRating} />
                  </p>
                </TableCell>
                <TableCell className="max-w-xs align-top text-sm text-muted-foreground">
                  {review.driverComment ? (
                    <p className={cn(!review.platformComment && "line-clamp-3")}>
                      <span className="font-medium text-foreground">D: </span>
                      {review.driverComment}
                    </p>
                  ) : null}
                  {review.platformComment ? (
                    <p className="mt-1 line-clamp-3">
                      <span className="font-medium text-foreground">P: </span>
                      {review.platformComment}
                    </p>
                  ) : null}
                  {!review.driverComment && !review.platformComment ? "—" : null}
                </TableCell>
                <TableCell className="align-top">
                  <StatusBadge status={review.status} />
                </TableCell>
                <TableCell className="pr-4 text-right align-top">
                  {review.status === "pending" ? (
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        disabled={pendingId === review.id}
                        onClick={() => void moderate(review.id, "approved")}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === review.id}
                        onClick={() => void moderate(review.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

export function ReviewsView() {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get("status")
  const initialTab =
    statusParam === "pending" ||
    statusParam === "approved" ||
    statusParam === "rejected" ||
    statusParam === "all"
      ? statusParam
      : "pending"

  return (
    <>
      <PageHeader title="Reviews" description="Customer feedback moderation" />
      <div className="p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        <Tabs
          defaultValue={initialTab}
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
            {TABS.map((t) => (
              <TabsContent key={t.value} value={t.value}>
                <PanelCard title={t.title} description={t.description}>
                  <ReviewList
                    status={t.value as ReviewStatus | "all"}
                  />
                </PanelCard>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </>
  )
}
