"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowLeftRightIcon,
  CheckIcon,
  Loader2Icon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api"
import { VEHICLE_LABELS, formatMoney } from "@/lib/format"
import type { InterZoneFare, PricingRule, VehicleType, Zone } from "@/lib/types"
import { useAdminSession } from "@/hooks/use-admin-session"
import { PageHeader } from "@/components/admin/page-header"
import { AdminFilterSelectField } from "@/components/admin/filter-select-field"
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
import { cn } from "@/lib/utils"

const VEHICLE_TYPES = Object.keys(VEHICLE_LABELS) as VehicleType[]
const VEHICLE_ITEMS = Object.fromEntries(
  VEHICLE_TYPES.map((v) => [v, VEHICLE_LABELS[v]]),
)

/** Compact euro-prefixed numeric input for inline & dialog fare editing. */
function MoneyInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-medium text-muted-foreground"
      >
        €
      </span>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        className={cn("pl-6 tabular-nums", className)}
        {...props}
      />
    </div>
  )
}

export function PricingView() {
  const { canDelete, isAdmin } = useAdminSession()
  const {
    data: zoneData,
    isLoading: zonesLoading,
    mutate: mutateZones,
  } = useSWR<{ zones: Zone[] }>("/api/admin/zones", fetcher)
  const zones = zoneData?.zones ?? []

  const [zoneFilter, setZoneFilter] = React.useState("all")
  const [vehicleFilter, setVehicleFilter] = React.useState<
    "all" | VehicleType
  >("all")
  const [ruleSearch, setRuleSearch] = React.useState("")

  const {
    data: allRulesData,
    isLoading: rulesLoading,
    mutate: mutateRules,
  } = useSWR<{ rules: PricingRule[] }>("/api/admin/pricing-rules", fetcher)
  const allRules = allRulesData?.rules ?? []

  // Per-zone rule counts so operators can see coverage at a glance.
  const ruleCountByZone = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const rule of allRules) {
      counts.set(rule.zoneId, (counts.get(rule.zoneId) ?? 0) + 1)
    }
    return counts
  }, [allRules])

  const filteredRules = React.useMemo(() => {
    const q = ruleSearch.trim().toLowerCase()
    return allRules.filter((rule) => {
      if (zoneFilter !== "all" && rule.zoneId !== zoneFilter) return false
      if (vehicleFilter !== "all" && rule.vehicleType !== vehicleFilter)
        return false
      if (q) {
        const hay = `${rule.zoneName} ${VEHICLE_LABELS[rule.vehicleType]}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allRules, zoneFilter, vehicleFilter, ruleSearch])

  const zoneFilterOptions = React.useMemo(
    () => [
      { value: "all", label: "All zones" },
      ...zones.map((z) => ({ value: z.id, label: z.name })),
    ],
    [zones],
  )

  const selectedZone = React.useMemo(
    () => zones.find((z) => z.id === zoneFilter) ?? null,
    [zones, zoneFilter],
  )

  const hasActiveRuleFilters =
    zoneFilter !== "all" ||
    vehicleFilter !== "all" ||
    ruleSearch.trim().length > 0

  return (
    <>
      <PageHeader
        title="Pricing"
        description={
          isAdmin
            ? "Manage service zones, Tirana Airport (TIA) corridor fares, and city-to-city rates"
            : "View service zones, Tirana Airport (TIA) corridor fares, and city-to-city rates"
        }
      />

      <div className="flex flex-col gap-5 p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <ZonesPanel
            zones={zones}
            loading={zonesLoading}
            ruleCountByZone={ruleCountByZone}
            totalRulesCount={allRules.length}
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
            <CardHeader className="flex-col items-stretch gap-3 border-b py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base font-semibold">
                      Airport ↔ city fares
                    </CardTitle>
                    {selectedZone ? (
                      <Badge variant="secondary" className="font-medium">
                        {selectedZone.name}
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription className="mt-0.5 text-xs">
                    Base fare, per-km rate, and minimum fare per zone (TIA
                    corridor). Press Enter to save inline edits.
                  </CardDescription>
                </div>

                {isAdmin ? (
                  <AddRuleDialog
                    zones={zones}
                    defaultZoneId={zoneFilter !== "all" ? zoneFilter : ""}
                    onCreated={() => void mutateRules()}
                  />
                ) : null}
              </div>

              {/* Filter toolbar */}
              <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVehicleFilter("all")}
                    aria-pressed={vehicleFilter === "all"}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      vehicleFilter === "all"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    All vehicles
                  </button>
                  {VEHICLE_TYPES.map((vt) => (
                    <button
                      key={vt}
                      type="button"
                      onClick={() => setVehicleFilter(vt)}
                      aria-pressed={vehicleFilter === vt}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        vehicleFilter === vt
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {VEHICLE_LABELS[vt]}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-48">
                    <SearchIcon
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      value={ruleSearch}
                      onChange={(e) => setRuleSearch(e.target.value)}
                      placeholder="Filter fares…"
                      aria-label="Filter airport fares"
                      className="h-9 pl-8 pr-8 text-sm"
                    />
                    {ruleSearch ? (
                      <button
                        type="button"
                        onClick={() => setRuleSearch("")}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    ) : null}
                  </div>

                  {/* Mobile zone dropdown (sidebar is above, dropdown gives quick access) */}
                  <div className="lg:hidden">
                    <AdminFilterSelectField
                      label="Zone"
                      value={zoneFilter}
                      onChange={setZoneFilter}
                      options={zoneFilterOptions}
                      icon={MapPinIcon}
                      className="w-full sm:w-48"
                    />
                  </div>
                </div>
              </div>

              {hasActiveRuleFilters ? (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                  <span>
                    Showing{" "}
                    <strong className="font-semibold text-foreground tabular-nums">
                      {filteredRules.length}
                    </strong>{" "}
                    of{" "}
                    <span className="tabular-nums">{allRules.length}</span>{" "}
                    rules
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setZoneFilter("all")
                      setVehicleFilter("all")
                      setRuleSearch("")
                    }}
                    className="font-medium text-primary hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : null}
            </CardHeader>

            <CardContent className="p-0">
              {/* Mobile cards */}
              <div className="divide-y md:hidden">
                {rulesLoading ? (
                  <div className="flex flex-col gap-3 p-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full rounded-lg" />
                    ))}
                  </div>
                ) : filteredRules.length > 0 ? (
                  filteredRules.map((rule) => (
                    <RuleMobileCard
                      key={rule.id}
                      rule={rule}
                      canManage={isAdmin}
                      canDelete={canDelete}
                      onSaved={() => void mutateRules()}
                    />
                  ))
                ) : (
                  <Empty className="py-10">
                    <EmptyTitle>
                      {hasActiveRuleFilters
                        ? "No matching fare rules"
                        : "No pricing rules"}
                    </EmptyTitle>
                    <EmptyDescription>
                      {hasActiveRuleFilters
                        ? "Try clearing your zone, vehicle, or search filter."
                        : isAdmin
                          ? "Add a rule to define fares for this zone."
                          : "No fare rules are configured yet."}
                    </EmptyDescription>
                  </Empty>
                )}
              </div>

              {/* Desktop table */}
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
                        <TableHead className="w-28 pr-4 text-right">
                          Actions
                        </TableHead>
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
                    ) : filteredRules.length > 0 ? (
                      filteredRules.map((rule) => (
                        <RuleRow
                          key={rule.id}
                          rule={rule}
                          canManage={isAdmin}
                          canDelete={canDelete}
                          onSaved={() => void mutateRules()}
                        />
                      ))
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={isAdmin ? 6 : 5}>
                          <Empty className="py-10">
                            <EmptyTitle>
                              {hasActiveRuleFilters
                                ? "No matching fare rules"
                                : "No pricing rules"}
                            </EmptyTitle>
                            <EmptyDescription>
                              {hasActiveRuleFilters
                                ? "Try clearing your zone, vehicle, or search filter."
                                : isAdmin
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

        <CityCorridorsPanel
          zones={zones}
          canManage={isAdmin}
          canDelete={canDelete}
        />
      </div>
    </>
  )
}

function ZonesPanel({
  zones,
  loading,
  ruleCountByZone,
  totalRulesCount,
  selectedZoneId,
  onSelectZone,
  canManage,
  canDelete,
  onChanged,
}: {
  zones: Zone[]
  loading: boolean
  ruleCountByZone: Map<string, number>
  totalRulesCount: number
  selectedZoneId: string
  onSelectZone: (zoneId: string) => void
  canManage: boolean
  canDelete: boolean
  onChanged: () => void
}) {
  const [search, setSearch] = React.useState("")
  const [name, setName] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [editing, setEditing] = React.useState<Zone | null>(null)
  const [editName, setEditName] = React.useState("")
  const [editPending, setEditPending] = React.useState(false)
  const [deleteZone, setDeleteZone] = React.useState<Zone | null>(null)
  const [deletePending, setDeletePending] = React.useState(false)

  const filteredZones = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return zones
    return zones.filter((z) => z.name.toLowerCase().includes(q))
  }, [zones, search])

  async function addZone(e?: React.FormEvent) {
    e?.preventDefault()
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
        `Zone "${name.trim()}" added with default vehicle fares. Adjust them on the right.`,
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

  async function saveEdit(e?: React.FormEvent) {
    e?.preventDefault()
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
      toast.success("Zone renamed.")
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
    <Card className="h-fit gap-0 py-0 lg:sticky lg:top-6">
      <CardHeader className="gap-3 border-b py-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">
              Service zones
            </CardTitle>
            <CardDescription className="text-xs">
              {loading
                ? "Loading zones…"
                : `${zones.length} ${zones.length === 1 ? "zone" : "zones"} defined`}
            </CardDescription>
          </div>
          {!loading ? (
            <Badge variant="outline" className="tabular-nums">
              {zones.length}
            </Badge>
          ) : null}
        </div>

        {zones.length > 5 ? (
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search zones…"
              aria-label="Search service zones"
              className="h-9 pl-8 pr-8 text-sm"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear zone search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <ul className="max-h-[26rem] divide-y overflow-y-auto">
            <li>
              <button
                type="button"
                aria-current={selectedZoneId === "all" ? "true" : undefined}
                onClick={() => onSelectZone("all")}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  selectedZoneId === "all" && "bg-primary/[0.07]",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    selectedZoneId === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  <MapPinIcon className="size-4" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "truncate text-sm",
                      selectedZoneId === "all"
                        ? "font-semibold text-foreground"
                        : "font-medium",
                    )}
                  >
                    All zones
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Show every airport fare rule
                  </span>
                </div>
                <Badge
                  variant={selectedZoneId === "all" ? "default" : "secondary"}
                  className="shrink-0 tabular-nums"
                >
                  {totalRulesCount}
                </Badge>
              </button>
            </li>

            {filteredZones.map((z) => {
              const isSelected = selectedZoneId === z.id
              const count = ruleCountByZone.get(z.id) ?? 0
              return (
                <li
                  key={z.id}
                  className={cn(
                    "group flex items-center gap-1 pr-2 transition-colors hover:bg-muted/50",
                    isSelected && "bg-primary/[0.07]",
                  )}
                >
                  <button
                    type="button"
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => onSelectZone(z.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-accent-foreground",
                      )}
                    >
                      <MapPinIcon className="size-4" aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        isSelected
                          ? "font-semibold text-foreground"
                          : "font-medium",
                      )}
                    >
                      {z.name}
                    </span>
                    <span
                      className="text-xs text-muted-foreground tabular-nums"
                      title={`${count} pricing ${count === 1 ? "rule" : "rules"}`}
                    >
                      {count}
                    </span>
                  </button>

                  {canManage || canDelete ? (
                    <div className="flex shrink-0 items-center gap-0.5">
                      {canManage ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => startEdit(z, e)}
                          aria-label={`Rename ${z.name}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteZone(z)
                          }}
                          aria-label={`Delete ${z.name}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}

            {filteredZones.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                {search ? `No zones match "${search}".` : "No zones yet."}
              </li>
            ) : null}
          </ul>
        )}
      </CardContent>

      {canManage ? (
        <form
          onSubmit={(e) => void addZone(e)}
          className="flex flex-col gap-2.5 border-t bg-muted/30 p-4"
        >
          <Label
            htmlFor="new-zone-name"
            className="text-xs font-medium text-muted-foreground"
          >
            Add new zone
          </Label>
          <div className="flex gap-2">
            <Input
              id="new-zone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Himarë"
              disabled={pending}
              className="h-9 flex-1 bg-background"
            />
            <Button
              type="submit"
              disabled={pending || !name.trim()}
              size="sm"
              className="h-9 shrink-0"
            >
              {pending ? (
                <Loader2Icon
                  className="size-4 animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              Add
            </Button>
          </div>
        </form>
      ) : null}

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => void saveEdit(e)}>
            <DialogHeader>
              <DialogTitle>Rename zone</DialogTitle>
              <DialogDescription>
                Update the display name for this service zone.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 flex flex-col gap-1.5">
              <Label
                htmlFor="edit-zone-name"
                className="text-xs text-muted-foreground"
              >
                Zone name
              </Label>
              <Input
                id="edit-zone-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                disabled={editPending}
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                type="submit"
                disabled={editPending || !editName.trim()}
              >
                {editPending ? (
                  <>
                    <Loader2Icon
                      className="size-4 animate-spin"
                      data-icon="inline-start"
                    />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
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

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
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
    <div
      className={cn(
        "flex flex-col gap-3 p-4 transition-colors",
        editing && "bg-primary/[0.04]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-semibold">{rule.zoneName}</p>
        <Badge variant="secondary" className="shrink-0 font-normal">
          {VEHICLE_LABELS[rule.vehicleType]}
        </Badge>
      </div>

      {editing ? (
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Base</Label>
              <MoneyInput
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
                disabled={pending}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                Per km
              </Label>
              <MoneyInput
                value={perKmRate}
                onChange={(e) => setPerKmRate(e.target.value)}
                disabled={pending}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Min</Label>
              <MoneyInput
                value={minFare}
                onChange={(e) => setMinFare(e.target.value)}
                disabled={pending}
                className="h-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 touch-manipulation"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 flex-1 touch-manipulation"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2Icon
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-muted/50 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Base</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(rule.baseFare, rule.currency)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Per km</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(rule.perKmRate, rule.currency)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Min</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(rule.minFare, rule.currency)}
              </p>
            </div>
          </div>

          {canManage || canDelete ? (
            <div className="flex gap-2">
              {canManage ? (
                <Button
                  variant="outline"
                  className="h-10 flex-1 touch-manipulation"
                  onClick={startEdit}
                >
                  <PencilIcon data-icon="inline-start" />
                  Edit fares
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  variant="outline"
                  className="h-10 touch-manipulation text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  aria-label={`Delete ${rule.zoneName} ${VEHICLE_LABELS[rule.vehicleType]} rule`}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      void save()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setEditing(false)
    }
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
      <TableRow className="bg-primary/[0.04] hover:bg-primary/[0.04]">
        <TableCell className="pl-4 font-medium">{rule.zoneName}</TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-normal">
            {VEHICLE_LABELS[rule.vehicleType]}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <MoneyInput
            value={baseFare}
            onChange={(e) => setBaseFare(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
            autoFocus
            aria-label="Base fare"
            className="ml-auto h-8 w-24 text-right"
          />
        </TableCell>
        <TableCell className="text-right">
          <MoneyInput
            value={perKmRate}
            onChange={(e) => setPerKmRate(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
            aria-label="Per km rate"
            className="ml-auto h-8 w-24 text-right"
          />
        </TableCell>
        <TableCell className="text-right">
          <MoneyInput
            value={minFare}
            onChange={(e) => setMinFare(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={pending}
            aria-label="Minimum fare"
            className="ml-auto h-8 w-24 text-right"
          />
        </TableCell>
        <TableCell className="pr-4">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={pending}
              aria-label="Cancel edit"
            >
              <XIcon />
            </Button>
            <Button
              size="icon-sm"
              onClick={() => void save()}
              disabled={pending}
              aria-label="Save changes"
            >
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <CheckIcon />
              )}
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
        <TableCell className="text-right font-medium tabular-nums">
          {formatMoney(rule.baseFare, rule.currency)}
        </TableCell>
        <TableCell className="text-right text-muted-foreground tabular-nums">
          {formatMoney(rule.perKmRate, rule.currency)}
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">
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
                  aria-label={`Edit ${rule.zoneName} ${VEHICLE_LABELS[rule.vehicleType]} rule`}
                >
                  <PencilIcon />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  aria-label={`Delete ${rule.zoneName} ${VEHICLE_LABELS[rule.vehicleType]} rule`}
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
  defaultZoneId,
  onCreated,
}: {
  zones: Zone[]
  defaultZoneId: string
  onCreated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [zoneId, setZoneId] = React.useState(defaultZoneId)
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
    setZoneId(defaultZoneId)
    setVehicleType("sedan")
    setBaseFare("")
    setPerKmRate("")
    setMinFare("")
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
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
        if (o) setZoneId(defaultZoneId)
        else reset()
      }}
    >
      <Button
        size="sm"
        className="h-9 w-full shrink-0 touch-manipulation sm:w-auto"
        onClick={() => {
          setZoneId(defaultZoneId)
          setOpen(true)
        }}
      >
        <PlusIcon data-icon="inline-start" />
        Add rule
      </Button>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>Add pricing rule</DialogTitle>
            <DialogDescription>
              Define Tirana Airport (TIA) fares for a zone and vehicle type.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 flex flex-col gap-4">
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
                <Label
                  htmlFor="add-rule-base"
                  className="text-xs text-muted-foreground"
                >
                  Base fare
                </Label>
                <MoneyInput
                  id="add-rule-base"
                  value={baseFare}
                  onChange={(e) => setBaseFare(e.target.value)}
                  placeholder="25"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="add-rule-km"
                  className="text-xs text-muted-foreground"
                >
                  Per km
                </Label>
                <MoneyInput
                  id="add-rule-km"
                  value={perKmRate}
                  onChange={(e) => setPerKmRate(e.target.value)}
                  placeholder="1.80"
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="add-rule-min"
                  className="text-xs text-muted-foreground"
                >
                  Min fare
                </Label>
                <MoneyInput
                  id="add-rule-min"
                  value={minFare}
                  onChange={(e) => setMinFare(e.target.value)}
                  placeholder="40"
                  disabled={pending}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2Icon
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                  Adding…
                </>
              ) : (
                "Add rule"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CityCorridorsPanel({
  zones,
  canManage,
  canDelete,
}: {
  zones: Zone[]
  canManage: boolean
  canDelete: boolean
}) {
  const { data, isLoading, mutate } = useSWR<{ fares: InterZoneFare[] }>(
    "/api/admin/inter-zone-fares",
    fetcher,
  )
  const fares = data?.fares ?? []
  const [search, setSearch] = React.useState("")

  const activeCount = React.useMemo(
    () => fares.filter((f) => f.active).length,
    [fares],
  )

  const filteredFares = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fares
    return fares.filter((f) =>
      `${f.zoneAName} ${f.zoneBName} ${VEHICLE_LABELS[f.vehicleType]}`
        .toLowerCase()
        .includes(q),
    )
  }, [fares, search])

  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardHeader className="flex-col items-stretch gap-3 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">
              City corridors
            </CardTitle>
            {!isLoading && fares.length > 0 ? (
              <Badge variant="outline" className="tabular-nums">
                {activeCount}/{fares.length} active
              </Badge>
            ) : null}
          </div>
          <CardDescription className="mt-0.5 text-xs">
            Symmetric city ↔ city fares (e.g. Sarandë ↔ Tirana City). Separate
            from airport pricing.
          </CardDescription>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {fares.length > 4 ? (
            <div className="relative w-full sm:w-52">
              <SearchIcon
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter corridors…"
                aria-label="Filter city corridors"
                className="h-9 pl-8 pr-8 text-sm"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear corridor search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          {canManage ? (
            <AddCorridorDialog zones={zones} onCreated={() => void mutate()} />
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Mobile cards */}
        <div className="divide-y md:hidden">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredFares.length > 0 ? (
            filteredFares.map((fare) => (
              <CorridorMobileCard
                key={fare.id}
                fare={fare}
                canManage={canManage}
                canDelete={canDelete}
                onSaved={() => void mutate()}
              />
            ))
          ) : (
            <Empty className="py-10">
              <EmptyTitle>
                {search ? "No matching corridors" : "No city corridors"}
              </EmptyTitle>
              <EmptyDescription>
                {search
                  ? `No corridors match "${search}".`
                  : canManage
                    ? "Add a corridor to sell city-to-city transfers."
                    : "No city corridor fares yet."}
              </EmptyDescription>
            </Empty>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="pl-4">Route</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead className="text-right">Base fare</TableHead>
                <TableHead className="text-right">Min fare</TableHead>
                <TableHead>Status</TableHead>
                {canManage ? (
                  <TableHead className="w-36 pr-4 text-right">
                    Actions
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={canManage ? 6 : 5} className="pl-4">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredFares.length > 0 ? (
                filteredFares.map((fare) => (
                  <CorridorRow
                    key={fare.id}
                    fare={fare}
                    canManage={canManage}
                    canDelete={canDelete}
                    onSaved={() => void mutate()}
                  />
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={canManage ? 6 : 5}>
                    <Empty className="py-10">
                      <EmptyTitle>
                        {search ? "No matching corridors" : "No city corridors"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {search
                          ? `No corridors match "${search}".`
                          : canManage
                            ? "Add Sarandë ↔ Tirana City (or other pairs) to enable booking."
                            : "No city corridor fares yet."}
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
  )
}

function CorridorRow({
  fare,
  canManage,
  canDelete,
  onSaved,
}: {
  fare: InterZoneFare
  canManage: boolean
  canDelete: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [baseFare, setBaseFare] = React.useState(String(fare.baseFare))
  const [minFare, setMinFare] = React.useState(String(fare.minFare))
  const [pending, setPending] = React.useState(false)
  const [toggling, setToggling] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)

  React.useEffect(() => {
    setBaseFare(String(fare.baseFare))
    setMinFare(String(fare.minFare))
  }, [fare.baseFare, fare.minFare])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      void save()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setBaseFare(String(fare.baseFare))
      setMinFare(String(fare.minFare))
      setEditing(false)
    }
  }

  async function save() {
    const base = Number(baseFare)
    const min = Number(minFare)
    if (!(base > 0) || !(min > 0)) {
      toast.error("Base fare and min fare must be positive numbers.")
      return
    }
    setPending(true)
    try {
      await apiPatch("/api/admin/inter-zone-fares", {
        id: fare.id,
        baseFare: base,
        minFare: min,
      })
      toast.success("Corridor fare updated.")
      setEditing(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function toggleActive() {
    setToggling(true)
    try {
      await apiPatch("/api/admin/inter-zone-fares", {
        id: fare.id,
        active: !fare.active,
      })
      toast.success(
        fare.active ? "Corridor deactivated." : "Corridor activated.",
      )
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setToggling(false)
    }
  }

  async function remove() {
    setDeletePending(true)
    try {
      await apiDelete("/api/admin/inter-zone-fares", { id: fare.id })
      toast.success("Corridor deleted.")
      setDeleteOpen(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  const routeLabel = `${fare.zoneAName} ↔ ${fare.zoneBName}`

  return (
    <>
      <TableRow
        className={cn(
          editing && "bg-primary/[0.04] hover:bg-primary/[0.04]",
          !fare.active && !editing && "opacity-70",
        )}
      >
        <TableCell className="pl-4 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span>{fare.zoneAName}</span>
            <ArrowLeftRightIcon
              aria-hidden
              className="size-3.5 text-muted-foreground"
            />
            <span>{fare.zoneBName}</span>
          </span>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-normal">
            {VEHICLE_LABELS[fare.vehicleType]}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">
          {editing ? (
            <MoneyInput
              className="ml-auto h-8 w-24 text-right"
              value={baseFare}
              onChange={(e) => setBaseFare(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={pending}
              autoFocus
              aria-label="Corridor base fare"
            />
          ) : (
            formatMoney(fare.baseFare, fare.currency)
          )}
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">
          {editing ? (
            <MoneyInput
              className="ml-auto h-8 w-24 text-right"
              value={minFare}
              onChange={(e) => setMinFare(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={pending}
              aria-label="Corridor minimum fare"
            />
          ) : (
            formatMoney(fare.minFare, fare.currency)
          )}
        </TableCell>
        <TableCell>
          <Badge variant={fare.active ? "default" : "secondary"}>
            {fare.active ? "Active" : "Paused"}
          </Badge>
        </TableCell>
        {canManage ? (
          <TableCell className="pr-4 text-right">
            <div className="flex items-center justify-end gap-1">
              {editing ? (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => {
                      setBaseFare(String(fare.baseFare))
                      setMinFare(String(fare.minFare))
                      setEditing(false)
                    }}
                    disabled={pending}
                    aria-label="Cancel edit"
                  >
                    <XIcon className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    onClick={() => void save()}
                    disabled={pending}
                    aria-label="Save corridor fare"
                  >
                    {pending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <CheckIcon className="size-4" />
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setEditing(true)}
                    aria-label={`Edit ${routeLabel} ${VEHICLE_LABELS[fare.vehicleType]} fare`}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    disabled={toggling}
                    onClick={() => void toggleActive()}
                    aria-label={
                      fare.active
                        ? `Pause ${routeLabel}`
                        : `Activate ${routeLabel}`
                    }
                    title={fare.active ? "Pause corridor" : "Activate corridor"}
                    className={
                      fare.active
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-primary hover:text-primary"
                    }
                  >
                    {toggling ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <PowerIcon className="size-4" />
                    )}
                  </Button>
                  {canDelete ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                      aria-label={`Delete ${routeLabel} ${VEHICLE_LABELS[fare.vehicleType]}`}
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </TableCell>
        ) : null}
      </TableRow>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete corridor?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {routeLabel} ({VEHICLE_LABELS[fare.vehicleType]}). This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep corridor</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={() => void remove()}
            >
              {deletePending ? "Deleting…" : "Delete corridor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function CorridorMobileCard({
  fare,
  canManage,
  canDelete,
  onSaved,
}: {
  fare: InterZoneFare
  canManage: boolean
  canDelete: boolean
  onSaved: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [baseFare, setBaseFare] = React.useState(String(fare.baseFare))
  const [minFare, setMinFare] = React.useState(String(fare.minFare))
  const [pending, setPending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)

  function startEdit() {
    setBaseFare(String(fare.baseFare))
    setMinFare(String(fare.minFare))
    setEditing(true)
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    const base = Number(baseFare)
    const min = Number(minFare)
    if (!(base > 0) || !(min > 0)) {
      toast.error("Base fare and min fare must be positive numbers.")
      return
    }
    setPending(true)
    try {
      await apiPatch("/api/admin/inter-zone-fares", {
        id: fare.id,
        baseFare: base,
        minFare: min,
      })
      toast.success("Corridor fare updated.")
      setEditing(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function toggleActive() {
    setPending(true)
    try {
      await apiPatch("/api/admin/inter-zone-fares", {
        id: fare.id,
        active: !fare.active,
      })
      toast.success(
        fare.active ? "Corridor deactivated." : "Corridor activated.",
      )
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
      await apiDelete("/api/admin/inter-zone-fares", { id: fare.id })
      toast.success("Corridor deleted.")
      setDeleteOpen(false)
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setDeletePending(false)
    }
  }

  const routeLabel = `${fare.zoneAName} ↔ ${fare.zoneBName}`

  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 transition-colors",
        editing && "bg-primary/[0.04]",
        !fare.active && !editing && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{routeLabel}</p>
          <Badge variant="secondary" className="mt-1 font-normal">
            {VEHICLE_LABELS[fare.vehicleType]}
          </Badge>
        </div>
        <Badge variant={fare.active ? "default" : "secondary"}>
          {fare.active ? "Active" : "Paused"}
        </Badge>
      </div>

      {editing ? (
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                Base fare
              </Label>
              <MoneyInput
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
                disabled={pending}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">
                Min fare
              </Label>
              <MoneyInput
                value={minFare}
                onChange={(e) => setMinFare(e.target.value)}
                disabled={pending}
                className="h-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 touch-manipulation"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 flex-1 touch-manipulation"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2Icon
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="rounded-lg bg-muted/50 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Base fare</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(fare.baseFare, fare.currency)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-2 py-2">
              <p className="text-[11px] text-muted-foreground">Min fare</p>
              <p className="font-semibold tabular-nums">
                {formatMoney(fare.minFare, fare.currency)}
              </p>
            </div>
          </div>

          {canManage ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-10 flex-1 touch-manipulation"
                disabled={pending}
                onClick={startEdit}
              >
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="h-10 flex-1 touch-manipulation"
                disabled={pending}
                onClick={() => void toggleActive()}
              >
                {fare.active ? "Pause" : "Activate"}
              </Button>
              {canDelete ? (
                <Button
                  variant="outline"
                  className="h-10 touch-manipulation text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => setDeleteOpen(true)}
                  aria-label={`Delete ${routeLabel}`}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete corridor?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {routeLabel} ({VEHICLE_LABELS[fare.vehicleType]}). This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep corridor</AlertDialogCancel>
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

function AddCorridorDialog({
  zones,
  onCreated,
}: {
  zones: Zone[]
  onCreated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [zoneAId, setZoneAId] = React.useState("")
  const [zoneBId, setZoneBId] = React.useState("")
  const [vehicleType, setVehicleType] = React.useState<VehicleType>("sedan")
  const [baseFare, setBaseFare] = React.useState("120")
  const [minFare, setMinFare] = React.useState("120")
  const [minTouched, setMinTouched] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  const zoneItems = React.useMemo(
    () => Object.fromEntries(zones.map((z) => [z.id, z.name])),
    [zones],
  )

  function reset() {
    setZoneAId("")
    setZoneBId("")
    setVehicleType("sedan")
    setBaseFare("120")
    setMinFare("120")
    setMinTouched(false)
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!zoneAId || !zoneBId) {
      toast.error("Select both cities.")
      return
    }
    if (zoneAId === zoneBId) {
      toast.error("Pick two different cities.")
      return
    }
    const base = Number(baseFare)
    const min = Number(minFare)
    if (!(base > 0) || !(min > 0)) {
      toast.error("Base fare and min fare must be positive numbers.")
      return
    }
    setPending(true)
    try {
      await apiPost("/api/admin/inter-zone-fares", {
        zoneAId,
        zoneBId,
        vehicleType,
        baseFare: base,
        minFare: min,
      })
      toast.success("City corridor added.")
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
        className="h-9 w-full shrink-0 touch-manipulation sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <PlusIcon data-icon="inline-start" />
        Add corridor
      </Button>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void submit(e)}>
          <DialogHeader>
            <DialogTitle>Add city corridor</DialogTitle>
            <DialogDescription>
              Same fare both directions. Create sedan and minivan separately.
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">City A</Label>
                <Select
                  value={zoneAId}
                  onValueChange={(v) => setZoneAId(v ?? "")}
                  items={zoneItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select city" />
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
                <Label className="text-xs text-muted-foreground">City B</Label>
                <Select
                  value={zoneBId}
                  onValueChange={(v) => setZoneBId(v ?? "")}
                  items={zoneItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select city" />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="add-corridor-base"
                  className="text-xs text-muted-foreground"
                >
                  Base fare
                </Label>
                <MoneyInput
                  id="add-corridor-base"
                  value={baseFare}
                  onChange={(e) => {
                    const next = e.target.value
                    setBaseFare(next)
                    if (!minTouched) setMinFare(next)
                  }}
                  disabled={pending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="add-corridor-min"
                  className="text-xs text-muted-foreground"
                >
                  Min fare
                </Label>
                <MoneyInput
                  id="add-corridor-min"
                  value={minFare}
                  onChange={(e) => {
                    setMinTouched(true)
                    setMinFare(e.target.value)
                  }}
                  disabled={pending}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2Icon
                    className="size-4 animate-spin"
                    data-icon="inline-start"
                  />
                  Adding…
                </>
              ) : (
                "Add corridor"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
