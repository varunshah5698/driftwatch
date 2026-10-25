"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserPlus,
} from "lucide-react";
import { startGoogleSignIn, supabaseConfigured } from "@/lib/supabase";

const DEMO_ACCOUNTS = [
  { email: "analyst@driftwatch.dev", label: "Security analyst", note: "triage · contain" },
  { email: "admin@driftwatch.dev", label: "Admin", note: "full control" },
  { email: "owner@driftwatch.dev", label: "Agent owner", note: "manifests" },
  { email: "auditor@driftwatch.dev", label: "Auditor", note: "read + export" },
];

/* ------------------------------------------------------------ google sso */
function GoogleButton({ mode }: { mode: "signin" | "signup" }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    const origin = window.location.origin;
    const { url, error } = await startGoogleSignIn(`${origin}/api/auth/oauth/callback`);
    setPending(false);
    if (error) {
      setError(error);
      return;
    }
    if (url) window.location.assign(url);
  };

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="btn h-11 w-full !text-[13px]"
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : (
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
        )}
        {mode === "signup" ? "Continue with Google" : "Sign in with Google"}
      </button>
      {error ? (
        <p role="alert" className="mt-2.5 text-[10.5px] leading-relaxed text-[var(--red)]">
          {error}
        </p>
      ) : null}
      {!supabaseConfigured && !error ? (
        <p className="mt-2.5 text-[10px] leading-relaxed text-[var(--muted-dim)]">
          Google sign-in activates once Supabase is configured — set{" "}
          <code className="text-[var(--text-soft)]">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-[var(--text-soft)]">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </p>
      ) : null}
    </div>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--line)]" />
      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-dim)]">or</span>
      <span className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow mb-2 block">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-dim)]" aria-hidden>
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] pl-11 pr-4 text-[13px] text-[var(--text)] outline-none transition-colors focus:border-[var(--line-strong)]";

/* --------------------------------------------------------------- sign in */
export function SignInForm() {
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
      router.push("/overview");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} aria-describedby="signin-error">
      <GoogleButton mode="signin" />
      <Divider />

      <div className="space-y-4">
        <Field id="email" label="Work email" icon={<Mail size={15} />}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            aria-label="Email address"
          />
        </Field>

        <Field id="password" label="Password" icon={<LockKeyhole size={15} />}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${inputClass} pr-12`}
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
        </Field>
      </div>

      <p id="signin-error" role="alert" className="mt-3 min-h-[16px] text-[11.5px] text-[var(--red)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary mt-1 h-11 w-full justify-between !text-[13px]"
      >
        <span>{loading ? "Verifying…" : "Enter the operations console"}</span>
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowRight size={15} aria-hidden />}
      </button>

      <p className="mt-4 text-center text-[11.5px] text-[var(--muted)]">
        New here?{" "}
        <Link href="/signup" className="focus-ring font-semibold text-[var(--lime)] hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-3">
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
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-left transition-colors hover:border-[var(--line-strong)]"
            >
              <span className="block text-[11px] font-medium">{account.label}</span>
              <span className="block text-[9.5px] text-[var(--muted-dim)]">{account.note}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-dim)]">
          Every demo account uses <code className="text-[var(--text-soft)]">driftwatch-demo</code>.
          Sessions are signed, HttpOnly and expire in 8 hours.
        </p>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- sign up */
export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to create the account.");
        return;
      }
      router.push("/overview");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const strength = Math.min(4, Math.floor(password.length / 4));
  const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"][strength] ?? "Too short";

  return (
    <form onSubmit={submit} aria-describedby="signup-error">
      <GoogleButton mode="signup" />
      <Divider />

      <div className="space-y-4">
        <Field id="name" label="Full name" icon={<UserPlus size={15} />}>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nadia Park"
            className={inputClass}
            aria-label="Full name"
          />
        </Field>

        <Field id="email" label="Work email" icon={<Mail size={15} />}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className={inputClass}
            aria-label="Email address"
          />
        </Field>

        <Field id="password" label="Password" icon={<LockKeyhole size={15} />}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            className={`${inputClass} pr-12`}
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
        </Field>
      </div>

      {password.length > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
            <span
              className="block h-full rounded-full transition-colors"
              style={{
                width: `${(strength / 4) * 100}%`,
                background: strength <= 1 ? "var(--red)" : strength === 2 ? "var(--orange)" : "var(--lime)",
              }}
            />
          </span>
          <span className="text-[10px] text-[var(--muted-dim)]">{strengthLabel}</span>
        </div>
      ) : null}

      <p id="signup-error" role="alert" className="mt-3 min-h-[16px] text-[11.5px] text-[var(--red)]">
        {error}
      </p>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary mt-1 h-11 w-full justify-between !text-[13px]"
      >
        <span>{loading ? "Creating account…" : "Create account"}</span>
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <ArrowRight size={15} aria-hidden />}
      </button>

      <p className="mt-4 text-center text-[11.5px] text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="focus-ring font-semibold text-[var(--lime)] hover:underline">
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-[var(--muted-dim)]">
        By continuing you agree to the synthetic-data notice: every seeded agent, event and alert in
        this demo is generated, and no real credentials are stored.
      </p>
    </form>
  );
}
