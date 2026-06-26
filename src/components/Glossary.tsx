import type { GlossaryItem, Guidance } from "@/types/exercise";

/**
 * Glossar + Schreib-Hinweise ("So beschreibst du Messdaten sauber") als
 * aufklappbare Details — wie im Mockup (Karte 02, untere Hälfte).
 */
export function Glossary({ items, guidance }: { items: GlossaryItem[]; guidance: Guidance }) {
  return (
    <div className="glossary">
      <details>
        <summary>Fachvokabular auf einen Blick</summary>
        <div className="term-body">
          {items.map((g) => (
            <p key={g.term}>
              <b>{g.term}</b> — {g.definition}
            </p>
          ))}
        </div>
      </details>
      <details>
        <summary>{guidance.title}</summary>
        <div className="term-body">
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {guidance.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      </details>
    </div>
  );
}
