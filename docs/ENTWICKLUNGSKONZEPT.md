# Beschreibungs-Lab — Entwicklungskonzept

> Plattform, in der Studierende üben, etwas Gesehenes (Diagramm, Bewegung, Bild,
> Skizze, Video, VR-Material) **mit eigenen Worten** fachlich präzise zu beschreiben
> und dazu begleitendes, **sokratisches KI-Feedback** zu erhalten.
>
> Dieses Dokument ist die gemeinsame Arbeitsgrundlage für die Weiterentwicklung mit
> Claude Code. Es beschreibt Zielbild, Datenmodell, Pipelines, Architektur und eine
> Roadmap in ausführbaren Phasen. Annahmen sind als **[Annahme]** markiert — bitte
> bestätigen oder korrigieren (siehe Abschnitt 11).

---

## 1. Zielbild & Kernschleife

Das didaktische Ziel bleibt über alle Kurse, Lektionen und Medien hinweg **konstant**:
Studierende sollen lernen, eine Beobachtung in der **Sprache der Fachdisziplin** zu
formulieren. Alles andere (das Medium, das Fach, der konkrete Prompt) variiert.

Die immer gleiche Lernschleife einer Übung:

1. **Sehen** — Studierende sehen ein Medium (Animation, Diagramm, Bild, Video, Embed/VR).
2. **Verstehen** — sie erhalten Kontext: Erklärung, Legende, Hinweise, Glossar, Schreib-Gerüst.
3. **Beschreiben** — sie schreiben einen eigenen Text in ein Editor-Feld.
4. **Feedback** — ein im Hintergrund liegender Prompt kommentiert ihren Text. Das Feedback
   sind **Fragen und Hinweise, keine fertigen Lösungen** — es begleitet beim Besser-Machen.
5. **Vergleichen** — optional eine **Musterlösung** als Referenz (zunächst verborgen).

Das bestehende Mockup (`cmj-squatjump-light.html`) ist **genau eine** solche Übung,
vollständig ausgestaltet, aber hartkodiert. Die Aufgabe des Projekts ist, daraus ein
**datengetriebenes System** zu machen, in dem beliebig viele solcher Übungen über
Kurse/Lektionen organisiert, von Lehrenden erstellt und mit echtem KI-Feedback betrieben
werden.

---

## 2. Was das Mockup schon zeigt (und was generalisiert werden muss)

Das Mockup ist die beste Spezifikationsquelle, weil es das fertige Erlebnis einer Übung
zeigt. Jeder hartkodierte Block entspricht einem Feld im künftigen Datenmodell:

| Block im Mockup | Wird zu (Datenfeld / Komponente) |
|---|---|
| Header, Breadcrumbs („Modul 4.3 · Lehreinheit · Übung 04") | `Course` → `Lesson` → `Exercise` Hierarchie |
| Titel + Untertitel („Warum springt man höher?") | `exercise.title`, `exercise.intro` |
| SVG-Animation + Kraftkurven, Knie-SVG, QR/3D-Embed | `exercise.media[]` (Typen: `interactive`, `image`, `video`, `embed`) |
| „Was bedeutet was?" (Achsen-Legende mit Farbe/Name/Hinweis) | `exercise.legend[]` (Konzept-Schlüssel) |
| Glossar + „So beschreibst du Messdaten sauber" | `exercise.glossary[]`, `exercise.guidance` |
| Schreib-Aufgabe + Editor | `exercise.task`, Editor-Komponente |
| Schreib-Gerüst (4 Schritte) | `exercise.scaffold[]` |
| Hartkodierter Studierenden-Text (Tipp-Animation) | Demo-Modus; im echten System = `Submission` der/des Studierenden |
| Marker `<m axis="x">…</m>` + Hinweis-Tooltips (sokratisch) | **`Feedback`**, erzeugt vom LLM (Abschnitt 4) |
| Achsen x/y/z (CMJ / Squat Jump / Prinzip) | `exercise.feedbackCategories[]` (konfigurierbar) |
| Experten-Beschreibung (verschwommen, auf Klick sichtbar) | `exercise.modelSolution` |
| Feedback-Prompt | implizit im Mockup, künftig `exercise.feedbackPrompt` |

**Kernerkenntnis:** Die einzige wirklich „intelligente" Stelle — die Marker — ist im
Mockup ein hartkodierter String (`annotated`) plus ein festes `tips`-Objekt. Genau das
wird in Phase 2 durch einen echten LLM-Aufruf ersetzt, der **strukturiertes Feedback**
zurückgibt (Abschnitt 4).

---

## 3. Datenmodell / Domänenmodell

Die Hierarchie und die Kern-Entitäten. Bewusst stack-unabhängig formuliert; lässt sich
1:1 auf TypeScript-Typen, Prisma-Schema oder JSON-Content abbilden.

```
User ──< Enrollment >── Course ──< Lesson ──< Exercise
                                                  │
                          ┌───────────────────────┼───────────────────────┐
                          │                        │                       │
                    media[]                  feedback config          modelSolution
                  (Medien)            (Prompt + Kategorien)          (Musterlösung)

User ──< Submission (Text zu einer Exercise) ──< Feedback (Marker)
```

### 3.1 Inhaltliche Entitäten (vom Lehrenden erstellt)

- **Course** — `id`, `slug`, `title`, `description`, `disziplin` (z. B. Trainingswissenschaft).
- **Lesson** — gehört zu Course; `id`, `slug`, `title`, `order`.
- **Exercise** — gehört zu Lesson; die zentrale Einheit. Felder (vgl. Mockup):

```jsonc
{
  "id": "cmj-vs-squatjump",
  "title": "Warum springt man mit Ausholbewegung höher?",
  "intro": "Links zwei schematische Sprünge im Vergleich …",
  "media": [
    { "type": "interactive", "component": "JumpForceLab", "config": { /* … */ } },
    { "type": "interactive", "component": "KneeFrontal", "config": { /* … */ } },
    { "type": "embed", "url": "https://…/3d-knie", "qr": true }
  ],
  "legend": [
    { "key": "cmj", "label": "Counter-Movement Jump", "color": "#3a63d8", "hint": "Mit Ausholbewegung …" },
    { "key": "sj",  "label": "Squat Jump",            "color": "#d98018", "hint": "Aus gehaltener Hocke …" }
  ],
  "glossary": [
    { "term": "Anfangskraft", "definition": "Kraft durch Abbremsen der Gegenbewegung …" }
  ],
  "guidance": ["Was zeigt das Diagramm? (Größe + Einheit + Achse)", "…"],
  "task": "Schreibe in eigenen Worten, was du siehst und worin sich die Sprünge unterscheiden.",
  "scaffold": [
    { "step": "Sehen", "text": "Was zeigt die rechte Grafik? …" }, "…"
  ],
  "feedbackCategories": [
    { "key": "cmj",     "label": "Beobachtung CMJ",    "color": "#3a63d8" },
    { "key": "sj",      "label": "Beobachtung Squat Jump", "color": "#d98018" },
    { "key": "prinzip", "label": "Prinzip / Begründung", "color": "#1098a5" }
  ],
  "feedbackPrompt": "Du bist ein sokratischer Schreibcoach …",   // siehe Abschnitt 4
  "mediaDescription": "Zwei Strichfiguren springen; rechts zwei Kraftkurven in BW …", // für das LLM / per Vision befüllbar
  "targetConcepts": ["negativer Kraftstoß", "Anfangskraft", "Abfluggeschwindigkeit"],
  "modelSolution": "Beide Kurven zeigen die vertikale Bodenreaktionskraft …"
}
```

### 3.2 Laufzeit-Entitäten (von Studierenden erzeugt)

- **Submission** — `id`, `userId`, `exerciseId`, `text`, `createdAt`, optional `version`.
- **Feedback** — gehört zu einer Submission; das strukturierte LLM-Ergebnis (Abschnitt 4).
- **User** — `id`, `role` (`student` | `teacher` | `admin`), Auth-Felder.

> **Content-Strategie früh vs. spät:** In Phase 1–3 leben Courses/Lessons/Exercises als
> **Dateien** (JSON oder MDX) im Repo — kein Datenbank-Setup nötig, voll versionierbar.
> Erst ab Phase 4 (Studierenden-Daten, Submissions) kommt eine Datenbank dazu.

---

## 4. Feedback-Pipeline (das Herzstück)

Heute im Mockup: `annotated` (fester String mit `<m axis="…">`-Tags) + festes `tips`-Objekt.
Künftig: ein echter LLM-Aufruf, der **dasselbe Format strukturiert erzeugt**.

### 4.1 Eingaben in den Prompt
- Der Feedback-Prompt der Übung (`feedbackPrompt`).
- Aufgabe + Zielkonzepte (`task`, `targetConcepts`).
- Medien-Kontext: entweder `mediaDescription` (Text) **oder** das Bild selbst per **Vision**
  (Bild als Input an die Anthropic Messages API — kein separater Beschreibungstext nötig).
- Die Kategorien (`feedbackCategories`) — damit jeder Marker einer Kategorie zugeordnet ist.
- Der **Studierenden-Text** (die Submission).
- Optional die `modelSolution` als interne Referenz für das LLM (nicht an Studierende ausgegeben).

### 4.2 Ausgabe (strukturiert, statt Freitext)
Der Prompt fordert **ausschließlich JSON** an (bzw. nutzt Tool-Use/Structured-Output der
Anthropic API). Eine Marke entspricht genau einem `<m>`-Tag im heutigen Mockup:

```jsonc
{
  "markers": [
    {
      "category": "cmj",
      "quote": "Die blaue Kurve geht am Anfang erst ein Stück nach unten",
      "question": "Unter welchen Wert fällt die Kurve — und was bedeutet 'unter 1 BW' für die Bewegungsrichtung?",
      "nudge": "Schau in Legende und Glossar ('negativer Kraftstoß'), dann eigene Worte."
    }
  ]
}
```

Das Frontend rendert diese Marker exakt wie heute (farbige Markierung im Text + Chip +
Tooltip), nur dass Inhalt und Position nun vom LLM kommen statt hartkodiert zu sein.
**`question` statt `answer`** ist die didaktische Leitplanke — der Prompt erzwingt
Fragen/Hinweise, keine fertigen Formulierungen.

### 4.3 Wichtige Designentscheidungen
- **Span-Zuordnung:** Das LLM gibt ein wörtliches Zitat (`quote`) zurück; das Frontend
  findet die Stelle im Text und markiert sie. Robuster als Zeichen-Offsets.
- **Provider-Abstraktion:** Ein dünnes Interface (`getFeedback(input) → markers`), dahinter
  Anthropic als Default; ChatGPT als austauschbarer Adapter **[Annahme: Anthropic primär]**.
- **Schlüssel serverseitig:** Der API-Key liegt nie im Browser. Der LLM-Aufruf läuft über
  eine eigene Server-Route. (Das ist auch der Grund für die Stack-Empfehlung in Abschnitt 8.)

---

## 5. Vision — schnelleres Verständnis der Medien

Vision (Bild-Input an das LLM) wird an zwei Stellen genutzt:

- **Im Designer-Modus (Erstellung):** Lehrende laden ein Medium hoch. Das LLM „sieht" es
  und schlägt automatisch `mediaDescription`, `targetConcepts`, einen ersten
  `feedbackPrompt` und einen Entwurf der `modelSolution` vor. Das verkürzt die Erstellung
  einer Übung drastisch.
- **Zur Laufzeit (Feedback):** Statt einer von Hand gepflegten `mediaDescription` kann das
  Bild direkt mitgeschickt werden, sodass das Feedback am tatsächlichen Medium „verankert"
  ist. (Bei reinen Animationen/SVG bleibt eine Textbeschreibung oft sinnvoller.)

---

## 6. Designer-Modus (Autoren-Werkzeug)

Eine eigene Oberfläche für Lehrende, um Kurse/Lektionen/Übungen zu erstellen — LLM-gestützt:

1. Medium hochladen oder Embed/URL angeben.
2. Kurze Absicht eingeben („Studierende sollen den Unterschied CMJ/Squat Jump fachlich beschreiben").
3. **Claude generiert Entwürfe** für Titel, Intro, Legende, Glossar, Schreib-Gerüst,
   Feedback-Kategorien, Feedback-Prompt und Musterlösung (auf Basis von Vision + Absicht).
4. Lehrende redigieren jedes Feld, sehen eine **Live-Vorschau** der echten Übungsseite.
5. Speichern → die Übung erscheint im jeweiligen Kurs.

Dieser Modus ist der Hebel für Skalierung: Aus „eine hartkodierte Seite" wird „beliebig
viele Übungen, in Minuten erstellt".

---

## 7. Ausblick: Video-Upload & Bewegungsanalyse

Spätere, eigenständige Phase. Studierende laden ein **eigenes Video** hoch, um ihre eigene
Bewegung zu beschreiben. Architektonisch eine separate **Ingestion-Pipeline**:

```
Video-Upload → Pose-/Bewegungsextraktion (MediaPipe) → 2D/3D-Darstellung
            → abgeleitete Kennzahlen (Winkel, Zeitpunkte, Geschwindigkeiten)
            → diese Kennzahlen werden in einen INDIVIDUALISIERTEN Feedback-Prompt injiziert
            → Feedback referenziert die EIGENE Bewegung der/des Studierenden
```

Wichtig: **Ziel und Grobstruktur bleiben identisch** (sehen → beschreiben → Feedback).
Neu ist nur die Quelle des Mediums (eigenes Video) und ein pro-Submission **dynamisch
zusammengebauter Prompt** auf Basis der extrahierten Daten. Deshalb sollte das
`feedbackPrompt`-Feld von Anfang an Templating/Platzhalter unterstützen, damit später
Kennzahlen eingesetzt werden können (`{{kniewinkel_landung}}` usw.). Diese Phase ist
rechen- und experiment-intensiv (MediaPipe, ggf. eigener Worker/Service) und bewusst ans
Ende der Roadmap gestellt.

---

## 8. Technische Architektur (entschieden)

- **Framework:** Next.js (App Router) + TypeScript + React.
  *Begründung:* Das Mockup ist bereits HTML/CSS/JS; Next.js gibt server­seitige Routen
  (LLM-Key bleibt geheim), ein Deploy-Artefakt, einfaches Content-Handling (MDX/JSON) und
  später SSR/Auth — ohne Frontend und Backend getrennt betreiben zu müssen.
- **LLM:** Anthropic Messages API (Vision + Tool-Use/Structured-Output) als Default, hinter
  einer Provider-Abstraktion. Aufruf nur serverseitig.
- **Content (Phase 1–3):** dateibasiert (`content/<course>/<lesson>/<exercise>.json|mdx`).
- **Entwicklung & Deploy:** lokal in VS Code mit Claude Code entwickeln; Deployment später
  auf den eigenen Server (Node + Python + MariaDB vorhanden). Phase 1–3 laufen ohne
  Datenbank rein lokal.
- **Datenbank (ab Phase 4):** MariaDB (auf dem Zielserver vorhanden) + Prisma/ORM für
  User/Submissions/Feedback.
- **Auth (ab Phase 4):** zunächst einfach; an einer Hochschule ist oft **SSO (Shibboleth/SAML)**
  Pflicht — bitte klären, ob das angebunden werden muss.
- **Medien-Animationen:** die bestehenden SVG-Renderer (`JumpForceLab`, `KneeFrontal`)
  werden zu wiederverwendbaren Komponenten, parametrisiert über `media[].config`.
- **DSGVO/Datenschutz (relevant!):** Studierenden-Texte und besonders **hochgeladene Videos**
  sind personenbezogene Daten. Hosting-Ort (EU/Self-hosted), Auftragsverarbeitung des
  LLM-Anbieters und Aufbewahrung müssen früh geklärt werden. Siehe Rückfragen.

---

## 9. Roadmap in ausführbaren Phasen

Jede Phase ist eigenständig lauffähig und testbar — ideal, um sie mit Claude Code
nacheinander abzuarbeiten.

**Phase 0 — Repo & Gerüst.** Next.js/TS aufsetzen, `CLAUDE.md` ablegen, das vorhandene
Mockup als statische Referenz-Übung ins Projekt portieren, `.env` für den API-Key.

**Phase 1 — Datengetriebene Übung. ◀ HIER STARTEN.** Den hartkodierten Inhalt der einen Seite in die
`Exercise`-Struktur (Abschnitt 3) auslagern; die Seite vollständig **aus Daten** rendern.
Ergebnis: dieselbe Seite, aber jede Übung ist jetzt nur noch ein Datensatz.

**Phase 2 — Echtes KI-Feedback.** `annotated`/`tips` durch einen serverseitigen Aufruf an
die Anthropic API ersetzen; strukturierte Marker (Abschnitt 4); `feedbackPrompt` als
Übungsfeld; sokratisches Format erzwingen. Optional Vision-Verankerung.

**Phase 3 — Mehrere Übungen / Lektionen / Kurse.** Navigation, Übersichtsseiten,
Breadcrumbs aus Daten. Mehrere Beispiel-Übungen anlegen (Bild, Diagramm, Video-Embed),
um die Generalisierung zu prüfen.

**Phase 4 — Persistenz & Nutzer.** Datenbank + Auth; Submissions und Feedback speichern;
Rollen (student/teacher); DSGVO-Grundlagen (Hosting, Aufbewahrung).

**Phase 5 — Designer-Modus.** Autoren-Oberfläche; LLM-gestützte Erzeugung einer Übung aus
hochgeladenem Medium (Vision); Felder editieren; Live-Vorschau.

**Phase 6 — Video-Upload & Bewegungsanalyse.** MediaPipe-Pipeline, Kennzahl-Extraktion,
individualisierte Prompts pro Submission. Größte, experimentellste Phase.

---

## 10. Arbeiten mit Claude Code

- Dieses Dokument (`ENTWICKLUNGSKONZEPT.md`) ist die **Quelle der Wahrheit** für das *Was/Warum*.
- `CLAUDE.md` im Repo-Root ist die **Arbeitsanweisung** für das *Wie* (Konventionen, Stack,
  Vorgehen) — Claude Code liest sie automatisch.
- Empfohlenes Vorgehen: **eine Phase pro Arbeitssitzung**. Pro Phase ein kurzer Plan, dann
  umsetzen, dann testen. Nicht mehrere Phasen gleichzeitig.
- Empfohlene Repo-Struktur (Startpunkt):

```
/content        # JSON/MDX der Kurse, Lektionen, Übungen (Phase 1+)
/src
  /app          # Next.js Routen (inkl. /api/feedback serverseitig)
  /components   # Editor, MediaRenderer, Marker/Tooltip, Animationen
  /lib          # LLM-Adapter, Feedback-Pipeline, Content-Loader
  /types        # Exercise, Submission, Feedback, …
/docs           # dieses Konzept + spätere Architektur-Notizen
CLAUDE.md
```

---

## 11. Offene Entscheidungen / Rückfragen

Die folgenden Punkte ändern die Architektur grundlegend — deshalb vor dem Start klären:

**Bereits entschieden:**
- **Tech-Stack:** Next.js/TypeScript auf Node (vom Zielserver unterstützt). ✔
- **Erster Meilenstein:** die eine Seite datengetrieben machen (Phase 1). ✔
- **Hosting/Datenschutz:** zuerst lokal (VS Code + Claude Code, ohne echte Daten),
  später eigener Server mit MariaDB. ✔

**Noch offen (kein Blocker für Phase 1):**
1. **LLM-Anbieter:** Nur Anthropic, oder ChatGPT von Beginn an parallel? (relevant ab Phase 2)
2. **Feedback-Kategorien:** pro Übung frei konfigurierbar (wie heute x/y/z) — oder ein festes,
   generisches Set über alle Übungen? (relevant ab Phase 2)
3. **Hochschul-SSO:** Muss später SSO (Shibboleth/SAML) angebunden werden? (relevant ab Phase 4)

---

## 12. Phase 1 — Konkreter Start (für Claude Code in VS Code)

Ziel: dieselbe Seite wie im Mockup, aber vollständig **aus Daten** gerendert. Die komplexe
SVG-Animation bleibt eine Komponente; der gesamte *Inhalt* (Texte, Legende, Glossar, Gerüst,
Kategorien, Demo-Feedback, Musterlösung) wandert in eine Datendatei.

**Mitgeliefert:** `cmj-vs-squatjump.json` — der bereits aus dem Mockup extrahierte Inhalt
dieser einen Übung. Das ist die Vorlage für das `Exercise`-Schema.

**Schritte für Claude Code:**

1. Next.js (App Router, TypeScript) anlegen; `cmj-squatjump-light.html` als Referenz ablegen.
2. TypeScript-Typen aus `cmj-vs-squatjump.json` ableiten (`Exercise`, `Media`, `LegendItem`,
   `GlossaryItem`, `ScaffoldStep`, `FeedbackCategory`, `Marker`, …).
3. Die JSON unter `content/trainingswissenschaft/anfangskraft/cmj-vs-squatjump.json` ablegen.
4. Die Seite in Komponenten zerlegen, jede aus den Daten gespeist: Header/Breadcrumbs,
   `MediaRenderer` (Typ `interactive` → bestehende SVG-Animation als Komponente portieren),
   `ConceptLegend`, `Glossary`, `WritingEditor`, `Scaffold`, `ModelSolution` (verborgen).
5. Das **Demo-Feedback** (`demo.feedback.markers`) wie im Mockup rendern (Marker + Chips +
   Tooltips). Noch **kein** LLM-Aufruf — das ist Phase 2. Optik/Interaktion 1:1 erhalten.
6. Prüfen: Sieht die datengetriebene Seite aus wie das Mockup? Dann ist Phase 1 fertig.

**Kickoff-Prompt, den du Claude Code geben kannst:**

> „Lies `docs/ENTWICKLUNGSKONZEPT.md` und `CLAUDE.md`. Wir setzen Phase 1 um: Lege ein
> Next.js-Projekt (App Router, TypeScript) an und rendere die Übung aus
> `content/.../cmj-vs-squatjump.json` als Seite — optisch und interaktiv identisch zum
> Referenz-Mockup `cmj-squatjump-light.html`. Die SVG-Animation wird eine wiederverwendbare
> Komponente. Das Feedback kommt in dieser Phase noch aus dem `demo`-Block der JSON, nicht
> aus einem LLM. Leite vorher die TypeScript-Typen aus der JSON ab."
