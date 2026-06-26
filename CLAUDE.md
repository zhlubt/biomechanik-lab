# CLAUDE.md — Arbeitsanweisung für Claude Code

> Diese Datei steuert, *wie* in diesem Repo gearbeitet wird. Das *Was/Warum* steht in
> `docs/ENTWICKLUNGSKONZEPT.md` — bei inhaltlichen Fragen immer dort nachsehen.
> Stack-Angaben unten sind ein Vorschlag und werden nach Klärung der offenen Fragen
> (Konzept, Abschnitt 11) angepasst.

## Projekt in einem Satz
Plattform, in der Studierende etwas Gesehenes (Diagramm, Bewegung, Bild, Video, VR) mit
eigenen Worten fachlich beschreiben und dazu **sokratisches** KI-Feedback erhalten —
Fragen und Hinweise, **niemals fertige Lösungen**.

## Die unveränderliche Kernschleife jeder Übung
sehen → verstehen (Erklärung/Legende/Glossar/Gerüst) → beschreiben (Editor) →
KI-Feedback (Marker mit Fragen) → mit Musterlösung vergleichen.

## Stack (entschieden)
- Next.js (App Router) + TypeScript + React, auf Node (Zielserver vorhanden).
- LLM: Anthropic Messages API, **nur serverseitig** (Key niemals im Browser/Client-Bundle).
- Provider-Abstraktion: alle LLM-Aufrufe laufen über `src/lib/llm/` (Default Anthropic,
  ChatGPT als austauschbarer Adapter).
- Content Phase 1–3: dateibasiert unter `/content`. Datenbank: **MariaDB** (Zielserver) via
  Prisma/ORM erst ab Phase 4 (Nutzer/Submissions).
- Entwicklung lokal in VS Code mit Claude Code; Deployment später auf eigenen Server.

## Verzeichnis-Konvention
```
/content   # Kurse/Lektionen/Übungen als JSON/MDX
/src/app   # Routen inkl. serverseitiger /api/feedback
/src/components, /src/lib, /src/types
/docs      # ENTWICKLUNGSKONZEPT.md u. a.
```

## Arbeitsweise (wichtig)
- **Eine Roadmap-Phase pro Sitzung** (siehe Konzept, Abschnitt 9). Erst kurzer Plan, dann
  Umsetzung, dann testen. Nicht mehrere Phasen vermischen.
- Vor größeren Änderungen die betroffenen Dateien lesen; keine ungefragten Stack-Wechsel.
- Das vorhandene Mockup `cmj-squatjump-light.html` ist die verbindliche Referenz für Aussehen
  und Verhalten der Übungsseite — Optik und Interaktion (Marker, Tooltips, Scrubber) erhalten.

## Didaktische Leitplanken (nicht verletzen)
- Feedback erzeugt **Fragen/Hinweise**, keine ausformulierten Antworten oder Textbausteine,
  die Studierende nur kopieren.
- Studierende entscheiden selbst, welche Marker sie öffnen.
- Die Musterlösung ist Referenz, kein Ersatz für die eigene Formulierung.

## LLM-Feedback-Vertrag
- Eingabe: `feedbackPrompt` + Aufgabe + Zielkonzepte + Medien-Kontext (Text oder Bild via
  Vision) + Studierenden-Text.
- Ausgabe: **striktes JSON** `{ "markers": [{ category, quote, question, nudge }] }`
  (bzw. Tool-Use/Structured-Output). Antwort robust parsen; Marker per `quote` im Text verorten.

## Datenschutz
- Studierenden-Texte und (später) Videos sind personenbezogene Daten — Hosting-Ort,
  Auftragsverarbeitung und Aufbewahrung beachten. Keine personenbezogenen Daten in Logs.

## Sprache
- UI und Inhalte auf Deutsch. Code-Kommentare/Commits Deutsch oder Englisch, konsistent je Datei.
