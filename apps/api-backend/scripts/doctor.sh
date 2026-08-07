#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Running WatanBot Doctor Checks..."
echo ""

cd "$(dirname "$0")/.."

# Source .env
set -a
source .env 2>/dev/null || true
set +a

API_PORT=${API_PORT:-8000}
API_URL="http://localhost:${API_PORT}"

# Check 1: API is running
echo -n "Checking API health... "
if curl -s -f "${API_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  API is not responding at ${API_URL}/health"
    exit 1
fi

# Check 2: Database connection
echo -n "Checking database connection... "
if docker compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-watanbot} > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  PostgreSQL is not responding"
    exit 1
fi

# Check 3: FTS index
echo -n "Checking full-text search index... "
FTS_CHECK=$(docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U ${POSTGRES_USER:-watanbot} -d ${POSTGRES_DB:-watanbot} -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'kb_cards' AND indexname = 'ix_kb_cards_fts'" 2>/dev/null | tr -d ' ')
if [ "$FTS_CHECK" -gt 0 ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  Full-text search index is missing"
    exit 1
fi

# Check 4: Published KB cards
echo -n "Checking published KB cards... "
KB_COUNT=$(docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U ${POSTGRES_USER:-watanbot} -d ${POSTGRES_DB:-watanbot} -t -c "SELECT COUNT(*) FROM kb_cards WHERE status = 'published'" 2>/dev/null | tr -d ' ')
if [ "$KB_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ OK${NC} (${KB_COUNT} published cards)"
else
    echo -e "${YELLOW}⚠ WARNING${NC} (No published cards found)"
fi

# Check 5: Worker is running
echo -n "Checking worker service... "
if curl -s -f "http://localhost:8001/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC}"
    echo "  Worker is not responding"
fi

# Check 6: Disk space
echo -n "Checking disk space... "
BACKUP_DIR=${BACKUP_DIR:-./backups}
KB_SQLITE_PATH=${KB_SQLITE_PATH:-/data/kb.sqlite}
if [ -d "$BACKUP_DIR" ]; then
    FREE_SPACE=$(df -BG "$BACKUP_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$FREE_SPACE" -gt 5 ]; then
        echo -e "${GREEN}✓ OK${NC} (${FREE_SPACE}GB free)"
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (Only ${FREE_SPACE}GB free)"
    fi
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Backup directory not found)"
fi

# Check 7: SQLite KB file
echo -n "Checking SQLite KB file... "
if [ -f "$KB_SQLITE_PATH" ]; then
    echo -e "${GREEN}✓ OK${NC} (${KB_SQLITE_PATH})"
else
    echo -e "${RED}✗ FAILED${NC}"
    echo "  SQLite KB file not found at ${KB_SQLITE_PATH}"
fi

# Check 8: SQLite KB schema and FTS
if [ -f "$KB_SQLITE_PATH" ]; then
    echo -n "Checking SQLite KB schema... "
    TABLE_CHECK=$(sqlite3 "$KB_SQLITE_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('transactions','tx_fts','tx_links','law_sources','law_articles','law_fts','tx_law_map');" 2>/dev/null || echo 0)
    if [ "$TABLE_CHECK" -ge 7 ]; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Missing required tables in SQLite KB"
    fi

    echo -n "Checking SQLite FTS MATCH... "
    FTS_TX=$(sqlite3 "$KB_SQLITE_PATH" "SELECT rowid FROM tx_fts WHERE tx_fts MATCH 'test' LIMIT 1;" 2>/dev/null)
    FTS_LAW=$(sqlite3 "$KB_SQLITE_PATH" "SELECT rowid FROM law_fts WHERE law_fts MATCH 'test' LIMIT 1;" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${YELLOW}⚠ WARNING${NC}"
        echo "  SQLite FTS MATCH failed"
    fi
fi

echo ""
echo -e "${GREEN}Doctor checks completed!${NC}"
