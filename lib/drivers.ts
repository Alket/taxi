import type { Driver } from "@/lib/types"

export type DriverRow = {
  id: string
  name: string
  phone: string
  whatsappNumber: string
  vehicleMake: string
  vehicleModel: string
  plateNumber: string
  languages: string[]
  vetted: boolean
  active: boolean
  avgRating: number
  pinHash?: string | null
}

export function serializeDriver(driver: DriverRow): Driver {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    whatsappNumber: driver.whatsappNumber,
    vehicleMake: driver.vehicleMake,
    vehicleModel: driver.vehicleModel,
    plateNumber: driver.plateNumber,
    languages: driver.languages,
    vetted: driver.vetted,
    active: driver.active,
    avgRating: driver.avgRating,
    pinSet: Boolean(driver.pinHash),
  }
}

export const DRIVER_PUBLIC_SELECT = {
  id: true,
  name: true,
  phone: true,
  whatsappNumber: true,
  vehicleMake: true,
  vehicleModel: true,
  plateNumber: true,
  languages: true,
  vetted: true,
  active: true,
  avgRating: true,
  pinHash: true,
} as const
