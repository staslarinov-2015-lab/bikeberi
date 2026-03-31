# Railway Deploy

Этот проект уже подготовлен под Railway через `Dockerfile`.

## Что важно

- приложение запускается в контейнере командой `python3 app.py`
- база `SQLite` должна лежать на `Railway Volume`
- если Volume подключен, приложение автоматически возьмет путь из `RAILWAY_VOLUME_MOUNT_PATH`
- cookie для production нужно запускать с `BIKEBERI_COOKIE_SECURE=true`

## Что создать в Railway

### 1. Новый проект

Создай новый empty project или подключи GitHub-репозиторий с этим кодом.

### 2. Service

Добавь сервис из репозитория. Railway сам увидит `Dockerfile`.

### 3. Volume

Подключи Volume к этому сервису.

Рекомендуемый mount path:

```text
/data
```

Тогда база будет храниться как:

```text
/data/app.db
```

## Переменные Railway

Добавь в Variables:

```env
BIKEBERI_APP_NAME=BikeBeri service app
BIKEBERI_COOKIE_SECURE=true
BIKEBERI_SECRET_KEY=very-long-random-secret
PORT=8000
```

Не нужно вручную задавать `RAILWAY_VOLUME_MOUNT_PATH`, Railway добавляет его сам при подключении Volume.

## Public Networking

После первого деплоя:

- открой `Settings` сервиса
- включи `Generate Domain`

Потом, если нужен свой домен:

- добавь custom domain в Railway
- укажи DNS запись у регистратора

## Что проверить после деплоя

- открывается домен сервиса
- логин механика работает
- логин собственника работает
- новая запись ремонта сохраняется после перезапуска deployment

## Демо-логины

- `mechanic / mechanic123`
- `owner / owner123`

После публикации их лучше поменять как можно раньше.
