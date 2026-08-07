# WatanBot - Self-Healing Setup Script for Windows
# PowerShell version

$ErrorActionPreference = "Stop"
# Avoid failing on non-fatal stderr from native commands like docker-compose.
$PSNativeCommandUseErrorActionPreference = $false

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "OK: $Message" "Green"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "ERROR: $Message" "Red"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "WARN: $Message" "Yellow"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput $Message "Cyan"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WatanBot - Self-Healing Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptPath "..")
$projectRoot = Get-Location

Write-Info "Checking prerequisites..."

# Check if Docker is installed
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed. Please install Docker Desktop and try again."
    exit 1
}
Write-Success "Docker found"

# Check if Docker Compose is available
$composeCmd = if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    "docker-compose"
} elseif ((docker compose version 2>&1) -match "Docker Compose") {
    "docker compose"
} else {
    Write-Error "Docker Compose is not available. Please install Docker Desktop."
    exit 1
}
Write-Success "Docker Compose found"

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Warning ".env file not found. Creating from .env.example..."
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Success ".env created. Please review and update values if needed."
    } else {
        Write-Error ".env.example not found. Cannot create .env."
        exit 1
    }
} else {
    Write-Success ".env file found"
}

# Load .env file
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Create backup directory
$backupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { "./backups" }
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Write-Success "Backup directory ready"

# Stop existing containers
Write-Info "`nStopping any existing containers..."
if ($composeCmd -eq "docker-compose") {
    docker-compose -f infra/docker/docker-compose.yml down 2>$null
} else {
    docker compose -f infra/docker/docker-compose.yml down 2>$null
}

# Start services
Write-Info "`nStarting services..."
if ($composeCmd -eq "docker-compose") {
    docker-compose -f infra/docker/docker-compose.yml up -d --build
} else {
    docker compose -f infra/docker/docker-compose.yml up -d --build
}

# Wait for PostgreSQL
Write-Info "`nWaiting for PostgreSQL to be ready..."
Start-Sleep -Seconds 5

$retryCount = 0
$maxRetries = 30
$postgresReady = $false

while ((-not $postgresReady) -and ($retryCount -lt $maxRetries)) {
    try {
        if ($composeCmd -eq "docker-compose") {
            $result = docker-compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U watanbot 2>&1
        } else {
            $result = docker compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U watanbot 2>&1
        }
        if ($LASTEXITCODE -eq 0) {
            $postgresReady = $true
        }
    } catch {
        # Ignore errors during retry
    }
    
    if (-not $postgresReady) {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $retryCount++
    }
}

Write-Host ""

if (-not $postgresReady) {
    Write-Error "PostgreSQL failed to start after $maxRetries seconds"
    exit 1
}
Write-Success "PostgreSQL is ready"

# Run migrations
Write-Info "`nRunning database migrations..."
try {
    if ($composeCmd -eq "docker-compose") {
        docker-compose -f infra/docker/docker-compose.yml exec -T api alembic upgrade head
    } else {
        docker compose -f infra/docker/docker-compose.yml exec -T api alembic upgrade head
    }
    Write-Success "Database migrations completed"
} catch {
    Write-Error "Database migrations failed"
    Write-Warning "Attempting recovery..."
    
    if ($composeCmd -eq "docker-compose") {
        docker-compose -f infra/docker/docker-compose.yml restart api
    } else {
        docker compose -f infra/docker/docker-compose.yml restart api
    }
    Start-Sleep -Seconds 5
    
    try {
        if ($composeCmd -eq "docker-compose") {
            docker-compose -f infra/docker/docker-compose.yml exec -T api alembic upgrade head
        } else {
            docker compose -f infra/docker/docker-compose.yml exec -T api alembic upgrade head
        }
        Write-Success "Database migrations completed after retry"
    } catch {
        Write-Error "Database migrations failed again."
        exit 1
    }
}

# Seed superadmin
Write-Info "`nSeeding superadmin user..."
try {
    if ($composeCmd -eq "docker-compose") {
        docker-compose -f infra/docker/docker-compose.yml exec -T api python seed.py
    } else {
        docker compose -f infra/docker/docker-compose.yml exec -T api python seed.py
    }
    Write-Success "Superadmin user seeded"
} catch {
    Write-Warning "Superadmin seed failed (may already exist)"
}

# Health checks
Write-Info "`nRunning health checks..."
Start-Sleep -Seconds 3

$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "8000" }
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$apiPort/health" -UseBasicParsing -ErrorAction Stop
    Write-Success "API is healthy"
} catch {
    Write-Error "API health check failed"
    exit 1
}

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing -ErrorAction Stop
    Write-Success "Worker is healthy"
} catch {
    Write-Warning "Worker health check failed (may still be starting)"
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Info "Services:"
Write-Info "  - API:         http://localhost:$apiPort"
Write-Info "  - API Docs:    http://localhost:$apiPort/docs"
Write-Info "  - Worker:      http://localhost:8001"
Write-Host ""
Write-Info "Admin Console:"
Write-Info "  cd apps/admin-console; npm install; npm start"
Write-Host ""
Write-Info "Credentials:"
Write-Info "  Email:    $($env:SUPERADMIN_EMAIL)"
Write-Info "  Password: (see .env file)"
Write-Host ""
