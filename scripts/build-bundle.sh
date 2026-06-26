#!/usr/bin/env bash
# Baut das Deploy-Bundle für den ZHL-Node-20-Slot (node-biomechanik).
# Plattform-Vertrag: Container-Workdir = /app/public, führt `npm install && npm start`
# aus, App MUSS auf Port 3000 lauschen. Wir nutzen daher `next start` (KEIN
# standalone) mit deklarierten Dependencies — der Container installiert sie selbst.
#
# Ergebnis: deploy-bundle/ mit .next (Build), next.config.mjs, content, public,
# package.json (deps + start) und app.js (Start-Shim: lädt Secret aus
# ../private/.env, startet `next start` auf 0.0.0.0:3000). KEIN node_modules,
# KEIN Secret im Bundle.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ next build …"
npm run build >/dev/null

echo "▸ Bundle zusammenstellen …"
rm -rf deploy-bundle
mkdir -p deploy-bundle
cp -r .next deploy-bundle/.next
rm -rf deploy-bundle/.next/cache              # Build-Cache nicht deployen
cp next.config.mjs deploy-bundle/
cp -r content deploy-bundle/content
[ -d public ] && cp -r public deploy-bundle/public || true

# Start-Shim (= package.json "start"): lädt das Secret von außerhalb des Webroots
# und startet den normalen Next-Production-Server auf Port 3000.
cat > deploy-bundle/app.js <<'JS'
// Start-Shim für den ZHL-Node-Slot. Lädt Laufzeit-Variablen (Secret liegt NICHT
// im Webroot, sondern in ../private/.env) und startet `next start` auf :3000.
const fs = require("fs");
const path = require("path");
function loadEnv(p) {
  try {
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      if (m[1] in process.env) continue; // Panel-/Prozess-Variablen haben Vorrang
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  } catch (e) {
    console.error("[app.js] .env (" + p + ") nicht ladbar:", e && e.message);
  }
}
loadEnv(path.join(__dirname, "..", "private", ".env")); // empfohlener Secret-Ort
loadEnv(path.join(__dirname, ".env"));
process.env.PORT = process.env.PORT || "3000";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("[app.js] WARN: ANTHROPIC_API_KEY nicht gesetzt — KI-Feedback liefert 502.");
}
const { spawn } = require("child_process");
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "start", "-H", process.env.HOSTNAME, "-p", process.env.PORT], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code === null ? 1 : code));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
JS

# package.json: Dependencies werden vom Container per `npm install` geholt.
cat > deploy-bundle/package.json <<'JSON'
{
  "name": "biomechanik-lab",
  "version": "0.1.0",
  "private": true,
  "scripts": { "start": "node app.js" },
  "dependencies": {
    "next": "15.5.19",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "@anthropic-ai/sdk": "0.106.0"
  }
}
JSON

# package-lock.json erzeugen → deterministische, VOLLSTÄNDIGE Installation im
# Container (sonst könnte ein altes/partielles node_modules npm install austricksen).
( cd deploy-bundle && npm install --package-lock-only --no-audit --no-fund >/dev/null 2>&1 ) \
  && echo "  package-lock.json erzeugt" || echo "  (Warnung: package-lock.json nicht erzeugt)"

echo "✓ deploy-bundle/ fertig ($(du -sh deploy-bundle | cut -f1)) — ohne node_modules/Secret."
echo "  Container macht: cd /app/public && npm install && npm start  →  next start :3000"
