import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { isSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
