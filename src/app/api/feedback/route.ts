import { NextResponse } from "next/server";
import { loadExercise } from "@/lib/content";
import { getProvider } from "@/lib/llm";

/**
 * Serverseitige Feedback-Route (Phase 2).
 *
 * Der Client schickt nur die Übungs-Adresse + den Studierenden-Text. Der
 * Feedback-Prompt, die Musterlösung und der API-Key bleiben serverseitig — sie
 * verlassen nie den Server. Antwort: { markers: [...] } im selben Format wie der
 * Demo-Block, damit das Frontend unverändert rendert.
 */

export const runtime = "nodejs";

interface FeedbackRequest {
  course?: string;
  lesson?: string;
  exercise?: string;
  studentText?: string;
}

export async function POST(req: Request) {
  let body: FeedbackRequest;
  try {
    body = (await req.json()) as FeedbackRequest;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const { course, lesson, exercise, studentText } = body;
  if (!course || !lesson || !exercise) {
    return NextResponse.json({ error: "course/lesson/exercise fehlen." }, { status: 400 });
  }
  if (!studentText || studentText.trim().length < 10) {
    return NextResponse.json({ error: "Bitte schreibe zuerst ein paar Sätze." }, { status: 400 });
  }

  let ex;
  try {
    ex = loadExercise({ course, lesson, exercise });
  } catch {
    return NextResponse.json({ error: "Übung nicht gefunden." }, { status: 404 });
  }
  if (!ex.feedbackPrompt) {
    return NextResponse.json({ error: "Für diese Übung ist kein Feedback-Prompt hinterlegt." }, { status: 422 });
  }

  try {
    const provider = getProvider();
    const feedback = await provider.getFeedback({
      feedbackPrompt: ex.feedbackPrompt,
      task: ex.task,
      targetConcepts: ex.targetConcepts ?? [],
      mediaDescription: ex.mediaDescription,
      categories: ex.feedbackCategories,
      modelSolution: ex.modelSolution,
      studentText,
    });
    return NextResponse.json(feedback);
  } catch (err) {
    // Keine personenbezogenen Daten loggen (Datenschutz, CLAUDE.md/Konzept §8).
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[api/feedback] LLM-Aufruf fehlgeschlagen:", msg);
    return NextResponse.json({ error: "Feedback konnte nicht erzeugt werden." }, { status: 502 });
  }
}
