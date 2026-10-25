import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/api";
import { verifyAuditChain } from "@/lib/engine/audit";
import { noStore } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET() {
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const result = verifyAuditChain(getStore().audit);
  return noStore(NextResponse.json(result));
}
