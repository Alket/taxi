"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiPut, fetcher } from "@/lib/api"
import type { BlogAuthor } from "@/lib/blog/types"
import type { BlogCatalog, BlogCategoryRecord } from "@/lib/blog/catalog"
import { slugifyCatalogId } from "@/lib/blog/catalog"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: BlogCatalog
  onSaved: (catalog: BlogCatalog) => void
  mode?: "categories" | "authors" | "all"
}

export function BlogCatalogManagerDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
  mode = "all",
}: Props) {
  const [categories, setCategories] = React.useState<BlogCategoryRecord[]>(
    initial.categories,
  )
  const [authors, setAuthors] = React.useState<BlogAuthor[]>(initial.authors)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setCategories(initial.categories)
    setAuthors(initial.authors)
  }, [open, initial])

  const showCategories = mode === "all" || mode === "categories"
  const showAuthors = mode === "all" || mode === "authors"

  async function save() {
    setSaving(true)
    try {
      const res = await apiPut<{ catalog: BlogCatalog }>(
        "/api/admin/blog-catalog",
        { categories, authors },
      )
      onSaved(res.catalog)
      toast.success("Blog categories & authors saved")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "categories"
              ? "Manage categories"
              : mode === "authors"
                ? "Manage authors"
                : "Blog categories & authors"}
          </DialogTitle>
          <DialogDescription>
            Changes apply to all blog posts and the public filter chips.
            Categories or authors still used by a post cannot be deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 py-2">
          {showCategories ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Categories</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCategories((prev) => [
                      ...prev,
                      { id: "", label: "New category" },
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
              {categories.map((cat, index) => (
                <div
                  key={`${cat.id}-${index}`}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      Label
                    </Label>
                    <Input
                      value={cat.label}
                      onChange={(e) => {
                        const label = e.target.value
                        setCategories((prev) =>
                          prev.map((c, i) =>
                            i === index
                              ? {
                                  ...c,
                                  label,
                                  id: c.id || slugifyCatalogId(label),
                                }
                              : c,
                          ),
                        )
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      Id (URL)
                    </Label>
                    <Input
                      value={cat.id}
                      placeholder="airport-transport"
                      onChange={(e) => {
                        const id = slugifyCatalogId(e.target.value)
                        setCategories((prev) =>
                          prev.map((c, i) =>
                            i === index ? { ...c, id } : c,
                          ),
                        )
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      disabled={categories.length <= 1}
                      onClick={() =>
                        setCategories((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {showAuthors ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Authors</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAuthors((prev) => [
                      ...prev,
                      {
                        id: "",
                        name: "New author",
                        role: "",
                        bio: "",
                        avatar: {
                          src: "/marketing/logo.svg",
                          alt: "Author",
                          width: 207,
                          height: 150,
                        },
                      },
                    ])
                  }
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
              {authors.map((author, index) => (
                <div
                  key={`${author.id}-${index}`}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Name
                      </Label>
                      <Input
                        value={author.name}
                        onChange={(e) => {
                          const name = e.target.value
                          setAuthors((prev) =>
                            prev.map((a, i) =>
                              i === index
                                ? {
                                    ...a,
                                    name,
                                    id: a.id || slugifyCatalogId(name),
                                    avatar: {
                                      ...a.avatar,
                                      alt: a.avatar.alt || name,
                                    },
                                  }
                                : a,
                            ),
                          )
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs text-muted-foreground">
                        Id
                      </Label>
                      <Input
                        value={author.id}
                        onChange={(e) => {
                          const id = slugifyCatalogId(e.target.value)
                          setAuthors((prev) =>
                            prev.map((a, i) =>
                              i === index ? { ...a, id } : a,
                            ),
                          )
                        }}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={authors.length <= 1}
                        onClick={() =>
                          setAuthors((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <Input
                      value={author.role}
                      onChange={(e) =>
                        setAuthors((prev) =>
                          prev.map((a, i) =>
                            i === index
                              ? { ...a, role: e.target.value }
                              : a,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Bio</Label>
                    <Textarea
                      rows={3}
                      value={author.bio}
                      onChange={(e) =>
                        setAuthors((prev) =>
                          prev.map((a, i) =>
                            i === index
                              ? { ...a, bio: e.target.value }
                              : a,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                      Avatar URL
                    </Label>
                    <Input
                      value={author.avatar.src}
                      onChange={(e) =>
                        setAuthors((prev) =>
                          prev.map((a, i) =>
                            i === index
                              ? {
                                  ...a,
                                  avatar: {
                                    ...a.avatar,
                                    src: e.target.value,
                                  },
                                }
                              : a,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Load catalog once for admin editor selects. */
export function useBlogCatalog() {
  const [catalog, setCatalog] = React.useState<BlogCatalog | null>(null)
  const [loading, setLoading] = React.useState(true)

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetcher<{ catalog: BlogCatalog }>(
        "/api/admin/blog-catalog",
      )
      setCatalog(data.catalog)
    } catch {
      setCatalog(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload])

  return { catalog, loading, setCatalog, reload }
}