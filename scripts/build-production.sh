#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Watany AI Assistant — Production Build Script
# Builds all components for koudama.com deployment
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║  Watany AI Assistant — Production Build                              ║"
echo "║  Target: koudama.com                                                  ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# 1. PRE-BUILD CHECKS
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[1/6] Pre-build checks...${NC}"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Node.js version must be 18 or higher (current: $(node -v))${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"

# Check pnpm installed
if ! command -v pnpm &> /dev/null; then
  echo -e "${RED}✗ pnpm is not installed${NC}"
  exit 1
fi
echo -e "${GREEN}✓ pnpm version: $(pnpm -v)${NC}"

# Check if in monorepo root
if [ ! -f "pnpm-workspace.yaml" ]; then
  echo -e "${RED}✗ Must run from monorepo root${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Running from monorepo root${NC}"

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 2. INSTALL DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[2/6] Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 3. TYPECHECK
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[3/6] Running TypeScript compilation check...${NC}"
pnpm -r typecheck || {
  echo -e "${RED}✗ TypeScript compilation failed${NC}"
  echo -e "${YELLOW}💡 Fix TypeScript errors before deployment${NC}"
  exit 1
}
echo -e "${GREEN}✓ TypeScript compilation passed${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 4. BUILD WEB-USER (FRONTEND)
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[4/6] Building web-user (frontend)...${NC}"

cd apps/web-user

# Check .env.production exists
if [ ! -f ".env.production" ]; then
  echo -e "${YELLOW}⚠ .env.production not found, using defaults${NC}"
  cp .env.production.example .env.production 2>/dev/null || true
fi

# Run production build
pnpm build

# Verify build output
if [ ! -f "dist/index.html" ]; then
  echo -e "${RED}✗ Build failed - dist/index.html not found${NC}"
  exit 1
fi

BUILD_SIZE=$(du -sh dist | cut -f1)
echo -e "${GREEN}✓ Frontend built successfully (size: $BUILD_SIZE)${NC}"

cd ../..
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 5. BUILD DESKTOP-ADMIN (OPTIONAL)
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[5/6] Building desktop-admin (optional)...${NC}"

read -p "Build desktop app? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  cd apps/desktop-admin
  npm run build
  
  if [ ! -f "dist/main/index.js" ]; then
    echo -e "${RED}✗ Desktop build failed${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Desktop admin built successfully${NC}"
  cd ../..
else
  echo -e "${YELLOW}⊘ Skipped desktop build${NC}"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 6. CREATE DEPLOYMENT PACKAGE
# ═══════════════════════════════════════════════════════════════════════════

echo -e "${BLUE}[6/6] Creating deployment package...${NC}"

DEPLOY_DIR="deploy_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DEPLOY_DIR"

# Copy frontend build
echo "  → Copying frontend build..."
mkdir -p "$DEPLOY_DIR/frontend"
cp -r apps/web-user/dist/* "$DEPLOY_DIR/frontend/"

# Copy gateway API
echo "  → Copying gateway API..."
mkdir -p "$DEPLOY_DIR/gateway-api"
cp -r apps/gateway-api/src "$DEPLOY_DIR/gateway-api/"
cp apps/gateway-api/package.json "$DEPLOY_DIR/gateway-api/"
cp apps/gateway-api/.env.production.example "$DEPLOY_DIR/gateway-api/.env.example"
cp apps/gateway-api/tsconfig.json "$DEPLOY_DIR/gateway-api/" 2>/dev/null || true

# Copy Python backend
echo "  → Copying Python backend..."
mkdir -p "$DEPLOY_DIR/api-backend"
cp -r apps/api-backend/apps "$DEPLOY_DIR/api-backend/"
cp apps/api-backend/requirements.txt "$DEPLOY_DIR/api-backend/"
cp apps/api-backend/pyproject.toml "$DEPLOY_DIR/api-backend/" 2>/dev/null || true

# Copy KB data (if exists)
if [ -d "data/kb" ]; then
  echo "  → Copying knowledge base..."
  mkdir -p "$DEPLOY_DIR/data/kb"
  cp -r data/kb/* "$DEPLOY_DIR/data/kb/" 2>/dev/null || true
fi

# Copy deployment docs
echo "  → Copying deployment documentation..."
cp KOUDAMA_DEPLOYMENT_GUIDE.md "$DEPLOY_DIR/"
cp README.md "$DEPLOY_DIR/" 2>/dev/null || true

# Create deployment manifest
cat > "$DEPLOY_DIR/MANIFEST.txt" << EOF
Watany AI Assistant — Production Build
═══════════════════════════════════════

Build Date: $(date '+%Y-%m-%d %H:%M:%S')
Build From: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
Node Version: $(node -v)
PNPM Version: $(pnpm -v)

Contents:
  frontend/         → Web-user build (deploy to koudama.com)
  gateway-api/      → Fastify backend (run with Node.js 22+)
  api-backend/      → Python FastAPI (run with Python 3.11+)
  data/kb/          → Knowledge base files
  
Deployment Instructions:
  1. Read KOUDAMA_DEPLOYMENT_GUIDE.md
  2. Upload to server: 
     rsync -avz $DEPLOY_DIR/ user@koudama.com:/opt/watanybot/
  3. Configure environment (.env files)
  4. Start services (PM2 + SystemD)
  5. Configure Nginx
  6. Install SSL certificate

For support: admin@koudama.com
EOF

# Create archive
echo "  → Creating tarball..."
tar -czf "${DEPLOY_DIR}.tar.gz" "$DEPLOY_DIR"

ARCHIVE_SIZE=$(du -sh "${DEPLOY_DIR}.tar.gz" | cut -f1)

echo -e "${GREEN}✓ Deployment package created: ${DEPLOY_DIR}.tar.gz (${ARCHIVE_SIZE})${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# BUILD COMPLETE
# ═══════════════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo -e "║  ${GREEN}✓ Production build completed successfully!${NC}                     ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}📦 Deployment Package:${NC} ${DEPLOY_DIR}.tar.gz"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Upload to server:"
echo "     scp ${DEPLOY_DIR}.tar.gz user@koudama.com:/tmp/"
echo ""
echo "  2. Extract on server:"
echo "     ssh user@koudama.com"
echo "     cd /opt"
echo "     sudo tar -xzf /tmp/${DEPLOY_DIR}.tar.gz"
echo "     sudo mv ${DEPLOY_DIR} watanybot"
echo ""
echo "  3. Follow deployment guide:"
echo "     cat /opt/watanybot/KOUDAMA_DEPLOYMENT_GUIDE.md"
echo ""
echo -e "${GREEN}Happy deploying! 🚀${NC}"
