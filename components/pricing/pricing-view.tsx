"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  CheckIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api"
import { VEHICLE_LABELS, formatMoney } from "@/lib/format"
import type { PricingRule, VehicleType, Zone } from "@/lib/types"
import { useAdminSession } from "@/hooks/use-admin-session"
import { PageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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

const VEHICLE_TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[]
const VEHICLE_ITEMS = Object.fromEntries(
  VEHICLE_TYPES.map((v) => [v, VEHICLE_LABELS[v]]),
)

export function PricingView() {
  const { canDelete, isAdmin } = useAdminSession()
  const { data: zoneData, mutate: mutateZones } = useSWR<{ zones: Zone[] }>(
    "/api/admin/zones",
    fetcher,
  )
  const zones = zoneData?.zones ?? []

  const [zoneFilter, setZoneFilter] = React.useState("all")

  const {
    data: ruleData,
    isLoading: rulesLoading,
    mutate: mutateRules,
  } = useSWR<{ rules: PricingRule[] }>(
    `/api/admin/pricing-rules${zoneFilter !== "all" ? `?zoneId=${zoneFilter}` : ""}`,
    fetcher,
  )
  const rules = ruleData?.rules ?? []

  const zoneFilterItems = React.useMemo(() => {
    const map: Record<string, React.ReactNode> = { all: "All zones" }
    for (const z of zones) map[z.id] = z.name
    return map
  }, [zones])

  return (
    <>
      <PageHeader
        title="Pricing"
        description={
          isAdmin
            ? "Configure service zones and fare rules"
            : "View service zones and fare rules"
        }
      />
      <div className="grid grid-cols-1 gap-4 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6 lg:grid-cols-[340px_1fr]">
        <ZonesPanel
          zones={zones}
          selectedZoneId={zoneFilter}
          onSelectZone={setZoneFilter}
          canManage={isAdmin}
          canDelete={canDelete}
          onChanged={() => {
            void mutateZones()
            void mutateRules()
          }}
        />

        <Card className="min-w-0 gap-0 py-0">
          <CardHeader className="flex-col items-stretch gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm">Pricing rules</CardTitle>
              <CardDescription className="text-xs">
                Base fare, per-km rate, and minimum fare per zone
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <Select
                value={zoneFilter}
                onValueChange={(value) => {
                  if (value) setZoneFilter(value)
                }}
                items={zoneFilterItems}
              >
                <SelectTrigger
                  size="default"
                  className="h-10 w-full touch-manipulation sm:h-8 sm:w-[11rem]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All zones</SelectItem>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin ? (
                <AddRuleDialog zones={zones} onCreated={() => mutateRules()} />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile cards */}
            <div className="divide-y md:hidden">
              {rulesLoading ? (
                <div className="flex flex-col gap-3 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : rules.length > 0 ? (
                rules.map((rule) => (
                  <RuleMobileCard
                    key={rule.id}
                    rule={rule}
                    canManage={isAdmin}
                    canDelete={canDelete}
                    onSaved={() => mutateRules()}
                  />
                ))
              ) : (
                <Empty className="py-10">
                  <EmptyTitle>No pricing rules</EmptyTitle>
                  <EmptyDescription>
                    {isAdmin
                      ? "Add a rule to define fares for this zone."
                      : "No fare rules are configured yet."}
                  </EmptyDescription>
                </Empty>
              )}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4">Zone</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Base fare</TableHead>
                    <TableHead className="text-right">Per km</TableHead>
                    <TableHead className="text-right">Min fare</TableHead>
                    {isAdmin ? (
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rulesLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="pl-4">
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rules.length > 0 ? (
                    rules.map((rule) => (
                      <RuleRow
                        key={rule.id}
                        rule={rule}
                        canManage={isAdmin}
                        canDelete={canDelete}
                        onSaved={() => mutateRules()}
                      />
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={isAdmin ? 6 : 5}>
                        <Empty className="py-10">
                          <EmptyTitle>No pricing rules</EmptyTitle>
                          <EmptyDescription>
                            {isAdmin
                              ? "Add a rule to define fares for this zone."
                              : "No fare rules are configured yet."}
                          </EmptyDescription>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ZonesPanel({
  zones,
  selectedZoneId,
  onSelectZone,
  canManage,
  canDelete,
  onChanged,
}: {
  zones: Zone[]
  selectedZoneId: string
  onSelectZone: (zoneId: string) => void
  canManage: boolean
  canDelete: boolean
  onChanged: () => void
}) {
  const [name, setName] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [editing, setEditing] = React.useState<Zone | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editPending, setEditPending] = React.useState(false)
  const [deleteZone, setDeleteZone] = React.useState<Zone | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)

  async function addZone() {
    if (!name.trim()) {
      toast.error("Zone name is required.")
      return
    }
    setPending(true)
    try {
      await apiPost("/api/admin/zones", {
        name: name.trim(),
      })
      toast.success(
        `Zone "${name.trim()}" added with prices for all vehicles. Edit them under pricing rules.`,
      )
      setName("")
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  function startEdit(zone: Zone, event: React.MouseEvent) {
    event.stopPropagation()
    setEditing(zone)
    setEditName(zone.name)
  }

  async function saveEdit() {
    if (!editing) return
    if (!editName.trim()) {
      toast.error("Zone name is required.")
      return
    }
    setEditPending(true)
    try {
      await apiPatch(`/api/admin/zones/${editing.id}`, {
        name: editName.trim(),
      })
      toast.success("Zone updated.")
      setEditing(null)
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setEditPending(false)
    }
  }

  async function confirmDelete() {
    if (!deleteZone) return
    setDeletePending(true)
    try {
      await apiDelete(`/api/admin/zones/${deleteZone.id}`)
      toast.success(`Zone "${deleteZone.name}" deleted.`)
      if (selectedZoneId === deleteZone.id) onSelectZone("all")
      setDeleteZone(null)
      onChanged()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <Card className="h-fit gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="text-sm">Service zones</CardTitle>
        <CardDescription className="text-xs">
          {zones.length} {zones.length === 1 ? "zone" : "zones"} defined
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          <li
            className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
              selectedZoneId === "all" ? "bg-muted/30" : ""
            }`}
            onClick={() => onSelectZone("all")}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <MapPinIcon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">All zones</span>
              <span className="text-xs text-muted-foreground">
                Show pricing for every zone
              </span>
            </div>
          </li>
          {zones.map((z) => (
            <li
              key={z.id}
              className={`flex cursor-pointer items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/40 ${
                selectedZoneId === z.id ? "bg-muted/30" : ""
              }`}
              onClick={() => onSelectZone(z.id)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <MapPinIcon className="size-4" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{z.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {canManage ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={(e) => startEdit(z, e)}
                    aria-label={`Edit ${z.name}`}
                  >
                    <PencilIcon />
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteZone(z)
                    }}
                    aria-label={`Delete ${z.name}`}
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {zones.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No zones yet.
            </li>
          )}
        </ul>
      </CardContent>
      {canManage ? (
        <div className="flex flex-col gap-3 border-t bg-muted/30 p-4">
          <span className="text-xs font-medium text-muted-foreground">
            Add zone
          </span>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Zone name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="City Center"
            />
          </div>
          <Button onClick={addZone} disabled={pending} size="sm">
            <PlusIcon data-icon="inline-start" />
            {pending ? "Adding…" : "Add zone"}
          </Button>
        </div>
      ) : null}

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit zone</DialogTitle>
            <DialogDescription>Update the zone name.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Zone name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={saveEdit} disabled={editPending}>
              {editPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteZone != null}
        onOpenChange={(o) => !o && setDeleteZone(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete zone?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {deleteZone?.name}
              </span>{" "}
              and all of its pricing rules. Existing bookings stay, but lose
              this zone link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep zone</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={() => void confirmDelete()}
            >
              {deletePending ? "Deleting…" : "Delete zone"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function RuleMobileCard({
  rule,
  canManage,
  canDelete,
  onSaved,
}: {
  rule: PricingRule
  canManage: boolean
  canDelete: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)
  const [baseFare, setBaseFare] = React.useState(String(rule.baseFare))
  const [perKmRate, setPerKmRate] = React.useState(String(rule.perKmRate))
  const [minFare, setMinFare] = React.useState(String(rule.minFare))

  function startEdit() {
    setBaseFare(String(rule.baseFare))
    setPerKmRate(String(rule.perKmRate))
    setMinFare(String(rule.minFare))
    setEditing(true)
  }

  async function save() {
    const base = Number(baseFare)
    const perKm = Number(perKmRate)
    const min = Number(minFare)

    if (!(base > 0) || !(perKm > 0) || !(min > 0)) {
      toast.error("Base fare, per km, and min fare must be positive numbers.")
      return
    }

    setPending(true)
    try {
      await apiPatch("/api/admin/pricing-rules", {
        id: rule.id,
        baseFare: base,
        perKmRate: perKm,
        minFare: min,
      })
      toast.success("Pricing rule updated.")
      setEditing(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    setDeletePending(true)
    try {
      await apiDelete("/api/admin/pricing-rules", { id: rule.id })
      toast.success("Pricing rule deleted.")
      setDeleteOpen(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{rule.zoneName}</p>
          <Badge variant="secondary" className="mt-1 font-normal">
            {VEHICLE_LABELS[rule.vehicleType]}
          </Badge>
        </div>
      </div>

      {editing ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">Base</Label>
            <Input
              type="number"
              step="0.01"
              value={baseFare}
              onChange={(e) => setBaseFare(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">Per km</Label>
            <Input
              type="number"
              step="0.01"
              value={perKmRate}
              onChange={(e) => setPerKmRate(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">Min</Label>
            <Input
              type="number"
              step="0.01"
              value={minFare}
              onChange={(e) => setMinFare(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <p className="text-[11px] text-muted-foreground">Base</p>
            <p className="font-medium tabular-nums">
              {formatMoney(rule.baseFare, rule.currency)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <p className="text-[11px] text-muted-foreground">Per km</p>
            <p className="font-medium tabular-nums">
              {formatMoney(rule.perKmRate, rule.currency)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-2 py-2">
            <p className="text-[11px] text-muted-foreground">Min</p>
            <p className="font-medium tabular-nums">
              {formatMoney(rule.minFare, rule.currency)}
            </p>
          </div>
        </div>
      )}

      {canManage || canDelete ? (
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                className="h-10 flex-1 touch-manipulation"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-10 flex-1 touch-manipulation"
                onClick={() => void save()}
                disabled={pending}
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              {canManage ? (
                <Button
                  variant="outline"
                  className="h-10 flex-1 touch-manipulation"
                  onClick={startEdit}
                >
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="outline"
                  className="h-10 touch-manipulation text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Delete rule"
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pricing rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the {VEHICLE_LABELS[rule.vehicleType]} rule for{" "}
              {rule.zoneName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep rule</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
            >
              {deletePending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RuleRow({
  rule,
  canManage,
  canDelete,
  onSaved,
}: {
  rule: PricingRule
  canManage: boolean
  canDelete: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)
  const [baseFare, setBaseFare] = React.useState(String(rule.baseFare))
  const [perKmRate, setPerKmRate] = React.useState(String(rule.perKmRate))
  const [minFare, setMinFare] = React.useState(String(rule.minFare))

  function startEdit() {
    setBaseFare(String(rule.baseFare))
    setPerKmRate(String(rule.perKmRate))
    setMinFare(String(rule.minFare))
    setEditing(true)
  }

  async function save() {
    const base = Number(baseFare)
    const perKm = Number(perKmRate)
    const min = Number(minFare)

    if (!(base > 0) || !(perKm > 0) || !(min > 0)) {
      toast.error("Base fare, per km, and min fare must be positive numbers.")
      return
    }

    setPending(true)
    try {
      await apiPatch("/api/admin/pricing-rules", {
        id: rule.id,
        baseFare: base,
        perKmRate: perKm,
        minFare: min,
      })
      toast.success("Pricing rule updated.")
      setEditing(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    setDeletePending(true)
    try {
      await apiDelete("/api/admin/pricing-rules", { id: rule.id })
      toast.success("Pricing rule deleted.")
      setDeleteOpen(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  if (editing) {
    return (
      <TableRow>
        <TableCell className="pl-4 font-medium">{rule.zoneName}</TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-normal">
            {VEHICLE_LABELS[rule.vehicleType]}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            step="0.01"
            value={baseFare}
            onChange={(e) => setBaseFare(e.target.value)}
            className="ml-auto h-7 w-20 text-right"
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            step="0.01"
            value={perKmRate}
            onChange={(e) => setPerKmRate(e.target.value)}
            className="ml-auto h-7 w-20 text-right"
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            step="0.01"
            value={minFare}
            onChange={(e) => setMinFare(e.target.value)}
            className="ml-auto h-7 w-20 text-right"
          />
        </TableCell>
        <TableCell className="pr-4">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              aria-label="Cancel edit"
            >
              <XIcon />
            </Button>
            <Button
              size="icon-sm"
              onClick={save}
              disabled={pending}
              aria-label="Save changes"
            >
              <CheckIcon />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      <TableRow>
        <TableCell className="pl-4 font-medium">{rule.zoneName}</TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-normal">
            {VEHICLE_LABELS[rule.vehicleType]}
          </Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatMoney(rule.baseFare, rule.currency)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatMoney(rule.perKmRate, rule.currency)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatMoney(rule.minFare, rule.currency)}
        </TableCell>
        {canManage || canDelete ? (
          <TableCell className="pr-4 text-right">
            <div className="flex items-center justify-end gap-0.5">
              {canManage ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={startEdit}
                  aria-label={`Edit ${rule.zoneName} ${rule.vehicleType} rule`}
                >
                  <PencilIcon />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  aria-label={`Delete ${rule.zoneName} ${rule.vehicleType} rule`}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>
          </TableCell>
        ) : null}
      </TableRow>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pricing rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the {VEHICLE_LABELS[rule.vehicleType]} fare for{" "}
              {rule.zoneName}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep rule</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={() => void remove()}
            >
              {deletePending ? "Deleting…" : "Delete rule"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AddRuleDialog({
  zones,
  onCreated,
}: {
  zones: Zone[]
  onCreated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [zoneId, setZoneId] = React.useState("")
  const [vehicleType, setVehicleType] = React.useState<VehicleType>("sedan")
  const [baseFare, setBaseFare] = React.useState("")
  const [perKmRate, setPerKmRate] = React.useState("")
  const [minFare, setMinFare] = React.useState("")
  const [pending, setPending] = React.useState(false)

  const zoneItems = React.useMemo(() => {
    const map: Record<string, React.ReactNode> = {}
    for (const z of zones) map[z.id] = z.name
    return map
  }, [zones])

  function reset() {
    setZoneId("")
    setVehicleType("sedan")
    setBaseFare("")
    setPerKmRate("")
    setMinFare("")
  }

  async function submit() {
    if (!zoneId) {
      toast.error("Please select a zone.")
      return
    }
    const base = Number(baseFare)
    const perKm = Number(perKmRate)
    const min = Number(minFare)
    if (!(base > 0) || !(perKm > 0) || !(min > 0)) {
      toast.error("Base fare, per km, and min fare must be positive numbers.")
      return
    }
    setPending(true)
    try {
      await apiPost("/api/admin/pricing-rules", {
        zoneId,
        vehicleType,
        baseFare: base,
        perKmRate: perKm,
        minFare: min,
      })
      toast.success("Pricing rule added.")
      setOpen(false)
      reset()
      onCreated()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <Button
        size="sm"
        className="h-10 w-full touch-manipulation sm:h-8 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Add rule
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add pricing rule</DialogTitle>
          <DialogDescription>
            Define fares for a zone and vehicle type.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Zone</Label>
              <Select
                value={zoneId}
                onValueChange={(value) => {
                  if (value) setZoneId(value)
                }}
                items={zoneItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Vehicle</Label>
              <Select
                value={vehicleType}
                onValueChange={(v) => setVehicleType(v as VehicleType)}
                items={VEHICLE_ITEMS}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {VEHICLE_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Base fare</Label>
              <Input
                type="number"
                step="0.01"
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
                placeholder="25"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Per km</Label>
              <Input
                type="number"
                step="0.01"
                value={perKmRate}
                onChange={(e) => setPerKmRate(e.target.value)}
                placeholder="1.80"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Min fare</Label>
              <Input
                type="number"
                step="0.01"
                value={minFare}
                onChange={(e) => setMinFare(e.target.value)}
                placeholder="40"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Adding…" : "Add rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
