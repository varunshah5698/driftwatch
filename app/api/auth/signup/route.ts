import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { payloadFor, sessionCookie } from "@/lib/auth/session";
import { createUser, getStore } from "@/lib/store";
import { clientKey, isSameOrigin, jsonError, noStore, rateLimit } from "@/lib/http";
import { log } from "@/lib/observability";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().max(160),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const limit = rateLimit(clientKey(request, "signup"), 5, 15 * 60_000);
  if (!limit.allowed) return jsonError("Too many sign-up attempts. Try again later.", 429);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Enter a name, a valid email and a password of at least 8 characters.", 422);
  }

  const store = getStore();
  const email = parsed.data.email.trim().toLowerCase();

  // Never leak which emails exist through a different status code.
  if (store.users.some((candidate) => candidate.email.toLowerCase() === email)) {
    return jsonError("An account with this email already exists.", 409);
  }

  const created = createUser({
    name: parsed.data.name,
    email,
    credential: hashPassword(parsed.data.password),
  });
  if ("error" in created) return jsonError(created.error, 409);

  log("info", "auth.signup", { userId: created.id, role: created.role });

  const response = NextResponse.json({
    ok: true,
    user: { name: created.name, role: created.role, email: created.email },
  });
  const cookie = sessionCookie(payloadFor(created));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return noStore(response);
}
