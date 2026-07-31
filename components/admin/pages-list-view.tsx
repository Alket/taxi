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
    <div className="flex flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit marketing copy, images, FAQs, and SEO for each site page.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-3.5" />
          Add destination
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Page</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                SEO title
              </th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Status
              </th>
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
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {page.title}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={
                          <Link
                            href={page.path}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <ExternalLink className="size-3.5" />
                        <span className="sr-only">View</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/admin/pages/${page.slug}`} />}
                      >
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                      {page.canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() =>
                            setPendingAction({ page, mode: "delete" })
                          }
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </Button>
                      ) : null}
                      {page.canReset ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingAction({ page, mode: "reset" })
                          }
                        >
                          <RotateCcw className="size-3.5" />
                          Reset
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
    </div>
  )
}
