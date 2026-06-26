import fs from "node:fs";
import path from "node:path";
import type { Exercise } from "@/types/exercise";

/**
 * Dateibasierter Content-Loader (Phase 1–3, ohne Datenbank).
 * Übungen liegen unter content/<course>/<lesson>/<exercise>.json.
 */

const CONTENT_ROOT = path.join(process.cwd(), "content");

export interface ExerciseLocator {
  course: string;
  lesson: string;
  exercise: string;
}

export function loadExercise(loc: ExerciseLocator): Exercise {
  const raw = fs.readFileSync(exerciseFile(loc), "utf-8");
  return JSON.parse(raw) as Exercise;
}

function exerciseFile(loc: ExerciseLocator): string {
  // Pfad-Segmente säubern (kein Verzeichniswechsel über ../ o. ä.)
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CONTENT_ROOT, safe(loc.course), safe(loc.lesson), `${safe(loc.exercise)}.json`);
}

/** Pflegbare Freitext-/Prompt-Felder einer Übung (Lehrenden-Sicht). */
export interface EditableFields {
  title: string;
  intro: string;
  task: string;
  mediaDescription: string;
  feedbackPrompt: string;
  modelSolution: string;
  targetConcepts: string[];
}

export const EDITABLE_KEYS: (keyof EditableFields)[] = [
  "title",
  "intro",
  "task",
  "mediaDescription",
  "feedbackPrompt",
  "modelSolution",
  "targetConcepts",
];

/** Liest nur die pflegbaren Felder aus einer Übung. */
export function readEditableFields(loc: ExerciseLocator): EditableFields {
  const ex = loadExercise(loc);
  return {
    title: ex.title ?? "",
    intro: ex.intro ?? "",
    task: ex.task ?? "",
    mediaDescription: ex.mediaDescription ?? "",
    feedbackPrompt: ex.feedbackPrompt ?? "",
    modelSolution: ex.modelSolution ?? "",
    targetConcepts: ex.targetConcepts ?? [],
  };
}

/**
 * Schreibt pflegbare Felder zurück in die Übungs-JSON. Übrige Felder (Medien,
 * Legende, Demo …) bleiben unangetastet. Quelle der Wahrheit bleibt die Datei.
 */
export function saveEditableFields(loc: ExerciseLocator, fields: Partial<EditableFields>): EditableFields {
  const file = exerciseFile(loc);
  const obj = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
  for (const key of EDITABLE_KEYS) {
    if (key in fields && fields[key] !== undefined) {
      obj[key] = fields[key];
    }
  }
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf-8");
  return readEditableFields(loc);
}

/** Alle vorhandenen Übungen ermitteln (für Index/Routing). */
export function listExercises(): ExerciseLocator[] {
  const out: ExerciseLocator[] = [];
  if (!fs.existsSync(CONTENT_ROOT)) return out;
  for (const course of dirs(CONTENT_ROOT)) {
    for (const lesson of dirs(path.join(CONTENT_ROOT, course))) {
      const lessonDir = path.join(CONTENT_ROOT, course, lesson);
      for (const f of fs.readdirSync(lessonDir)) {
        if (f.endsWith(".json")) {
          out.push({ course, lesson, exercise: f.replace(/\.json$/, "") });
        }
      }
    }
  }
  return out;
}

function dirs(p: string): string[] {
  if (!fs.existsSync(p)) return [];
  return fs
    .readdirSync(p, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
