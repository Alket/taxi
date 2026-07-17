export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      // Skip ngrok free-tier interstitial HTML (breaks JSON APIs on iPhone PWAs).
      "ngrok-skip-browser-warning": "true",
    },
  })
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    const error = new Error(
      `Request failed (${res.status}). Refresh the page and try again.`,
    ) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(
      body.error || `Request failed (${res.status})`,
    ) as Error & {
      status?: number
    }
    error.status = res.status
    throw error
  }
  return res.json()
}

async function mutateRequest<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const contentType = res.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    const error = new Error(
      `Request failed (${res.status}). Refresh the page and try again.`,
    ) as Error & { code?: string }
    throw error
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(
      data.error || `Request failed (${res.status})`,
    ) as Error & {
      code?: string
    }
    error.code = data.code
    throw error
  }
  return data as T
}

export function apiPost<T>(url: string, body?: unknown) {
  return mutateRequest<T>(url, "POST", body)
}

export function apiPatch<T>(url: string, body?: unknown) {
  return mutateRequest<T>(url, "PATCH", body)
}

export function apiDelete<T>(url: string, body?: unknown) {
  return mutateRequest<T>(url, "DELETE", body)
}
