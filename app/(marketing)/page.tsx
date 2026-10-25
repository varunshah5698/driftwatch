import Link from "next/link";
import {
  ArrowRight,
  Check,
  Fingerprint,
  Gauge,
  GitBranch,
  Network,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import { HeroScene } from "@/components/hero-scene";

export const metadata = {
  title: "Driftwatch · Identity drift detection for autonomous AI agents",
  description:
    "Agents drift. Credentials don't. Driftwatch learns each agent's normal behavior, compares it with the role it was created for, and contains the drift without stopping legitimate work.",
  robots: { index: true, follow: true },
};

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#scenario", label: "The attack" },
  { href: "#platform", label: "Platform" },
  { href: "#pricing", label: "Pricing" },
];

const PILLARS = [
  {
    icon: Fingerprint,
    title: "Role alignment score",
    body: "A 0–100 score that decomposes into named contributions which always sum to the total. No black box, no unexplained alerts.",
  },
  {
    icon: Radar,
    title: "Indirect injection taint",
    body: "Follows an untrusted document, web page or peer message to the exact actions it influenced, and shows the causal thread.",
  },
  {
    icon: ShieldCheck,
    title: "Surgical containment",
    body: "Restrict blocks the exact data class, tool or destination. The agent's valid token keeps working for everything declared in its role.",
  },
];

const STEPS = [
  { n: "01", title: "Register the role", body: "A versioned YAML manifest declares tools, data classes, destinations, operating hours and call depth." },
  { n: "02", title: "Learn the baseline", body: "Tool frequency, data distribution, Markov action transitions, egress volume and delegation graph — with a wide band for new agents." },
  { n: "03", title: "Compare continuously", body: "Scope, drift, sequence, exfiltration, delegation and injection are scored on every event window." },
  { n: "04", title: "Contain with evidence", body: "Every alert ships with its taint path, its contributing factors and a reversible, audit-logged response." },
];

const FACTORS = [
  { key: "scope", label: "Role scope", weight: "hard rules, weighted high" },
  { key: "drift", label: "Distributional drift", weight: "Jensen–Shannon divergence" },
  { key: "sequence", label: "Sequence anomaly", weight: "Markov transition likelihood" },
  { key: "exfil", label: "Exfiltration signal", weight: "sensitive read → egress" },
  { key: "delegation", label: "Delegation anomaly", weight: "unknown sub-agents, depth spikes" },
  { key: "injection", label: "Injection taint", weight: "untrusted input → action" },
];

const FOOTER_COLS = [
  { title: "Product", links: ["Overview", "Agent directory", "Simulation lab", "Role manifests"] },
  { title: "Developers", links: ["REST API", "TypeScript SDK", "Python SDK", "Ingestion signing"] },
  { title: "Company", links: ["Security", "Threat model", "Status", "Contact"] },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 40 40" role="img" aria-label="Driftwatch">
        <rect width="40" height="40" rx="13" fill="var(--white)" />
        <circle cx="20" cy="20" r="10.5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <circle cx="20" cy="20" r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />
        <path d="M27 13 L34 6" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="20" cy="20" r="2" fill="var(--orange)" />
      </svg>
      {!compact ? (
        <span className="hidden leading-none sm:block">
          <span className="display-tight block text-[16px] tracking-[0.08em]">Driftwatch</span>
          <span className="mt-1 block text-[8px] uppercase tracking-[0.22em] text-[var(--muted-dim)]">
            identity continuity
          </span>
        </span>
      ) : null}
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      {/* ------------------------------------------------------------- nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="focus-ring shrink-0" aria-label="Driftwatch home">
            <Logo />
          </Link>
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Marketing">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="focus-ring rounded-full px-3 py-2 text-[12.5px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--panel)] hover:text-[var(--text)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="focus-ring pill !h-10 !text-[12.5px]">
              Sign in
            </Link>
            <Link href="/signup" className="focus-ring btn btn-primary !h-10 !text-[12.5px]">
              Start free <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(900px 480px at 76% 22%, rgba(201,247,111,0.10), transparent 68%), radial-gradient(760px 420px at 12% 88%, rgba(242,163,90,0.08), transparent 66%)",
          }}
        />
        <HeroScene className="pointer-events-none absolute inset-y-0 right-0 h-full w-full lg:w-[58%]" />

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="animate-in max-w-[640px]">
            <span className="chip chip-lime mb-6">
              <span className="live-dot" /> Now monitoring 60 demo agents
            </span>
            <h1 className="display text-[clamp(44px,7.2vw,84px)] leading-[0.86]">
              Agents drift.
              <br />
              <span className="text-[var(--lime)]">Credentials</span> don&apos;t.
            </h1>
            <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-[var(--text-soft)]">
              A valid token proves who an agent is — not what it has become. Driftwatch learns each
              agent&apos;s normal behavior, compares it with the role it was created for, and contains
              the drift without stopping legitimate work.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="focus-ring btn btn-primary !h-12 !px-6 !text-[14px]">
                Open the demo console <ArrowRight size={16} aria-hidden />
              </Link>
              <a href="#scenario" className="focus-ring btn !h-12 !px-5 !text-[13.5px]">
                See the attack replay
              </a>
            </div>

            <dl className="mt-10 grid max-w-[560px] grid-cols-3 gap-4 border-t border-[var(--line)] pt-6">
              {[
                { label: "Agents under watch", value: "60" },
                { label: "Median detection", value: "38s" },
                { label: "False positive rate", value: "3.7%" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dd className="metric-sm text-[30px] font-bold leading-none">{stat.value}</dd>
                  <dt className="mt-1.5 text-[9.5px] uppercase tracking-[0.12em] text-[var(--muted-dim)]">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
          {/* Spacer column keeps the 3D scene readable on large screens. */}
          <div className="hidden lg:block" aria-hidden />
        </div>
      </section>

      {/* --------------------------------------------------- problem strip */}
      <section className="border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
            <div>
              <p className="eyebrow mb-3">The gap</p>
              <h2 className="display-tight text-[clamp(26px,3.4vw,40px)] leading-tight">
                Permission checks pass
                <br />
                while the agent is compromised.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--red)_34%,transparent)] bg-[var(--red-soft)] p-4">
                <p className="text-[13px] font-semibold text-[var(--red)]">Valid identity, stolen intent</p>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-soft)]">
                  A hidden instruction in a supplier PDF turns a procurement agent into an HR-data
                  scraper. Its token is still valid, so every access check still passes.
                </p>
              </div>
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--orange)_34%,transparent)] bg-[var(--orange-soft)] p-4">
                <p className="text-[13px] font-semibold text-[var(--orange)]">No history to compare</p>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-soft)]">
                  Short-lived agents have no baseline. Role templates and priors keep coverage honest
                  until real events accumulate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ how it works */}
      <section id="how" className="scroll-mt-24 border-b border-[var(--line)]">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-[52ch]">
            <p className="eyebrow mb-3">How it works</p>
            <h2 className="display-tight text-[clamp(26px,3.4vw,40px)] leading-tight">
              Four steps from registration to containment.
            </h2>
          </div>
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step) => (
              <li key={step.n} className="panel panel-pad flex flex-col">
                <span className="metric-sm text-[26px] font-bold leading-none text-[var(--lime)]">
                  {step.n}
                </span>
                <h3 className="display-tight mt-4 text-[15px] uppercase tracking-wide">{step.title}</h3>
                <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--muted)]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------- scenario */}
      <section id="scenario" className="scroll-mt-24 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-[56ch]">
            <p className="eyebrow mb-3">The attack · end to end</p>
            <h2 className="display-tight text-[clamp(26px,3.4vw,40px)] leading-tight">
              A poisoned PDF, caught in 38 seconds.
            </h2>
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--muted)]">
              This exact scenario ships in the demo console and in the simulation lab. Every number
              below is produced by the same engine that scores live telemetry.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="panel panel-pad">
              <span className="chip chip-orange mb-4">Step 1 · the bait</span>
              <h3 className="display-tight text-[15px] uppercase tracking-wide">
                supplier-acme-pricing.pdf
              </h3>
              <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                A white-on-white instruction block is buried in the extracted text. The document is
                marked <span className="text-[var(--orange)]">untrusted</span> at the edge; only its
                hash and classification are stored.
              </p>
            </div>
            <div className="panel panel-pad">
              <span className="chip chip-red mb-4">Step 2 · the drift</span>
              <h3 className="display-tight text-[15px] uppercase tracking-wide">Out-of-role access</h3>
              <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                Within six steps the agent reads <span className="text-[var(--text-soft)]">hr.salary</span>{" "}
                and <span className="text-[var(--text-soft)]">hr.performance</span> — classes no
                procurement manifest declares.
              </p>
            </div>
            <div className="panel panel-pad">
              <span className="chip chip-lime mb-4">Step 3 · the response</span>
              <h3 className="display-tight text-[15px] uppercase tracking-wide">Restrict, don&apos;t stop</h3>
              <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                Egress to <span className="text-[var(--text-soft)]">45.83.211.19</span> and{" "}
                <span className="text-[var(--text-soft)]">exfil-relay.top</span> is denied while{" "}
                <span className="text-[var(--text-soft)]">supplier.search</span> keeps working. The
                token stays valid.
              </p>
            </div>
          </div>

          {/* Live-looking evidence strip */}
          <div className="panel mt-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3">
              <span className="chip chip-red">
                <ShieldAlert size={11} aria-hidden /> Critical · 100
              </span>
              <span className="text-[12.5px] font-semibold">
                Prompt injection with outbound data exfiltration
              </span>
              <span className="ml-auto text-[10px] text-[var(--muted-dim)]">
                detected in 38s · confidence 86%
              </span>
            </div>
            <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Exfiltration signal", points: 31, note: "2 new destinations · max 3.3 MiB" },
                { label: "Injection taint", points: 27, note: "supplier PDF → 6 steps → 5 actions" },
                { label: "Role scope", points: 25, note: "5 violation types · 2 restricted reads" },
                { label: "Distributional drift", points: 10, note: "JS divergence 0.25 max" },
                { label: "Sequence anomaly", points: 5, note: "low-probability transition" },
                { label: "Delegation anomaly", points: 2, note: "depth 2 above manifest" },
              ].map((factor) => (
                <div
                  key={factor.label}
                  className="border-b border-[var(--line)] px-5 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(3n)]:border-r-0 lg:last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] font-medium text-[var(--text-soft)]">
                      {factor.label}
                    </span>
                    <span className="metric-sm text-[13px] font-bold text-[var(--lime)]">
                      +{factor.points}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full bg-[var(--lime)]"
                      style={{ width: `${factor.points * 3.2}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-[var(--muted-dim)]">{factor.note}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-5 py-3 text-[11px] text-[var(--muted)]">
              <Check size={13} className="text-[var(--lime)]" aria-hidden />
              Σ contributions = 100 = risk score. Every alert decomposes like this.
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- platform */}
      <section id="platform" className="scroll-mt-24 border-b border-[var(--line)]">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-[52ch]">
            <p className="eyebrow mb-3">The platform</p>
            <h2 className="display-tight text-[clamp(26px,3.4vw,40px)] leading-tight">
              Built for the questions permission checks cannot answer.
            </h2>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title} className="panel panel-pad">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--lime-soft)] text-[var(--lime)]">
                    <Icon size={19} aria-hidden />
                  </span>
                  <h3 className="display-tight mt-4 text-[16px] uppercase tracking-wide">
                    {pillar.title}
                  </h3>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                    {pillar.body}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Score decomposition */}
          <div className="panel mt-3 grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="border-b border-[var(--line)] p-6 lg:border-b-0 lg:border-r">
              <p className="eyebrow mb-3">Explainable scoring</p>
              <h3 className="display-tight text-[20px] leading-tight">
                Six weighted signals.
                <br />
                One auditable number.
              </h3>
              <p className="mt-3 text-[12px] leading-relaxed text-[var(--muted)]">
                A weighted logistic model turns normalized signals into a 0–100 score. Contributions
                are allocated from log-odds, rounded to integers, and the remainder is assigned to the
                strongest factor — so the sum always matches the total you see.
              </p>
              <Link href="/signup" className="focus-ring btn btn-primary mt-5 !h-10 !text-[12.5px]">
                Open the console <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {FACTORS.map((factor) => (
                <li key={factor.key} className="flex items-center gap-4 px-6 py-4">
                  <span className="metric-sm w-[70px] shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--muted-dim)]">
                    {factor.key}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{factor.label}</span>
                    <span className="block text-[11px] text-[var(--muted)]">{factor.weight}</span>
                  </span>
                  <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[var(--line)]">
                    <span
                      className="block h-full rounded-full bg-[var(--orange)]"
                      style={{
                        width:
                          factor.key === "scope"
                            ? "100%"
                            : factor.key === "exfil"
                              ? "83%"
                              : factor.key === "injection"
                                ? "70%"
                                : factor.key === "drift"
                                  ? "52%"
                                  : factor.key === "sequence"
                                    ? "48%"
                                    : "44%",
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Capability grid */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: GitBranch, title: "Agent chains", body: "Force-directed delegation graph with blast radius and propagation highlighting." },
              { icon: Gauge, title: "Containment ladder", body: "Monitor → Notify → Step-up → Restrict → Quarantine → Isolate, all reversible." },
              { icon: Waypoints, title: "Cold-start priors", body: "Role templates give new agents a wide, honest band until history accumulates." },
              { icon: Network, title: "Gateway proxy", body: "Policy-as-code evaluated on every tool call, with dry-run previews and rollback." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="panel panel-pad">
                  <Icon size={18} className="text-[var(--orange)]" aria-hidden />
                  <h3 className="mt-3 text-[13px] font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--muted)]">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- pricing */}
      <section id="pricing" className="scroll-mt-24 border-b border-[var(--line)] bg-[var(--panel-soft)]">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="mb-10 max-w-[52ch]">
            <p className="eyebrow mb-3">Pricing</p>
            <h2 className="display-tight text-[clamp(26px,3.4vw,40px)] leading-tight">
              Start on a demo fleet. Scale when you&apos;re ready.
            </h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              { name: "Sandbox", price: "Free", note: "forever", points: ["Synthetic 60-agent fleet", "Full console + simulation lab", "HMAC-signed ingestion", "No real credentials"], cta: "Open the demo", featured: false },
              { name: "Team", price: "$49", note: "per seat / month", points: ["Your own agent registry", "Postgres + Redis + S3", "SIEM, Slack and email exports", "Change management + feedback loop"], cta: "Start free trial", featured: true },
              { name: "Enterprise", price: "Custom", note: "annual", points: ["Self-hosted or VPC", "OIDC / SSO + SCIM", "Helm + Terraform", "Dedicated response runbook"], cta: "Talk to security", featured: false },
            ].map((tier) => (
              <div
                key={tier.name}
                className={`panel panel-pad flex flex-col ${
                  tier.featured ? "border-[color-mix(in_srgb,var(--lime)_45%,transparent)]" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="display-tight text-[16px] uppercase tracking-wide">{tier.name}</h3>
                  {tier.featured ? <span className="chip chip-lime">Most teams</span> : null}
                </div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="metric-sm text-[36px] font-bold leading-none">{tier.price}</span>
                  <span className="text-[11px] text-[var(--muted)]">{tier.note}</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {tier.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[12px] text-[var(--text-soft)]">
                      <Check size={14} className="mt-0.5 shrink-0 text-[var(--lime)]" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`focus-ring btn mt-6 !h-11 !text-[13px] ${tier.featured ? "btn-primary" : ""}`}
                >
                  {tier.cta} <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA */}
      <section className="border-b border-[var(--line)]">
        <div className="mx-auto max-w-[1240px] px-4 py-20 text-center sm:px-6">
          <h2 className="display text-[clamp(30px,5vw,58px)] leading-[0.9]">
            Stop trusting the token.
            <br />
            <span className="text-[var(--lime)]">Start watching the behavior.</span>
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="focus-ring btn btn-primary !h-12 !px-6 !text-[14px]">
              Create a free account <ArrowRight size={16} aria-hidden />
            </Link>
            <Link href="/login" className="focus-ring btn !h-12 !px-6 !text-[13.5px]">
              I already have one
            </Link>
          </div>
          <p className="mt-5 text-[11px] text-[var(--muted-dim)]">
            No credit card. Every seeded agent, event and alert is synthetic.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- footer */}
      <footer className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[34ch] text-[12px] leading-relaxed text-[var(--muted)]">
              Identity drift detection for autonomous AI agents. Learn the role, watch the behavior,
              contain the drift.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="eyebrow mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link}>
                    <span className="text-[12px] text-[var(--muted)] transition-colors hover:text-[var(--text)]">
                      {link}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--line)] pt-6 text-[11px] text-[var(--muted-dim)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Driftwatch. Synthetic demo data throughout.</span>
          <span className="inline-flex items-center gap-4">
            <span>Security</span>
            <span>Privacy</span>
            <span>Status</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
