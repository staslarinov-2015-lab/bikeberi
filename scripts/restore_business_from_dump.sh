#!/usr/bin/env sh
# Подставляет бизнес-данные из дампа (например скачанного с Railway) в локальный app.db.
# Пароли пользователей на цели по умолчанию сохраняются (см. merge_sqlite.py).
#
# Использование:
#   ./scripts/restore_business_from_dump.sh railway-app.db
#   ./scripts/restore_business_from_dump.sh railway-app.db ./app.db
#   ./scripts/restore_business_from_dump.sh railway-app.db ./app.db --copy-users

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"

SOURCE="${1:?Укажите путь к .db с Railway}"
shift

TARGET="${ROOT}/app.db"
if [ "${1:-}" ] && [ "${1#-}" = "$1" ]; then
  TARGET="$1"
  shift
fi

EXTRA="$*"

if [ ! -f "${SOURCE}" ]; then
  echo "Файл не найден: ${SOURCE}" >&2
  exit 2
fi

if [ ! -f "${TARGET}" ]; then
  echo "Целевой файл ${TARGET} нет — создаю схему через init_db()…"
  (cd "${ROOT}" && python3 -c "import app; app.init_db()")
fi

BACKUP="${TARGET}.bak.$(date +%Y%m%d_%H%M%S)"
cp "${TARGET}" "${BACKUP}"
echo "Резервная копия текущей базы: ${BACKUP}"

python3 "${SCRIPT_DIR}/merge_sqlite.py" --from "${SOURCE}" --to "${TARGET}" ${EXTRA}
echo "Готово. Запуск локально: cd ${ROOT} && python3 app.py"
echo "На сервере замени файл по пути BIKEBERI_DB_PATH и перезапусти сервис."
