/* Staff push notifications (admin + driver). */
self.addEventListener("push", (event) => {
  let data = {
    title: "Albania Transfers",
    body: "You have a new update.",
    url: "/",
    tag: "staff-alert",
  }

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch {
    // keep defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      renotify: true,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url },
    }),
  )
})

function toAbsoluteUrl(pathOrUrl) {
  try {
    return new URL(pathOrUrl || "/", self.location.origin).href
  } catch {
    return new URL("/", self.location.origin).href
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = toAbsoluteUrl(event.notification.data?.url || "/")

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })

      for (const client of clientList) {
        if (!client.url.startsWith(self.location.origin)) continue
        if (!("focus" in client)) continue

        await client.focus()

        // Prefer navigate when available (Chromium / some PWAs).
        if (typeof client.navigate === "function") {
          try {
            await client.navigate(targetUrl)
            return
          } catch {
            // fall through to postMessage
          }
        }

        client.postMessage({
          type: "NOTIFICATION_CLICK",
          url: targetUrl,
        })
        return
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
