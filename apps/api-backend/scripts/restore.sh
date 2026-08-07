#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")/.."

# Source .env
set -a
source .env 2>/dev/null || true
set +a

BACKUP_DIR=${BACKUP_DIR:-./backups}
KB_SQLITE_PATH=${KB_SQLITE_PATH:-/data/kb.sqlite}
AUTO_APPROVE=${AUTO_APPROVE:-false}

# Get backup file
if [ -z "$1" ]; then
    # Find latest backup
    BACKUP_FILE=$(ls -t ${BACKUP_DIR}/watanbot_*.tar.gz 2>/dev/null | head -n 1)
    if [ -z "$BACKUP_FILE" ]; then
        echo -e "${RED}✗ No backup files found in ${BACKUP_DIR}${NC}"
        exit 1
    fi
    echo "Latest backup: $BACKUP_FILE"
else
    BACKUP_FILE="$1"
    if [ ! -f "$BACKUP_FILE" ]; then
        echo -e "${RED}✗ Backup file not found: ${BACKUP_FILE}${NC}"
        exit 1
    fi
fi

# Confirm
if [ "$AUTO_APPROVE" != "true" ]; then
    echo -e "${YELLOW}WARNING: This will replace the current database!${NC}"
    echo "Backup file: $BACKUP_FILE"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

echo ""
echo "Restoring database from backup..."
echo ""

# Drop existing connections
echo "Dropping existing connections..."
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
    psql -U ${POSTGRES_USER:-watanbot} -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB:-watanbot}' AND pid <> pg_backend_pid();" \
    2>/dev/null || true

# Drop and recreate database
echo "Recreating database..."
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
    psql -U ${POSTGRES_USER:-watanbot} -d postgres -c \
    "DROP DATABASE IF EXISTS ${POSTGRES_DB:-watanbot};" 2>/dev/null || true

docker compose -f infra/docker/docker-compose.yml exec -T postgres \
    psql -U ${POSTGRES_USER:-watanbot} -d postgres -c \
    "CREATE DATABASE ${POSTGRES_DB:-watanbot};"

# Restore from backup
echo "Restoring data..."
TMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TMP_DIR"

if [ -f "${TMP_DIR}/postgres_dump.sql" ]; then
    cat "${TMP_DIR}/postgres_dump.sql" | docker compose -f infra/docker/docker-compose.yml exec -T postgres \
        psql -U ${POSTGRES_USER:-watanbot} -d ${POSTGRES_DB:-watanbot} > /dev/null 2>&1
else
    echo -e "${RED}✗ PostgreSQL dump not found in backup${NC}"
    rm -rf "$TMP_DIR"
    exit 1
fi

if [ -f "${TMP_DIR}/kb.sqlite" ]; then
    echo "Restoring SQLite KB file..."
    mkdir -p "$(dirname "$KB_SQLITE_PATH")"
    cp "${TMP_DIR}/kb.sqlite" "$KB_SQLITE_PATH"
fi

rm -rf "$TMP_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored successfully${NC}"
    echo ""
    echo "Restarting API and worker services..."
    docker compose -f infra/docker/docker-compose.yml restart api worker
    
    echo ""
    echo -e "${GREEN}Restore complete!${NC}"
else
    echo -e "${RED}✗ Restore failed${NC}"
    exit 1
fi
