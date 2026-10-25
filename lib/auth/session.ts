import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User, UserRole } from "@/lib/types";
import { getStore } from "@/lib/store";

export const SESSION_COOKIE = "dw_session";
const MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * In production SESSION_SECRET must be provided by the environment. The
 * development fallback is intentionally obvious and never used to protect real
 * data (the seeded fleet is synthetic).
 */
const secret = (): string =>
  process.env.SESSION_SECRET ?? "dev-only-driftwatch-session-secret";

export interface SessionPayload {
  email: string;
  role: UserRole;
  name: string;
  initials: string;
  color: string;
  exp: number;
}

const sign = (data: string): string =>
  createHmac("sha256", secret()).update(data).digest("base64url");

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  try {
    if (
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(payload: SessionPayload): {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  };
} {
  return {
    name: SESSION_COOKIE,
    value: signSession(payload),
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    },
  };
}

export function payloadFor(user: User): SessionPayload {
  return {
    email: user.email,
    role: user.role,
    name: user.name,
    initials: user.initials,
    color: user.color,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  };
}

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const payload = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return getStore().users.find((user) => user.email === payload.email) ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
