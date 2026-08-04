"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { apiDelete, apiPost, fetcher } from "@/lib/api"
import { slugifyDestinationId } from "@/lib/destinations"
import { PageHeader } from "@/components/admin/page-header"

type AdminPageRow = {
  slug: string
  label: string
  path: string
  title: string
  updatedAt: string | null
  fromDatabase: boolean
  canDelete: boolean
  canReset: boolean
  isCustomDestination: boolean
}

function PageRowActions({
  page,
  layout,
  onDelete,
  onReset,
}: {
  page: AdminPageRow
  layout: "mobile" | "desktop"
  onDelete: () => void
  onReset: () => void
}) {
  const isMobile = layout === "mobile"
  return (
    <div
      className={
        isMobile
          ? "grid grid-cols-2 gap-2"
          : "flex flex-wrap items-center justify-end gap-1"
      }
    >
      <Button
        variant="outline"
        size="sm"
        className={
          isMobile ? "h-10 touch-manipulation justify-center" : undefined
        }
        nativeButton={false}
        render={<Link href={`/admin/pages/${page.slug}`} />}
      >
        <Pencil className="size-3.5" />
        Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={
          isMobile ? "h-10 touch-manipulation justify-center" : undefined
        }
        nativeButton={false}
        render={<Link href={page.path} target="_blank" rel="noreferrer" />}
      >
        <ExternalLink className="size-3.5" />
        View
      </Button>
      {page.canReset ? (
        <Button
          variant="outline"
          size="sm"
          className={
            isMobile ? "h-10 touch-manipulation justify-center" : undefined
          }
          onClick={onReset}
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      ) : null}
      {page.canDelete ? (
        <Button
          variant="outline"
          size="sm"
          className={
            isMobile
              ? "h-10 touch-manipulation justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
              : "text-destructive hover:bg-destructive/10 hover:text-destructive"
          }
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      ) : null}
    </div>
  )
}

export function PagesListView() {
  const router = useRouter()
  const { data, isLoading, mutate } = useSWR<{ pages: AdminPageRow[] }>(
    "/api/admin/pages",
    fetcher,
  )
  const pages = data?.pages ?? []

  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState("")
  const [id, setId] = React.useState("")
  const [idTouched, setIdTouched] = React.useState(false)
  const [region, setRegion] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [badge, setBadge] = React.useState("New")
  const [priceFrom, setPriceFrom] = React.useState("€—")

  const [pendingAction, setPendingAction] = React.useState<{
    page: AdminPageRow
    mode: "delete" | "reset"
  } | null>(null)
  const [acting, setActing] = React.useState(false)

  function resetCreateForm() {
    setName("")
    setId("")
    setIdTouched(false)
    setRegion("")
    setDescription("")
    setBadge("New")
    setPriceFrom("€—")
  }

  async function createDestination() {
    setCreating(true)
    try {
      const res = await apiPost<{ page: { slug: string } }>("/api/admin/pages", {
        name,
        id: id.trim() || undefined,
        region: region.trim() || undefined,
        description: description.trim() || undefined,
        badge: badge.trim() || undefined,
        priceFrom: priceFrom.trim() || undefined,
      })
      toast.success("Destination page created.")
      setCreateOpen(false)
      resetCreateForm()
      await mutate()
      router.push(`/admin/pages/${res.page.slug}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  async function confirmAction() {
    if (!pendingAction) return
    setActing(true)
    try {
      const res = await apiDelete<{ mode: "deleted" | "reset" }>(
        `/api/admin/pages/${pendingAction.page.slug}`,
      )
      toast.success(
        res.mode === "deleted"
          ? "Destination deleted."
          : "Page reset to defaults.",
      )
      setPendingAction(null)
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setActing(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Pages"
        description="Edit marketing copy, images, FAQs, and SEO for each site page."
        actions={
          <Button
            size="sm"
            className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />
            Add destination
          </Button>
        }
      />
      <div className="flex flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
        {/* Mobile cards */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))
            : null}
          {!isLoading && pages.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No pages found.
            </div>
          ) : null}
          {!isLoading
            ? pages.map((page) => (
                <div
                  key={page.slug}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[15px] font-semibold">
                          {page.label}
                        </p>
                        <span
                          className={
                            page.fromDatabase
                              ? "shrink-0 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                              : "shrink-0 text-[11px] text-muted-foreground"
                          }
                        >
                          {page.fromDatabase ? "Customized" : "Defaults"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {page.path}
                        {page.isCustomDestination ? " · custom" : null}
                      </p>
                      {page.title ? (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                          {page.title}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <PageRowActions
                    page={page}
                    layout="mobile"
                    onDelete={() =>
                      setPendingAction({ page, mode: "delete" })
                    }
                    onReset={() => setPendingAction({ page, mode: "reset" })}
                  />
                </div>
              ))
            : null}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Page</th>
                <th className="px-4 py-3 font-medium">SEO title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-3" colSpan={4}>
                      <Skeleton className="h-5 w-full max-w-md" />
                    </td>
                  </tr>
                ))}
              {!isLoading &&
                pages.map((page) => (
                  <tr
                    key={page.slug}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{page.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {page.path}
                            {page.isCustomDestination ? " · custom" : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {page.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          page.fromDatabase
                            ? "text-xs font-medium text-emerald-700 dark:text-emerald-400"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        {page.fromDatabase ? "Customized" : "Defaults"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PageRowActions
                        page={page}
                        layout="desktop"
                        onDelete={() =>
                          setPendingAction({ page, mode: "delete" })
                        }
                        onReset={() =>
                          setPendingAction({ page, mode: "reset" })
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add destination</DialogTitle>
            <DialogDescription>
              Creates a new destination page for the site carousel and
              /destinations/[slug].
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dest-name">Name</Label>
              <Input
                id="dest-name"
                value={name}
                placeholder="Gjirokastër Old Town"
                onChange={(e) => {
                  const next = e.target.value
                  setName(next)
                  if (!idTouched) setId(slugifyDestinationId(next))
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dest-id">URL slug</Label>
              <Input
                id="dest-id"
                value={id}
                placeholder="gjirokaster"
                className="font-mono text-sm"
                onChange={(e) => {
                  setIdTouched(true)
                  setId(slugifyDestinationId(e.target.value))
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Public URL: /destinations/{id || "…"}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dest-region">Region</Label>
                <Input
                  id="dest-region"
                  value={region}
                  placeholder="Southern Albania"
                  onChange={(e) => setRegion(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dest-badge">Badge</Label>
                <Input
                  id="dest-badge"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dest-price">Price from</Label>
              <Input
                id="dest-price"
                value={priceFrom}
                placeholder="€40"
                onChange={(e) => setPriceFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dest-desc">Short description</Label>
              <Textarea
                id="dest-desc"
                rows={3}
                value={description}
                placeholder="Optional intro for the card and page."
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={creating || !name.trim()}
              onClick={() => void createDestination()}
            >
              {creating ? "Creating…" : "Create destination"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.mode === "delete"
                ? "Delete destination?"
                : "Reset page to defaults?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.mode === "delete"
                ? `“${pendingAction.page.label}” will be removed from the site and this list. You can add it again later if needed.`
                : `Custom edits for “${pendingAction?.page.label}” will be cleared and the built-in defaults restored.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={acting}
              variant={
                pendingAction?.mode === "delete" ? "destructive" : "default"
              }
              onClick={(e) => {
                e.preventDefault()
                void confirmAction()
              }}
            >
              {acting
                ? "Working…"
                : pendingAction?.mode === "delete"
                  ? "Delete"
                  : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
