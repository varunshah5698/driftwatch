"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "analyst@driftwatch.dev", label: "Security analyst", note: "triage · contain" },
  { email: "admin@driftwatch.dev", label: "Admin", note: "full control" },
  { email: "owner@driftwatch.dev", label: "Agent owner", note: "manifests" },
  { email: "auditor@driftwatch.dev", label: "Auditor", note: "read + export" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("analyst@driftwatch.dev");
  const [password, setPassword] = useState("driftwatch-demo");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-describedby="login-error">
      <div>
        <label htmlFor="email" className="eyebrow mb-2 block">
          Work email
        </label>
        <div className="relative">
          <Mail size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-dim)]" aria-hidden />
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] pl-11 pr-4 text-[13px] text-[var(--text)] outline-none transition-colors focus:border-[var(--line-strong)]"
            aria-label="Email address"
          />
        </div>
      </div>
      <div>
        <label htmlFor="password" className="eyebrow mb-2 block">
          Password
        </label>
        <div className="relative">
          <LockKeyhole size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-dim)]" aria-hidden />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] pl-11 pr-12 text-[13px] text-[var(--text)] outline-none transition-colors focus:border-[var(--line-strong)]"
            aria-label="Password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-hi)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
          </button>
        </div>
      </div>
      <p id="login-error" role="alert" className="min-h-[18px] text-[11.5px] text-[var(--red)]">
        {error}
      </p>
      <button type="submit" disabled={loading} className="btn btn-primary h-12 w-full justify-between px-5 text-[13px]">
        <span>{loading ? "Verifying…" : "Enter the operations console"}</span>
        {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ArrowRight size={16} aria-hidden />}
      </button>

      <div className="pt-1">
        <p className="eyebrow mb-2">Demo identities</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword("driftwatch-demo");
                setError(null);
              }}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-left transition-colors hover:border-[var(--line-strong)]"
            >
              <span className="block text-[11px] font-medium text-[var(--text)]">{account.label}</span>
              <span className="block text-[9.5px] text-[var(--muted-dim)]">{account.note}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-[var(--muted-dim)]">
          Every demo account uses <code className="text-[var(--text-soft)]">driftwatch-demo</code>.
          Sessions are signed, HttpOnly and expire in 8 hours.
        </p>
      </div>
    </form>
  );
}
