#!/usr/bin/env sh
# Скачивает SQLite с Railway в текущую папку (нужен Railway CLI: npm i -g @railway/cli, railway login, railway link).
# Путь к файлу по умолчанию: /data/app.db (см. RAILWAY.md — Volume на /data).
#
# Использование:
#   ./scripts/fetch_railway_app_db.sh
#   RAILWAY_DB_PATH=/data/app.db ./scripts/fetch_railway_app_db.sh ./railway-app.db

set -eu

OUT="${1:-railway-app.db}"
REMOTE_PATH="${RAILWAY_DB_PATH:-/data/app.db}"

echo "Скачиваю ${REMOTE_PATH} → ${OUT} (через railway ssh)…"
railway ssh -- cat "${REMOTE_PATH}" > "${OUT}"
echo "Готово: $(wc -c < "${OUT}") байт → ${OUT}"
echo "Дальше: ./scripts/restore_business_from_dump.sh ${OUT}"
