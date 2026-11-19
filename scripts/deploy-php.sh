#!/bin/bash
# Shebang bewusst fest: /usr/bin/env bash wuerde das x86-bash aus dem Intel-Homebrew
# (/usr/local/bin, im PATH weiter vorn) finden - seit macOS 27 ohne Rosetta nicht lauffaehig.
# Deployt die PHP-Variante auf den ZHL-PHP-Slot (biomechanik.zhl-ubt.de).
#   php/public/  → SFTP public/  (= /var/www/html)
#   php/private/ → SFTP private/ (= /var/www/private): config.php, lib/, content/
#
# TRANSPORT: sftp + expect (scripts/sftp-run.exp).
#   lftp und sshpass sind x86_64-Binaries aus dem Intel-Homebrew und seit dem
#   Wegfall von Rosetta (macOS 27) nicht mehr lauffaehig. sftp und expect
#   liegen als arm64 vor und brauchen keine Installation.
#
# SECRETS: private/.env wird NICHT ueberschrieben. Dort stehen PFLEGE_PASSWORD
#   und NHR_API_KEY; die Server-Werte sind andere als die lokalen Testwerte.
#   Zum Aendern: `scripts/deploy-php.sh --env-merge KEY=WERT …` — holt die
#   Server-Datei, setzt nur die genannten Schluessel und laedt sie 640 zurueck.
#
# Rechte: Der Web-PHP-Prozess laeuft NICHT als der SFTP-User (1044), ist aber in
# der Gruppe `filebrowser`. content-Dateien muessen gruppen-lesbar/-schreibbar
# sein (Dirs 755/775, Dateien 664), sonst 404 („Keine Uebung gefunden") bzw. die
# Pflege kann nicht speichern. private/.env muss 640 sein.
set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
BATCH="$TMP/batch.sftp"

envval() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//'; }
H="$(envval SFTP)"; HOST="${H%%:*}"; PORT="${H##*:}"
U="$(envval SFTP_User)"; PASS="$(envval SFTP_Pw)"
[ -n "$HOST" ] && [ -n "$U" ] && [ -n "$PASS" ] || { echo "SFTP-Zugang unvollstaendig in .env"; exit 1; }

run_batch() { SFTP_PW="$PASS" ./scripts/sftp-run.exp "$U" "$HOST" "$PORT" "$1"; }

# --- Sonderweg: einzelne Schluessel in private/.env setzen, Rest unangetastet ---
if [ "${1:-}" = "--env-merge" ]; then
  shift
  [ $# -gt 0 ] || { echo "Nutzung: $0 --env-merge KEY=WERT [KEY=WERT …]"; exit 1; }
  printf 'get private/.env %s/server.env\n' "$TMP" > "$BATCH"
  run_batch "$BATCH" >/dev/null
  [ -s "$TMP/server.env" ] || { echo "private/.env konnte nicht geholt werden"; exit 1; }
  python3 - "$TMP/server.env" "$@" <<'PY'
import re, sys
path, pairs = sys.argv[1], sys.argv[2:]
s = open(path).read().rstrip('\n')
for p in pairs:
    k, _, v = p.partition('=')
    s = re.sub(rf'^{re.escape(k)}=.*$', f'{k}={v}', s, flags=re.M) \
        if re.search(rf'^{re.escape(k)}=', s, flags=re.M) else s + f'\n{k}={v}'
open(path, 'w').write(s + '\n')
print('gesetzt:', ', '.join(p.split('=')[0] for p in pairs))
PY
  printf 'put %s/server.env private/.env\nchmod 640 private/.env\n' "$TMP" > "$BATCH"
  run_batch "$BATCH" >/dev/null
  echo "✓ private/.env aktualisiert (640), uebrige Werte unveraendert."
  exit 0
fi

# --- Inhalts-Schutz: Uebungen entstehen auch auf dem Server (Pflege > Neue Uebung) ---
# Vor jedem Upload wird der Server-Stand von private/content geholt und mit dem
# lokalen Stand und dem Manifest des letzten Deploys verglichen
# (scripts/content-sync.py). Auf dem Server geaenderte Dateien werden nicht
# ueberschrieben: das Skript bricht ab und verweist auf --pull.
#   --pull           Server-Stand nach lokal holen (danach git diff pruefen)
#   --force-content  trotz Konflikt die lokale Fassung hochladen
MANIFEST=".deploy-state/content.sha256"
fetch_server_content() {
  printf 'get -r private/content %s/srv\n' "$TMP" > "$BATCH"
  run_batch "$BATCH" >/dev/null 2>&1 || true
  [ -d "$TMP/srv" ] || { echo "✗ Server-Inhalte (private/content) konnten nicht geholt werden."; exit 1; }
}

if [ "${1:-}" = "--pull" ]; then
  fetch_server_content
  /usr/bin/python3 scripts/content-sync.py pull "$TMP/srv" php/private/content "$MANIFEST"
  exit $?
fi

FORCE_CONTENT=0
[ "${1:-}" = "--force-content" ] && FORCE_CONTENT=1
fetch_server_content
/usr/bin/python3 scripts/content-sync.py check "$TMP/srv" php/private/content "$MANIFEST" "$FORCE_CONTENT" || exit 1

echo "▸ PHP-Deploy → ${U}@${HOST}:${PORT}  (Passwort verborgen)"

{
  # Verzeichnisse: '-' davor, damit „existiert schon" den Lauf nicht abbricht.
  echo "-mkdir private"
  echo "-mkdir private/lib"
  echo "-mkdir private/content"
  echo "-mkdir private/data"
  echo "-mkdir public/img"
  echo "-mkdir public/vid"
  echo "-mkdir public/model"

  for f in php/public/*.php php/public/*.js php/public/*.css; do
    [ -e "$f" ] && echo "put $f public/$(basename "$f")"
  done
  # Medien: nur anlegen/aktualisieren, nie loeschen (Videos liegen nur auf dem Server).
  for f in php/public/img/* php/public/model/*; do
    [ -f "$f" ] && echo "put $f public/$(echo "$f" | sed 's|^php/public/||')"
  done

  # Animationsseiten (Medientyp "frame"): ganzer Baum unter public/anim/, lesbar fuer den Web-User.
  if [ -d php/public/anim ]; then
    find php/public/anim -type d | sed 's|^php/public/|-mkdir public/|'
    find php/public/anim -type f ! -name '.DS_Store' | while read -r f; do
      echo "put $f public/${f#php/public/}"
    done
    find php/public/anim -type d | sed 's|^php/public/|chmod 755 public/|'
    find php/public/anim -type f ! -name '.DS_Store' | sed 's|^php/public/|chmod 644 public/|'
  fi

  for f in php/private/lib/*.php; do echo "put $f private/lib/$(basename "$f")"; done
  echo "put php/private/config.php private/config.php"
  # Anleitung fuer die KI-gestuetzte Uebungsentwicklung (Pflege > Neue Uebung).
  [ -f php/private/llm-anleitung.md ] && { echo "put php/private/llm-anleitung.md private/llm-anleitung.md"; echo "chmod 644 private/llm-anleitung.md"; }

  # Inhalte: Verzeichnisbaum nachziehen und Rechte setzen.
  find php/private/content -mindepth 1 -type d | sed 's|^php/private/content|-mkdir private/content|'
  find php/private/content -name '*.json' | while read -r f; do
    echo "put $f private/content/${f#php/private/content/}"
  done

  # Schreibbar fuer den Web-User: Uploads aus „Neue Uebung“ (Bild, Video, 3D) und die Datenbank.
  echo "chmod 775 public/img public/vid public/model private/data"
  echo "-chmod 775 private/content"
  find php/private/content -mindepth 1 -type d | sed 's|^php/private/content|-chmod 775 private/content|'
  find php/private/content -name '*.json' | while read -r f; do
    echo "-chmod 664 private/content/${f#php/private/content/}"
  done
} > "$BATCH"

run_batch "$BATCH" | grep -vE "^(spawn |.*password:)" || true

echo "✓ Upload fertig ($(grep -c '^put' "$BATCH") Dateien)."
/usr/bin/python3 scripts/content-sync.py record "$TMP/srv" php/private/content "$MANIFEST"
echo "  private/.env blieb unberuehrt — aendern mit: $0 --env-merge NHR_MODEL=…"
echo "  Test: https://biomechanik.zhl-ubt.de/  und  /pflege.php"
