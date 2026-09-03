"use client"

import {
  ArrowDown,
  ArrowUp,
  FolderOpen,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type {
  DestinationAttractionItem,
  DestinationDocument,
  DestinationFaqItem,
  DestinationMeta,
  DestinationSection,
} from "@/lib/destination-document"

function newId() {
  return globalThis.crypto.randomUUID()
}

type Props = {
  document: DestinationDocument
  onChange: (next: DestinationDocument) => void
  onOpenLibrary: (sectionId: string, kind: "hero" | "attraction") => void
  onUpload: (file: File) => Promise<string | null>
  uploading: boolean
}

function patchMeta(
  doc: DestinationDocument,
  patch: Partial<DestinationMeta>,
): DestinationDocument {
  return { ...doc, meta: { ...doc.meta, ...patch } }
}

function patchSection(
  doc: DestinationDocument,
  sectionId: string,
  next: DestinationSection,
): DestinationDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => (s.id === sectionId ? next : s)),
  }
}

export function DestinationDocumentEditor({
  document: doc,
  onChange,
  onOpenLibrary,
  onUpload,
  uploading,
}: Props) {
  const meta = doc.meta

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5">
        <div>
          <h2 className="text-sm font-semibold">Destination settings</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            SEO and card fields. Public URL uses the slug below.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={meta.title}
              onChange={(e) =>
                onChange(patchMeta(doc, { title: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              rows={3}
              value={meta.description}
              onChange={(e) =>
                onChange(patchMeta(doc, { description: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Public slug</Label>
            <Input
              value={meta.slug}
              onChange={(e) =>
                onChange(patchMeta(doc, { slug: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Region</Label>
            <Input
              value={meta.region}
              onChange={(e) =>
                onChange(patchMeta(doc, { region: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Badge</Label>
            <Input
              value={meta.badge}
              onChange={(e) =>
                onChange(patchMeta(doc, { badge: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Price from</Label>
            <Input
              value={meta.priceFrom}
              onChange={(e) =>
                onChange(patchMeta(doc, { priceFrom: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Input
              value={meta.priceCurrency}
              onChange={(e) =>
                onChange(patchMeta(doc, { priceCurrency: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Travel time</Label>
            <Input
              value={meta.travelTime}
              onChange={(e) =>
                onChange(patchMeta(doc, { travelTime: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Distance (km)
            </Label>
            <Input
              type="number"
              value={meta.distanceKm ?? ""}
              onChange={(e) => {
                const raw = e.target.value.trim()
                onChange(
                  patchMeta(doc, {
                    distanceKm: raw === "" ? null : Number(raw),
                  }),
                )
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Primary keyword
            </Label>
            <Input
              value={meta.primaryKeyword}
              onChange={(e) =>
                onChange(patchMeta(doc, { primaryKeyword: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Canonical URL (optional)
            </Label>
            <Input
              value={meta.canonicalUrl}
              placeholder="/destinations/…"
              onChange={(e) =>
                onChange(patchMeta(doc, { canonicalUrl: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Transfer page slug
            </Label>
            <Input
              value={meta.transferLinkSlug}
              placeholder="tirana-airport-to-saranda"
              onChange={(e) =>
                onChange(
                  patchMeta(doc, { transferLinkSlug: e.target.value.trim() }),
                )
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Public segment for{" "}
              <code className="rounded bg-muted px-1">/transfers/…</code> —
              leave empty to hide the hero transfer link (unless a code
              fallback exists).
            </p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">
              Transfer link text
            </Label>
            <Input
              value={meta.transferLinkAnchor}
              placeholder="book a private transfer from Tirana Airport to…"
              onChange={(e) =>
                onChange(
                  patchMeta(doc, { transferLinkAnchor: e.target.value }),
                )
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Shown under the destination hero CTA when both slug and text are
              set. Translate per language; slug stays English-canonical.
            </p>
          </div>
        </div>
      </section>

      {doc.sections.map((section) => {
        if (section.type === "hero") {
          return (
            <section
              key={section.id}
              className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5"
            >
              <h2 className="text-sm font-semibold">Hero</h2>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Heading</Label>
                  <Input
                    value={section.heading}
                    onChange={(e) =>
                      onChange(
                        patchSection(doc, section.id, {
                          ...section,
                          heading: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Body</Label>
                  <Textarea
                    rows={3}
                    value={section.body ?? ""}
                    onChange={(e) =>
                      onChange(
                        patchSection(doc, section.id, {
                          ...section,
                          body: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Image</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Input
                      value={section.src}
                      onChange={(e) =>
                        onChange(
                          patchSection(doc, section.id, {
                            ...section,
                            src: e.target.value,
                          }),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenLibrary(section.id, "hero")}
                    >
                      <FolderOpen className="size-3.5" />
                      Library
                    </Button>
                    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ""
                          if (!file) return
                          const url = await onUpload(file)
                          if (!url) return
                          onChange(
                            patchSection(doc, section.id, {
                              ...section,
                              src: url,
                            }),
                          )
                        }}
                      />
                      <ImagePlus className="size-3.5" />
                      Upload
                    </label>
                  </div>
                  {section.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={section.src}
                      alt={section.alt || section.heading}
                      className="mt-1 h-40 w-full rounded-lg border object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Image alt
                  </Label>
                  <Input
                    value={section.alt}
                    onChange={(e) =>
                      onChange(
                        patchSection(doc, section.id, {
                          ...section,
                          alt: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </div>
            </section>
          )
        }

        if (section.type === "route_details") {
          return (
            <section
              key={section.id}
              className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5"
            >
              <h2 className="text-sm font-semibold">Route details</h2>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Heading</Label>
                  <Input
                    value={section.heading}
                    onChange={(e) =>
                      onChange(
                        patchSection(doc, section.id, {
                          ...section,
                          heading: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Distance</Label>
                  <Input
                    value={section.distance}
                    onChange={(e) =>
                      onChange(
                        patchSection(doc, section.id, {
                          ...section,
                          distance: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <Input
                    value={section.duration}
                    onChange={(e) =>
                      onChange(
                        patchSection(doc, section.id, {
                          ...section,
                          duration: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Why book
                  </Label>
                  <Textarea
                    rows={4}
                    value={section.whyBook}
                    onChange={(e) =>
                      onChange(
                        patchSection(doc, section.id, {
                          ...section,
                          whyBook: e.target.value,
                        }),
                      )
                    }
                  />
                </div>
              </div>
            </section>
          )
        }

        if (section.type === "attractions_grid") {
          return (
            <AttractionsEditor
              key={section.id}
              section={section}
              onChange={(next) => onChange(patchSection(doc, section.id, next))}
              onOpenLibrary={(itemId) => onOpenLibrary(itemId, "attraction")}
              onUpload={onUpload}
              uploading={uploading}
            />
          )
        }

        if (section.type === "more_destinations") {
          return (
            <section
              key={section.id}
              className="flex flex-col gap-4 rounded-xl border bg-card p-4 md:p-5"
            >
              <h2 className="text-sm font-semibold">More destinations</h2>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Heading</Label>
                <Input
                  value={section.heading}
                  onChange={(e) =>
                    onChange(
                      patchSection(doc, section.id, {
                        ...section,
                        heading: e.target.value,
                      }),
                    )
                  }
                />
              </div>
            </section>
          )
        }

        if (section.type === "faq_accordion") {
          return (
            <FaqEditor
              key={section.id}
              section={section}
              onChange={(next) => onChange(patchSection(doc, section.id, next))}
            />
          )
        }

        return null
      })}

      {!doc.sections.some((s) => s.type === "faq_accordion") ? (
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...doc,
              sections: [
                ...doc.sections,
                {
                  id: newId(),
                  type: "faq_accordion",
                  heading: "FAQ",
                  items: [],
                },
              ],
            })
          }
        >
          <Plus className="size-3.5" />
          Add FAQ section
        </Button>
      ) : null}
    </div>
  )
}

function AttractionsEditor({
  section,
  onChange,
  onOpenLibrary,
  onUpload,
  uploading,
}: {
  section: Extract<DestinationSection, { type: "attractions_grid" }>
  onChange: (
    next: Extract<DestinationSection, { type: "attractions_grid" }>,
  ) => void
  onOpenLibrary: (itemId: string) => void
  onUpload: (file: File) => Promise<string | null>
  uploading: boolean
}) {
  function updateItem(index: number, item: DestinationAttractionItem) {
    const items = [...section.items]
    items[index] = item
    onChange({ ...section, items })
  }

  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= section.items.length) return
    const items = [...section.items]
    ;[items[index], items[target]] = [items[target], items[index]]
    onChange({ ...section, items })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Attractions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Places to visit for this destination.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...section,
              items: [
                ...section.items,
                {
                  id: newId(),
                  heading: "",
                  body: "",
                  src: "",
                  alt: "",
                },
              ],
            })
          }
        >
          <Plus className="size-3.5" />
          Add attraction
        </Button>
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
        <Label className="text-xs text-muted-foreground">Section heading</Label>
        <Input
          value={section.heading}
          onChange={(e) => onChange({ ...section, heading: e.target.value })}
        />
      </div>
      {section.items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No attractions yet.
        </p>
      ) : (
        section.items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-xl border bg-card p-4 md:p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                Attraction #{index + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => moveItem(index, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === section.items.length - 1}
                  onClick={() => moveItem(index, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() =>
                    onChange({
                      ...section,
                      items: section.items.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Title</Label>
                <Input
                  value={item.heading}
                  onChange={(e) =>
                    updateItem(index, { ...item, heading: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Description
                </Label>
                <Textarea
                  rows={3}
                  value={item.body}
                  onChange={(e) =>
                    updateItem(index, { ...item, body: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Image</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Input
                    value={item.src}
                    onChange={(e) =>
                      updateItem(index, { ...item, src: e.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenLibrary(item.id)}
                  >
                    <FolderOpen className="size-3.5" />
                    Library
                  </Button>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ""
                        if (!file) return
                        const url = await onUpload(file)
                        if (!url) return
                        updateItem(index, { ...item, src: url })
                      }}
                    />
                    <ImagePlus className="size-3.5" />
                    Upload
                  </label>
                </div>
                {item.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.src}
                    alt={item.alt || item.heading}
                    className="mt-1 h-32 w-full rounded-lg border object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Image alt
                </Label>
                <Input
                  value={item.alt}
                  onChange={(e) =>
                    updateItem(index, { ...item, alt: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  )
}

function FaqEditor({
  section,
  onChange,
}: {
  section: Extract<DestinationSection, { type: "faq_accordion" }>
  onChange: (
    next: Extract<DestinationSection, { type: "faq_accordion" }>,
  ) => void
}) {
  function updateItem(index: number, item: DestinationFaqItem) {
    const items = [...section.items]
    items[index] = item
    onChange({ ...section, items })
  }

  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= section.items.length) return
    const items = [...section.items]
    ;[items[index], items[target]] = [items[target], items[index]]
    onChange({ ...section, items })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">FAQ</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional accordion shown on the destination page.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...section,
              items: [
                ...section.items,
                { id: newId(), question: "", answer: "" },
              ],
            })
          }
        >
          <Plus className="size-3.5" />
          Add FAQ
        </Button>
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
        <Label className="text-xs text-muted-foreground">Section heading</Label>
        <Input
          value={section.heading ?? ""}
          onChange={(e) => onChange({ ...section, heading: e.target.value })}
        />
      </div>
      {section.items.map((item, index) => (
        <div key={item.id} className="rounded-xl border bg-card p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
              FAQ #{index + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === 0}
                onClick={() => moveItem(index, -1)}
              >
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={index === section.items.length - 1}
                onClick={() => moveItem(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                onClick={() =>
                  onChange({
                    ...section,
                    items: section.items.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Question</Label>
              <Input
                value={item.question}
                onChange={(e) =>
                  updateItem(index, { ...item, question: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Answer</Label>
              <Textarea
                rows={3}
                value={item.answer}
                onChange={(e) =>
                  updateItem(index, { ...item, answer: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
