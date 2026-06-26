import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseEditor } from "@/components/ExerciseEditor";
import { readEditableFields } from "@/lib/content";

/** Pflege-Seite einer einzelnen Übung. */
export default async function PflegeExercise({
  params,
}: {
  params: Promise<{ course: string; lesson: string; exercise: string }>;
}) {
  const loc = await params;
  let initial;
  try {
    initial = readEditableFields(loc);
  } catch {
    notFound();
  }

  return (
    <div className="shell">
      <div className="admin-head">
        <div>
          <h1 className="title" style={{ marginBottom: 6 }}>
            {initial.title || "Übung pflegen"}
          </h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            <code>
              {loc.course}/{loc.lesson}/{loc.exercise}
            </code>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link className="ctrl" href={`/uebung/${loc.course}/${loc.lesson}/${loc.exercise}`} style={{ textDecoration: "none" }}>
            👁 Ansehen
          </Link>
          <Link className="ctrl" href="/pflege" style={{ textDecoration: "none" }}>
            ← Übersicht
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <ExerciseEditor locator={loc} initial={initial} />
      </div>
    </div>
  );
}
