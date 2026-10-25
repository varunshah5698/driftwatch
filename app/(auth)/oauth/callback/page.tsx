"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

type Phase = "working" | "failed";

/**
 * OAuth landing pad. Supabase redirects here with a PKCE code; we exchange it
 * for a session, then hand the access token to /api/auth/oauth/session which
 * re-verifies it server-side before issuing the Driftwatch cookie.
 */
function CallbackInner() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      if (!supabaseConfigured) {
        setMessage(
          "Google sign-in is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then enable the Google provider in Supabase.",
        );
        setPhase("failed");
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        setPhase("failed");
        setMessage("Google sign-in is not configured on this deployment.");
        return;
      }

      const code = params.get("code");
      const errorDescription = params.get("error_description");
      if (!code) {
        setPhase("failed");
        setMessage(errorDescription ?? "No authorization code was returned by Google.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setPhase("failed");
        setMessage(error.message || "Could not complete the Google sign-in.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setPhase("failed");
        setMessage("Google sign-in did not return a session. Try again.");
        return;
      }

      const response = await fetch("/api/auth/oauth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setPhase("failed");
        setMessage(payload.error ?? "Could not start your Driftwatch session.");
        return;
      }

      // Clear the Supabase session from browser storage; our own signed,
      // HttpOnly cookie is the session of record for the console.
      await supabase.auth.signOut().catch(() => undefined);
      window.location.assign("/overview");
    };

    void run();
  }, [params]);

  if (phase === "working") {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <Loader2 size={26} className="animate-spin text-[var(--lime)]" aria-hidden />
        <p className="text-[13px] text-[var(--muted)]">Verifying your Google identity…</p>
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[var(--red-soft)] p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[var(--red)]" aria-hidden />
          <div>
            <p className="text-[13px] font-semibold">Could not complete Google sign-in</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-soft)]">{message}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/login" className="btn btn-primary !h-10 !text-[12.5px]">
          Back to sign in
        </Link>
        <Link href="/signup" className="btn !h-10 !text-[12.5px]">
          Create an account instead
        </Link>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <div className="mx-auto max-w-[520px] px-4 py-12">
      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 size={26} className="animate-spin text-[var(--lime)]" aria-hidden />
          </div>
        }
      >
        <CallbackInner />
      </Suspense>
    </div>
  );
}
