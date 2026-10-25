import { createHash } from "node:crypto";
import type { AuditEntry } from "@/lib/types";

const canonical = (entry: Omit<AuditEntry, "hash">): string =>
  [
    entry.seq,
    entry.at,
    entry.actor,
    entry.actorType,
    entry.action,
    entry.target,
    entry.detail,
    entry.prevHash,
  ].join("|");

export function hashAuditEntry(entry: Omit<AuditEntry, "hash">): string {
  return createHash("sha256").update(canonical(entry)).digest("hex");
}

export function appendAudit(
  entries: AuditEntry[],
  input: Omit<AuditEntry, "seq" | "hash" | "prevHash" | "at"> & { at?: string },
): AuditEntry {
  const previous = entries[entries.length - 1];
  const base: Omit<AuditEntry, "hash"> = {
    seq: (previous?.seq ?? 0) + 1,
    at: input.at ?? new Date().toISOString(),
    actor: input.actor,
    actorType: input.actorType,
    action: input.action,
    target: input.target,
    detail: input.detail,
    prevHash: previous?.hash ?? "genesis",
  };
  const entry: AuditEntry = { ...base, hash: hashAuditEntry(base) };
  entries.push(entry);
  return entry;
}

/** Verify every link in the chain. Returns the first broken sequence, if any. */
export function verifyAuditChain(entries: AuditEntry[]): {
  valid: boolean;
  checked: number;
  brokenAt?: number;
} {
  let prevHash = "genesis";
  for (const entry of entries) {
    const { hash: _hash, ...rest } = entry;
    if (entry.prevHash !== prevHash || hashAuditEntry(rest) !== entry.hash) {
      return { valid: false, checked: entries.indexOf(entry), brokenAt: entry.seq };
    }
    prevHash = entry.hash;
  }
  return { valid: true, checked: entries.length };
}
