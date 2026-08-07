#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

cd "$(dirname "$0")/.."

# Source .env
set -a
source .env 2>/dev/null || true
set +a

BACKUP_DIR=${BACKUP_DIR:-./backups}
KB_SQLITE_PATH=${KB_SQLITE_PATH:-/data/kb.sqlite}
MAX_BACKUPS=${MAX_BACKUPS:-30}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/watanbot_${TIMESTAMP}.tar.gz"

echo "Creating database backup..."
echo "Target: $BACKUP_FILE"
echo ""

# Run pg_dump into temp file
TMP_DIR=$(mktemp -d)
PG_DUMP_FILE="${TMP_DIR}/postgres_dump.sql"

if docker compose -f infra/docker/docker-compose.yml exec -T postgres \
    pg_dump -U ${POSTGRES_USER:-watanbot} -d ${POSTGRES_DB:-watanbot} > "$PG_DUMP_FILE"; then
    echo "Including SQLite KB file (if present)..."
    if [ -f "$KB_SQLITE_PATH" ]; then
        cp "$KB_SQLITE_PATH" "${TMP_DIR}/kb.sqlite"
    fi

    tar -czf "$BACKUP_FILE" -C "$TMP_DIR" .
    rm -rf "$TMP_DIR"
    
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Backup created successfully${NC}"
    echo "  File: $BACKUP_FILE"
    echo "  Size: $SIZE"
    
    # Clean old backups
    echo ""
    echo "Cleaning old backups (keeping last ${MAX_BACKUPS})..."
    ls -t ${BACKUP_DIR}/watanbot_*.tar.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f 2>/dev/null || true
    
    REMAINING=$(ls -1 ${BACKUP_DIR}/watanbot_*.tar.gz 2>/dev/null | wc -l)
    echo "  Backups in directory: $REMAINING"
else
    rm -rf "$TMP_DIR"
    echo -e "${RED}✗ Backup failed${NC}"
    exit 1
fi
