# Данные с Railway: выгрузка и восстановление

Репозиторий **не содержит** файл `app.db` (он в `.gitignore`) — база живёт на **Volume** в Railway или на диске сервера. Если при смене хоста или деплоя «пропали» записи механика, нужно один раз **скачать SQLite с Railway** и **перенести бизнес-таблицы** в актуальную базу.

## Важно про Railway

- Без **Volume** база при каждом деплое может оказаться новой (данные только в контейнере). Убедись, что Volume подключён к сервису и путь совпадает с тем, куда пишет приложение (по умолчанию: `RAILWAY_VOLUME_MOUNT_PATH` → `…/app.db`, см. `RAILWAY.md`).

## 1. Скачать `app.db` с Railway

Нужны [Railway CLI](https://docs.railway.com/develop/cli) и привязка к проекту:

```bash
railway login
cd /path/to/Байк\ бот
railway link
```

Файл на сервисе обычно лежит так (Volume смонтирован в `/data`):

```text
/data/app.db
```

Если путь другой — задай переменную:

```bash
export RAILWAY_DB_PATH=/data/app.db
```

Скачать в файл рядом с проектом:

```bash
chmod +x scripts/fetch_railway_app_db.sh
./scripts/fetch_railway_app_db.sh railway-app.db
```

Вручную то же самое:

```bash
railway ssh -- cat /data/app.db > railway-app.db
```

(Если `cat` ругается на путь — проверь в контейнере: `railway ssh -- ls -la /data`.)

## 2. Влить данные в локальную или серверную базу

Скрипт делает **резервную копию** целевого `app.db`, затем вызывает `scripts/merge_sqlite.py`: удаляет бизнес-строки в **цели** и копирует их из **Railway-дампа**. Пользователи и пароли на цели **по умолчанию сохраняются** (логины останутся как на новом сервере).

```bash
chmod +x scripts/restore_business_from_dump.sh
./scripts/restore_business_from_dump.sh railway-app.db
```

Явно указать путь к целевой базе:

```bash
./scripts/restore_business_from_dump.sh railway-app.db ./app.db
```

Если нужны **те же пароли**, что были на Railway:

```bash
./scripts/restore_business_from_dump.sh railway-app.db ./app.db --copy-users
```

Подробности опций: `python3 scripts/merge_sqlite.py --help`.

## 3. Загрузка на прод (VPS / другой хост)

1. Скопируй получившийся `app.db` на сервер в каталог приложения (или путь из `BIKEBERI_DB_PATH`).
2. Перезапусти сервис (`systemctl restart bikeberi` и т.д.).
3. Проверь логин механика и наличие записей.

## 4. Только справка по строкам (без записи)

```bash
python3 scripts/merge_sqlite.py --from railway-app.db --to ./app.db --dry-run
```

---

Если дампа с Railway **нет** (сервис удалён, Volume не сохранился), восстановление из этого репозитория невозно — остаётся только бэкап с диска или снимок Railway, если он был включён отдельно.
