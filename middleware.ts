import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { SESSION_COOKIE, isValidSessionToken } from "@/lib/session"
import {
  DRIVER_SESSION_COOKIE,
  isValidDriverSessionToken,
} from "@/lib/driver-session"

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export async function middleware(request: NextRequest) {
  const path = normalizePath(request.nextUrl.pathname)

  // ── Driver portal ──────────────────────────────────────────────
  if (path.startsWith("/driver") || path.startsWith("/api/driver")) {
    const isLoginPage = path === "/driver/login"
    const isLoginApi = path === "/api/driver/login"

    if (isLoginApi) {
      return NextResponse.next()
    }

    const token = request.cookies.get(DRIVER_SESSION_COOKIE)?.value
    const authenticated = token
      ? await isValidDriverSessionToken(token)
      : false

    if (isLoginPage) {
      if (authenticated) {
        return NextResponse.redirect(new URL("/driver", request.url))
      }
      return NextResponse.next()
    }

    if (!authenticated) {
      if (path.startsWith("/api/driver")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/driver/login", request.url))
    }

    return NextResponse.next()
  }

  // ── Admin portal ───────────────────────────────────────────────
  const isLoginPage = path === "/admin/login"
  const isLoginApi = path === "/api/admin/login"

  const token = request.cookies.get(SESSION_COOKIE)?.value
  const authenticated = token ? await isValidSessionToken(token) : false

  if (isLoginApi) {
    return NextResponse.next()
  }

  if (isLoginPage) {
    if (authenticated) {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
    return NextResponse.next()
  }

  if (!authenticated) {
    if (path.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/admin/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/driver",
    "/driver/:path*",
    "/api/driver/:path*",
  ],
}
