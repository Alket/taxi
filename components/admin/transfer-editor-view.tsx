"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FolderOpen,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"

import { MediaPickerDialog } from "@/components/admin/media-picker-dialog"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { apiDelete, apiPut, fetcher } from "@/lib/api"
import type { TransferRouteSeed } from "@/lib/transfers/routes"

type AdminTransferPayload = {
  seed: TransferRouteSeed
  fromDatabase: boolean
  isBuiltIn: boolean
  livePriceEur: number | null
  updatedAt: string | null
}

function emptyComparison() {
  return {
    mode: "",
    typicalTime: "",
    changes: "",
    priceClarity: "",
    highlight: false as boolean | undefined,
  }
}

export function TransferEditorView({ slug }: { slug: string }) {
  const router = useRouter()
  const { data, isLoading, mutate, error } = useSWR<{
    transfer: AdminTransferPayload
  }>(`/api/admin/transfers/${slug}`, fetcher)

  const [seed, setSeed] = React.useState<TransferRouteSeed | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [mediaOpen, setMediaOpen] = React.useState(false)
  const [confirm, setConfirm] = React.useState<"reset" | "delete" | null>(null)
  const [acting, setActing] = React.useState(false)

  React.useEffect(() => {
    if (data?.transfer.seed) setSeed(data.transfer.seed)
  }, [data])

  function patch(partial: Partial<TransferRouteSeed>) {
    setSeed((prev) => (prev ? { ...prev, ...partial } : prev))
  }

  async function handleSave() {
    if (!seed) return
    setSaving(true)
    try {
      await apiPut(`/api/admin/transfers/${slug}`, { seed })
      toast.success("Transfer saved")
      await mutate()
    } catch (err) {
      toast.error((err as Error).message || "Could not save")
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    if (!confirm) return
    setActing(true)
    try {
      const res = await apiDelete<{ mode: "deleted" | "reset" }>(
        `/api/admin/transfers/${slug}`,
      )
      toast.success(
        res.mode === "reset" ? "Reset to code defaults" : "Transfer deleted",
      )
      setConfirm(null)
      if (res.mode === "deleted") {
        router.push("/admin/transfers")
        return
      }
      await mutate()
    } catch (err) {
      toast.error((err as Error).message || "Action failed")
    } finally {
      setActing(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Transfer" />
        <p className="p-6 text-sm text-destructive">
          {(error as Error).message || "Transfer not found."}
        </p>
      </div>
    )
  }

  if (isLoading || !seed || !data) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Transfer" />
        <div className="flex flex-col gap-3 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  const meta = data.transfer

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={seed.destinationName || slug}
        description={`/transfers/${slug}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <Link
                  href={`/transfers/${slug}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink className="size-3.5" />
              View
            </Button>
            {meta.isBuiltIn && meta.fromDatabase ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirm("reset")}
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            ) : null}
            {!meta.isBuiltIn ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setConfirm("delete")}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            ) : null}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-3 pb-16 sm:p-4 md:p-6">
        <p className="text-xs text-muted-foreground">
          {meta.fromDatabase
            ? meta.isBuiltIn
              ? "Editing CMS override of a built-in seed."
              : "Custom CMS transfer."
            : "Editing built-in seed — Save writes a CMS override."}
          {meta.livePriceEur != null
            ? ` Live sedan fare: €${meta.livePriceEur}.`
            : " No live zone fare (catalog used on site)."}
        </p>

        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Basics</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">
                Destination name
              </Label>
              <Input
                value={seed.destinationName}
                onChange={(e) => patch({ destinationName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">
                Name variants (comma-separated)
              </Label>
              <Input
                value={seed.nameVariants.join(", ")}
                onChange={(e) =>
                  patch({
                    nameVariants: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Saranda"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Origin</Label>
              <Input
                value={seed.origin}
                onChange={(e) => patch({ origin: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Zone name (pricing)
              </Label>
              <Input
                value={seed.zoneName}
                onChange={(e) => patch({ zoneName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Destination id
              </Label>
              <Input
                value={seed.destinationId}
                onChange={(e) => patch({ destinationId: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Distance (km)
              </Label>
              <Input
                type="number"
                value={seed.distanceKm}
                onChange={(e) =>
                  patch({ distanceKm: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Catalog price (€)
              </Label>
              <Input
                type="number"
                value={seed.catalogPriceEur}
                onChange={(e) =>
                  patch({ catalogPriceEur: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Duration label
              </Label>
              <Input
                value={seed.duration.label}
                onChange={(e) =>
                  patch({
                    duration: { ...seed.duration, label: e.target.value },
                  })
                }
                placeholder="3.5–4 hrs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Min minutes
              </Label>
              <Input
                type="number"
                value={seed.duration.minMinutes}
                onChange={(e) =>
                  patch({
                    duration: {
                      ...seed.duration,
                      minMinutes: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Max minutes
              </Label>
              <Input
                type="number"
                value={seed.duration.maxMinutes}
                onChange={(e) =>
                  patch({
                    duration: {
                      ...seed.duration,
                      maxMinutes: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">
                Related slugs (comma-separated)
              </Label>
              <Input
                value={seed.relatedSlugs.join(", ")}
                onChange={(e) =>
                  patch({
                    relatedSlugs: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Hero image</Label>
              <div className="flex gap-2">
                <Input
                  value={seed.heroImageUrl}
                  onChange={(e) => patch({ heroImageUrl: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMediaOpen(true)}
                >
                  <FolderOpen className="size-3.5" />
                  Library
                </Button>
              </div>
              {seed.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={seed.heroImageUrl}
                  alt=""
                  className="mt-2 max-h-40 rounded-lg object-cover"
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">
                Travel description
              </Label>
              <Textarea
                rows={5}
                value={seed.travelDescription}
                onChange={(e) => patch({ travelDescription: e.target.value })}
              />
            </div>
          </div>
        </section>

        <RepeatableSection
          title="Comparison table"
          onAdd={() =>
            patch({
              comparisonTable: [...seed.comparisonTable, emptyComparison()],
            })
          }
        >
          {seed.comparisonTable.map((row, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Row {index + 1}
                </span>
                <RowControls
                  index={index}
                  length={seed.comparisonTable.length}
                  onMove={(from, to) => {
                    const next = [...seed.comparisonTable]
                    const [item] = next.splice(from, 1)
                    next.splice(to, 0, item)
                    patch({ comparisonTable: next })
                  }}
                  onRemove={() =>
                    patch({
                      comparisonTable: seed.comparisonTable.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Mode"
                  value={row.mode}
                  onChange={(e) => {
                    const next = [...seed.comparisonTable]
                    next[index] = { ...row, mode: e.target.value }
                    patch({ comparisonTable: next })
                  }}
                />
                <Input
                  placeholder="Typical time"
                  value={row.typicalTime}
                  onChange={(e) => {
                    const next = [...seed.comparisonTable]
                    next[index] = { ...row, typicalTime: e.target.value }
                    patch({ comparisonTable: next })
                  }}
                />
                <Input
                  placeholder="Changes"
                  value={row.changes}
                  onChange={(e) => {
                    const next = [...seed.comparisonTable]
                    next[index] = { ...row, changes: e.target.value }
                    patch({ comparisonTable: next })
                  }}
                />
                <Input
                  placeholder="Price clarity"
                  value={row.priceClarity}
                  onChange={(e) => {
                    const next = [...seed.comparisonTable]
                    next[index] = { ...row, priceClarity: e.target.value }
                    patch({ comparisonTable: next })
                  }}
                />
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(row.highlight)}
                    onChange={(e) => {
                      const next = [...seed.comparisonTable]
                      next[index] = {
                        ...row,
                        highlight: e.target.checked || undefined,
                      }
                      patch({ comparisonTable: next })
                    }}
                  />
                  Highlight this row
                </label>
              </div>
            </div>
          ))}
        </RepeatableSection>

        <RepeatableSection
          title="FAQs"
          onAdd={() =>
            patch({
              routeFaqs: [...seed.routeFaqs, { question: "", answer: "" }],
            })
          }
        >
          {seed.routeFaqs.map((faq, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  FAQ {index + 1}
                </span>
                <RowControls
                  index={index}
                  length={seed.routeFaqs.length}
                  onMove={(from, to) => {
                    const next = [...seed.routeFaqs]
                    const [item] = next.splice(from, 1)
                    next.splice(to, 0, item)
                    patch({ routeFaqs: next })
                  }}
                  onRemove={() =>
                    patch({
                      routeFaqs: seed.routeFaqs.filter((_, i) => i !== index),
                    })
                  }
                />
              </div>
              <Input
                placeholder="Question"
                value={faq.question}
                onChange={(e) => {
                  const next = [...seed.routeFaqs]
                  next[index] = { ...faq, question: e.target.value }
                  patch({ routeFaqs: next })
                }}
              />
              <Textarea
                rows={3}
                placeholder="Answer"
                value={faq.answer}
                onChange={(e) => {
                  const next = [...seed.routeFaqs]
                  next[index] = { ...faq, answer: e.target.value }
                  patch({ routeFaqs: next })
                }}
              />
            </div>
          ))}
        </RepeatableSection>

        <RepeatableSection
          title="Insights"
          onAdd={() =>
            patch({
              insights: [
                ...(seed.insights ?? []),
                { title: "", body: "" },
              ],
            })
          }
        >
          {(seed.insights ?? []).map((insight, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Insight {index + 1}
                </span>
                <RowControls
                  index={index}
                  length={(seed.insights ?? []).length}
                  onMove={(from, to) => {
                    const next = [...(seed.insights ?? [])]
                    const [item] = next.splice(from, 1)
                    next.splice(to, 0, item)
                    patch({ insights: next })
                  }}
                  onRemove={() =>
                    patch({
                      insights: (seed.insights ?? []).filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                />
              </div>
              <Input
                placeholder="Title"
                value={insight.title}
                onChange={(e) => {
                  const next = [...(seed.insights ?? [])]
                  next[index] = { ...insight, title: e.target.value }
                  patch({ insights: next })
                }}
              />
              <Textarea
                rows={3}
                placeholder="Body"
                value={insight.body}
                onChange={(e) => {
                  const next = [...(seed.insights ?? [])]
                  next[index] = { ...insight, body: e.target.value }
                  patch({ insights: next })
                }}
              />
            </div>
          ))}
        </RepeatableSection>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/transfers" />}
          >
            Back
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save transfer"}
          </Button>
        </div>
      </div>

      <MediaPickerDialog
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        onSelect={(asset) => {
          patch({ heroImageUrl: asset.url })
          setMediaOpen(false)
        }}
      />

      <AlertDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "reset"
                ? "Reset to code defaults?"
                : "Delete this transfer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "reset"
                ? "Removes the CMS override. Built-in seed content will return."
                : "Permanently deletes this custom transfer route."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={acting} onClick={handleConfirm}>
              {acting ? "Working…" : confirm === "reset" ? "Reset" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RepeatableSection({
  title,
  onAdd,
  children,
}: {
  title: string
  onAdd: () => void
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function RowControls({
  index,
  length,
  onMove,
  onRemove,
}: {
  index: number
  length: number
  onMove: (from: number, to: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={index >= length - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
