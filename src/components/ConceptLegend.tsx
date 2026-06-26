import type { LegendItem } from "@/types/exercise";

/** Achsen-/Konzept-Legende ("Was bedeutet was?") aus exercise.legend. */
export function ConceptLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <div className="axis-row" key={it.key}>
          <span className="swatch" style={{ background: it.color }} />
          <div>
            <b style={{ color: it.color }}>{it.label}</b>
            <span className="hint">{it.hint}</span>
          </div>
          {it.colorName ? <code>{it.colorName}</code> : <span />}
        </div>
      ))}
    </div>
  );
}
