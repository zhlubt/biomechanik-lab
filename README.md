# Biomechanik-Lab | Beschreibungs-Lab

Eine Lernplattform, auf der Studierende etwas Gesehenes mit eigenen Worten
fachlich beschreiben: ein Kraft-Zeit-Diagramm, eine Bewegung im Video, ein
anatomisches 3D-Modell, eine Messkurve aus der Zerspanung. Auf ihren Text
bekommen sie **sokratisches** KI-Feedback, also Hinweise und Rückfragen zu
einzelnen Stellen ihrer Beschreibung, aber nie eine fertige Formulierung.

Didaktisch gedacht ist das Werkzeug als Übungsraum vor dem Protokoll oder der
Prüfung: beschreiben, Rückfragen lesen, überarbeiten, so oft man will.

Konzept und Begründung: [`docs/ENTWICKLUNGSKONZEPT.md`](docs/ENTWICKLUNGSKONZEPT.md).
Arbeitsanweisung mit Konventionen: [`CLAUDE.md`](CLAUDE.md).

## Zwei Varianten, eine davon produktiv

Das Repository enthält zwei Umsetzungen derselben Idee. Wer hier anfängt,
sollte nur die erste anschauen:

**`php/` ist die Live-Variante.** Sie läuft auf
https://biomechanik.zhl-ubt.de, auf PHP 8.3 mit SQLite, ohne Framework und
ohne Build-Schritt. Hier passiert die Weiterentwicklung.

**`src/` ist eine eingefrorene Next.js-Variante** (Next 15, React 19,
TypeScript). Sie war der erste Prototyp und ist funktional, aber sie wird
nicht mehr gepflegt. Der Hosting-Platz des ZHL kann PHP dauerhaft und Node
nur eingeschränkt, deshalb der Wechsel. Der Code bleibt im Repository, weil
die React-Komponenten für Sprunganimation und Kraftkurven
(`src/components/JumpForceLab.tsx`, `KneeFrontal.tsx`) als Referenz nützlich
sind.

`mockups/` enthält die Entwurfsstufen vor Phase 1, darunter statische
HTML-Mockups und das WurfTool von Dr. Uli Fehr. Siehe
[NOTICE.md](NOTICE.md), ein Teil davon ist Fremdmaterial.

## Wie eine Übung entsteht

Inhalte liegen nicht in der Datenbank, sondern im Dateisystem. Eine Übung ist
eine JSON-Datei, ein Verzeichnis ist ein Kurs:

```
php/private/content/<kurs>/<lektion>/<uebung>.json
```

Die Kursliste leitet die Anwendung aus den vorhandenen Übungen ab, ein neuer
Bereich braucht also nur ein neues Verzeichnis. Die JSON beschreibt alles:
Titel, Einstieg, Aufgabe, Medien, Legende, Glossar, Schreibgerüst,
Zielkonzepte, den Feedback-Prompt und die Musterlösung. Es gibt keine global
hartkodierten Prompts, jede Übung hat ihren eigenen.

Angelegt wird eine Übung entweder von Hand oder über die Pflegeoberfläche
(`php/public/pflege.php`, passwortgeschützt), die ein Gerüst erzeugt und
optional aus einem Bild Textfelder vorschlägt. Das Formular kennt bisher nur
die Medientypen Video und Sprungkraft-Labor; Bild- und 3D-Übungen entstehen
durch Kopieren einer bestehenden JSON.

Enthaltene Bereiche: `biomechanik/` (drei Übungen), `leichtathletik/` (eine),
`zerspanung/` (eine, Kraft aus dem Piezosensor gegen Wirkleistung der
Vorschubachsen).

### Medien und Methoden

`php/public/media-methods.js` ist eine Registry von Arbeitsweisen, die sich
über die Übungs-JSON zuschalten lassen (`media[].methods`), ohne Code je
Übung. Die erste Methode `readout` lässt Studierende Achsenwerte unter dem
Zeiger ablesen und als `[43,0-54,5 s]` in ihren Text übernehmen,
mausbedienbar, tastaturbedienbar und auf dem Tablet.

## Das KI-Feedback

Der Aufruf passiert serverseitig in `php/private/lib/llm.php`. Es gibt drei
Adapter, umschaltbar über `LLM_PROVIDER` in `private/.env`:

| Provider | Hinweis |
| --- | --- |
| `nhr` | LLM-Gateway des NHR@FAU, OpenAI-kompatibel. Default der Live-Installation, Modell `gpt-oss-120b`. |
| `anthropic` | Claude, über die Messages-API. |
| `openai` | OpenAI oder jede OpenAI-kompatible Gegenstelle. |

Das Modell liefert striktes JSON (`json_schema`) in der Form
`{markers: [{category, quote, question, nudge}]}`. Ein Marker, dessen `quote`
nicht wörtlich im Text der Studierenden steht, wird verworfen, weil er sich
sonst nicht im Editor verorten lässt. Fällt der Aufruf aus, zeigt die Seite
einen Hinweis mit zwei Wegen: erneut versuchen, oder das Demo-Feedback aus der
Übungs-JSON ansehen.

Welches Modell antwortet und wo es läuft, steht für Studierende sichtbar
unter dem Feedback-Knopf und bei jeder Abgabe. Das ist Absicht: wer seinen
Text an ein Rechenzentrum schickt, soll wissen, an welches.

Zwei Stolpersteine, die Zeit gekostet haben: Reasoning-Modelle rechnen ihre
Denkspur gegen `max_tokens`, bei 800 Tokens kam nur `content: null` zurück,
daher die Untergrenze `NHR_MAX_TOKENS_FLOOR`. Und das NHR-Gateway cacht
identische Anfragen, beim Prompt-Tuning also immer etwas variieren, sonst
misst man den Cache.

## Konten, Rollen, Datenschutz

Anmelden heißt: Namen eingeben. Daraus entsteht ein Gerätekonto über ein
langlebiges Cookie (`biomech_device`), ohne E-Mail und ohne Passwort. Die
E-Mail-Funktionen in `auth.php` existieren, sind aber aus der Oberfläche
heraus nicht erreichbar.

Lehrende kommen über einen Einladungslink `konto.php?lehrcode=<TEACHER_CODE>`
herein. Die Rolle entscheidet allein der serverseitig geprüfte Code, Felder
im Formular werden ignoriert. Den fertigen Link zeigt die Pflegeoberfläche
oben als Kopierfeld.

Studierende können unter "Meine Abgaben" eine einzelne Abgabe löschen, alle
ihre Daten als JSON exportieren und ihr Konto samt Abgaben löschen
(`meine-daten.php`, Art. 15, 17 und 20 DSGVO). Die Nutzer-ID kommt dabei
immer aus der Sitzung, nie aus der Anfrage. Lehrende sehen in `nutzer.php`
alle Konten mit Abgabenzahl und können sie löschen.

Gehärtet ist außerdem: CSRF-Token auf allen schreibenden Endpunkten,
`Secure`/`HttpOnly`/`SameSite=Lax` auf dem Sitzungscookie, HTTPS-Erkennung
über `X-Forwarded-Proto` (hinter dem Proxy sieht PHP sonst kein HTTPS und das
Gerätecookie ginge unverschlüsselt über das Netz), Rate-Limit auf dem
Pflege-Login, und die Musterlösung wird erst auf Knopfdruck über
`loesung.php` nachgeladen statt im HTML mitgeliefert.

## Lokal starten

Für die PHP-Variante genügt PHP 8.3 oder neuer mit den Erweiterungen `pdo_sqlite`
und `curl`:

```bash
cp php/private/.env.example php/private/.env   # Werte eintragen
chmod 640 php/private/.env
php -S localhost:8080 -t php/public
```

Die SQLite-Datei legt die Anwendung beim ersten Start selbst unter
`php/private/data/` an. Ohne LLM-Key funktioniert alles außer dem KI-Feedback:
`feedback.php` antwortet mit 502, und die Seite bietet stattdessen einen Knopf
an, der das Demo-Feedback aus der Übungs-JSON zeigt.

Für die eingefrorene Next.js-Variante:

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npm run typecheck  # tsc --noEmit
```

`.env.local` aus `.env.local.example` anlegen.

## Deploy

`scripts/deploy-php.sh` lädt `php/public/` und `php/private/` per SFTP auf den
ZHL-Hosting-Platz. Details und die Rechte-Fallen stehen in
[`docs/DEPLOY.md`](docs/DEPLOY.md). Drei Dinge, die ein Fork wissen sollte:

- `private/.env` wird vom Skript **nie** überschrieben. Die Serverwerte sind
  andere als die lokalen. Ändern nur über `--env-merge KEY=WERT`.
- Der Web-PHP-Nutzer ist nicht der SFTP-Nutzer. Frisch hochgeladene Dateien
  landen als 600 und sind für den Webserver unlesbar, was sich als "Keine
  Übung" zeigt. Das Skript setzt die Rechte deshalb selbst.
- Statische Dateien bekommen über `asset()` einen Versionsstempel aus der
  Mtime, sonst liefert der Browser nach einem Deploy die alte Datei.

Die Zugangsdaten erwartet das Skript in einer `.env` im Projektwurzel, die
nicht im Repository liegt. Ein Fork braucht hier seine eigenen Werte.

## Was noch fehlt

- Nutzerverwaltung im größeren Sinn: Rollen, Kurszuordnung, Einladungen.
- Passwort-Reset, sobald es wieder E-Mail-Konten gibt.
- Eine `kurs.json` je Bereich, damit Kurstitel nicht redundant in jeder
  Übung stehen.
- Bild- und 3D-Medientypen im Anlege-Formular.
- Video-Upload mit Bewegungsanalyse. Hierher gehört das WurfTool
  (`mockups/v3_wurfvideo/`), eine eigene Pipeline mit Kennzahl-Extraktion.

## Eigene Kopie anlegen

Dieses Repository ist privat, und die Organisation erlaubt keine Forks privater
Repositories. Eine eigene Kopie entsteht deshalb so:

```bash
git clone https://github.com/zhlubt/biomechanik-lab.git
cd biomechanik-lab
git remote rename origin upstream          # Quelle zum Nachziehen behalten
git remote add origin <eigenes-leeres-repo> # eigenes Ziel
git push -u origin main
```

`upstream` bleibt als Quelle erhalten, `git fetch upstream` holt spätere
Änderungen. Rückflüsse in die andere Richtung gehen per Pull Request aus
einem Branch dieses Repositorys oder per `git format-patch`.

## Lizenz

Der Programmcode steht unter der MIT-Lizenz ([LICENSE](LICENSE)), die
didaktischen Inhalte unter CC BY-NC-SA 4.0
([LICENSE-CONTENT](LICENSE-CONTENT)). Welche Pfade zu welchem Teil gehören
und welche Mediendateien Fremdmaterial sind, steht in [NOTICE.md](NOTICE.md).

Wer das Projekt forkt und selbst betreibt, braucht ein eigenes Impressum und
eine eigene Datenschutzerklärung. `php/public/impressum.php` ist auf die
Universität Bayreuth ausgestellt und muss angepasst werden.

Entstanden am Zentrum für Hochschullehre der Universität Bayreuth.
Kontakt: ki-lehre@uni-bayreuth.de
