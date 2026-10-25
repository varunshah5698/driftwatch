import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/overview");

  return (
    <AuthShell
      eyebrow="Operations console"
      title="Sign in"
      subtitle="Role-scoped access for analysts, owners, auditors and admins."
      footer={
        <p className="text-center text-[11px] leading-relaxed text-[var(--muted-dim)]">
          All seeded agents, events and alerts are synthetic. Ingested content is sanitized and never
          rendered as HTML. Authentication uses scrypt hashing with per-user salts.
        </p>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
