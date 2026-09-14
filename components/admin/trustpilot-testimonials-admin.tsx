"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react"

import { PanelCard } from "@/components/settings/shared"
import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api"
import { useAdminSession } from "@/hooks/use-admin-session"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ReviewSiteDisplay = {
  customerReviewsVisibleOnSite: boolean
  trustpilotTestimonialsVisibleOnSite: boolean
  trustpilotDisplayScore: number
  trustpilotDisplayCount: number
  trustpilotProfileUrl: string
  trustpilotDisclaimer: string
}

type TrustpilotTestimonial = {
  id: string
  authorName: string
  title: string
  rating: number
  body: string
  reviewedAt: string | null
  sourceUrl: string | null
  sortOrder: number
  published: boolean
}

type FormState = {
  authorName: string
  title: string
  rating: number
  body: string
  reviewedAt: string
  sourceUrl: string
  sortOrder: number
  published: boolean
}

const emptyForm = (): FormState => ({
  authorName: "",
  title: "",
  rating: 5,
  body: "",
  reviewedAt: "",
  sourceUrl: "",
  sortOrder: 0,
  published: true,
})

function toDateInput(iso: string | null) {
  if (!iso) return ""
  return iso.slice(0, 10)
}

function StarPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1
        return (
          <button
            key={n}
            type="button"
            className="rounded p-0.5 touch-manipulation"
            aria-label={`${n} stars`}
            onClick={() => onChange(n)}
          >
            <StarIcon
              className={cn(
                "size-5",
                n <= value
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30",
              )}
            />
          </button>
        )
      })}
      <span className="ml-2 text-sm tabular-nums text-muted-foreground">
        {value}/5
      </span>
    </div>
  )
}

export function CustomerReviewsVisibilityCard() {
  const { data, isLoading, mutate } = useSWR<{ display: ReviewSiteDisplay }>(
    "/api/admin/review-site-display",
    fetcher,
  )
  const [saving, setSaving] = React.useState(false)
  const checked = data?.display.customerReviewsVisibleOnSite ?? true

  async function toggle(next: boolean) {
    setSaving(true)
    try {
      await apiPatch("/api/admin/review-site-display", {
        customerReviewsVisibleOnSite: next,
      })
      toast.success(
        next
          ? "Customer reviews will show on the site."
          : "Customer reviews hidden from the site.",
      )
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <Skeleton className="mb-4 h-16 w-full rounded-xl" />

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border bg-muted/20 px-4 py-3">
      <Checkbox
        id="customer-reviews-visible"
        checked={checked}
        disabled={saving}
        onCheckedChange={(v) => void toggle(v === true)}
      />
      <div className="min-w-0">
        <Label htmlFor="customer-reviews-visible" className="font-medium">
          Show customer reviews on homepage &amp; destination pages
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Approved booking reviews appear in the traveller stories carousel when
          enabled.
        </p>
      </div>
    </div>
  )
}

export function TrustpilotTestimonialsAdmin() {
  const { canDelete } = useAdminSession()
  const displayKey = "/api/admin/review-site-display"
  const listKey = "/api/admin/trustpilot-testimonials"
  const { data: displayData, mutate: mutateDisplay } = useSWR<{
    display: ReviewSiteDisplay
  }>(displayKey, fetcher)
  const { data, isLoading, mutate, error } = useSWR<{
    testimonials: TrustpilotTestimonial[]
  }>(listKey, fetcher)

  const display = displayData?.display
  const [score, setScore] = React.useState("0")
  const [count, setCount] = React.useState("0")
  const [profileUrl, setProfileUrl] = React.useState("")
  const [disclaimer, setDisclaimer] = React.useState(
    "Selection of 5 star reviews from verified customers.",
  )
  const [savingDisplay, setSavingDisplay] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [savingForm, setSavingForm] = React.useState(false)
  const [deleting, setDeleting] = React.useState<TrustpilotTestimonial | null>(
    null,
  )
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!display) return
    setScore(String(display.trustpilotDisplayScore))
    setCount(String(display.trustpilotDisplayCount))
    setProfileUrl(display.trustpilotProfileUrl)
    setDisclaimer(
      display.trustpilotDisclaimer ||
        "Selection of 5 star reviews from verified customers.",
    )
  }, [display])

  const rows = data?.testimonials ?? []

  async function saveDisplay(patch: Partial<ReviewSiteDisplay>) {
    setSavingDisplay(true)
    try {
      await apiPatch(displayKey, patch)
      toast.success("Trustpilot display settings saved.")
      await mutateDisplay()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingDisplay(false)
    }
  }

  function startEdit(row: TrustpilotTestimonial) {
    setEditingId(row.id)
    setForm({
      authorName: row.authorName,
      title: row.title ?? "",
      rating: row.rating,
      body: row.body,
      reviewedAt: toDateInput(row.reviewedAt),
      sourceUrl: row.sourceUrl ?? "",
      sortOrder: row.sortOrder,
      published: row.published,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setSavingForm(true)
    const payload = {
      authorName: form.authorName.trim(),
      title: form.title.trim(),
      rating: form.rating,
      body: form.body.trim(),
      reviewedAt: form.reviewedAt || null,
      sourceUrl: form.sourceUrl.trim() || null,
      sortOrder: form.sortOrder,
      published: form.published,
    }
    try {
      if (editingId) {
        await apiPatch(`/api/admin/trustpilot-testimonials/${editingId}`, payload)
        toast.success("Trustpilot review updated.")
      } else {
        await apiPost("/api/admin/trustpilot-testimonials", payload)
        toast.success("Trustpilot review added.")
      }
      cancelEdit()
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingForm(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setPendingId(deleting.id)
    try {
      await apiDelete(`/api/admin/trustpilot-testimonials/${deleting.id}`)
      toast.success("Trustpilot review deleted.")
      setDeleting(null)
      if (editingId === deleting.id) cancelEdit()
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <PanelCard
      title="Trustpilot reviews"
      description="Paste public Trustpilot quotes for the marketing carousel. Overall score and count are set manually."
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border bg-muted/20 px-4 py-3">
        <Checkbox
          id="tp-visible"
          checked={display?.trustpilotTestimonialsVisibleOnSite ?? false}
          disabled={savingDisplay || !display}
          onCheckedChange={(v) =>
            void saveDisplay({ trustpilotTestimonialsVisibleOnSite: v === true })
          }
        />
        <div className="min-w-0">
          <Label htmlFor="tp-visible" className="font-medium">
            Show Trustpilot carousel on homepage &amp; destination pages
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Independent of the hero Trustpilot Review Collector widget.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tp-score">Overall score</Label>
          <Input
            id="tp-score"
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tp-count">Total reviews</Label>
          <Input
            id="tp-count"
            type="number"
            min={0}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="tp-url">Trustpilot profile URL</Label>
          <Input
            id="tp-url"
            type="url"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            placeholder="https://www.trustpilot.com/review/landedalbania.com"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="tp-disclaimer">Disclaimer text</Label>
          <Input
            id="tp-disclaimer"
            value={disclaimer}
            onChange={(e) => setDisclaimer(e.target.value)}
            maxLength={300}
            placeholder="Selection of 5 star reviews from verified customers."
          />
          <p className="text-xs text-muted-foreground">
            Shown under the TrustScore on homepage &amp; destination pages.
          </p>
        </div>
        <div className="sm:col-span-3">
          <Button
            type="button"
            size="sm"
            disabled={savingDisplay}
            onClick={() =>
              void saveDisplay({
                trustpilotDisplayScore: Number(score) || 0,
                trustpilotDisplayCount: Number.parseInt(count, 10) || 0,
                trustpilotProfileUrl: profileUrl.trim(),
                trustpilotDisclaimer: disclaimer.trim(),
              })
            }
          >
            Save summary
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => void submitForm(e)}
        className="mb-6 space-y-3 rounded-xl border p-4"
      >
        <p className="text-sm font-medium">
          {editingId ? "Edit Trustpilot review" : "Add Trustpilot review"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tp-author">Author name</Label>
            <Input
              id="tp-author"
              value={form.authorName}
              onChange={(e) =>
                setForm((f) => ({ ...f, authorName: e.target.value }))
              }
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Stars</Label>
            <StarPicker
              value={form.rating}
              onChange={(rating) => setForm((f) => ({ ...f, rating }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tp-title">Headline (optional)</Label>
            <Input
              id="tp-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={120}
              placeholder="e.g. Convenient and so simple!"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tp-body">Review text</Label>
            <Textarea
              id="tp-body"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              required
              rows={3}
              maxLength={2000}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp-date">Review date (optional)</Label>
            <Input
              id="tp-date"
              type="date"
              value={form.reviewedAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, reviewedAt: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tp-sort">Sort order</Label>
            <Input
              id="tp-sort"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sortOrder: Number.parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tp-source">Source URL (optional)</Label>
            <Input
              id="tp-source"
              type="url"
              value={form.sourceUrl}
              onChange={(e) =>
                setForm((f) => ({ ...f, sourceUrl: e.target.value }))
              }
              placeholder="https://www.trustpilot.com/reviews/..."
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="tp-published"
              checked={form.published}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, published: v === true }))
              }
            />
            <Label htmlFor="tp-published">Published</Label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={savingForm}>
            {editingId ? (
              <>
                <PencilIcon data-icon="inline-start" />
                Update
              </>
            ) : (
              <>
                <PlusIcon data-icon="inline-start" />
                Add review
              </>
            )}
          </Button>
          {editingId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancelEdit}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : error ? (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Trustpilot reviews pasted yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border bg-muted/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.authorName}</p>
                  {row.title ? (
                    <p className="mt-0.5 text-sm font-semibold">{row.title}</p>
                  ) : null}
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <StarIcon
                          key={i}
                          className={cn(
                            "size-3.5",
                            i < row.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30",
                          )}
                        />
                      ))}
                    </span>
                    {row.reviewedAt ? (
                      <span>{toDateInput(row.reviewedAt)}</span>
                    ) : null}
                    <Badge variant={row.published ? "default" : "secondary"}>
                      {row.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(row)}
                  >
                    Edit
                  </Button>
                  {canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pendingId === row.id}
                      onClick={() => setDeleting(row)}
                    >
                      <Trash2Icon data-icon="inline-start" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{row.body}</p>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && pendingId === null) setDeleting(null)
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Trustpilot review by {deleting?.authorName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the pasted review from the carousel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingId === deleting?.id}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deleting || pendingId === deleting.id}
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelCard>
  )
}
