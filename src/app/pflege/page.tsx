import Link from "next/link";
import { listExercises, loadExercise } from "@/lib/content";

/** Übersicht aller Übungen mit Links zum Ansehen und Pflegen. */
export default function PflegeIndex() {
  const all = listExercises();
  const items = all.map((loc) => {
    const ex = loadExercise(loc);
    return { loc, title: ex.title, course: ex.course.title, lesson: ex.lesson.title };
  });

  return (
    <div className="shell">
      <div className="admin-head">
        <div>
          <h1 className="title" style={{ marginBottom: 6 }}>
            Übungen pflegen
          </h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Prompts, Musterlösungen und Texte je Übung bearbeiten. Quelle der Wahrheit bleibt die Content-Datei.
          </p>
        </div>
        <Link className="ctrl" href="/" style={{ textDecoration: "none" }}>
          ← Zur Übung
        </Link>
      </div>

      <p className="admin-note">
        ℹ️ Lokales Autoren-Werkzeug — schreibt direkt in <code>content/…</code>. Eine neue Übung legst du an, indem du eine
        JSON-Datei unter <code>content/&lt;course&gt;/&lt;lesson&gt;/&lt;exercise&gt;.json</code> ablegst (am einfachsten als
        Kopie einer bestehenden); sie erscheint dann automatisch hier.
      </p>

      {items.length === 0 ? (
        <p className="subtitle" style={{ marginTop: 18 }}>
          Noch keine Übung vorhanden.
        </p>
      ) : (
        <ul className="admin-list">
          {items.map(({ loc, title, course, lesson }) => (
            <li className="admin-row" key={`${loc.course}/${loc.lesson}/${loc.exercise}`}>
              <div>
                <div style={{ fontWeight: 600 }}>{title}</div>
                <div className="meta">
                  {course} · {lesson} · {loc.course}/{loc.lesson}/{loc.exercise}
                </div>
              </div>
              <div className="actions">
                <Link className="ctrl" href={`/uebung/${loc.course}/${loc.lesson}/${loc.exercise}`}>
                  👁 Ansehen
                </Link>
                <Link className="ctrl primary" href={`/pflege/${loc.course}/${loc.lesson}/${loc.exercise}`}>
                  ✏ Pflegen
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
