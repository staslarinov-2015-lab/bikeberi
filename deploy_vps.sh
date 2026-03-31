#!/bin/sh
set -eu

APP_DIR="/var/www/bikeberi-service"

mkdir -p "$APP_DIR"
cp app.py index.html styles.css script.js .env "$APP_DIR"/

if [ -f app.db ]; then
  cp app.db "$APP_DIR"/
fi

cp bikeberi.service /etc/systemd/system/bikeberi.service
cp nginx-bikeberi.conf /etc/nginx/sites-available/bikeberi-service

ln -sf /etc/nginx/sites-available/bikeberi-service /etc/nginx/sites-enabled/bikeberi-service
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable bikeberi.service
systemctl restart bikeberi.service
nginx -t
systemctl reload nginx

echo "Deploy complete."
