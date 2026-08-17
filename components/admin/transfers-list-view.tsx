"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import type { AdminTransferListItem } from "@/lib/transfers/cms"

function slugifyTransfer(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return base ? `tirana-airport-to-${base}` : ""
}

export function TransfersListView() {
  const router = useRouter()
  const { data, isLoading, mutate } = useSWR<{
    transfers: AdminTransferListItem[]
  }>("/api/admin/transfers", fetcher)
  const transfers = data?.transfers ?? []

  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [destinationName, setDestinationName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [zoneName, setZoneName] = React.useState("")
  const [destinationId, setDestinationId] = React.useState("")

  const [pending, setPending] = React.useState<{
    item: AdminTransferListItem
    mode: "delete" | "reset"
  } | null>(null)
  const [acting, setActing] = React.useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await apiPost<{ seed: { slug: string } }>(
        "/api/admin/transfers",
        {
          destinationName: destinationName.trim(),
          slug: slug.trim() || undefined,
          zoneName: zoneName.trim() || undefined,
          destinationId: destinationId.trim() || undefined,
        },
      )
      toast.success("Transfer created")
      setCreateOpen(false)
      setDestinationName("")
      setSlug("")
      setSlugTouched(false)
      setZoneName("")
      setDestinationId("")
      await mutate()
      router.push(`/admin/transfers/${res.seed.slug}`)
    } catch (error) {
      toast.error((error as Error).message || "Could not create transfer")
    } finally {
      setCreating(false)
    }
  }

  async function confirmAction() {
    if (!pending) return
    setActing(true)
    try {
      const res = await apiDelete<{ mode: "deleted" | "reset" }>(
        `/api/admin/transfers/${pending.item.slug}`,
      )
      toast.success(
        res.mode === "reset"
          ? "Reset to code defaults"
          : "Transfer deleted",
      )
      setPending(null)
      await mutate()
    } catch (error) {
      toast.error((error as Error).message || "Action failed")
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Transfers"
        description="Airport transfer landing pages (CMS overrides + custom routes)"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New transfer
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transfers yet.</p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Destination</th>
                    <th className="px-4 py-3 font-medium">Zone</th>
                    <th className="px-4 py-3 font-medium">Catalog €</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((item) => (
                    <tr key={item.slug} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.destinationName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.slug}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.zoneName || "—"}
                      </td>
                      <td className="px-4 py-3">€{item.catalogPriceEur}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.fromDatabase
                          ? item.isBuiltIn
                            ? "CMS override"
                            : "Custom"
                          : "Code seed"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={
                              <Link href={`/admin/transfers/${item.slug}`} />
                            }
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            nativeButton={false}
                            render={
                              <Link
                                href={item.path}
                                target="_blank"
                                rel="noreferrer"
                              />
                            }
                          >
                            <ExternalLink className="size-3.5" />
                            View
                          </Button>
                          {item.isBuiltIn && item.fromDatabase ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setPending({ item, mode: "reset" })
                              }
                            >
                              <RotateCcw className="size-3.5" />
                              Reset
                            </Button>
                          ) : null}
                          {!item.isBuiltIn ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() =>
                                setPending({ item, mode: "delete" })
                              }
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {transfers.map((item) => (
                <div
                  key={item.slug}
                  className="flex flex-col gap-3 rounded-xl border p-3"
                >
                  <div>
                    <div className="font-medium">{item.destinationName}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.slug} · {item.zoneName || "no zone"} · €
                      {item.catalogPriceEur}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {item.fromDatabase
                        ? item.isBuiltIn
                          ? "CMS override"
                          : "Custom"
                        : "Code seed"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 touch-manipulation"
                      nativeButton={false}
                      render={
                        <Link href={`/admin/transfers/${item.slug}`} />
                      }
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 touch-manipulation"
                      nativeButton={false}
                      render={
                        <Link
                          href={item.path}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <ExternalLink className="size-3.5" />
                      View
                    </Button>
                    {item.isBuiltIn && item.fromDatabase ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 touch-manipulation"
                        onClick={() => setPending({ item, mode: "reset" })}
                      >
                        <RotateCcw className="size-3.5" />
                        Reset
                      </Button>
                    ) : null}
                    {!item.isBuiltIn ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 touch-manipulation text-destructive"
                        onClick={() => setPending({ item, mode: "delete" })}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New transfer route</DialogTitle>
            <DialogDescription>
              Creates a CMS-backed landing page at /transfers/…
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={handleCreate}>
            <div className="flex flex-col gap-1.5">
              <Label>Destination name</Label>
              <Input
                value={destinationName}
                onChange={(e) => {
                  const v = e.target.value
                  setDestinationName(v)
                  if (!slugTouched) setSlug(slugifyTransfer(v))
                  if (!zoneName) setZoneName(v)
                }}
                placeholder="Sarandë"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>URL slug</Label>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                placeholder="tirana-airport-to-saranda"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Pricing zone name</Label>
                <Input
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Matches Zones in Pricing"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Destination id (optional)</Label>
                <Input
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  placeholder="sarande"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.mode === "reset"
                ? "Reset to code defaults?"
                : "Delete this transfer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.mode === "reset"
                ? `Removes the CMS override for ${pending.item.destinationName}. The built-in seed will show again.`
                : `Permanently deletes ${pending?.item.destinationName} (${pending?.item.slug}).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={acting} onClick={confirmAction}>
              {acting
                ? "Working…"
                : pending?.mode === "reset"
                  ? "Reset"
                  : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
