#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$BACKUP_DIR/ak_learning_platform_${TIMESTAMP}.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$OUT_FILE"
echo "Backup created: $OUT_FILE"

# Keep last 14 backups
ls -1t "$BACKUP_DIR"/ak_learning_platform_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
