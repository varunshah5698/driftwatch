import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { Card, CardHead, PageHeader } from "@/components/ui";
import { GatewayTester, PolicyRow } from "@/components/policy-controls";
import { dryRunPolicy } from "@/lib/engine/policy";
import { getStore } from "@/lib/store";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { CONTAINMENT_LADDER } from "@/lib/domain";

export const metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const store = getStore();
  const user = await getSessionUser();
  const canEdit = Boolean(user && can(user.role, "policy:edit"));

  const summaries = store.policies.map((policy) => {
    const result = dryRunPolicy(policy, store.agents, store.events);
    return { policy, blocked: result.blocked, agentsAffected: result.agentsAffected };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Enforcement · gateway"
        title="Policies & Containment"
        description="Policies are evaluated on every tool call at the gateway proxy. Restrict is surgical: it blocks the exact data class, tool or destination while the agent's valid token keeps working elsewhere."
        meta={
          <>
            <span className="chip chip-lime">{store.policies.filter((policy) => policy.enabled).length} active policies</span>
            <span className="chip">{store.policies.length} total</span>
            <span className="chip chip-orange">dry-run before apply</span>
            <span className="chip">every decision audit-logged</span>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-2.5 xl:col-span-8">
          {summaries.map(({ policy, blocked, agentsAffected }) => (
            <PolicyRow
              key={policy.id}
              policy={policy}
              dryRun={{ blocked, agentsAffected }}
              canEdit={canEdit}
            />
          ))}
          {!canEdit ? (
            <p className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-[10px] text-[var(--muted)]">
              <Lock size={11} aria-hidden /> Your role can preview policies but not edit them.
            </p>
          ) : null}
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Card>
            <CardHead
              eyebrow="Live enforcement"
              title="Gateway tester"
              subtitle="Send a tool call through the same decision function agents hit."
              right={<span className="chip chip-lime">no side effects</span>}
            />
            <div className="px-5 pb-5">
              <GatewayTester
                agents={store.agents.map((agent) => ({
                  id: agent.id,
                  name: agent.name,
                  containment: agent.containment,
                  manifest: agent.manifest,
                }))}
              />
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Response ladder" title="Six enforcement levels" subtitle="Levels escalate per agent; every change is reversible." />
            <div className="px-5 pb-5">
              <ol className="space-y-1.5">
                {CONTAINMENT_LADDER.map((level) => {
                  const count = store.agents.filter((agent) => agent.containment === level.level).length;
                  return (
                    <li key={level.level} className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] px-2.5 py-2">
                      <span className="metric-sm mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] text-[9px]">{level.level}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-medium text-[var(--text-soft)]">{level.label}</span>
                          <span className="chip !px-1.5 !py-0 !text-[8px]">{count}</span>
                        </div>
                        <p className="mt-0.5 text-[9px] leading-relaxed text-[var(--muted-dim)]">{level.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-2.5">
                <ShieldCheck size={12} className="mt-0.5 shrink-0 text-[var(--lime)]" aria-hidden />
                <p className="text-[9px] leading-relaxed text-[var(--muted)]">
                  Containment changes never delete evidence. Roll back with one click from the
                  agent detail page; each reversal is hash-chained.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Audit" title="Recent enforcement" right={<Link href="/audit" className="chip">Log <ArrowRight size={9} aria-hidden /></Link>} />
            <ul className="divide-y divide-[var(--line)] px-4 pb-4">
              {store.audit
                .filter((entry) => entry.action.startsWith("containment") || entry.action.startsWith("gateway"))
                .slice(-5)
                .reverse()
                .map((entry) => (
                  <li key={entry.seq} className="py-2">
                    <p className="text-[10px] text-[var(--text-soft)]">{entry.action.replace(".", " · ")}</p>
                    <p className="truncate text-[8.5px] text-[var(--muted-dim)]">{entry.detail}</p>
                    <p className="text-[8px] text-[var(--muted-dim)]">#{entry.seq} · {entry.actor}</p>
                  </li>
                ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
