import { PageHeader } from "@/components/ui";
import { SimulationLab } from "@/components/simulation-lab";
import { getSimulationSuite } from "@/lib/engine/simulate";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata = { title: "Simulation lab" };

export default async function SimulationPage() {
  const { results, summary } = getSimulationSuite();
  const user = await getSessionUser();

  return (
    <div>
      <PageHeader
        eyebrow="Adversarial validation"
        title="Simulation Lab"
        description="Red-team the engine itself. Every scenario is replayed through the same ingestion, taint and scoring code as production — no recorded answers."
        meta={
          <>
            <span className="chip chip-lime">5 attack patterns</span>
            <span className="chip">3 benign controls</span>
            <span className="chip">replayable sessions</span>
            <span className="chip">metrics recomputed live</span>
          </>
        }
      />
      <SimulationLab
        initialResults={results}
        initialSummary={summary}
        canRun={Boolean(user && can(user.role, "simulation:run"))}
      />
      <div className="panel mt-3 p-5">
        <p className="eyebrow mb-2">Evaluation methodology</p>
        <div className="grid gap-4 text-[10.5px] leading-relaxed text-[var(--muted)] md:grid-cols-3">
          <p>
            <span className="text-[var(--text-soft)]">Labels.</span> Attack steps are marked at
            generation time. An attack counts as detected when the cumulative score crosses 50
            before the session ends; benign controls must stay below it for the whole replay.
          </p>
          <p>
            <span className="text-[var(--text-soft)]">Latency.</span> Measured as the number of
            signed steps and wall-clock telemetry time between the first adversarial action and
            the first alert. Seeded detection latency is p50 38 seconds.
          </p>
          <p>
            <span className="text-[var(--text-soft)]">Limits.</span> Eight curated scenarios are a
            regression suite, not a production benchmark. Use the replay API with recorded
            sessions to evaluate threshold changes before applying them.
          </p>
        </div>
      </div>
    </div>
  );
}
