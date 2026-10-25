import { NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/api";
import { isSameOrigin, jsonError, noStore } from "@/lib/http";
import { escalateAlert, getAlert, triageAlert } from "@/lib/store";

const schema = z.object({
  action: z.enum(["acknowledge", "escalate", "resolve", "classify", "assign"]),
  classification: z.enum(["true_positive", "false_positive", "benign_change"]).optional(),
  assignee: z.string().max(80).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);
  const auth = await guard("alert:triage");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const alert = getAlert(id);
  if (!alert) return jsonError("Alert not found", 404);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid triage action", 422);
  const input = parsed.data;

  if (input.action === "escalate") {
    const updated = escalateAlert(id, auth.user.name);
    return noStore(NextResponse.json({ alert: updated }));
  }

  if (input.action === "classify" && !input.classification) {
    return jsonError("classification is required", 422);
  }

  const updated = triageAlert(id, {
    status:
      input.action === "acknowledge"
        ? "acknowledged"
        : input.action === "resolve"
          ? "resolved"
          : undefined,
    classification: input.classification,
    assignee: input.assignee ?? (input.action === "assign" ? auth.user.name : undefined),
    actor: auth.user.name,
  });

  return noStore(NextResponse.json({ alert: updated }));
}
