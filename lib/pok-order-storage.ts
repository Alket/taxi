const POK_ORDER_KEY = "pok:pendingOrderId"

/**
 * A 3-D Secure step-up can bounce the customer to POK and back, losing React
 * state. The order id is not a secret (confirmation is verified server-side
 * against the stored intent), so parking it in sessionStorage is enough to
 * resume the confirmation on return.
 */
export function rememberPokOrderId(orderId: string) {
  try {
    window.sessionStorage.setItem(POK_ORDER_KEY, orderId)
  } catch {
    // Private mode / storage disabled — the return page falls back to the URL.
  }
}

export function readPokOrderId(): string | null {
  try {
    return window.sessionStorage.getItem(POK_ORDER_KEY)
  } catch {
    return null
  }
}

export function clearPokOrderId() {
  try {
    window.sessionStorage.removeItem(POK_ORDER_KEY)
  } catch {
    // Nothing to clean up.
  }
}
