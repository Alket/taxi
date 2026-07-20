"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { StarIcon, UserPlusIcon } from "lucide-react"

import { apiPatch, fetcher } from "@/lib/api"
import type { Booking, Driver } from "@/lib/types"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

type AssignableDriver = Driver & {
  busy?: boolean
  conflictReference?: string | null
}

export function DriverAssign({
  booking,
  onAssigned,
}: {
  booking: Booking
  onAssigned: () => void
}) {
  const { data } = useSWR<{ drivers: AssignableDriver[] }>(
    `/api/admin/drivers?active=true&forBookingId=${booking.id}`,
    fetcher,
  )
  const drivers = data?.drivers ?? []
  const [pending, setPending] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [selectedDriver, setSelectedDriver] =
    React.useState<AssignableDriver | null>(null)

  const currentDriver = drivers.find((d) => d.id === booking.driverId) ?? null

  React.useEffect(() => {
    setEditing(false)
    setSelectedDriver(null)
  }, [booking.id, booking.driverId])

  async function assign() {
    if (!selectedDriver || selectedDriver.id === booking.driverId) return
    if (selectedDriver.busy) {
      toast.error(
        selectedDriver.conflictReference
          ? `${selectedDriver.name} is busy on booking ${selectedDriver.conflictReference} at this pickup time.`
          : `${selectedDriver.name} is already assigned at this pickup date and time.`,
      )
      return
    }
    setPending(true)
    try {
      await apiPatch(`/api/admin/bookings/${booking.id}/assign-driver`, {
        driverId: selectedDriver.id,
      })
      toast.success(
        booking.driverId
          ? `Reassigned to ${selectedDriver.name}`
          : `Assigned to ${selectedDriver.name}`,
      )
      setEditing(false)
      setSelectedDriver(null)
      onAssigned()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <UserPlusIcon className="size-3.5" />
        Assigned driver
        {pending && <Spinner className="size-3" />}
      </Label>
      {currentDriver && !editing ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-col">
            <span className="font-medium">{currentDriver.name}</span>
            <span className="text-xs text-muted-foreground">
              {currentDriver.vehicleMake} {currentDriver.vehicleModel} ·{" "}
              {currentDriver.plateNumber}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <StarIcon className="size-3" />
              {currentDriver.avgRating.toFixed(1)} average rating
            </span>
            {booking.status === "driver_assigned" ? (
              <span className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Waiting for the driver to accept
              </span>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            Reassign
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Combobox
            items={drivers}
            value={selectedDriver}
            onValueChange={(value: AssignableDriver | null) => {
              if (value?.busy) {
                toast.error(
                  value.conflictReference
                    ? `${value.name} is busy on booking ${value.conflictReference} at this pickup time.`
                    : `${value.name} is already assigned at this pickup date and time.`,
                )
                setSelectedDriver(null)
                return
              }
              setSelectedDriver(value)
            }}
            itemToStringLabel={(item: AssignableDriver) =>
              item.busy
                ? `${item.name} (busy${item.conflictReference ? ` · ${item.conflictReference}` : ""})`
                : item.name
            }
            isItemEqualToValue={(a: AssignableDriver, b: AssignableDriver) =>
              a.id === b.id
            }
          >
            <ComboboxInput
              placeholder="Search active drivers..."
              disabled={pending}
            />
            <ComboboxContent>
              <ComboboxEmpty>No active drivers found.</ComboboxEmpty>
              <ComboboxList>
                {(item: AssignableDriver) => (
                  <ComboboxItem
                    key={item.id}
                    value={item}
                    disabled={item.busy}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {item.name}
                        {item.busy ? " · Busy" : ""}
                      </span>
                      <span className="text-xs text-sidebar-foreground/65">
                        {item.vehicleMake} {item.vehicleModel} ·{" "}
                        {item.plateNumber}
                        {item.busy && item.conflictReference
                          ? ` · ${item.conflictReference}`
                          : ""}
                      </span>
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <div className="flex items-center gap-2">
            {currentDriver ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setSelectedDriver(null)
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={assign}
              disabled={
                pending ||
                !selectedDriver ||
                selectedDriver.busy ||
                selectedDriver.id === booking.driverId
              }
            >
              {currentDriver ? "Confirm reassignment" : "Assign driver"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
