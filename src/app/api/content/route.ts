import { NextResponse } from "next/server";
import { EDITABLE_KEYS, type EditableFields, saveEditableFields } from "@/lib/content";

/**
 * Pflege-Route: speichert die pflegbaren Übungsfelder (Prompts, Musterlösung,
 * Prosa) zurück in die Content-JSON.
 *
 * Schreibt ins Dateisystem — bewusst ein **lokales Autoren-Werkzeug**. In einer
 * Produktivumgebung ohne Auth ist Schreiben gesperrt (ALLOW_CONTENT_WRITE=1 zum
 * bewussten Freischalten). Auth/Rollen kommen mit Phase 4.
 */

export const runtime = "nodejs";

function writingAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_CONTENT_WRITE === "1";
}

interface SaveRequest {
  course?: string;
  lesson?: string;
  exercise?: string;
  fields?: Partial<EditableFields>;
}

export async function POST(req: Request) {
  if (!writingAllowed()) {
    return NextResponse.json(
      { error: "Schreiben ist in dieser Umgebung gesperrt (lokales Autoren-Werkzeug)." },
      { status: 403 },
    );
  }

  let body: SaveRequest;
  try {
    body = (await req.json()) as SaveRequest;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const { course, lesson, exercise, fields } = body;
  if (!course || !lesson || !exercise || !fields) {
    return NextResponse.json({ error: "course/lesson/exercise/fields fehlen." }, { status: 400 });
  }

  // Nur erlaubte Felder übernehmen (Whitelist).
  const clean: Partial<EditableFields> = {};
  for (const key of EDITABLE_KEYS) {
    if (key in fields) {
      const v = (fields as Record<string, unknown>)[key];
      if (key === "targetConcepts") {
        if (Array.isArray(v)) clean.targetConcepts = v.map(String).map((s) => s.trim()).filter(Boolean);
      } else if (typeof v === "string") {
        (clean as Record<string, unknown>)[key] = v;
      }
    }
  }

  try {
    const saved = saveEditableFields({ course, lesson, exercise }, clean);
    return NextResponse.json({ ok: true, fields: saved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[api/content] Speichern fehlgeschlagen:", msg);
    return NextResponse.json({ error: "Übung nicht gefunden oder nicht beschreibbar." }, { status: 404 });
  }
}
