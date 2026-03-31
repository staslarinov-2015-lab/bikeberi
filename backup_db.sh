#!/bin/sh
set -eu

APP_DIR="/var/www/bikeberi-service"
BACKUP_DIR="/var/backups/bikeberi-service"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"
cp "$APP_DIR/app.db" "$BACKUP_DIR/app_${TIMESTAMP}.db"
find "$BACKUP_DIR" -type f -name 'app_*.db' -mtime +14 -delete

echo "Backup created: $BACKUP_DIR/app_${TIMESTAMP}.db"
