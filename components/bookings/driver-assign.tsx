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

export function DriverAssign({
  booking,
  onAssigned,
}: {
  booking: Booking
  onAssigned: () => void
}) {
  const { data } = useSWR<{ drivers: Driver[] }>(
    "/api/admin/drivers?active=true",
    fetcher,
  )
  const drivers = data?.drivers ?? []
  const [pending, setPending] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [selectedDriver, setSelectedDriver] = React.useState<Driver | null>(null)

  const currentDriver = drivers.find((d) => d.id === booking.driverId) ?? null

  React.useEffect(() => {
    setEditing(false)
    setSelectedDriver(null)
  }, [booking.id, booking.driverId])

  async function assign() {
    if (!selectedDriver || selectedDriver.id === booking.driverId) return
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
            onValueChange={(value: Driver | null) => setSelectedDriver(value)}
            itemToStringLabel={(item: Driver) => item.name}
          >
            <ComboboxInput
              placeholder="Search active drivers..."
              disabled={pending}
            />
            <ComboboxContent>
              <ComboboxEmpty>No active drivers found.</ComboboxEmpty>
              <ComboboxList>
                {(item: Driver) => (
                  <ComboboxItem key={item.id} value={item}>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-sidebar-foreground/65">
                        {item.vehicleMake} {item.vehicleModel} · {item.plateNumber}
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
