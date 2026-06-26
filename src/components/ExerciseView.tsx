"use client";

import { useEffect } from "react";
import type { Exercise } from "@/types/exercise";
import { MotionClockProvider, useMotionClock } from "./MotionClock";
import { MediaRenderer } from "./MediaRenderer";
import { ConceptLegend } from "./ConceptLegend";
import { Glossary } from "./Glossary";
import { WritingEditor } from "./WritingEditor";
import { Scaffold } from "./Scaffold";
import { ModelSolution } from "./ModelSolution";
import { DURATION, FPS } from "@/lib/jumpMotion";
import type { ExerciseLocator } from "@/lib/content";

/**
 * Datengetriebene Übungsseite. Komponiert die Mockup-Layoutstruktur, speist aber
 * jeden Block aus dem Exercise-Datensatz. JumpForceLab und KneeFrontal teilen
 * sich über MotionClockProvider eine synchrone Animations-Uhr.
 */
export function ExerciseView({ exercise, locator }: { exercise: Exercise; locator: ExerciseLocator }) {
  const jumpLab = exercise.media.find((m) => m.type === "interactive" && m.component === "JumpForceLab");
  const knee = exercise.media.find((m) => m.type === "interactive" && m.component === "KneeFrontal");
  const embed = exercise.media.find((m) => m.type === "embed");

  const cfg = jumpLab && jumpLab.type === "interactive" ? jumpLab.config : undefined;
  const duration = cfg?.durationSec ?? DURATION;
  const fps = cfg?.fps ?? FPS;
  const phases = cfg?.phases ?? [];

  const crumbModule = exercise.course.module ? `${exercise.course.module} · ` : "";

  return (
    <MotionClockProvider duration={duration} fps={fps} phases={phases}>
      <KeyboardShortcuts />
      <div className="shell">
        <header className="top">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div>
              <b>Biomechanik-Lab</b>
              <small>
                {exercise.course.title}
                {exercise.course.module ? ` · ${exercise.course.module}` : ""}
              </small>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="crumbs">
              {crumbModule}
              {exercise.lesson.title} / <span>Übung {exercise.number}</span>
            </div>
            <a href="/pflege" className="ctrl" style={{ padding: "6px 10px", fontSize: 12, textDecoration: "none" }}>
              ✏ Pflege
            </a>
          </div>
        </header>

        <h1 className="title">{exercise.title}</h1>
        <p className="subtitle">{exercise.intro}</p>
        {exercise.status ? (
          <span className="pill">
            <span className="dot" /> {exercise.status}
          </span>
        ) : null}

        {/* Lab: Animation + Konzept/Glossar */}
        <section className="lab" style={{ marginTop: 24 }}>
          {jumpLab ? <MediaRenderer media={jumpLab} /> : null}
          <div className="card">
            <h3>02 · Was bedeutet was?</h3>
            <div className="body">
              <ConceptLegend items={exercise.legend} />
              <Glossary items={exercise.glossary} guidance={exercise.guidance} />
            </div>
          </div>
        </section>

        {/* Knie-Detail + Embed */}
        {(knee || embed) && (
          <section className="lab" style={{ marginTop: 22, gridTemplateColumns: "1fr 1fr" }}>
            {knee ? <MediaRenderer media={knee} /> : null}
            {embed ? <MediaRenderer media={embed} /> : null}
          </section>
        )}

        {/* Schreiben + Feedback */}
        <WritingEditor task={exercise.task} demo={exercise.demo} categories={exercise.feedbackCategories} locator={locator} />

        {/* Schreib-Gerüst + Musterlösung */}
        <section className="assistant">
          <Scaffold steps={exercise.scaffold} />
          <ModelSolution text={exercise.modelSolution} />
        </section>

        <footer>
          <span>
            <b>Beschreibungs-Lab · {exercise.course.title}</b> · Universität Bayreuth
          </span>
          <span>Phase 1 · datengetrieben aus content/…/{exercise.id}.json</span>
        </footer>
      </div>
    </MotionClockProvider>
  );
}

/** Tastatur-Shortcuts für die Animation (Space/Pfeile/,./1-4), wie im Mockup. */
function KeyboardShortcuts() {
  const clock = useMotionClock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const editable =
        !!el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON");
      if (e.code === "Space") {
        if (editable) return; // Buttons/Inputs ihre eigene Space-Aktion lassen
        e.preventDefault();
        clock.toggle();
        return;
      }
      if (e.code === "ArrowLeft") clock.stepFrame(-1);
      else if (e.code === "ArrowRight") clock.stepFrame(1);
      else if (e.key === ",") clock.nudge(-0.25);
      else if (e.key === ".") clock.nudge(0.25);
      else {
        const rates: Record<string, number> = { "1": 0.25, "2": 0.5, "3": 1, "4": 2 };
        if (rates[e.key] != null && !editable) clock.setRate(rates[e.key]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clock]);
  return null;
}
