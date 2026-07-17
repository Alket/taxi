"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react"

import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api"
import type { Driver } from "@/lib/types"
import { useAdminSession } from "@/hooks/use-admin-session"
import { PageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty"
import {
  Dialog,
  DialogClose,
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

export function DriversView() {
  const { canDelete } = useAdminSession()
  const { data, isLoading, mutate } = useSWR<{ drivers: Driver[] }>(
    "/api/admin/drivers",
    fetcher,
  )
  const drivers = data?.drivers ?? []
  const [editing, setEditing] = React.useState<Driver | null>(null)
  const [deleting, setDeleting] = React.useState<Driver | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)

  async function toggle(
    driver: Driver,
    field: "active" | "vetted",
    value: boolean,
  ) {
    mutate(
      {
        drivers: drivers.map((d) =>
          d.id === driver.id ? { ...d, [field]: value } : d,
        ),
      },
      false,
    )
    try {
      await apiPatch(`/api/admin/drivers/${driver.id}`, { [field]: value })
      toast.success(
        `${driver.name} ${field === "active" ? (value ? "activated" : "deactivated") : value ? "marked as vetted" : "marked as unvetted"}.`,
      )
      mutate()
    } catch (err) {
      toast.error((err as Error).message)
      mutate()
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeletePending(true)
    try {
      await apiDelete(`/api/admin/drivers/${deleting.id}`)
      toast.success(`${deleting.name} removed from the fleet.`)
      setDeleting(null)
      mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Drivers"
        description="Manage your fleet and driver availability"
        actions={<DriverFormDialog mode="create" onSaved={() => mutate()} />}
      />
      <div className="flex flex-col gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        {/* Mobile cards */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))
          ) : drivers.length > 0 ? (
            drivers.map((d) => (
              <div
                key={d.id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{d.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.phone}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm tabular-nums">
                    <StarIcon className="size-3.5 fill-warning text-warning" />
                    {d.avgRating > 0 ? d.avgRating.toFixed(1) : "New"}
                  </span>
                </div>

                <div className="text-sm">
                  <p className="font-medium">
                    {d.vehicleMake} {d.vehicleModel}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {d.plateNumber || "No plate"}
                  </p>
                </div>

                {d.languages.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {d.languages.map((l) => (
                      <Badge key={l} variant="secondary" className="font-normal">
                        {l}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
                  <label className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Vetted</span>
                    <Switch
                      checked={d.vetted}
                      onCheckedChange={(v) => toggle(d, "vetted", v)}
                      aria-label={`Toggle vetted for ${d.name}`}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">Active</span>
                    <Switch
                      checked={d.active}
                      onCheckedChange={(v) => toggle(d, "active", v)}
                      aria-label={`Toggle active for ${d.name}`}
                    />
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-10 flex-1 touch-manipulation"
                    onClick={() => setEditing(d)}
                  >
                    <PencilIcon data-icon="inline-start" />
                    Edit
                  </Button>
                  {canDelete ? (
                    <Button
                      variant="outline"
                      className="h-10 touch-manipulation text-destructive hover:text-destructive"
                      onClick={() => setDeleting(d)}
                      aria-label={`Delete ${d.name}`}
                    >
                      <Trash2Icon />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border bg-card py-10">
              <Empty>
                <EmptyTitle>No drivers yet</EmptyTitle>
                <EmptyDescription>
                  Add your first driver to start assigning trips.
                </EmptyDescription>
              </Empty>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="text-center">Vetted</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="pl-4">
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : drivers.length > 0 ? (
                drivers.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="pl-4">
                      <div className="flex flex-col">
                        <span className="font-medium">{d.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {d.phone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {d.vehicleMake} {d.vehicleModel}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {d.plateNumber || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {d.languages.length > 0 ? (
                          d.languages.map((l) => (
                            <Badge
                              key={l}
                              variant="secondary"
                              className="font-normal"
                            >
                              {l}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm tabular-nums">
                        <StarIcon className="size-3.5 fill-warning text-warning" />
                        {d.avgRating > 0 ? d.avgRating.toFixed(1) : "New"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={d.vetted}
                        onCheckedChange={(v) => toggle(d, "vetted", v)}
                        aria-label={`Toggle vetted for ${d.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={d.active}
                        onCheckedChange={(v) => toggle(d, "active", v)}
                        aria-label={`Toggle active for ${d.name}`}
                      />
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setEditing(d)}
                          aria-label={`Edit ${d.name}`}
                        >
                          <PencilIcon />
                        </Button>
                        {canDelete ? (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleting(d)}
                            aria-label={`Delete ${d.name}`}
                          >
                            <Trash2Icon />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <Empty className="py-12">
                      <EmptyTitle>No drivers yet</EmptyTitle>
                      <EmptyDescription>
                        Add your first driver to start assigning trips.
                      </EmptyDescription>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DriverFormDialog
        mode="edit"
        driver={editing}
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null)
          mutate()
        }}
      />

      <AlertDialog
        open={deleting != null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete driver?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove{" "}
              <span className="font-medium text-foreground">
                {deleting?.name}
              </span>{" "}
              from the fleet. Drivers with active bookings cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep driver</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={() => void confirmDelete()}
            >
              {deletePending ? "Deleting…" : "Delete driver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const EMPTY_FORM = {
  name: "",
  phone: "",
  whatsappNumber: "",
  vehicleMake: "",
  vehicleModel: "",
  plateNumber: "",
}

function DriverFormDialog({
  mode,
  driver,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: {
  mode: "create" | "edit"
  driver?: Driver | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved: () => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const [form, setForm] = React.useState({ ...EMPTY_FORM })
  const [languages, setLanguages] = React.useState<string[]>([])
  const [langInput, setLangInput] = React.useState("")
  const [pin, setPin] = React.useState("")
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (mode === "edit" && driver) {
      setForm({
        name: driver.name,
        phone: driver.phone,
        whatsappNumber: driver.whatsappNumber,
        vehicleMake: driver.vehicleMake,
        vehicleModel: driver.vehicleModel,
        plateNumber: driver.plateNumber,
      })
      setLanguages(driver.languages)
    } else {
      setForm({ ...EMPTY_FORM })
      setLanguages([])
    }
    setLangInput("")
    setPin("")
  }, [open, mode, driver])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addLanguage(raw: string) {
    const value = raw.trim().replace(/,$/, "").trim()
    if (!value) return
    if (!languages.some((l) => l.toLowerCase() === value.toLowerCase())) {
      setLanguages((prev) => [...prev, value])
    }
    setLangInput("")
  }

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required.")
      return
    }
    if (pin && pin.trim().length < 4) {
      toast.error("Dashboard PIN must be at least 4 characters.")
      return
    }
    setPending(true)
    try {
      const payload = {
        ...form,
        languages,
        ...(pin.trim() ? { pin: pin.trim() } : {}),
      }
      if (mode === "edit" && driver) {
        await apiPatch(`/api/admin/drivers/${driver.id}`, payload)
        toast.success(`${form.name} updated.`)
      } else {
        await apiPost("/api/admin/drivers", payload)
        toast.success(`${form.name} added to the fleet.`)
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {mode === "create" && (
        <Button
          className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
          onClick={() => setOpen(true)}
        >
          <PlusIcon data-icon="inline-start" />
          Add driver
        </Button>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit driver" : "Add driver"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update driver contact and vehicle details."
              : "Register a new driver. They start active and unvetted."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Full name" required>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Marco Rossi"
              />
            </FormField>
            <FormField label="Phone" required>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+39 320 111 2233"
              />
            </FormField>
          </div>
          <FormField label="WhatsApp number">
            <Input
              value={form.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value)}
              placeholder="Defaults to phone number"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Vehicle make">
              <Input
                value={form.vehicleMake}
                onChange={(e) => set("vehicleMake", e.target.value)}
                placeholder="Mercedes-Benz"
              />
            </FormField>
            <FormField label="Vehicle model">
              <Input
                value={form.vehicleModel}
                onChange={(e) => set("vehicleModel", e.target.value)}
                placeholder="E-Class"
              />
            </FormField>
          </div>
          <FormField label="Plate number">
            <Input
              value={form.plateNumber}
              onChange={(e) => set("plateNumber", e.target.value)}
              placeholder="MI 442 KJ"
            />
          </FormField>
          <FormField
            label="Dashboard PIN"
            hint={
              mode === "edit" && driver?.pinSet
                ? "PIN is set. Leave blank to keep it, or enter a new one."
                : "Drivers use phone + this PIN at /driver/login (min 4 chars)."
            }
          >
            <Input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={
                mode === "edit" && driver?.pinSet
                  ? "•••• (saved)"
                  : "e.g. 4821"
              }
              autoComplete="off"
              inputMode="numeric"
            />
          </FormField>
          <FormField label="Languages">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input p-1.5">
              {languages.map((l) => (
                <Badge key={l} variant="secondary" className="gap-1 font-normal">
                  {l}
                  <button
                    type="button"
                    onClick={() =>
                      setLanguages((prev) => prev.filter((x) => x !== l))
                    }
                    className="rounded-full opacity-60 hover:opacity-100"
                    aria-label={`Remove ${l}`}
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addLanguage(langInput)
                  } else if (e.key === "Backspace" && !langInput) {
                    setLanguages((prev) => prev.slice(0, -1))
                  }
                }}
                onBlur={() => addLanguage(langInput)}
                placeholder={
                  languages.length ? "Add another…" : "e.g. Italian, English"
                }
                className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </FormField>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? mode === "edit"
                ? "Saving…"
                : "Adding…"
              : mode === "edit"
                ? "Save changes"
                : "Add driver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
