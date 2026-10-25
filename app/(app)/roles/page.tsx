import Link from "next/link";
import { stringify as toYaml } from "yaml";
import { Card, CardHead, PageHeader, StatusPill } from "@/components/ui";
import { RoleEditor } from "@/components/role-editor";
import { getStore } from "@/lib/store";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Role manifests" };

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const params = await searchParams;
  const store = getStore();
  const user = await getSessionUser();
  const selected =
    store.agents.find((agent) => agent.id === params.agent) ??
    [...store.agents].sort((a, b) => b.openAlerts - a.openAlerts)[0];
  const canEdit = Boolean(user && can(user.role, "manifest:edit"));
  const yaml = toYaml(selected.manifest, { lineWidth: 0 });
  const changes = store.changeEvents.filter((change) => change.agentId === selected.id);

  return (
    <div>
      <PageHeader
        eyebrow="Role manifests · versioned"
        title="Manifest Editor"
        description="The declared role is the contract. Edit it as YAML, validate against the schema, replay the last seven days, then apply with a grace window."
        meta={
          <>
            <span className="chip">v{selected.manifestVersion}</span>
            <span className="chip">schema driftwatch/v1</span>
            <span className="chip chip-lime">replay before apply</span>
            {changes.length ? <span className="chip chip-violet">{changes.length} change events</span> : null}
          </>
        }
        actions={
          <Link href={`/agents/${selected.id}`} className="pill !h-10 !text-[12px]">
            Open agent
          </Link>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <Card className="h-fit xl:col-span-3">
          <CardHead eyebrow="Registry" title="Choose agent" right={<span className="chip">{store.agents.length}</span>} />
          <ul className="max-h-[72vh] overflow-y-auto px-2 pb-3">
            {[...store.agents]
              .sort((a, b) => b.openAlerts - a.openAlerts || a.name.localeCompare(b.name))
              .map((agent) => (
                <li key={agent.id}>
                  <Link
                    href={`/roles?agent=${agent.id}`}
                    className={`mb-0.5 block rounded-xl px-2.5 py-2 transition-colors ${
                      agent.id === selected.id ? "bg-[var(--panel-hi)]" : "hover:bg-[var(--panel-soft)]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10.5px] font-medium">{agent.name}</span>
                        <span className="block text-[8.5px] text-[var(--muted-dim)]">
                          v{agent.manifestVersion} · {agent.roleTemplate}
                        </span>
                      </span>
                      {agent.openAlerts > 0 ? <span className="chip chip-red !px-1.5 !py-0 !text-[8px]">{agent.openAlerts}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </Card>

        <div className="space-y-3 xl:col-span-9">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] px-6 py-4">
              <div>
                <p className="eyebrow mb-1">{selected.roleTemplate} · {selected.environment}</p>
                <h2 className="display-tight text-[22px] uppercase">{selected.name}</h2>
                <p className="mt-1 text-[10px] text-[var(--muted)]">
                  manifest v{selected.manifestVersion} · updated {formatDate(selected.manifest.metadata.updatedAt)} by{" "}
                  {selected.manifest.metadata.updatedBy}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill status={selected.status} />
                <span className="chip">{selected.manifest.spec.riskTier} tier</span>
              </div>
            </div>
            <div className="p-5">
              <RoleEditor agentId={selected.id} initialYaml={yaml} canEdit={canEdit} />
              {!canEdit ? (
                <p className="mt-3 text-[10px] text-[var(--muted)]">
                  Your role can simulate manifests but not apply them. Sign in as an owner or admin to save.
                </p>
              ) : null}
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHead eyebrow="Current scope" title="Declared surface" />
              <div className="space-y-2.5 px-5 pb-5">
                {[
                  ["tools", selected.manifest.spec.allowed.tools],
                  ["data classes", selected.manifest.spec.allowed.dataClasses],
                  ["destinations", selected.manifest.spec.allowed.destinations],
                  ["actions", selected.manifest.spec.allowed.actions],
                ].map(([label, values]) => (
                  <div key={label as string}>
                    <p className="eyebrow mb-1">{label as string}</p>
                    <div className="flex flex-wrap gap-1">
                      {(values as string[]).map((value) => (
                        <span key={value} className="chip !px-2 !py-0.5 !text-[8.5px]">{value}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHead eyebrow="Schema" title="Validation rules" />
              <div className="space-y-2 px-5 pb-5 text-[10px] leading-relaxed text-[var(--muted)]">
                <p><span className="text-[var(--text-soft)]">apiVersion</span> must be <code>driftwatch/v1</code> and kind <code>AgentRole</code>.</p>
                <p><span className="text-[var(--text-soft)]">allowed</span> is deny-by-default: any tool, data class, action or destination absent from the manifest is out of role.</p>
                <p><span className="text-[var(--text-soft)]">operatingHours</span> are UTC and accept overnight windows (start &gt; end).</p>
                <p><span className="text-[var(--text-soft)]">approvedDelegates</span> constrains which agent identities may receive work; maxCallDepth caps transitive authority.</p>
                <p className="text-[var(--muted-dim)]">Applying a change opens a 48-hour grace window and is written to the hash-chained audit log.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
