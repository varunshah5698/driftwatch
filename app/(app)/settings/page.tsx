import { Card, CardHead, PageHeader, RoleChip } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { getStore } from "@/lib/store";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_LABEL, capabilities, can, type Capability } from "@/lib/auth/rbac";
import { users } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import type { UserRole } from "@/lib/types";
import {
  Check,
  CircleDashed,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Webhook,
  X,
} from "lucide-react";

export const metadata = { title: "Settings" };

const CAPABILITIES: { key: Capability; label: string }[] = [
  { key: "alert:triage", label: "Triage alerts" },
  { key: "containment:apply", label: "Apply containment" },
  { key: "manifest:edit", label: "Edit manifests" },
  { key: "agent:register", label: "Register agents" },
  { key: "simulation:run", label: "Run simulations" },
  { key: "policy:edit", label: "Edit policies" },
  { key: "users:manage", label: "Manage users" },
];

const ROLES: UserRole[] = ["admin", "analyst", "owner", "auditor", "viewer"];

export default async function SettingsPage() {
  const store = getStore();
  const current = await getSessionUser();
  const team = users();
  const integrations = [
    { name: "SIEM webhook", icon: Webhook, env: "SIEM_WEBHOOK_URL", ready: Boolean(process.env.SIEM_WEBHOOK_URL), note: "OCSF or CEF over HTTPS" },
    { name: "Slack", icon: MessageSquare, env: "SLACK_WEBHOOK_URL", ready: Boolean(process.env.SLACK_WEBHOOK_URL), note: "Critical alerts + containment events" },
    { name: "Microsoft Teams", icon: MessageSquare, env: "TEAMS_WEBHOOK_URL", ready: Boolean(process.env.TEAMS_WEBHOOK_URL), note: "Adaptive card per incident" },
    { name: "Email", icon: Mail, env: "SMTP_URL", ready: Boolean(process.env.SMTP_URL), note: "Owner notifications and digests" },
  ];
  const ingestSnippet = `curl -X POST http://localhost:3000/api/ingest \\
  -H "content-type: application/json" \\
  -H "x-agent-id: agt-procurement-1" \\
  -H "x-timestamp: $(date +%s000)" \\
  -H "x-idempotency-key: $(uuidgen)" \\
  -H "x-signature: sha256=<hmac(secret, timestamp + '.' + body)>" \\
  -d '{"events":[{"type":"tool.call","sessionId":"ses-1",...}]}'`;

  return (
    <div>
      <PageHeader
        eyebrow="Workspace · governance"
        title="Settings"
        description="RBAC, integrations and data-minimization controls. Secrets live in the environment or a manager, never in the repository."
        meta={
          <>
            <span className="chip chip-lime">CSP nonce enforced</span>
            <span className="chip">scrypt · per-user salt</span>
            <span className="chip">signed sessions</span>
            <span className="chip">audit chain active</span>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Card>
            <CardHead
              eyebrow="Identity"
              title="Users and roles"
              subtitle="Five seeded identities. Role changes require the users:manage capability."
              right={<span className="chip">{team.length} users</span>}
            />
            <div className="scroll-x">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted-dim)]">
                    <th className="py-2.5 pl-6 font-medium">User</th>
                    <th className="py-2.5 pr-4 font-medium">Role</th>
                    <th className="py-2.5 pr-4 font-medium">Capabilities</th>
                    <th className="py-2.5 pr-6 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((user) => (
                    <tr key={user.id} className="border-b border-[var(--line)]">
                      <td className="py-3 pl-6">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-[#111]" style={{ background: user.color }}>
                            {user.initials}
                          </span>
                          <div>
                            <p className="text-[11.5px] font-medium">
                              {user.name}
                              {current?.id === user.id ? <span className="ml-2 text-[8px] uppercase tracking-wide text-[var(--lime)]">you</span> : null}
                            </p>
                            <p className="text-[9px] text-[var(--muted-dim)]">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4"><RoleChip role={user.role} /></td>
                      <td className="py-3 pr-4 text-[9.5px] text-[var(--muted)]">
                        {capabilities(user.role).length} / {CAPABILITIES.length}
                      </td>
                      <td className="py-3 pr-6 text-[9px] text-[var(--muted-dim)]">{formatDateTime(user.lastActive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Authorization" title="Role capability matrix" subtitle="Enforced in both the API guard and the interface." />
            <div className="scroll-x px-6 pb-6">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="text-[8px] uppercase tracking-wide text-[var(--muted-dim)]">
                    <th className="sticky left-0 bg-[var(--panel)] py-2 pr-4 font-medium">Capability</th>
                    {ROLES.map((role) => (
                      <th key={role} className="px-2 py-2 text-center font-medium">{ROLE_LABEL[role]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map((capability) => (
                    <tr key={capability.key} className="border-t border-[var(--line)]">
                      <td className="sticky left-0 bg-[var(--panel)] py-2 pr-4 text-[10px] text-[var(--text-soft)]">{capability.label}</td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-2 py-2 text-center">
                          {can(role, capability.key) ? (
                            <Check size={12} className="mx-auto text-[var(--lime)]" aria-label="allowed" />
                          ) : (
                            <X size={11} className="mx-auto text-[var(--muted-dim)]" aria-label="not allowed" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Integrations" title="Notifications and SIEM" subtitle="Configured through environment variables or a secrets manager; values are never shown." />
            <div className="grid gap-2 px-6 pb-6 sm:grid-cols-2">
              {integrations.map((integration) => {
                const Icon = integration.icon;
                return (
                  <div key={integration.name} className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[10.5px] font-medium">
                        <Icon size={13} className="text-[var(--muted)]" aria-hidden /> {integration.name}
                      </span>
                      <span className={`chip !px-1.5 !py-0 !text-[8px] ${integration.ready ? "chip-lime" : ""}`}>
                        {integration.ready ? "configured" : "not configured"}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] text-[var(--muted)]">{integration.note}</p>
                    <code className="mt-1.5 block text-[8.5px] text-[var(--muted-dim)]">{integration.env}</code>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHead
              eyebrow="Machine access"
              title="Telemetry ingestion"
              subtitle="HMAC-SHA256 over `${timestamp}.${body}` with a five-minute replay window."
              right={<span className="chip chip-orange">development secret</span>}
            />
            <div className="px-6 pb-6">
              <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0c0e0b] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[8.5px] uppercase tracking-wide text-[var(--muted-dim)]">POST /api/ingest</span>
                  <CopyButton value={ingestSnippet} label="Copy curl" />
                </div>
                <pre className="overflow-x-auto font-mono text-[9px] leading-relaxed text-[#c9dab3]">{ingestSnippet}</pre>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  ["TypeScript SDK", "sdk-ts/"],
                  ["Python SDK", "sdk-py/"],
                  ["OpenAPI", "openapi.yaml"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[var(--line)] px-3 py-2">
                    <p className="text-[9.5px] text-[var(--text-soft)]">{label}</p>
                    <code className="text-[8.5px] text-[var(--muted-dim)]">{value}</code>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Card>
            <CardHead eyebrow="Security" title="Posture" right={<ShieldCheck size={14} className="text-[var(--lime)]" aria-hidden />} />
            <div className="space-y-2 px-5 pb-5">
              {[
                ["Content Security Policy", "nonce-based, no unsafe-inline scripts", true],
                ["Session cookie", "HttpOnly · SameSite=Lax · 8h", true],
                ["Password hashing", "scrypt, per-user salt", true],
                ["CSRF", "same-origin checks on mutations", true],
                ["Rate limits", "login + ingest + gateway", true],
                ["OIDC / SSO", "adapter documented, issuer not set", false],
              ].map(([label, note, ok]) => (
                <div key={label as string} className="flex items-start gap-2">
                  {ok ? <Check size={11} className="mt-0.5 shrink-0 text-[var(--lime)]" aria-hidden /> : <CircleDashed size={11} className="mt-0.5 shrink-0 text-[var(--orange)]" aria-hidden />}
                  <div>
                    <p className="text-[10px] text-[var(--text-soft)]">{label as string}</p>
                    <p className="text-[8.5px] text-[var(--muted-dim)]">{note as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Tenant" title="Workspace" />
            <div className="space-y-2 px-5 pb-5 text-[10px]">
              {[
                ["workspace", "Driftwatch Security"],
                ["environment", "production (demo fleet)"],
                ["region", "local · UTC"],
                ["plan", "enterprise evaluation"],
                ["ingest secret", "AGENT_INGEST_SECRET (dev default)"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-[var(--muted-dim)]">{label}</span>
                  <span className="text-right text-[var(--text-soft)]">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Privacy" title="Retention and minimization" />
            <div className="space-y-2 px-5 pb-5">
              {[
                ["Raw content", "24h encrypted TTL"],
                ["Hashes + labels", "400 days"],
                ["Evidence snapshots", "sanitized"],
                ["PII redaction", "at the edge"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-[var(--line)] px-2.5 py-2 text-[9.5px]">
                  <span className="flex items-center gap-1.5 text-[var(--muted)]"><LockKeyhole size={10} aria-hidden /> {label}</span>
                  <span className="text-[var(--text-soft)]">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Session" title="Your access" />
            <div className="px-5 pb-5">
              {current ? (
                <>
                  <p className="text-[11.5px] font-medium">{current.name}</p>
                  <p className="text-[9.5px] text-[var(--muted)]">{current.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <RoleChip role={current.role} />
                    <span className="chip">{capabilities(current.role).length} capabilities</span>
                  </div>
                </>
              ) : null}
              <div className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3 text-[9px] text-[var(--muted-dim)]">
                <p className="flex items-center gap-1.5"><KeyRound size={10} aria-hidden /> signed session · expires after 8h</p>
                <p className="flex items-center gap-1.5"><ScrollText size={10} aria-hidden /> your actions are audit-logged</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead eyebrow="Docs" title="Operate it" />
            <div className="space-y-1 px-5 pb-5 text-[10px]">
              {[
                ["Architecture + tradeoffs", "README.md"],
                ["Threat model (STRIDE)", "docs/THREAT-MODEL.md"],
                ["Architecture decisions", "docs/adr/"],
                ["Evaluation report", "docs/EVALUATION.md"],
              ].map(([label, file]) => (
                <div key={label} className="flex items-center justify-between gap-2 border-b border-[var(--line)] py-1.5 last:border-0">
                  <span className="text-[var(--text-soft)]">{label}</span>
                  <code className="text-[8px] text-[var(--muted-dim)]">{file}</code>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <p className="mt-3 text-center text-[8.5px] text-[var(--muted-dim)]">
        Demo fleet: {store.agents.length} synthetic agents · {store.events.length.toLocaleString()} events · configuration changes are audit-logged.
      </p>
    </div>
  );
}
