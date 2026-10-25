import type { UserRole } from "@/lib/types";

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  analyst: "Security Analyst",
  owner: "Agent Owner",
  auditor: "Auditor",
  viewer: "Read-only",
};

export type Capability =
  | "alert:triage"
  | "containment:apply"
  | "manifest:edit"
  | "agent:register"
  | "simulation:run"
  | "policy:edit"
  | "users:manage";

const MATRIX: Record<UserRole, Capability[]> = {
  admin: [
    "alert:triage",
    "containment:apply",
    "manifest:edit",
    "agent:register",
    "simulation:run",
    "policy:edit",
    "users:manage",
  ],
  analyst: [
    "alert:triage",
    "containment:apply",
    "manifest:edit",
    "agent:register",
    "simulation:run",
    "policy:edit",
  ],
  owner: ["alert:triage", "manifest:edit", "agent:register", "simulation:run"],
  auditor: ["simulation:run"],
  viewer: [],
};

export const can = (role: UserRole, capability: Capability): boolean =>
  MATRIX[role].includes(capability);

export const capabilities = (role: UserRole): Capability[] => MATRIX[role];
