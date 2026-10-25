import { AppShell } from "@/components/shell";
import { requireUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const store = getStore();
  const openAlerts = store.alerts.filter((alert) =>
    ["open", "acknowledged", "escalated"].includes(alert.status),
  ).length;
  const agents = store.agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
  }));

  return (
    <AppShell user={user} openAlerts={openAlerts} agents={agents}>
      {children}
    </AppShell>
  );
}
