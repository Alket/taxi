import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { SESSION_COOKIE, isValidSessionToken } from "@/lib/session"
import {
  DRIVER_SESSION_COOKIE,
  isValidDriverSessionToken,
} from "@/lib/driver-session"
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  isPrefixedLocale,
  type Locale,
} from "@/lib/i18n/locales"

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1)
  }
  return pathname
}

function withLocaleHeaders(
  response: NextResponse,
  locale: Locale,
): NextResponse {
  response.headers.set(LOCALE_HEADER, locale)
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })
  return response
}

function applyPublicLocale(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname

  // Skip APIs, admin, driver, Next internals, and static files.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.includes(".")
  ) {
    return null
  }

  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]

  // /en or /en/... → redirect to unprefixed English URL.
  if (first === "en") {
    const rest = segments.slice(1).join("/")
    const url = request.nextUrl.clone()
    url.pathname = rest ? `/${rest}` : "/"
    const redirect = NextResponse.redirect(url)
    return withLocaleHeaders(redirect, DEFAULT_LOCALE)
  }

  // /it/... → rewrite to unprefixed path with locale header/cookie.
  if (first && isPrefixedLocale(first)) {
    const locale = first
    const rest = segments.slice(1).join("/")
    const url = request.nextUrl.clone()
    url.pathname = rest ? `/${rest}` : "/"
    const rewrite = NextResponse.rewrite(url)
    return withLocaleHeaders(rewrite, locale)
  }

  // Default English (unprefixed).
  const response = NextResponse.next()
  return withLocaleHeaders(response, DEFAULT_LOCALE)
}

export async function middleware(request: NextRequest) {
  const path = normalizePath(request.nextUrl.pathname)

  // ── Public locale handling (marketing + booking chrome) ────────
  const localeResponse = applyPublicLocale(request)
  // Continue into auth only for admin/driver; for public return locale response.
  if (
    !path.startsWith("/admin") &&
    !path.startsWith("/api/admin") &&
    !path.startsWith("/driver") &&
    !path.startsWith("/api/driver")
  ) {
    return localeResponse ?? NextResponse.next()
  }

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
    /*
     * Match all pathnames except static files handled above via extension check.
     * Keep broad so locale rewrites apply to marketing routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
}
