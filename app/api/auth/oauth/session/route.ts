import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { payloadFor, sessionCookie } from "@/lib/auth/session";
import { provisionSsoUser } from "@/lib/store";
import { isSameOrigin, jsonError, noStore, rateLimit } from "@/lib/http";
import { log } from "@/lib/observability";

const schema = z.object({ accessToken: z.string().min(20).max(4000) });

/**
 * Exchange a verified Supabase access token for a Driftwatch session cookie.
 *
 * The browser completes the PKCE exchange with the anon key, then posts the
 * resulting access token here. We re-verify it against Supabase from the server
 * — never trusting a client-asserted email — before provisioning the local
 * account and signing the session.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return jsonError("Google sign-in is not configured on this deployment.", 503);
  }

  const limit = rateLimit(clientKeySafe(request), 20, 5 * 60_000);
  if (!limit.allowed) return jsonError("Too many sign-in attempts. Try again later.", 429);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Missing Supabase access token.", 422);

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(parsed.data.accessToken);
  if (error || !data.user || !data.user.email) {
    log("warn", "auth.sso_rejected", { reason: error?.message ?? "no-email" });
    return jsonError("Google identity could not be verified.", 401);
  }

  const name =
    data.user.user_metadata?.full_name ??
    data.user.user_metadata?.name ??
    data.user.email.split("@")[0];

  const user = provisionSsoUser({ email: data.user.email, name, provider: "google" });
  log("info", "auth.sso_signin", { userId: user.id, provider: "google" });

  const response = NextResponse.json({
    ok: true,
    user: { name: user.name, role: user.role, email: user.email },
  });
  const cookie = sessionCookie(payloadFor(user));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return noStore(response);
}

// Small local helper so the import list stays focused on what this route uses.
function clientKeySafe(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `oauth:${forwarded ?? "local"}`;
}
