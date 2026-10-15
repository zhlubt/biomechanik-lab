# Lizenz-Zuordnung und Fremdmaterial

Das Repository ist zweigeteilt lizenziert: der Programmcode unter der
MIT-Lizenz ([LICENSE](LICENSE)), die didaktischen Inhalte unter
CC BY-NC-SA 4.0 ([LICENSE-CONTENT](LICENSE-CONTENT)).

## Programmcode (MIT)

| Pfad | Inhalt |
| --- | --- |
| `php/public/*.php`, `php/public/*.js`, `php/public/styles.css` | Live-Anwendung (PHP-Variante) |
| `php/private/config.php`, `php/private/lib/` | Serverseitige Bibliothek, LLM-Adapter, Auth, Sitzung |
| `src/` | Eingefrorene Next.js-Variante |
| `scripts/` | Build-, Deploy- und Generator-Skripte |
| `next.config.mjs`, `package.json`, `package-lock.json`, `tsconfig.json` | Projektkonfiguration |

## Didaktische Inhalte (CC BY-NC-SA 4.0)

| Pfad | Inhalt |
| --- | --- |
| `php/private/content/` | Übungen: Aufgabe, Leitfaden, Glossar, Feedback-Prompt, Musterlösung |
| `content/` | Übungsdaten der Next.js-Variante |
| `docs/ENTWICKLUNGSKONZEPT.md` | Didaktisches Konzept |
| `img/`, `php/public/img/` | Eigene Abbildungen und Vorschaubilder |

Die Abbildung `php/public/img/zerspanung-kraft-leistung.svg` ist mit
`scripts/gen-zerspanung-svg.py` aus synthetischen Daten selbst erzeugt. Sie ist
keine Reproduktion einer Vorlage.

## Fremdmaterial, Herkunft nicht abschließend geklärt

Diese Dateien gehören nicht dem ZHL und fallen unter keine der beiden Lizenzen.
Sie liegen hier als Arbeitsmaterial. Vor einer Weiterverbreitung oder einer
Veröffentlichung eines Forks sind die Rechte zu klären:

| Pfad | Hinweis |
| --- | --- |
| `mockups/v3_wurfvideo/WurfTool_Handbuch.docx` | Arbeitsmaterial von Dr. Uli Fehr (Universität Bayreuth). Nicht weitergeben ohne seine Zustimmung. |
| `mockups/v4/lower-limb.glb`, `mockups/v4/lower-limb-glb.zip`, `php/public/model/lower-limb.glb` | Anatomisches 3D-Modell des Beins. Quelle und Lizenz sind im Projekt nicht dokumentiert. |
| `php/public/vid/absprungbrett.mp4`, `php/public/vid/kugelstossen.mp4`, `mockups/v1/vid/absprungbrett.mp4` | Bewegungsaufnahmen. Herkunft und Einwilligung der abgebildeten Personen sind nicht dokumentiert. |
| `mockups/v2/cmj-squatjump-light.html` | Enthält eine eingebettete Abbildung als Base64-PNG, Herkunft nicht dokumentiert. |

Drittanbieter-Bibliotheken: der 3D-Betrachter `php/public/model-viewer.js` ist
eigener Code, lädt three.js aber zur Laufzeit von einem CDN. Die
npm-Abhängigkeiten der Next.js-Variante stehen mit ihren Lizenzen in
`package-lock.json`.

## Personenbezogene Daten

Im Repository liegen keine. Die Nutzerdatenbank (`php/private/data/`), die
Produktionssicherungen (`backup/`) und alle `.env`-Dateien sind über
`.gitignore` ausgeschlossen. Wer das Projekt betreibt, verarbeitet Namen und
Texte von Studierenden und braucht ein eigenes Impressum und eine eigene
Datenschutzerklärung: `php/public/impressum.php` nennt die Universität
Bayreuth und ist für einen Fork anzupassen.
