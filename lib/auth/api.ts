import type { User } from "@/lib/types";
import type { Capability } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/rbac";
import { getSessionUser } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { NextResponse } from "next/server";

export async function getApiUser(): Promise<User | null> {
  return getSessionUser();
}

export async function guard(
  capability?: Capability,
): Promise<{ user: User } | { response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError("Authentication required", 401) };
  if (capability && !can(user.role, capability)) {
    return { response: jsonError("Your role cannot perform this action", 403) };
  }
  return { user };
}
