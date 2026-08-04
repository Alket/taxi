"use client"

import * as React from "react"
import useSWR from "swr"
import {
  CopyIcon,
  ImagePlus,
  ImagesIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { apiDelete, apiPatch, fetcher } from "@/lib/api"
import { isUploadHashLabel, type MediaAssetDto } from "@/lib/media-shared"
import { cn } from "@/lib/utils"

type MediaListResponse = { assets: MediaAssetDto[] }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaLibraryView() {
  const { data, isLoading, mutate } = useSWR<MediaListResponse>(
    "/api/admin/media",
    fetcher,
  )
  const assets = data?.assets ?? []
  const [uploading, setUploading] = React.useState(false)
  const [selected, setSelected] = React.useState<MediaAssetDto | null>(null)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [alt, setAlt] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    if (!selected) return
    setTitle(selected.title)
    setDescription(selected.description)
    setAlt(selected.alt)
  }, [selected])

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: form,
        headers: { "ngrok-skip-browser-warning": "true" },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body.error || "Upload failed")
      }
      toast.success("Image uploaded")
      await mutate()
      if (body.asset) setSelected(body.asset as MediaAssetDto)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function saveMeta() {
    if (!selected) return
    setSaving(true)
    try {
      const data = await apiPatch<{ asset: MediaAssetDto }>(
        `/api/admin/media/${selected.id}`,
        { title, description, alt },
      )
      setSelected(data.asset)
      await mutate()
      toast.success("Media updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function removeAsset() {
    if (!selected) return
    if (!window.confirm("Delete this image from the library and disk?")) return
    setDeleting(true)
    try {
      await apiDelete(`/api/admin/media/${selected.id}`)
      setSelected(null)
      await mutate()
      toast.success("Image deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  async function copyUrl() {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(selected.url)
      toast.success("URL copied")
    } catch {
      toast.error("Could not copy URL")
    }
  }

  return (
    <>
      <PageHeader
        title="Media"
        description="Upload images and set title, description, and alt text for each."
        actions={
          <label
            className={cn(
              "inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground touch-manipulation hover:bg-primary/90 sm:h-8 sm:w-auto",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              className="sr-only"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (!file) return
                await uploadFile(file)
              }}
            />
            <ImagePlus className="size-3.5" />
            {uploading ? "Uploading…" : "Upload image"}
          </label>
        }
      />
      <div className="flex flex-col gap-5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-6 sm:p-4 md:p-6">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
          <ImagesIcon className="size-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">No images yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload JPEG, PNG, WebP, GIF, or SVG files to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelected(asset)}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors",
                "hover:border-primary hover:ring-2 hover:ring-primary/15",
                selected?.id === asset.id &&
                  "border-primary ring-2 ring-primary/20",
              )}
            >
              <div className="relative aspect-square bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.alt || asset.title}
                  className="absolute inset-0 size-full object-cover"
                />
                <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                  <PencilIcon className="size-2.5" />
                  Edit
                </span>
              </div>
              <div className="space-y-0.5 p-2.5">
                <p className="truncate text-xs font-semibold">
                  {asset.title || "Untitled"}
                </p>
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {isUploadHashLabel(
                    asset.filename.replace(/\.[^.]+$/, ""),
                  )
                    ? "Stored with unique file id"
                    : asset.filename}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {asset.alt
                    ? `Alt: ${asset.alt}`
                    : "No alt text yet"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit media</DialogTitle>
            <DialogDescription>
              Title, description, and alt are stored with this image in the
              library.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="flex flex-col gap-4">
              <div className="overflow-hidden rounded-xl border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.url}
                  alt={alt || title}
                  className="mx-auto max-h-48 object-contain"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-title">Title</Label>
                <Input
                  id="media-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Display title"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-alt">Alt text</Label>
                <Input
                  id="media-alt"
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="Describe the image for accessibility"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="media-description">Description</Label>
                <Textarea
                  id="media-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes about this image"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>URL</Label>
                <div className="flex gap-2">
                  <Input value={selected.url} readOnly className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyUrl()}
                    aria-label="Copy URL"
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isUploadHashLabel(selected.filename.replace(/\.[^.]+$/, ""))
                    ? "Unique storage name (original upload name wasn’t kept)"
                    : `File: ${selected.filename}`}
                  {" · "}
                  {formatBytes(selected.sizeBytes)}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || saving}
              onClick={() => void removeAsset()}
            >
              <Trash2Icon data-icon="inline-start" />
              {deleting ? "Deleting…" : "Delete"}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving || deleting}
                onClick={() => void saveMeta()}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  )
}
