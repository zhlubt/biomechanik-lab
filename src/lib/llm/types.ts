import type { Feedback, FeedbackCategory } from "@/types/exercise";

/**
 * Provider-Abstraktion für das KI-Feedback (Konzept §4.3).
 * Alle LLM-Aufrufe laufen über dieses Interface — Default ist Anthropic,
 * ein ChatGPT-Adapter ließe sich austauschen, ohne Frontend/Route zu ändern.
 */

export interface FeedbackInput {
  /** Übungsspezifischer Feedback-Prompt (sokratisch). */
  feedbackPrompt: string;
  /** Aufgabenstellung. */
  task: string;
  /** Zielkonzepte, die im Text vorkommen sollten. */
  targetConcepts: string[];
  /** Beschreibung des Mediums (für das LLM, statt/ergänzend zu Vision). */
  mediaDescription?: string;
  /** Erlaubte Feedback-Kategorien. */
  categories: FeedbackCategory[];
  /** Musterlösung — nur als interne Referenz, NICHT an Studierende ausgegeben. */
  modelSolution?: string;
  /** Der zu kommentierende Studierenden-Text. */
  studentText: string;
}

export interface LLMProvider {
  /** Erzeugt strukturiertes, sokratisches Feedback (Marker mit Fragen). */
  getFeedback(input: FeedbackInput): Promise<Feedback>;
}
