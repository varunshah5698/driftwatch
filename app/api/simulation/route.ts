import { NextResponse } from "next/server";
import { guard } from "@/lib/auth/api";
import { getSimulationSuite } from "@/lib/engine/simulate";
import { isSameOrigin, jsonError, noStore } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await guard();
  if ("response" in auth) return auth.response;
  return noStore(NextResponse.json(getSimulationSuite()));
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard("simulation:run");
  if ("response" in auth) return auth.response;
  const suite = getSimulationSuite(true);
  return noStore(
    NextResponse.json({
      ...suite,
      ranBy: auth.user.name,
      ranAt: new Date().toISOString(),
    }),
  );
}
