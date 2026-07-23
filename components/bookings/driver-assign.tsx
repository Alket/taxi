"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { StarIcon, UserPlusIcon } from "lucide-react"

import { AdminDriverField } from "@/components/admin/driver-field"
import { apiPatch, fetcher } from "@/lib/api"
import { isBookingLockedForDriverAssign } from "@/lib/booking-status"
import type { Booking, Driver } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

type AssignableDriver = Driver & {
  busy?: boolean
  conflictReference?: string | null
}

function busyMessage(driver: AssignableDriver) {
  return driver.conflictReference
    ? `${driver.name} is busy on booking ${driver.conflictReference} at this pickup time.`
    : `${driver.name} is already assigned at this pickup date and time.`
}

function DriverSummary({
  driver,
  bookingDriver,
  waitingForAccept,
}: {
  driver: AssignableDriver | null
  bookingDriver: Booking["driver"]
  waitingForAccept?: boolean
}) {
  const name = driver?.name ?? bookingDriver?.name
  if (!name) {
    return (
      <p className="text-sm text-muted-foreground">No driver assigned.</p>
    )
  }

  const vehicleLine = driver
    ? `${driver.vehicleMake} ${driver.vehicleModel} · ${driver.plateNumber}`
    : bookingDriver?.plateNumber
      ? `Plate ${bookingDriver.plateNumber}`
      : null

  const rating =
    typeof driver?.avgRating === "number" ? driver.avgRating : null

  return (
    <div className="flex flex-col">
      <span className="font-medium">{name}</span>
      {vehicleLine ? (
        <span className="text-xs text-muted-foreground">{vehicleLine}</span>
      ) : null}
      {rating != null ? (
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <StarIcon className="size-3" />
          {rating.toFixed(1)} average rating
        </span>
      ) : null}
      {waitingForAccept ? (
        <span className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Waiting for the driver to accept
        </span>
      ) : null}
    </div>
  )
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
  const [selectedDriverId, setSelectedDriverId] = React.useState("")

  const currentDriver =
    drivers.find((d) => d.id === booking.driverId) ?? null
  const hasAssignedDriver = Boolean(booking.driverId || booking.driver)
  const selectedDriver =
    drivers.find((d) => d.id === selectedDriverId) ?? null
  const locked = isBookingLockedForDriverAssign(booking.status)

  React.useEffect(() => {
    setEditing(false)
    setSelectedDriverId("")
  }, [booking.id, booking.driverId])

  async function assign() {
    if (locked) return
    if (!selectedDriver || selectedDriver.id === booking.driverId) return
    if (selectedDriver.busy) {
      toast.error(busyMessage(selectedDriver))
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
      setSelectedDriverId("")
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
      {locked ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <DriverSummary
            driver={currentDriver}
            bookingDriver={booking.driver}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Driver assignment is locked after the driver has arrived.
          </p>
        </div>
      ) : hasAssignedDriver && !editing ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
          <DriverSummary
            driver={currentDriver}
            bookingDriver={booking.driver}
            waitingForAccept={booking.status === "driver_assigned"}
          />
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
          <AdminDriverField
            label=""
            value={selectedDriverId}
            onChange={setSelectedDriverId}
            drivers={drivers}
            placeholder="Select a driver"
            includeAll={false}
            includeUnassigned={false}
            allowClear={Boolean(selectedDriverId)}
            disabled={pending}
            emptyMessage="No active drivers found."
            getOptionLabel={(driver) => {
              const d = driver as AssignableDriver
              return d.busy ? `${d.name} · Busy` : d.name
            }}
            getOptionDescription={(driver) => {
              const d = driver as AssignableDriver
              const vehicle = `${d.vehicleMake} ${d.vehicleModel} · ${d.plateNumber}`
              if (d.busy && d.conflictReference) {
                return `${vehicle} · ${d.conflictReference}`
              }
              return vehicle
            }}
            isOptionDisabled={(driver) =>
              Boolean((driver as AssignableDriver).busy)
            }
            onDisabledSelect={(driver) => {
              toast.error(busyMessage(driver as AssignableDriver))
            }}
          />
          <div className="flex items-center gap-2">
            {hasAssignedDriver ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false)
                  setSelectedDriverId("")
                }}
                disabled={pending}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => void assign()}
              disabled={
                pending ||
                !selectedDriver ||
                selectedDriver.busy ||
                selectedDriver.id === booking.driverId
              }
            >
              {hasAssignedDriver ? "Confirm reassignment" : "Assign driver"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
