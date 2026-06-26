# Deployment — biomechanik.zhl-ubt.de (Node-20-Slot)

Das Beschreibungs-Lab läuft als **Next.js (`next start`)** auf dem **Node.js-20-Slot** des
ZHL-Hostings: `node-biomechanik.zhl-ubt.de`.

Die Plattform ist Multi-Runtime (ein gemeinsamer SFTP-Webroot, getrennte Laufzeit-Container):
| Slot | URL | Runtime |
|---|---|---|
| PHP 8.3 (Default) | `biomechanik.zhl-ubt.de` | PHP |
| Python | `py-biomechanik.zhl-ubt.de` | `public/app.py` |
| **Node.js 20** | **`node-biomechanik.zhl-ubt.de`** | **`public/app.js`** ← hier |

SFTP-Home: `public/` = Web-Docroot, `private/` = **nicht** web-ausgeliefert (für Secrets).

Container-Vertrag des Node-Slots: Workdir `/app/public`, führt automatisch
`npm install && npm start` aus, App **muss auf Port 3000 lauschen**. Darum: normaler
`next start` (KEIN standalone), Dependencies in `package.json` deklariert → der Container
installiert sie selbst. `package-lock.json` sorgt für eine vollständige Installation.

## Build & Deploy
```bash
./scripts/build-bundle.sh   # next build → deploy-bundle/ (2,3M, OHNE node_modules/Secret)
./scripts/deploy.sh         # lftp/SFTP:2222 → public/
```
- `build-bundle.sh` erzeugt `deploy-bundle/` mit `.next` (Build), `next.config.mjs`, `content/`,
  `package.json` (deps + `start: node app.js`), `package-lock.json` und `app.js`
  (Start-Shim: lädt Secret aus `../private/.env`, startet `next start` auf `0.0.0.0:3000`).
- Der **`ANTHROPIC_API_KEY` ist NIE im Bundle**. Er liegt serverseitig in **`private/.env`**
  (= `/app/private/.env`, außerhalb des Webroots). Lade-Reihenfolge im Shim:
  `Panel-/Prozess-Env → ../private/.env → ./.env`.
- Zugang kommt aus der lokalen `.env` (`SFTP`, `SFTP_User`, `SFTP_Pw`) — nie committen, nie
  mit-deployen.

## Einmalig im Hosting-Panel (nur manuell möglich)
1. **Node.js-20-App aktivieren** für `node-biomechanik`, **Entry/Workdir = `public/`** (start aus
   `public/package.json`).
2. App **starten/neustarten** → Container macht `npm install && npm start`.
3. Falls das Panel Umgebungsvariablen kann: alternativ `ANTHROPIC_API_KEY` dort setzen
   (hat Vorrang vor `private/.env`).

> **Beim Wechsel von einem früheren Standalone-Deploy:** vorher `public/node_modules` (und
> `public/server.js`) löschen, damit `npm install` eine vollständige `next`-Installation macht.

## Verifizieren
```bash
curl -I https://node-biomechanik.zhl-ubt.de/            # 200 → läuft
# Seite öffnen, „KI Feedback" testen (braucht den Key aus private/.env)
```

## Hinweise
- **Pflege/Schreiben** (`/pflege`, `/api/content`) ist live **gesperrt** (`NODE_ENV=production`,
  kein Auth — Phase 4). Prompts/Musterlösungen vorerst lokal pflegen und neu deployen; ein
  Redeploy überschreibt `content/`. Später: Basic-Auth + `ALLOW_CONTENT_WRITE=1`.
- Secret-Rotation: `private/.env` per SFTP ersetzen, Node-Slot neu starten.
