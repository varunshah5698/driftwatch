import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { payloadFor, sessionCookie } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { clientKey, isSameOrigin, jsonError, noStore, rateLimit } from "@/lib/http";

const schema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8).max(200),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const limit = rateLimit(clientKey(request, "login"), 10, 5 * 60_000);
  if (!limit.allowed) return jsonError("Too many attempts. Try again later.", 429);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a valid email and password.", 422);

  const store = getStore();
  const user = store.users.find(
    (candidate) => candidate.email.toLowerCase() === parsed.data.email.toLowerCase(),
  );
  const credential = user ? store.credentials[user.email] : undefined;
  if (!user || !credential || !verifyPassword(parsed.data.password, credential.salt, credential.hash)) {
    return jsonError("Incorrect email or password.", 401);
  }

  const response = NextResponse.json({
    ok: true,
    user: { name: user.name, role: user.role, email: user.email },
  });
  const cookie = sessionCookie(payloadFor(user));
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return noStore(response);
}
