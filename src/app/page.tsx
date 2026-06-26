import { ExerciseView } from "@/components/ExerciseView";
import { listExercises, loadExercise } from "@/lib/content";

/**
 * Startseite (Phase 1): rendert die erste vorhandene Übung datengetrieben.
 * Navigation/Übersicht über mehrere Übungen folgt in Phase 3.
 */
export default function Home() {
  const all = listExercises();
  if (all.length === 0) {
    return (
      <div className="shell">
        <h1 className="title">Keine Übung gefunden</h1>
        <p className="subtitle">Lege eine Übung unter content/&lt;course&gt;/&lt;lesson&gt;/&lt;exercise&gt;.json an.</p>
      </div>
    );
  }
  const exercise = loadExercise(all[0]);
  return <ExerciseView exercise={exercise} locator={all[0]} />;
}
