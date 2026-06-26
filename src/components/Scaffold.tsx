import type { ScaffoldStep } from "@/types/exercise";

/** Schreib-Gerüst (4 Schritte vom Sehen zum Verstehen) aus exercise.scaffold. */
export function Scaffold({ steps }: { steps: ScaffoldStep[] }) {
  return (
    <div className="card">
      <h3>04 · Schreib-Gerüst</h3>
      <div className="body scaffold">
        <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 13.5 }}>
          Nutze diese vier Schritte als Stütze — sie führen vom Sehen zum Verstehen:
        </p>
        <ol>
          {steps.map((s, i) => (
            <li key={i}>
              <b>{s.step}.</b> {s.text}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
