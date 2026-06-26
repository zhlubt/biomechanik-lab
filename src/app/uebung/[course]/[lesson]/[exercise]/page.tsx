import { notFound } from "next/navigation";
import { ExerciseView } from "@/components/ExerciseView";
import { loadExercise } from "@/lib/content";

/** Übungsseite über die generische Route (mehrere Übungen, Phase 3). */
export default async function ExercisePage({
  params,
}: {
  params: Promise<{ course: string; lesson: string; exercise: string }>;
}) {
  const loc = await params;
  let exercise;
  try {
    exercise = loadExercise(loc);
  } catch {
    notFound();
  }
  return <ExerciseView exercise={exercise} locator={loc} />;
}
