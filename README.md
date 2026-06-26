# Biomechanik-Lab — Beschreibungs-Lab

Plattform, in der Studierende etwas Gesehenes (Diagramm, Bewegung, Bild, Video, VR)
mit eigenen Worten fachlich beschreiben und dazu **sokratisches** KI-Feedback erhalten
— Fragen und Hinweise, **niemals fertige Lösungen**.

Konzept & Begründung: [`docs/ENTWICKLUNGSKONZEPT.md`](docs/ENTWICKLUNGSKONZEPT.md).
Arbeitsanweisung (Stack/Konventionen): [`CLAUDE.md`](CLAUDE.md).

## Stack
- Next.js 15 (App Router) + TypeScript + React 19
- Inhalte dateibasiert unter `content/` (Phase 1–3, keine Datenbank)
- LLM-Feedback ab Phase 2 serverseitig (Anthropic), Key nur über `.env.local`

## Entwicklung
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Produktions-Build
npm run typecheck  # tsc --noEmit
```

`.env.local` aus `.env.local.example` anlegen (wird nicht committet).
Die vorhandene `.env` (Webserver-Zugangsdaten) ist über `.gitignore` ausgeschlossen.

## Stand: Phase 1 + 2 ✅
**Phase 1 — Datengetriebene Übung:** Die hartkodierte Mockup-Seite
(`mockups/v2/cmj-squatjump-light.html`) ist jetzt ein **Datensatz**:
[`content/trainingswissenschaft/anfangskraft/cmj-vs-squatjump.json`](content/trainingswissenschaft/anfangskraft/cmj-vs-squatjump.json).
Die Seite wird vollständig aus diesen Daten gerendert — Optik und Interaktion 1:1 zum Mockup.

**Phase 2 — Echtes KI-Feedback:** „KI Feedback" ruft die serverseitige Route
[`/api/feedback`](src/app/api/feedback/route.ts) auf. Der Editor ist jetzt frei editierbar;
der Text geht an das LLM (Anthropic, Default `claude-opus-4-8`), das über Structured Outputs
striktes JSON `{markers:[{category,quote,question,nudge}]}` liefert. Der `feedbackPrompt`,
die Musterlösung und der API-Key bleiben serverseitig. Fällt der Aufruf aus, bleibt das
Demo-Feedback aus der JSON als Rückfall.

### Aufbau
```
content/<course>/<lesson>/<exercise>.json   # Übungsinhalt (Quelle der Wahrheit)
src/types/exercise.ts                        # Datenmodell
src/lib/content.ts                           # dateibasierter Loader
src/lib/jumpMotion.ts                        # Bewegungs-/Kraftmodell (Verhalten, kein Inhalt)
src/lib/llm/                                 # Provider-Abstraktion (types, anthropic, index)
src/app/api/feedback/route.ts                # serverseitige Feedback-Route (LLM-Aufruf)
src/components/
  ExerciseView.tsx        # Layout-Komposition, datengespeist
  MotionClock.tsx         # gemeinsame Animations-Uhr (JumpForceLab ↔ KneeFrontal synchron)
  JumpForceLab.tsx        # Sprung-Animation + Kraftkurven + Transport-Steuerung
  KneeFrontal.tsx         # Knie-Detail (dynamischer Valgus → VKB-Last)
  MediaRenderer.tsx       # Dispatcher nach Medien-Typ
  ConceptLegend.tsx, Glossary.tsx, Scaffold.tsx, ModelSolution.tsx, EmbedQR.tsx
  WritingEditor.tsx       # editierbarer Editor + echtes KI-Feedback (Marker, Chips, Tooltips)
```

### Feedback-Vertrag (Phase 2)
Eingabe: `feedbackPrompt` + Aufgabe + Zielkonzepte + Medien-Kontext + Studierenden-Text.
Ausgabe: striktes JSON `{ "markers": [{ category, quote, question, nudge }] }` (Structured
Outputs). Der Adapter verwirft Marker, deren `quote` nicht wörtlich im Text vorkommt (sonst
nicht verortbar). Didaktische Leitplanke: das LLM liefert **Fragen**, keine fertigen
Formulierungen. Bei Ausfall greift das Demo-Feedback aus der JSON.

### Übungen pflegen (Prompts & Musterlösungen)
Unter **`/pflege`** liegt ein lokales Autoren-Werkzeug: Übersicht aller Übungen + ein
Editor je Übung für **Feedback-Prompt**, **Musterlösung**, Titel, Intro, Aufgabe,
Medien-Beschreibung und Zielkonzepte. Gespeichert wird über [`/api/content`](src/app/api/content/route.ts)
zurück in die jeweilige Content-JSON — die übrigen Felder (Medien, Demo, Legende) bleiben
unangetastet. Jede Übung hat ihren **eigenen** Prompt und ihre eigene Musterlösung in ihrer
Datei; nichts ist global hartkodiert. Mehrere Übungen sind über
`/uebung/<course>/<lesson>/<exercise>` erreichbar; eine neue Übung = neue JSON-Datei
(z. B. Kopie einer bestehenden), sie erscheint automatisch in `/pflege`.

> Das Schreiben ins Dateisystem ist ein **lokales** Werkzeug. In Produktion ist es gesperrt
> (Freischalten nur bewusst via `ALLOW_CONTENT_WRITE=1`); echte Autoren-Rollen/Auth kommen mit Phase 4.

## Roadmap (siehe Konzept §9)
- **Phase 3** (teilweise erledigt) — Mehr-Übungs-Routing + `/pflege`-Autorenoberfläche stehen;
  offen: Kurs-/Lektions-Übersichtsseiten und Breadcrumb-Navigation aus Daten.
- **Phase 4** — Persistenz & Nutzer (MariaDB, Auth, DSGVO).
- **Phase 5** — Designer-Modus (LLM-gestützte Übungserstellung via Vision).
- **Phase 6** — Video-Upload & Bewegungsanalyse. Hierher gehört das separate
  **WurfTool** (`mockups/v3_wurfvideo/`, macOS-Python/OpenCV-Pipeline, Kugel/Speer/
  Schleuderball): eigene Ingestion-Pipeline mit Kennzahl-Extraktion und pro-Submission
  individualisiertem Prompt. Bewusst ans Ende der Roadmap gestellt.
```
