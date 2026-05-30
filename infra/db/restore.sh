#!/bin/bash
# Restore script for gql-ddd-inventory database
if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' not found."
  exit 1
fi

echo "Starting PostgreSQL database restore from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker-compose exec -T db psql -U inventory_user -d inventory_db

if [ ${PIPESTATUS[0]} -eq 0 ] && [ ${PIPESTATUS[1]} -eq 0 ]; then
  echo "Database successfully restored from $BACKUP_FILE"
else
  echo "Error: Database restore failed."
  exit 1
fi
