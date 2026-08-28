import { z } from "zod"

/** Shared with login route + QA (keep bounds in sync). */
export const driverLoginPinSchema = z.string().trim().min(4).max(12)

export const driverLoginSchema = z.object({
  phone: z.string().trim().min(1),
  pin: driverLoginPinSchema,
})

/** Alias used by QA scripts. */
export const loginSchemaForQa = driverLoginSchema
