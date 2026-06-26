#!/usr/bin/env bash
# Deployt deploy-bundle/ per SFTP (lftp) in den Webroot des ZHL-Node-Slots.
# Code landet unter public/ (= web docroot; Node-Entry = public/app.js, analog
# zu python public/app.py). Zugang gezielt aus .env gelesen (kein `source`,
# da .env Nicht-KEY=VALUE-Zeilen enthält). Passwort wird NICHT ausgegeben.
#
# Voraussetzung: ./scripts/build-bundle.sh wurde ausgeführt.
# REMOTE_CLEAN=1 für sauberen Spiegel (--delete); Default ist additiv.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -d deploy-bundle ] || { echo "deploy-bundle/ fehlt — erst scripts/build-bundle.sh"; exit 1; }

envval() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/[[:space:]]*$//'; }
SFTP_RAW="$(envval SFTP)"
SFTP_HOST="${SFTP_RAW%%:*}"
SFTP_PORT="${SFTP_RAW##*:}"
USER="$(envval SFTP_User)"
PASS="$(envval SFTP_Pw)"
REMOTE_DIR="${REMOTE_DIR:-public}"

[ -n "$SFTP_HOST" ] && [ -n "$USER" ] && [ -n "$PASS" ] || { echo "SFTP-Zugang unvollständig in .env"; exit 1; }
echo "▸ Deploy → ${USER}@${SFTP_HOST}:${SFTP_PORT}/${REMOTE_DIR}  (Passwort verborgen)"

MIRROR_FLAGS="-R --verbose=1 --parallel=4 --no-perms"
[ "${REMOTE_CLEAN:-0}" = "1" ] && MIRROR_FLAGS="$MIRROR_FLAGS --delete"

LFTP_PASSWORD="$PASS" lftp -u "${USER}" --env-password -p "${SFTP_PORT}" "sftp://${SFTP_HOST}" <<LFTP
set sftp:auto-confirm yes
set net:timeout 25
set net:max-retries 2
mirror $MIRROR_FLAGS deploy-bundle ${REMOTE_DIR}
bye
LFTP

echo "✓ Upload fertig → /${REMOTE_DIR}. Node-Slot ggf. im Panel (neu) starten; Entry = ${REMOTE_DIR}/app.js."
