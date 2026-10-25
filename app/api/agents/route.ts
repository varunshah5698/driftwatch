import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/api";
import { ROLE_TEMPLATES } from "@/lib/data/roles";
import { isSameOrigin, jsonError, noStore } from "@/lib/http";
import { registerAgent } from "@/lib/store";

const schema = z.object({
  name: z.string().trim().min(3).max(60),
  templateId: z.string().refine((value) => ROLE_TEMPLATES.some((template) => template.id === value)),
  environment: z.enum(["production", "staging", "development"]),
  ownerId: z.string().max(64),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard("agent:register");
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid agent registration", 422);

  const agent = registerAgent({ ...parsed.data, actor: auth.user.name });
  return noStore(NextResponse.json({ agent }, { status: 201 }));
}
