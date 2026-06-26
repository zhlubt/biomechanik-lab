"use client";

import { useMemo, useRef, useState } from "react";
import { useMotionClock } from "./MotionClock";
import { SvgPrims } from "./SvgPrims";
import {
  STAGE,
  buildChartStatic,
  buildChartLegend,
  buildChartDynamic,
  drawFigure,
  poseCMJ,
  poseSJ,
  fmtTime,
} from "@/lib/jumpMotion";

/**
 * Medien-Komponente "JumpForceLab": schematische Sprung-Animation + synchrone
 * Kraftkurven, mit Scrubber, Phasen-Sprüngen und Transport-Steuerung.
 */
export function JumpForceLab({ label }: { label: string }) {
  const clock = useMotionClock();
  const { t, duration, playing, rate, phases } = clock;
  const scrubRef = useRef<HTMLDivElement | null>(null);
  const [dragVisual, setDragVisual] = useState(false);

  const staticPrims = useMemo(() => [...buildChartStatic()], []);
  const legendPrims = useMemo(() => buildChartLegend(), []);
  const dynamicPrims = buildChartDynamic(t);
  const figCMJ = drawFigure("cmj", 18 + 78, poseCMJ(t));
  const figSJ = drawFigure("sj", 18 + 220, poseSJ(t));

  const pct = (t / duration) * 100;

  // Scrubber: Klick/Drag im Track
  const dragging = useRef(false);
  const resume = useRef(false);
  function seekFromClientX(clientX: number) {
    const el = scrubRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    clock.seek(p * duration);
  }
  function onPointerDown(e: React.PointerEvent) {
    dragging.current = true;
    setDragVisual(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    resume.current = playing;
    clock.setPlaying(false);
    seekFromClientX(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragging.current) seekFromClientX(e.clientX);
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    setDragVisual(false);
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    if (resume.current) clock.setPlaying(true);
  }

  return (
    <div className="card">
      <h3>{label}</h3>
      <div className="body" style={{ padding: 14 }}>
        <div className="player">
          <svg className="stage" viewBox={`0 0 ${STAGE.W} ${STAGE.H}`} preserveAspectRatio="xMidYMid meet" aria-label="Schematische Sprunganimation mit Kraftkurven">
            <SvgPrims prims={staticPrims} />
            <SvgPrims prims={dynamicPrims} />
            <SvgPrims prims={legendPrims} />
            <g>
              <SvgPrims prims={figCMJ} />
            </g>
            <g>
              <SvgPrims prims={figSJ} />
            </g>
          </svg>

          <div className="scrub-wrap">
            <div
              ref={scrubRef}
              className={`scrub${dragVisual ? " dragging" : ""}`}
              role="slider"
              tabIndex={0}
              aria-label="Position im Video"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration * 1000)}
              aria-valuenow={Math.round(t * 1000)}
              style={{ ["--pct" as string]: `${pct}%` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div className="track">
                <div className="fill" />
              </div>
              <div className="head" />
            </div>

            <div className="phases">
              {phases.map((ph) => (
                <button key={ph.label} onClick={() => clock.seek(ph.t)}>
                  {ph.label}
                </button>
              ))}
            </div>
          </div>

          <div className="controls">
            <button className="ctrl primary" onClick={clock.toggle} aria-label="Abspielen / Pause">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d={playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z"} />
              </svg>
              <span>{playing ? "Pause" : "Abspielen"}</span>
            </button>
            <button className="ctrl" onClick={() => clock.stepFrame(-1)} title="Frame zurück (←)">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zM20 6 10 12l10 6z" />
              </svg>
              −1 Frame
            </button>
            <button className="ctrl" onClick={() => clock.stepFrame(1)} title="Frame vor (→)">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2zM4 6l10 6L4 18z" />
              </svg>
              +1 Frame
            </button>
            <div className="speed" role="group" aria-label="Geschwindigkeit">
              {[0.25, 0.5, 1, 2].map((r) => (
                <button key={r} className={rate === r ? "on" : ""} onClick={() => clock.setRate(r)}>
                  {r}×
                </button>
              ))}
            </div>
            <div className="time">
              {fmtTime(t)} / {fmtTime(duration)}
            </div>
          </div>

          <div className="shortcuts">
            <b>Shortcuts:</b>
            <span>
              <span className="kbd">Space</span> Play/Pause
            </span>
            <span>
              <span className="kbd">←</span>
              <span className="kbd">→</span> Frame
            </span>
            <span>
              <span className="kbd">,</span>
              <span className="kbd">.</span> 0.25 s
            </span>
            <span>
              <span className="kbd">1</span>–<span className="kbd">4</span> Speed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
