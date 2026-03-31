# BikeBeri Service Control

Локальное приложение уже готово к деплою на обычный Ubuntu VPS.

## Что лежит в проекте

- `app.py` — backend на Python stdlib + SQLite
- `app.db` — база данных
- `index.html`, `styles.css`, `script.js` — фронтенд
- `.env.example` — пример переменных окружения
- `bikeberi.service` — systemd unit
- `nginx-bikeberi.conf` — конфиг Nginx
- `backup_db.sh` — бэкап базы
- `deploy_vps.sh` — быстрый скрипт раскладки на сервер

## Что нужно на сервере

```bash
sudo apt update
sudo apt install -y python3 nginx certbot python3-certbot-nginx
```

## Подготовка проекта

```bash
cp .env.example .env
```

Отредактируй `.env`:

```env
BIKEBERI_APP_NAME=BikeBeri service app
BIKEBERI_HOST=127.0.0.1
BIKEBERI_PORT=8000
PORT=8000
BIKEBERI_SECRET_KEY=very-long-random-secret
BIKEBERI_COOKIE_SECURE=true
```

## Куда копировать проект

Рекомендованный путь:

```bash
/var/www/bikeberi-service
```

## Ручной деплой

### 1. Скопировать файлы на сервер

```bash
scp -r /local/path/to/project user@server:/tmp/bikeberi-service
```

### 2. На сервере разложить проект

```bash
sudo mkdir -p /var/www/bikeberi-service
sudo cp /tmp/bikeberi-service/app.py /var/www/bikeberi-service/
sudo cp /tmp/bikeberi-service/index.html /var/www/bikeberi-service/
sudo cp /tmp/bikeberi-service/styles.css /var/www/bikeberi-service/
sudo cp /tmp/bikeberi-service/script.js /var/www/bikeberi-service/
sudo cp /tmp/bikeberi-service/.env /var/www/bikeberi-service/
sudo cp /tmp/bikeberi-service/app.db /var/www/bikeberi-service/
```

### 3. Установить systemd unit

```bash
sudo cp /tmp/bikeberi-service/bikeberi.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable bikeberi.service
sudo systemctl restart bikeberi.service
sudo systemctl status bikeberi.service
```

### 4. Подключить Nginx

```bash
sudo cp /tmp/bikeberi-service/nginx-bikeberi.conf /etc/nginx/sites-available/bikeberi-service
sudo ln -sf /etc/nginx/sites-available/bikeberi-service /etc/nginx/sites-enabled/bikeberi-service
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Включить HTTPS

Заменить `service.bikeberi.ru` в `nginx-bikeberi.conf` на свой домен, потом:

```bash
sudo certbot --nginx -d service.bikeberi.ru
```

## Бэкапы

Скрипт:

```bash
sudo sh /var/www/bikeberi-service/backup_db.sh
```

Для cron, например каждый день в 03:20:

```bash
20 3 * * * /bin/sh /var/www/bikeberi-service/backup_db.sh >> /var/log/bikeberi-backup.log 2>&1
```

## Демо-логины

- `mechanic / mechanic123`
- `owner / owner123`

После деплоя их лучше сменить напрямую в базе или через будущую админку.

## Что стоит сделать следующим этапом

- смена паролей и добавление экрана управления пользователями
- импорт ремонтов и склада из Excel
- редактирование и удаление записей
- аудит действий пользователей
- перенос с SQLite на PostgreSQL, если пользователей станет много
