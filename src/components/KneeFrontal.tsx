"use client";

import { useMotionClock } from "./MotionClock";
import { SvgPrims } from "./SvgPrims";
import { KNEE, drawKnee } from "@/lib/jumpMotion";

/**
 * Medien-Komponente "KneeFrontal": rechtes Knie von vorn, synchron zur
 * CMJ-Figur. In der Landung knickt das Knie nach innen (dynamischer Valgus),
 * der Zug auf das vordere Kreuzband (VKB) steigt.
 */
export function KneeFrontal({ label, caption }: { label: string; caption?: string }) {
  const { t } = useMotionClock();
  const frame = drawKnee(t);
  return (
    <div className="card">
      <h3>{label}</h3>
      <div className="body" style={{ padding: 14 }}>
        <div className="player" style={{ background: "#0e1118" }}>
          <svg
            viewBox={`0 0 ${KNEE.W} ${KNEE.H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "block", width: "100%", height: "auto", background: "linear-gradient(180deg,#0e1118,#11151d)" }}
            aria-label="Schematisches Knie in der Frontalebene, synchron zur Animation"
          >
            <SvgPrims prims={frame.prims} />
          </svg>
        </div>
        {caption ? (
          <p style={{ margin: "10px 2px 0", color: "var(--ink-mute)", fontSize: 13, lineHeight: 1.5 }}>{caption}</p>
        ) : null}
      </div>
    </div>
  );
}
