# Handover — Biomechanik-Lab Mock-up (ubt_wilke)

> Stand: 2026-05-21 · Autor des Mock-ups: Paul + Claude · Empfänger: jeder, der das hier weiterbaut.

## Worum es geht

Mock-up für einen Professor aus der **Trainingswissenschaft (Uni Bayreuth)**. Lehrszenario:
Studierende sehen ein 6-Sekunden-Video eines Athleten, der auf eine Messplatte springt
(`vid/absprungbrett.mp4`). Links im Video das 3D-Bewegungsmodell, rechts ein Diagramm
mit den drei Kraftkomponenten F_x (pink, medio-lateral), F_y (grün, antero-posterior),
F_z (türkis, vertikal). Aufgabe: das, was man sieht, in eigenen Worten und biomechanisch
sauber beschreiben.

**Pädagogischer Kern**, den der Prof bestätigt hat und der jede Designentscheidung schlägt:

> Die KI gibt **Fragen, keine Lösungen**. Der Studierende muss schreiben. Das Tool darf
> ihn nicht überfordern und nicht für ihn fertig formulieren.

Wenn du eine UX-Entscheidung treffen musst und unsicher bist: frag dich, ob die Variante
den Studierenden mehr schreiben lässt oder weniger. Mehr ist richtig.

## Dateien

- [index.html](index.html) — Dark Theme (Default, was der Prof zuerst sieht)
- [index-light.html](index-light.html) — Light Theme (weißer Hintergrund, dunkler Text)
- `vid/absprungbrett.mp4` — das Demo-Video
- `HANDOVER.md` — diese Datei

Beide HTML-Dateien sind **standalone**: kein Build, kein npm, kein Server. Doppelklick im
Finder oder `open index.html` reicht. Keine externen Assets außer dem Video. Themes sind
über einen Switcher im Header verlinkt (☀ Light ↔ 🌙 Dark).

## Was steht

1. **Video-Player** mit eigenen Controls
   - Drag-bare Scrub-Leiste (PointerEvents mit Capture, pausiert beim Drag, läuft danach weiter)
   - Frame-Step ±1 (Pfeil-Tasten, FPS=30 angenommen), 0.5-Sek-Sprünge (`,` / `.`)
   - Speed 0.25× / 0.5× / 1× / 2× (Tasten `1`–`4`)
   - Phasen-Sprungmarken: Start · Anflug · Landung · Maximum F_z · Abstoß
   - Tastatur-Shortcuts unten als Cheatsheet
2. **Achsen-Legende + Glossar** rechts vom Video
3. **Live-Typewriter** schreibt den vorgegebenen Studierenden-Text in den Editor (3× Speed
   gegenüber Realtime, „⏭ Sofort fertig"-Skip-Button vorhanden)
4. **KI-Feedback (Kern-UX)**
   - Klick auf „KI Feedback" → drei kleine **Marker-Chips ① ② ③** erscheinen am Ende der
     drei problematischen Stellen
   - Text bleibt sonst **komplett unverändert** (keine Hintergrund-Highlights, keine
     Umfärbung — der Student soll seine eigene Schrift wiedererkennen)
   - Erst beim **Hover/Klick auf einen Chip** wird die zugehörige Stelle dezent unterlegt
     und ein Floating-Tooltip mit der **sokratischen Frage** zeigt sich
   - Tooltips klemmen am Viewport (kippen oben/unten je nach Platz, clampen horizontal)
   - „Marker ausblenden"-Toggle im Banner, falls der Student konzentriert weiterlesen will
   - Esc / Klick außerhalb schließt einen angepinnten Tooltip
5. **Schreib-Gerüst** (4 Schritte) als Stützrad
6. **Experten-Beschreibung** verschwommen — Klick auf 👁 entblurrt. Verhindert, dass
   Studierende vorzeitig spicken.

## Architektur-Hinweise

- **CSS-Variablen pro Theme** sind in `:root` definiert. Wenn du Farben/Typo ändern willst,
  fang dort an. Die meisten Werte fließen über `var(--ink-dim)`, `var(--accent)` etc. ins
  Layout. `color-mix(in srgb, var(--accent) 12%, transparent)` wird für theme-agnostische
  Tönungen genutzt (z. B. Hint-Banner).
- **Mono-Font**: bewusst nur noch für Code-artige Elemente (Tastatur-Kürzel, Zeitanzeige,
  Inline-Code im Glossar). Paul fand sie sonst schwer zu lesen. Bitte halten.
- **JS-Struktur** in beiden Dateien:
  - Player (`vid`, `scrub`, Frame-Step, Speed, Keyboard)
  - Scrub-Drag mit Pointer-Capture (siehe `seekFromEvent`, `scrubDragging`)
  - Typewriter (`typeOut`, 2 Zeichen/Tick, Skip via `skipType`)
  - Feedback-Render (`renderFeedback` → Chips bekommen Hover/Click-Handler)
  - Floating-Tooltip (`floatTip` als Singleton im body, `positionTip` rechnet
    Viewport-Clamping)
- **Annotated Text** in `const annotated`: HTML-ähnliches Format mit `<m axis="x">…</m>`.
  Erweitern oder ändern: einfach mehr `<m>`-Marker einfügen und entsprechenden Eintrag in
  `tips` ergänzen. Die Chips werden in DOM-Reihenfolge nummeriert.
- **`tips`-Objekt** ist die einzige Stelle, an der du Feedback-Inhalte editierst. Halte
  dich dabei strikt an **sokratisch** (Fragen, kein „Versuch: …" oder „Stichwort: …").
  Wenn du fertige Formulierungen reinschreibst, bricht das den pädagogischen Kontrakt.

## Bewusste Entscheidungen, die du nicht versehentlich kippen solltest

- **Keine farbigen Highlights im Studierenden-Text**. Wir haben es zwei Mal mit
  Hintergrund-Highlights probiert; Paul hat beide Male abgebrochen mit „dann weiß der
  Student ja nicht mehr, wo oben und unten ist". Marker-Chips sind die UX-Lösung.
- **Drei Marker, nicht vier oder fünf**. Wir hatten zwischenzeitlich einen vierten
  Meta-Marker auf das Wort „Belastung" (Sprach-Hinweis). Der wurde in den X-Tooltip
  eingewoben, weil er sonst innerhalb des X-Marks lag und die Nummerierung durcheinander
  brachte. Wenn du sprachliche Hinweise dazu nehmen willst, mach das innerhalb der
  bestehenden Tooltip-Bodies — nicht als separate verschachtelte Markierung.
- **Player FPS = 30 hartcodiert**. Wenn das echte Video andere FPS hat, in
  `const FPS = 30;` ändern. Es gibt kein verlässliches Browser-API, um die FPS einer
  Video-Datei zu lesen.
- **Typewriter ist Performance, kein Eingabefeld**. Der Editor ist `contenteditable="false"`.
  Wenn du ihn echt editierbar machst (für Live-Demo, wo der Prof tippen darf), musst du
  den Auto-Start unterbinden und die Word-Count-Logik anpassen.

## Bekannte Limitationen / offene Punkte

- **Keine KI dahinter.** Die „KI" ist ein hartcodierter Marker-Set. Wenn der Prof das
  produktiv haben will, müsste das an einen Claude-API-Endpoint verdrahtet werden, der
  beliebigen Studierenden-Text bekommt und Marker-Positionen + sokratische Fragen
  zurückgibt. Das ist die nächste echte Ausbaustufe, nicht trivial. Siehe „Mögliche
  nächste Schritte" unten.
- **Frame-Bookmark-Funktion** (Taste `F`) ist im Shortcut-Cheatsheet beworben, aber **nicht
  implementiert**. Falls jemand danach fragt: war geplant, ist nicht da. Entweder
  implementieren oder aus dem Cheatsheet rausnehmen.
- **Mobile/Touch** ist nicht systematisch getestet. Pointer-Events sollten Touch
  abdecken; Tooltips dürften eng werden. Wenn das ein Use-Case wird: Layout auf < 600 px
  Breite stresstesten.
- **Achsen-Legende kollabiert auf schmalen Screens** etwas hart. Das Grid wechselt unter
  980 px auf einspaltig, aber das Verhältnis zwischen Video-Höhe und Legenden-Höhe wird
  dann unschön. Kein Blocker.
- **`scrollIntoView({block:'nearest'})` beim Klick auf KI Feedback** scrollt manchmal
  einen Tick zu weit. Akzeptabel, aber bei Bedarf mit `behavior:'smooth'` + manueller
  Offset-Berechnung verfeinern.

## Mögliche nächste Schritte

In etwa nach Aufwand sortiert:

1. **Echte Claude-Integration.** Endpoint hinter dem „KI Feedback"-Button: schickt
   Studierenden-Text + Aufgaben-Kontext (3D-Modell, Messplatte, drei Achsen) an Claude,
   bekommt strukturierte Antwort `{stellen:[{start_char, end_char, axis, frage,
   nudge}], …}` zurück, rendert das ins bestehende Chip-System. Prompt muss strikt
   sokratisch zwingen (Fragen statt Lösungen) — System-Prompt sollte das mit Beispielen
   verstärken. Caching der Antworten sinnvoll. Trainexus hat ANTHROPIC_KEY-Pattern, siehe
   andere Projekte (PromptStudio, ExamSim).
2. **„Verstanden"-Status pro Chip persistieren.** Nach Lesen des Hinweises kann der
   Student „verstanden" markieren; Fortschrittsbalken am Banner. Reines UX, kein
   Backend.
3. **Frame-Bookmark-Funktion** (`F`-Taste) wirklich implementieren: Zeitstempel speichern,
   Liste unter dem Player rendern, Klick springt zurück. Pädagogisch wertvoll für
   „Schau dir den Moment Y nochmal an"-Feedback.
4. **Vergleich Studierender ↔ Experten-Beschreibung** automatisieren: nach dem Schreiben
   per KI-Diff vorschlagen, welche Aspekte (Achse, Einheit, Phase, Interpretation) gut
   abgedeckt und welche fehlen. Auch hier strikt im Frage-Modus.
5. **Multi-Video-Modus**: Prof legt mehrere Aufgaben an, Studierende durchlaufen sie.
   Würde eine kleine Backend-Schicht brauchen (Aufgaben-Definition, ggf. Speichern der
   Antworten).
6. **Video-FPS automatisch erkennen.** Halbwegs zuverlässig nur über `requestVideoFrameCallback`
   möglich (Browser-Support okay). Lohnt sich nur, wenn Frame-Step-Genauigkeit wirklich
   wichtig wird.

## Wenn du Paul-Stil bedienen willst

- Knappe Updates, keine Aufzählung von Selbstverständlichkeiten
- „Mach das" → mach es, frag nicht zwei Mal zurück
- Wenn der Vorschlag zu generisch oder zu „KI-bunt" aussieht, fliegt er — siehe Verlauf
  der Tooltip-Iteration (3 Anläufe). Lieber zurückhaltend und klar als laut und
  überdesigned.
- Themes parallel pflegen. Wenn du eine Änderung im Dark machst, mach sie im Light
  mit. Sonst driften die zwei Dateien auseinander.

## Workflow-Hinweis

Wenn du an mehr als einer Stelle gleichzeitig editierst, lohnt sich evtl. ein Refactor in
eine geteilte `app.css` + `app.js` + thin-HTML-Wrapper. Aktuell sind beide Dateien fast
identisch (ca. 95 %). Solange das Mock-up-Stadium hält, ist die Duplikation aber
einfacher zu reviewen als ein Build-Setup, das es im Repo nicht gibt.
