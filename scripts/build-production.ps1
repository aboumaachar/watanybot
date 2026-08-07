#!/usr/bin/env pwsh

# ═══════════════════════════════════════════════════════════════════════════
# Watany AI Assistant — Production Build Script (PowerShell)
# Windows version of build-production.sh
# ═══════════════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host "`n╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host   "║  Watany AI Assistant — Production Build                              ║" -ForegroundColor Cyan
Write-Host   "║  Target: koudama.com                                                  ║" -ForegroundColor Cyan
Write-Host   "╚═══════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ═══════════════════════════════════════════════════════════════════════════
# 1. PRE-BUILD CHECKS
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[1/6] Pre-build checks..." -ForegroundColor Blue

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found" -ForegroundColor Red
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm -v
    Write-Host "✓ pnpm version: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ pnpm not found" -ForegroundColor Red
    exit 1
}

# Check monorepo root
if (-not (Test-Path "pnpm-workspace.yaml")) {
    Write-Host "✗ Must run from monorepo root" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Running from monorepo root`n" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════════════════
# 2. INSTALL DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[2/6] Installing dependencies..." -ForegroundColor Blue
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Dependency installation failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Dependencies installed`n" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════════════════
# 3. TYPECHECK
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[3/6] Running TypeScript compilation check..." -ForegroundColor Blue
pnpm -r typecheck
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ TypeScript compilation failed" -ForegroundColor Red
    Write-Host "💡 Fix TypeScript errors before deployment" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ TypeScript compilation passed`n" -ForegroundColor Green

# ═══════════════════════════════════════════════════════════════════════════
# 4. BUILD WEB-USER
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[4/6] Building web-user (frontend)..." -ForegroundColor Blue

Push-Location apps\web-user

# Check .env.production
if (-not (Test-Path ".env.production")) {
    Write-Host "⚠ .env.production not found, using defaults" -ForegroundColor Yellow
    if (Test-Path ".env.production.example") {
        Copy-Item ".env.production.example" ".env.production"
    }
}

# Build
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Frontend build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Verify
if (-not (Test-Path "dist\index.html")) {
    Write-Host "✗ Build failed - dist\index.html not found" -ForegroundColor Red
    Pop-Location
    exit 1
}

$buildSize = (Get-ChildItem -Path dist -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "✓ Frontend built successfully (size: $([Math]::Round($buildSize, 2)) MB)" -ForegroundColor Green

Pop-Location
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# 5. BUILD DESKTOP (OPTIONAL)
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[5/6] Building desktop-admin (optional)..." -ForegroundColor Blue
$buildDesktop = Read-Host "Build desktop app? (y/N)"

if ($buildDesktop -eq 'y' -or $buildDesktop -eq 'Y') {
    Push-Location apps\desktop-admin
    npm run build
    
    if (-not (Test-Path "dist\main\index.js")) {
        Write-Host "✗ Desktop build failed" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
    Write-Host "✓ Desktop admin built successfully" -ForegroundColor Green
    Pop-Location
} else {
    Write-Host "⊘ Skipped desktop build" -ForegroundColor Yellow
}

Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# 6. CREATE DEPLOYMENT PACKAGE
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "[6/6] Creating deployment package..." -ForegroundColor Blue

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$deployDir = "deploy_$timestamp"

New-Item -ItemType Directory -Path $deployDir -Force | Out-Null

# Copy frontend
Write-Host "  → Copying frontend build..."
New-Item -ItemType Directory -Path "$deployDir\frontend" -Force | Out-Null
Copy-Item -Path "apps\web-user\dist\*" -Destination "$deployDir\frontend\" -Recurse

# Copy gateway
Write-Host "  → Copying gateway API..."
New-Item -ItemType Directory -Path "$deployDir\gateway-api" -Force | Out-Null
Copy-Item -Path "apps\gateway-api\src" -Destination "$deployDir\gateway-api\" -Recurse
Copy-Item -Path "apps\gateway-api\package.json" -Destination "$deployDir\gateway-api\"
if (Test-Path "apps\gateway-api\.env.production.example") {
    Copy-Item -Path "apps\gateway-api\.env.production.example" -Destination "$deployDir\gateway-api\.env.example"
}

# Copy Python backend
Write-Host "  → Copying Python backend..."
New-Item -ItemType Directory -Path "$deployDir\api-backend" -Force | Out-Null
Copy-Item -Path "apps\api-backend\apps" -Destination "$deployDir\api-backend\" -Recurse
Copy-Item -Path "apps\api-backend\requirements.txt" -Destination "$deployDir\api-backend\"

# Copy KB data
if (Test-Path "data\kb") {
    Write-Host "  → Copying knowledge base..."
    New-Item -ItemType Directory -Path "$deployDir\data\kb" -Force | Out-Null
    Copy-Item -Path "data\kb\*" -Destination "$deployDir\data\kb\" -Recurse -ErrorAction SilentlyContinue
}

# Copy docs
Write-Host "  → Copying documentation..."
Copy-Item -Path "KOUDAMA_DEPLOYMENT_GUIDE.md" -Destination "$deployDir\"
if (Test-Path "README.md") {
    Copy-Item -Path "README.md" -Destination "$deployDir\"
}

# Create manifest
$gitHash = git rev-parse --short HEAD 2>$null
if (-not $gitHash) { $gitHash = "unknown" }

$manifest = @"
Watany AI Assistant — Production Build
═══════════════════════════════════════

Build Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Build From: $gitHash
Node Version: $(node -v)
PNPM Version: $(pnpm -v)

Contents:
  frontend\         → Web-user build (deploy to koudama.com)
  gateway-api\      → Fastify backend (run with Node.js 22+)
  api-backend\      → Python FastAPI (run with Python 3.11+)
  data\kb\          → Knowledge base files
  
Deployment Instructions:
  1. Read KOUDAMA_DEPLOYMENT_GUIDE.md
  2. Upload to server
  3. Configure environment (.env files)
  4. Start services (PM2 + SystemD)
  5. Configure Nginx
  6. Install SSL certificate

For support: admin@koudama.com
"@

Set-Content -Path "$deployDir\MANIFEST.txt" -Value $manifest

# Create ZIP
Write-Host "  → Creating archive..."
Compress-Archive -Path $deployDir -DestinationPath "$deployDir.zip" -Force

$archiveSize = (Get-Item "$deployDir.zip").Length / 1MB
Write-Host "✓ Deployment package created: $deployDir.zip ($([Math]::Round($archiveSize, 2)) MB)" -ForegroundColor Green
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════
# BUILD COMPLETE
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ Production build completed successfully!                          ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "📦 Deployment Package:" -ForegroundColor Blue
Write-Host "   $deployDir.zip`n" -ForegroundColor White

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Upload to server (use SCP/SFTP/rsync)"
Write-Host "  2. Extract on server"
Write-Host "  3. Follow KOUDAMA_DEPLOYMENT_GUIDE.md"
Write-Host ""
Write-Host "Happy deploying! 🚀" -ForegroundColor Green
