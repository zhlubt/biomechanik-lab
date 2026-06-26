/**
 * Datenmodell einer Übung (Phase 1).
 * Abgeleitet aus content/.../cmj-vs-squatjump.json und Abschnitt 3 des
 * Entwicklungskonzepts. Bewusst eng an der JSON gehalten, damit Inhalte
 * dateibasiert versionierbar bleiben (Phase 1–3 ohne Datenbank).
 */

/** Bekannte interaktive Medien-Komponenten (per `component`-Schlüssel aufgelöst). */
export type InteractiveComponent = "JumpForceLab" | "KneeFrontal";

export interface PhaseMarker {
  /** Beschriftung des Sprung-Buttons, z. B. "⤓ Ausholen (CMJ)". */
  label: string;
  /** Zielzeit in Sekunden. */
  t: number;
}

export interface InteractiveMediaConfig {
  durationSec?: number;
  fps?: number;
  phases?: PhaseMarker[];
  note?: string;
}

export interface InteractiveMedia {
  type: "interactive";
  component: InteractiveComponent;
  label: string;
  caption?: string;
  config?: InteractiveMediaConfig;
}

export interface ImageMedia {
  type: "image";
  label: string;
  src: string;
  alt?: string;
  caption?: string;
}

export interface VideoMedia {
  type: "video";
  label: string;
  src: string;
  caption?: string;
}

export interface EmbedMedia {
  type: "embed";
  label: string;
  description?: string;
  url: string;
  /** Wenn true, wird zusätzlich ein QR-Code zum Öffnen am Handy gezeigt. */
  qr?: boolean;
}

export type Media = InteractiveMedia | ImageMedia | VideoMedia | EmbedMedia;

export interface LegendItem {
  key: string;
  label: string;
  /** Hex-Farbe der Markierung/Swatch. */
  color: string;
  /** Klartext-Farbname (z. B. "blau"), wie im Mockup rechts angezeigt. */
  colorName?: string;
  hint: string;
}

export interface GlossaryItem {
  term: string;
  definition: string;
}

export interface Guidance {
  title: string;
  steps: string[];
}

export interface ScaffoldStep {
  step: string;
  text: string;
}

export interface FeedbackCategory {
  key: string;
  label: string;
  color: string;
}

/** Ein vom LLM (oder im Demo-Modus hartkodiert) erzeugter Marker im Text. */
export interface Marker {
  /** Schlüssel einer FeedbackCategory. */
  category: string;
  /** Wörtliches Zitat aus dem Studierenden-Text — verortet die Markierung. */
  quote: string;
  /** Sokratische Frage / Hinweis — niemals die fertige Lösung. */
  question: string;
  /** Optionaler kurzer Schubs (z. B. "Schau ins Glossar"). */
  nudge?: string;
}

export interface Feedback {
  markers: Marker[];
}

/** Demo-Block: hartkodiertes Beispiel, ersetzt in Phase 2 durch echten LLM-Aufruf. */
export interface ExerciseDemo {
  studentText: string;
  feedback: Feedback;
}

export interface CourseRef {
  id: string;
  title: string;
  module?: string;
}

export interface LessonRef {
  id: string;
  title: string;
}

export interface Exercise {
  id: string;
  course: CourseRef;
  lesson: LessonRef;
  /** Übungsnummer als Anzeige-String, z. B. "04". */
  number?: string;
  title: string;
  intro: string;
  /** Pill-Text oben, z. B. "Übung aktiv · Aufnahmedauer 00:03.000". */
  status?: string;
  media: Media[];
  legend: LegendItem[];
  glossary: GlossaryItem[];
  guidance: Guidance;
  task: string;
  scaffold: ScaffoldStep[];
  feedbackCategories: FeedbackCategory[];
  targetConcepts: string[];
  /** Medien-Beschreibung für das LLM (Phase 2) bzw. per Vision befüllbar. */
  mediaDescription?: string;
  /** Im Hintergrund liegender Feedback-Prompt (Phase 2). */
  feedbackPrompt?: string;
  /** Musterlösung — zunächst verborgen, auf Klick sichtbar. */
  modelSolution: string;
  demo: ExerciseDemo;
}
