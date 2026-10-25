"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const PROMISES = [
  { title: "Behavior, not permissions", body: "A valid token proves identity, not intent. We compare live behavior with the declared role." },
  { title: "Explainable by design", body: "Every alert decomposes into named contributions that always sum to the risk score." },
  { title: "Contain without disruption", body: "Restrict blocks the exact class, tool or destination. Legitimate work keeps flowing." },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(780px 420px at 14% 8%, rgba(201,247,111,0.12), transparent 66%), radial-gradient(620px 380px at 88% 92%, rgba(242,163,90,0.10), transparent 62%)",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh max-w-[1360px] flex-col px-4 py-4 sm:px-6 sm:py-5">
        <header className="flex items-center justify-between">
          <Link href="/" className="focus-ring inline-flex items-center gap-2.5" aria-label="Back to Driftwatch home">
            <svg width="34" height="34" viewBox="0 0 40 40" role="img" aria-label="Driftwatch">
              <rect width="40" height="40" rx="13" fill="var(--white)" />
              <circle cx="20" cy="20" r="10.5" fill="none" stroke="var(--bg)" strokeWidth="2" />
              <circle cx="20" cy="20" r="5" fill="none" stroke="var(--bg)" strokeWidth="2" />
              <path d="M27 13 L34 6" stroke="var(--bg)" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="20" cy="20" r="2" fill="var(--orange)" />
            </svg>
            <span className="hidden leading-none sm:block">
              <span className="display-tight block text-[16px] tracking-[0.08em]">Driftwatch</span>
              <span className="mt-1 block text-[8px] uppercase tracking-[0.22em] text-[var(--muted-dim)]">
                identity continuity
              </span>
            </span>
          </Link>
          <Link
            href="/"
            className="focus-ring pill !h-9 !text-[12px]"
          >
            <ArrowLeft size={13} aria-hidden /> Back to site
          </Link>
        </header>

        <main className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 lg:py-10">
          {/* ------------------------------------------------------- brand */}
          <section className="animate-in max-w-[560px]">
            <span className="chip chip-lime mb-5">
              <span className="live-dot" /> Demo fleet online
            </span>
            <h1 className="display text-[clamp(38px,5.4vw,66px)] leading-[0.88]">
              Agents drift.
              <br />
              <span className="text-[var(--lime)]">Credentials</span> don&apos;t.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
              A valid token proves who an agent is, not what it has become. Driftwatch learns each
              agent&apos;s normal behavior, compares it with the role it was created for, and contains
              the drift without stopping legitimate work.
            </p>

            <ul className="mt-8 space-y-3 border-t border-[var(--line)] pt-6">
              {PROMISES.map((promise) => (
                <li key={promise.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--lime-soft)] text-[var(--lime)]">
                    <ShieldCheck size={14} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-semibold">{promise.title}</span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-[var(--muted)]">
                      {promise.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-8 grid max-w-[480px] grid-cols-3 gap-4 border-t border-[var(--line)] pt-5">
              {[
                { label: "Agents under watch", value: "60" },
                { label: "Median detection", value: "38s" },
                { label: "False positive rate", value: "3.7%" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dd className="metric-sm text-[24px] font-bold leading-none">{stat.value}</dd>
                  <dt className="mt-1.5 text-[8.5px] uppercase tracking-[0.12em] text-[var(--muted-dim)]">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
          </section>

          {/* --------------------------------------------------------- form */}
          <section className="panel w-full max-w-[460px] justify-self-center p-6 sm:p-7 lg:justify-self-end">
            <p className="eyebrow mb-2">{eyebrow}</p>
            <h2 className="display-tight text-[26px] uppercase">{title}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">{subtitle}</p>
            <div className="mt-6">{children}</div>
            <div className="mt-6 border-t border-[var(--line)] pt-4">{footer}</div>
          </section>
        </main>
      </div>
    </div>
  );
}
