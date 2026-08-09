(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push(["chunks/[root-of-the-server]__111k7nf._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/lib/jwt-secret.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "assertJwtSecret",
    ()=>assertJwtSecret,
    "getJwtSecretKey",
    ()=>getJwtSecretKey
]);
/**
 * Shared JWT secret loading for admin + driver session tokens.
 * Fails closed on missing, short, or known-insecure placeholder values.
 */ const MIN_JWT_SECRET_LENGTH = 32;
/** Exact matches (case-insensitive) that must never be used in any environment. */ const FORBIDDEN_JWT_SECRETS = new Set([
    "change-me-to-a-long-random-string",
    "secret",
    "changeme",
    "change-me",
    "password",
    "jwt_secret",
    "jwt-secret",
    "build-time-placeholder",
    "placeholder",
    "your-secret-here",
    "dev",
    "test",
    "development"
]);
function assertJwtSecret(secret) {
    const value = secret?.trim() ?? "";
    if (!value) {
        throw new Error("JWT_SECRET is not set");
    }
    if (value.length < MIN_JWT_SECRET_LENGTH) {
        throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
    }
    if (FORBIDDEN_JWT_SECRETS.has(value.toLowerCase())) {
        throw new Error("JWT_SECRET matches a known insecure default/placeholder — set a unique random secret");
    }
    return value;
}
function getJwtSecretKey() {
    return new TextEncoder().encode(assertJwtSecret(process.env.JWT_SECRET));
}
}),
"[project]/lib/session.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ADMIN_JWT_AUDIENCE",
    ()=>ADMIN_JWT_AUDIENCE,
    "ADMIN_JWT_ISSUER",
    ()=>ADMIN_JWT_ISSUER,
    "SESSION_COOKIE",
    ()=>SESSION_COOKIE,
    "SESSION_MAX_AGE",
    ()=>SESSION_MAX_AGE,
    "isValidSessionToken",
    ()=>isValidSessionToken,
    "signSessionToken",
    ()=>signSessionToken,
    "verifySessionToken",
    ()=>verifySessionToken
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$sign$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/sign.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/verify.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$jwt$2d$secret$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/jwt-secret.ts [middleware-edge] (ecmascript)");
;
;
const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ADMIN_JWT_ISSUER = "taxi-admin";
const ADMIN_JWT_AUDIENCE = "admin";
async function signSessionToken(adminUserId) {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$sign$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["SignJWT"]({
        sub: adminUserId
    }).setProtectedHeader({
        alg: "HS256"
    }).setIssuer(ADMIN_JWT_ISSUER).setAudience(ADMIN_JWT_AUDIENCE).setIssuedAt().setExpirationTime("7d").sign((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$jwt$2d$secret$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["getJwtSecretKey"])());
}
async function verifySessionToken(token) {
    try {
        const { payload } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["jwtVerify"])(token, (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$jwt$2d$secret$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["getJwtSecretKey"])(), {
            issuer: ADMIN_JWT_ISSUER,
            audience: ADMIN_JWT_AUDIENCE
        });
        return typeof payload.sub === "string" ? payload.sub : null;
    } catch  {
        return null;
    }
}
async function isValidSessionToken(token) {
    return await verifySessionToken(token) !== null;
}
}),
"[project]/lib/driver-session.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DRIVER_JWT_AUDIENCE",
    ()=>DRIVER_JWT_AUDIENCE,
    "DRIVER_JWT_ISSUER",
    ()=>DRIVER_JWT_ISSUER,
    "DRIVER_SESSION_COOKIE",
    ()=>DRIVER_SESSION_COOKIE,
    "DRIVER_SESSION_MAX_AGE",
    ()=>DRIVER_SESSION_MAX_AGE,
    "isValidDriverSessionToken",
    ()=>isValidDriverSessionToken,
    "signDriverSessionToken",
    ()=>signDriverSessionToken,
    "verifyDriverSessionToken",
    ()=>verifyDriverSessionToken
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$sign$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/sign.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/verify.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$jwt$2d$secret$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/jwt-secret.ts [middleware-edge] (ecmascript)");
;
;
const DRIVER_SESSION_COOKIE = "driver_session";
const DRIVER_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const DRIVER_JWT_ISSUER = "taxi-driver";
const DRIVER_JWT_AUDIENCE = "driver";
async function signDriverSessionToken(driverId) {
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$sign$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["SignJWT"]({
        sub: driverId,
        role: "driver"
    }).setProtectedHeader({
        alg: "HS256"
    }).setIssuer(DRIVER_JWT_ISSUER).setAudience(DRIVER_JWT_AUDIENCE).setIssuedAt().setExpirationTime("30d").sign((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$jwt$2d$secret$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["getJwtSecretKey"])());
}
async function verifyDriverSessionToken(token) {
    try {
        const { payload } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["jwtVerify"])(token, (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$jwt$2d$secret$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["getJwtSecretKey"])(), {
            issuer: DRIVER_JWT_ISSUER,
            audience: DRIVER_JWT_AUDIENCE
        });
        if (payload.role !== "driver") return null;
        return typeof payload.sub === "string" ? payload.sub : null;
    } catch  {
        return null;
    }
}
async function isValidDriverSessionToken(token) {
    return await verifyDriverSessionToken(token) !== null;
}
}),
"[project]/lib/i18n/locales.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_LOCALE",
    ()=>DEFAULT_LOCALE,
    "LOCALES",
    ()=>LOCALES,
    "LOCALE_COOKIE",
    ()=>LOCALE_COOKIE,
    "LOCALE_HEADER",
    ()=>LOCALE_HEADER,
    "LOCALE_LABELS",
    ()=>LOCALE_LABELS,
    "isLocale",
    ()=>isLocale,
    "isPrefixedLocale",
    ()=>isPrefixedLocale,
    "localeFromPathname",
    ()=>localeFromPathname,
    "localePath",
    ()=>localePath,
    "localizedAlternates",
    ()=>localizedAlternates,
    "stripLocalePrefix",
    ()=>stripLocalePrefix
]);
const LOCALES = [
    "en",
    "it",
    "de",
    "pl",
    "tr",
    "uk",
    "ru"
];
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "NEXT_LOCALE";
const LOCALE_HEADER = "x-locale";
const LOCALE_LABELS = {
    en: {
        label: "English",
        short: "EN"
    },
    it: {
        label: "Italian",
        short: "IT"
    },
    de: {
        label: "German",
        short: "DE"
    },
    pl: {
        label: "Polish",
        short: "PL"
    },
    tr: {
        label: "Turkish",
        short: "TR"
    },
    uk: {
        label: "Ukrainian",
        short: "UK"
    },
    ru: {
        label: "Russian",
        short: "RU"
    }
};
function isLocale(value) {
    return Boolean(value && LOCALES.includes(value));
}
function isPrefixedLocale(value) {
    return isLocale(value) && value !== DEFAULT_LOCALE;
}
function localePath(path, locale) {
    const raw = path.startsWith("/") ? path : `/${path}`;
    const [pathnamePart, query = ""] = raw.split("?");
    const hashIndex = pathnamePart.indexOf("#");
    const pathname = hashIndex >= 0 ? pathnamePart.slice(0, hashIndex) : pathnamePart;
    const hash = hashIndex >= 0 ? pathnamePart.slice(hashIndex) : "";
    const querySuffix = query ? `?${query}` : "";
    const stripped = stripLocalePrefix(pathname);
    if (locale === DEFAULT_LOCALE) {
        return `${stripped === "" ? "/" : stripped}${querySuffix}${hash}`;
    }
    if (stripped === "/") {
        return `/${locale}${querySuffix}${hash}`;
    }
    return `/${locale}${stripped}${querySuffix}${hash}`;
}
function stripLocalePrefix(pathname) {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "/";
    if (isPrefixedLocale(segments[0])) {
        const rest = segments.slice(1).join("/");
        return rest ? `/${rest}` : "/";
    }
    return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
function localizedAlternates(path, locale) {
    const languages = {};
    for (const code of LOCALES){
        languages[code] = localePath(path, code);
    }
    languages["x-default"] = localePath(path, DEFAULT_LOCALE);
    return {
        canonical: localePath(path, locale),
        languages
    };
}
function localeFromPathname(pathname) {
    const first = pathname.split("/").filter(Boolean)[0];
    if (isPrefixedLocale(first ?? "")) return first;
    return DEFAULT_LOCALE;
}
}),
"[project]/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "middleware",
    ()=>middleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$api$2f$server$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/api/server.js [middleware-edge] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/esm/server/web/spec-extension/response.js [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$session$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/session.ts [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$driver$2d$session$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/driver-session.ts [middleware-edge] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$i18n$2f$locales$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/i18n/locales.ts [middleware-edge] (ecmascript)");
;
;
;
;
function normalizePath(pathname) {
    if (pathname.length > 1 && pathname.endsWith("/")) {
        return pathname.slice(0, -1);
    }
    return pathname;
}
function withLocaleHeaders(response, locale) {
    response.headers.set(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$i18n$2f$locales$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["LOCALE_HEADER"], locale);
    response.cookies.set(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$i18n$2f$locales$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["LOCALE_COOKIE"], locale, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365
    });
    return response;
}
function applyPublicLocale(request) {
    const pathname = request.nextUrl.pathname;
    // Skip APIs, admin, driver, Next internals, and static files.
    if (pathname.startsWith("/api") || pathname.startsWith("/admin") || pathname.startsWith("/driver") || pathname.startsWith("/_next") || pathname.startsWith("/uploads") || pathname.includes(".")) {
        return null;
    }
    const segments = pathname.split("/").filter(Boolean);
    const first = segments[0];
    // /en or /en/... → redirect to unprefixed English URL.
    if (first === "en") {
        const rest = segments.slice(1).join("/");
        const url = request.nextUrl.clone();
        url.pathname = rest ? `/${rest}` : "/";
        const redirect = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(url);
        return withLocaleHeaders(redirect, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$i18n$2f$locales$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["DEFAULT_LOCALE"]);
    }
    // /it/... → rewrite to unprefixed path with locale header/cookie.
    if (first && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$i18n$2f$locales$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["isPrefixedLocale"])(first)) {
        const locale = first;
        const rest = segments.slice(1).join("/");
        const url = request.nextUrl.clone();
        url.pathname = rest ? `/${rest}` : "/";
        const rewrite = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].rewrite(url);
        return withLocaleHeaders(rewrite, locale);
    }
    // Default English (unprefixed).
    const response = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    return withLocaleHeaders(response, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$i18n$2f$locales$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["DEFAULT_LOCALE"]);
}
async function middleware(request) {
    const path = normalizePath(request.nextUrl.pathname);
    // ── Public locale handling (marketing + booking chrome) ────────
    const localeResponse = applyPublicLocale(request);
    // Continue into auth only for admin/driver; for public return locale response.
    if (!path.startsWith("/admin") && !path.startsWith("/api/admin") && !path.startsWith("/driver") && !path.startsWith("/api/driver")) {
        return localeResponse ?? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // ── Driver portal ──────────────────────────────────────────────
    if (path.startsWith("/driver") || path.startsWith("/api/driver")) {
        const isLoginPage = path === "/driver/login";
        const isLoginApi = path === "/api/driver/login";
        if (isLoginApi) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
        }
        const token = request.cookies.get(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$driver$2d$session$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["DRIVER_SESSION_COOKIE"])?.value;
        const authenticated = token ? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$driver$2d$session$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["isValidDriverSessionToken"])(token) : false;
        if (isLoginPage) {
            if (authenticated) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/driver", request.url));
            }
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
        }
        if (!authenticated) {
            if (path.startsWith("/api/driver")) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "Unauthorized"
                }, {
                    status: 401
                });
            }
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/driver/login", request.url));
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    // ── Admin portal ───────────────────────────────────────────────
    const isLoginPage = path === "/admin/login";
    const isLoginApi = path === "/api/admin/login";
    const token = request.cookies.get(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$session$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["SESSION_COOKIE"])?.value;
    const authenticated = token ? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$session$2e$ts__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["isValidSessionToken"])(token) : false;
    if (isLoginApi) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    if (isLoginPage) {
        if (authenticated) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/admin", request.url));
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    if (!authenticated) {
        if (path.startsWith("/api/admin")) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Unauthorized"
            }, {
                status: 401
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL("/admin/login", request.url));
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$esm$2f$server$2f$web$2f$spec$2d$extension$2f$response$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["NextResponse"].next();
}
const config = {
    matcher: [
        /*
     * Match all pathnames except static files handled above via extension check.
     * Keep broad so locale rewrites apply to marketing routes.
     */ "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__111k7nf._.js.map