/**
 * Deduplicate public booking creation across React Strict Mode double-mounts
 * and rapid remounts of the payment step. Without this, two pending bookings
 * can be created for a single checkout.
 */
let inFlight: Promise<unknown> | null = null

export async function createPublicBookingOnce<T>(
  create: () => Promise<T>,
): Promise<T> {
  if (!inFlight) {
    inFlight = create().finally(() => {
      inFlight = null
    })
  }
  return inFlight as Promise<T>
}
