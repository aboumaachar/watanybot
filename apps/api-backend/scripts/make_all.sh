#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════╗"
echo "║   WatanBot - Self-Healing Setup        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Change to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "$1"
}

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker and try again."
    exit 1
fi
print_success "Docker found"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install Docker Compose and try again."
    exit 1
fi
print_success "Docker Compose found"

# Check if .env exists, if not create from .env.example
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success ".env created. Please review and update values if needed."
    else
        print_error ".env.example not found. Cannot create .env."
        exit 1
    fi
else
    print_success ".env file found"
fi

# Source the .env file
set -a
source .env
set +a

# Create backup directory
mkdir -p "${BACKUP_DIR:-./backups}"
print_success "Backup directory ready"

# Stop existing containers
print_info "\nStopping any existing containers..."
docker compose -f infra/docker/docker-compose.yml down 2>/dev/null || true

# Start services
print_info "\nStarting services..."
docker compose -f infra/docker/docker-compose.yml up -d --build

# Wait for PostgreSQL to be ready
print_info "\nWaiting for PostgreSQL to be ready..."
sleep 5
RETRY_COUNT=0
MAX_RETRIES=30
until docker compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-watanbot} &> /dev/null || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo -n "."
    sleep 1
done
echo ""

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "PostgreSQL failed to start after ${MAX_RETRIES} seconds"
    docker compose -f infra/docker/docker-compose.yml logs postgres
    exit 1
fi
print_success "PostgreSQL is ready"

# Run database migrations
print_info "\nRunning database migrations..."
if docker compose -f infra/docker/docker-compose.yml exec -T api alembic upgrade head; then
    print_success "Database migrations completed"
else
    print_error "Database migrations failed"
    print_warning "Attempting recovery..."
    
    # Try to restart API container
    docker compose -f infra/docker/docker-compose.yml restart api
    sleep 5
    
    # Retry migrations
    if docker compose -f infra/docker/docker-compose.yml exec -T api alembic upgrade head; then
        print_success "Database migrations completed after retry"
    else
        print_error "Database migrations failed again. Check logs:"
        docker compose -f infra/docker/docker-compose.yml logs api
        exit 1
    fi
fi

# Seed superadmin user
print_info "\nSeeding superadmin user..."
if docker compose -f infra/docker/docker-compose.yml exec -T api python seed.py; then
    print_success "Superadmin user seeded"
else
    print_warning "Superadmin seed failed (may already exist)"
fi

# Run health checks
print_info "\nRunning health checks..."
sleep 3

# Check API health
if curl -s -f http://localhost:${API_PORT:-8000}/health > /dev/null 2>&1; then
    print_success "API is healthy"
else
    print_error "API health check failed"
    print_warning "Attempting to restart API..."
    docker compose -f infra/docker/docker-compose.yml restart api
    sleep 5
    
    if curl -s -f http://localhost:${API_PORT:-8000}/health > /dev/null 2>&1; then
        print_success "API is healthy after restart"
    else
        print_error "API is still unhealthy. Check logs:"
        docker compose -f infra/docker/docker-compose.yml logs api
        exit 1
    fi
fi

# Check worker health
if curl -s -f http://localhost:8001/health > /dev/null 2>&1; then
    print_success "Worker is healthy"
else
    print_warning "Worker health check failed (may still be starting)"
fi

# Check database connection
print_info "\nVerifying database connection..."
if docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U ${POSTGRES_USER:-watanbot} -d ${POSTGRES_DB:-watanbot} -c "SELECT 1" > /dev/null 2>&1; then
    print_success "Database connection verified"
else
    print_error "Database connection failed"
    exit 1
fi

# Check FTS index
print_info "\nVerifying full-text search index..."
FTS_CHECK=$(docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U ${POSTGRES_USER:-watanbot} -d ${POSTGRES_DB:-watanbot} -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'kb_cards' AND indexname = 'ix_kb_cards_fts'")
if [ "$FTS_CHECK" -gt 0 ]; then
    print_success "Full-text search index exists"
else
    print_error "Full-text search index not found"
    exit 1
fi

# Summary
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Setup Complete!                      ║"
echo "╚════════════════════════════════════════╝"
echo ""
print_info "Services:"
print_info "  • API:         http://localhost:${API_PORT:-8000}"
print_info "  • API Docs:    http://localhost:${API_PORT:-8000}/docs"
print_info "  • Worker:      http://localhost:8001"
print_info "  • PostgreSQL:  localhost:${POSTGRES_PORT:-5432}"
echo ""
print_info "Admin Console:"
print_info "  cd apps/admin-console && npm install && npm start"
echo ""
print_info "Credentials:"
print_info "  Email:    ${SUPERADMIN_EMAIL}"
print_info "  Password: ${SUPERADMIN_PASSWORD}"
echo ""
print_info "Useful commands:"
print_info "  • View logs:     docker compose -f infra/docker/docker-compose.yml logs -f"
print_info "  • Stop services: docker compose -f infra/docker/docker-compose.yml down"
print_info "  • Run doctor:    ./scripts/doctor.sh"
print_info "  • Create backup: ./scripts/backup.sh"
echo ""
