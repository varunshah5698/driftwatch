import { NextResponse, type NextRequest } from "next/server";

/**
 * A per-request nonce lets us keep a strict script-src (no unsafe-inline).
 * Next.js reads the nonce from the request CSP header and stamps it onto the
 * framework and page scripts it emits.
 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/oauth", "/api/auth", "/fonts"];

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV !== "production";
  // Supabase Auth (Google sign-in) needs its own origins reachable from the
  // browser. When it is not configured these origins are simply never used.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseHost = (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).origin : null;
    } catch {
      return null;
    }
  })();
  const connectExtras = [supabaseHost, "https://*.supabase.co", "https://accounts.google.com", "https://oauth2.googleapis.com"]
    .filter(Boolean)
    .join(" ");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${connectExtras}`,
    `frame-src 'self' ${supabaseHost ?? "https://*.supabase.co"}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSession = request.cookies.has("dw_session");

  // Fast redirect for unauthenticated navigation. Signature and expiry are
  // validated server-side in the app layout; this only avoids rendering work.
  // Already-signed-in visitors skip the marketing and auth screens.
  const wantsApp =
    pathname.startsWith("/overview") ||
    ["/agents", "/alerts", "/monitor", "/policies", "/simulation", "/evidence", "/chain", "/baselines", "/roles", "/audit", "/settings"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (!hasSession && !isPublic && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  if (hasSession && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  if (hasSession && pathname === "/" && !wantsApp) {
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
