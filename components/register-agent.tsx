"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { ROLE_TEMPLATES } from "@/lib/data/roles";

export function RegisterAgent({
  owners,
  canRegister,
}: {
  owners: { id: string; name: string }[];
  canRegister: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(ROLE_TEMPLATES[0].id);
  const [environment, setEnvironment] = useState("production");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash === "#register") setOpen(true);
    const onHash = () => {
      if (window.location.hash === "#register") setOpen(true);
    };
    window.addEventListener("hashchange", onHash);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, templateId, environment, ownerId }),
    });
    const payload = (await response.json()) as { error?: string; agent?: { id: string } };
    setLoading(false);
    if (!response.ok || !payload.agent) {
      setError(payload.error ?? "Unable to register agent.");
      return;
    }
    setOpen(false);
    router.push(`/agents/${payload.agent.id}`);
    router.refresh();
  };

  const template = ROLE_TEMPLATES.find((candidate) => candidate.id === templateId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canRegister}
        className="btn btn-primary !h-10"
        title={canRegister ? "Register an agent" : "Your role cannot register agents"}
      >
        <Plus size={14} aria-hidden /> Register agent
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="panel my-8 w-full max-w-[560px] p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="eyebrow mb-2">Agent registry</p>
                <h2 id="register-title" className="display-tight text-[24px] uppercase">
                  Register an agent
                </h2>
                <p className="mt-2 max-w-[42ch] text-[11.5px] leading-relaxed text-[var(--muted)]">
                  The template seeds cold-start priors. Thresholds start wide and narrow as
                  signed telemetry arrives.
                </p>
              </div>
              <button type="button" className="icon-btn h-8 w-8" onClick={() => setOpen(false)} aria-label="Close registration dialog">
                <X size={15} aria-hidden />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label htmlFor="agent-name" className="eyebrow mb-2 block">Agent name</label>
                <input
                  id="agent-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={3}
                  maxLength={60}
                  placeholder="Procurement Vega"
                  className="h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-4 text-[13px] outline-none focus:border-[var(--line-strong)]"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="agent-template" className="eyebrow mb-2 block">Role template</label>
                  <select
                    id="agent-template"
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    className="h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-4 text-[12px] outline-none"
                  >
                    {ROLE_TEMPLATES.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="agent-env" className="eyebrow mb-2 block">Environment</label>
                  <select
                    id="agent-env"
                    value={environment}
                    onChange={(event) => setEnvironment(event.target.value)}
                    className="h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-4 text-[12px] outline-none"
                  >
                    <option value="production">Production</option>
                    <option value="staging">Staging</option>
                    <option value="development">Development</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="agent-owner" className="eyebrow mb-2 block">Owner</label>
                <select
                  id="agent-owner"
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                  className="h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-4 text-[12px] outline-none"
                >
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>{owner.name}</option>
                  ))}
                </select>
              </div>
              {template ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3 text-[10.5px] leading-relaxed text-[var(--muted)]">
                  <p className="mb-1 font-semibold text-[var(--text-soft)]">Declared scope preview</p>
                  <p><span className="text-[var(--muted-dim)]">Tools:</span> {template.tools.join(", ")}</p>
                  <p><span className="text-[var(--muted-dim)]">Data:</span> {template.dataClasses.join(", ")}</p>
                  <p><span className="text-[var(--muted-dim)]">Egress:</span> {template.destinations.join(", ")}</p>
                </div>
              ) : null}
              {error ? <p role="alert" className="text-[11.5px] text-[var(--red)]">{error}</p> : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Registering…" : "Create with priors"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
