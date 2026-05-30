#!/bin/bash
# Backup script for gql-ddd-inventory database
BACKUP_DIR="$(dirname "$0")/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/inventory_db_backup_$TIMESTAMP.sql.gz"

echo "Starting PostgreSQL database backup..."
docker-compose exec -T db pg_dump -U inventory_user -d inventory_db | gzip > "$BACKUP_FILE"

if [ ${PIPESTATUS[0]} -eq 0 ] && [ ${PIPESTATUS[1]} -eq 0 ]; then
  echo "Backup successfully created: $BACKUP_FILE"
else
  echo "Error: Database backup failed."
  exit 1
fi
