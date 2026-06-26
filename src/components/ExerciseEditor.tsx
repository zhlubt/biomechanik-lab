"use client";

import { useState } from "react";
import type { EditableFields } from "@/lib/content";
import type { ExerciseLocator } from "@/lib/content";

/**
 * Lehrenden-Editor: pflegt pro Übung die Prompts, die Musterlösung und die
 * Prosa-Felder. Speichert über /api/content zurück in die Content-JSON.
 */
export function ExerciseEditor({ locator, initial }: { locator: ExerciseLocator; initial: EditableFields }) {
  const [fields, setFields] = useState<EditableFields>(initial);
  const [concepts, setConcepts] = useState(initial.targetConcepts.join(", "));
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "ok" | "error"; msg?: string }>({ kind: "idle" });

  function set<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
    setStatus({ kind: "idle" });
  }

  async function save() {
    setStatus({ kind: "saving" });
    const payload = {
      ...locator,
      fields: {
        ...fields,
        targetConcepts: concepts.split(",").map((s) => s.trim()).filter(Boolean),
      },
    };
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; fields?: EditableFields };
      if (!res.ok) throw new Error(data.error || `Serverfehler (${res.status})`);
      if (data.fields) {
        setFields(data.fields);
        setConcepts(data.fields.targetConcepts.join(", "));
      }
      setStatus({ kind: "ok", msg: "Gespeichert." });
    } catch (e) {
      setStatus({ kind: "error", msg: e instanceof Error ? e.message : "Speichern fehlgeschlagen." });
    }
  }

  return (
    <div className="form">
      <label className="field">
        <span className="field-label">Titel</span>
        <input value={fields.title} onChange={(e) => set("title", e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">Intro (Untertitel)</span>
        <textarea rows={3} value={fields.intro} onChange={(e) => set("intro", e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">Aufgabenstellung</span>
        <textarea rows={3} value={fields.task} onChange={(e) => set("task", e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">
          Zielkonzepte <span className="field-hint">(kommagetrennt)</span>
        </span>
        <input value={concepts} onChange={(e) => setConcepts(e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">
          Medien-Beschreibung <span className="field-hint">(geht als Kontext ans LLM)</span>
        </span>
        <textarea rows={4} value={fields.mediaDescription} onChange={(e) => set("mediaDescription", e.target.value)} />
      </label>

      <label className="field field-accent">
        <span className="field-label">
          Feedback-Prompt <span className="field-hint">(sokratisch — Fragen, keine Lösungen)</span>
        </span>
        <textarea rows={8} value={fields.feedbackPrompt} onChange={(e) => set("feedbackPrompt", e.target.value)} />
      </label>

      <label className="field field-accent">
        <span className="field-label">
          Musterlösung <span className="field-hint">(verborgen; auch interne LLM-Referenz)</span>
        </span>
        <textarea rows={8} value={fields.modelSolution} onChange={(e) => set("modelSolution", e.target.value)} />
      </label>

      <div className="form-actions">
        <button className="ctrl primary" onClick={save} disabled={status.kind === "saving"}>
          {status.kind === "saving" ? "Speichert …" : "💾 Speichern"}
        </button>
        {status.kind === "ok" ? <span className="save-ok">✓ {status.msg}</span> : null}
        {status.kind === "error" ? <span className="save-err">⚠ {status.msg}</span> : null}
      </div>
    </div>
  );
}
