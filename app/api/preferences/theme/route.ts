import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, jsonError } from "@/lib/http";

const schema = z.object({ theme: z.enum(["dark", "light"]) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Unknown theme", 422);
  const response = NextResponse.json({ theme: parsed.data.theme });
  response.cookies.set("dw_theme", parsed.data.theme, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
