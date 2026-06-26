#!/usr/bin/env bash
# Deployt die PHP-Variante auf den ZHL-PHP-Slot (biomechanik.zhl-ubt.de).
#   php/public/  → SFTP public/  (= /var/www/html)
#   php/private/ → SFTP private/ (= /var/www/private): config.php, lib/, content/
# Secrets (ANTHROPIC_API_KEY, PFLEGE_PASSWORD) liegen in private/.env auf dem
# Server (mode 640, Gruppe filebrowser) — werden NICHT mitdeployt.
#
# Rechte: Der Web-PHP-Prozess läuft NICHT als der SFTP-User (1044), ist aber in
# der Gruppe `filebrowser`. Daher müssen content-Dateien gruppen-lesbar/-schreibbar
# sein (Dirs 775, Dateien 664), sonst 404 („Keine Übung gefunden") bzw. Pflege
# kann nicht speichern. private/.env muss 640 sein, sonst kommt der Webserver
# nicht an Key/Passwort.
#
# REMOVE_NODE=1 entfernt zusätzlich Node-Altlasten aus public/ (v. a. public/content,
# das sonst den feedbackPrompt web-ausliefern würde).
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//'; }
H="$(envval SFTP)"; HOST="${H%%:*}"; PORT="${H##*:}"; U="$(envval SFTP_User)"; PASS="$(envval SFTP_Pw)"
[ -n "$HOST" ] && [ -n "$U" ] && [ -n "$PASS" ] || { echo "SFTP-Zugang unvollständig in .env"; exit 1; }
echo "▸ PHP-Deploy → ${U}@${HOST}:${PORT}  (Passwort verborgen)"

CLEAN=""
if [ "${REMOVE_NODE:-0}" = "1" ]; then
  CLEAN="
    rm -r public/content
    rm -r public/.next
    rm -r public/node_modules
    rm -f public/package.json public/package-lock.json public/next.config.mjs public/server.js
  "
fi

LFTP_PASSWORD="$PASS" lftp -u "$U" --env-password -p "$PORT" "sftp://$HOST" <<LFTP
set sftp:auto-confirm yes
set net:timeout 30
$CLEAN
mirror -R --verbose=1 --parallel=3 php/public public
mirror -R --verbose=1 --parallel=3 php/private/lib private/lib
# Upload-Ziele für die Pflege (Vorschaubilder/Videos): gruppen-schreibbar (filebrowser)
chmod 775 public/img public/vid
put php/private/config.php -o private/config.php
mirror -R --verbose=1 --parallel=3 php/private/content private/content
# SQLite-Datenverzeichnis (Phase 4) — gruppen-schreibbar, DB wird zur Laufzeit erzeugt.
mkdir -f private/data
chmod 775 private/data
# Rechte für den Web-User (Gruppe filebrowser):
chmod 755 private/content
glob -a chmod 755 private/content/*
glob -a chmod 755 private/content/*/*
glob -a chmod 664 private/content/*/*/*.json
bye
LFTP

echo "✓ Upload fertig."
echo "  private/.env separat pflegen (ANTHROPIC_API_KEY + PFLEGE_PASSWORD), mode 640."
echo "  Test: https://biomechanik.zhl-ubt.de/  und  /pflege.php"
