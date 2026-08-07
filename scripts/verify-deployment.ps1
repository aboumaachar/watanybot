#!/usr/bin/env pwsh

# ═══════════════════════════════════════════════════════════════════════════
# Watany AI Assistant — Pre-Deployment Verification
# Quick validation before deploying to koudama.com
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host   "║  Watany AI koudama.com — Pre-Deployment Verification                 ║" -ForegroundColor Cyan
Write-Host   "╚═══════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$score = 0
$total = 0

function Test-Check {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$Fix = ""
    )
    
    $script:total++
    Write-Host "[$script:total] $Name... " -NoNewline -ForegroundColor Yellow
    
    try {
        $result = Invoke-Command -ScriptBlock $Test
        
        if ($result) {
            Write-Host "PASS" -ForegroundColor Green
            $script:score++
            return $true
        } else {
            Write-Host "FAIL" -ForegroundColor Red
            if ($Fix) {
                Write-Host "    Fix: $Fix" -ForegroundColor Gray
            }
            return $false
        }
    } catch {
        Write-Host "ERROR" -ForegroundColor Red
        if ($Fix) {
            Write-Host "    Fix: $Fix" -ForegroundColor Gray
        }
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# 1. FILE EXISTENCE CHECKS
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n[FILE STRUCTURE]`n" -ForegroundColor Blue

Test-Check "Landing page component exists" {
    Test-Path "apps\web-user\src\components\LandingPage.tsx"
} "Create apps/web-user/src/components/LandingPage.tsx"

Test-Check "Landing page CSS exists" {
    Test-Path "apps\web-user\src\components\landing.css"
} "Create apps/web-user/src/components/landing.css"

Test-Check "Production env file exists" {
    Test-Path "apps\web-user\.env.production"
} "Copy .env.production.example to .env.production"

Test-Check "Gateway production env template exists" {
    Test-Path "apps\gateway-api\.env.production.example"
} "Create .env.production.example in gateway-api"

Test-Check "Deployment guide exists" {
    Test-Path "KOUDAMA_DEPLOYMENT_GUIDE.md"
} "Create KOUDAMA_DEPLOYMENT_GUIDE.md"

Test-Check "Build script (PowerShell) exists" {
    Test-Path "scripts\build-production.ps1"
} "Create scripts/build-production.ps1"

# ═══════════════════════════════════════════════════════════════════════════
# 2. CONFIGURATION CHECKS
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n[CONFIGURATION]`n" -ForegroundColor Blue

Test-Check "Gateway .env has Ollama config" {
    if (Test-Path "apps\gateway-api\.env") {
        $content = Get-Content "apps\gateway-api\.env" -Raw
        $content -match "AI_PROVIDER=ollama" -and $content -match "AI_MODEL=deepseek-r1:8b"
    } else {
        $false
    }
} "Set AI_PROVIDER=ollama and AI_MODEL=deepseek-r1:8b in gateway .env"

Test-Check "Gateway has USE_AI_PROVIDER=true" {
    if (Test-Path "apps\gateway-api\.env") {
        $content = Get-Content "apps\gateway-api\.env" -Raw
        $content -match "USE_AI_PROVIDER=true"
    } else {
        $false
    }
} "Set USE_AI_PROVIDER=true in gateway .env"

Test-Check "Vite config has production settings" {
    if (Test-Path "apps\web-user\vite.config.ts") {
        $content = Get-Content "apps\web-user\vite.config.ts" -Raw
        $content -match "build:" -and $content -match "outDir"
    } else {
        $false
    }
} "Update vite.config.ts with build settings"

# ═══════════════════════════════════════════════════════════════════════════
# 3. CODE INTEGRATION CHECKS
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n[CODE INTEGRATION]`n" -ForegroundColor Blue

Test-Check "App.tsx imports LandingPage" {
    if (Test-Path "apps\web-user\src\App.tsx") {
        $content = Get-Content "apps\web-user\src\App.tsx" -Raw
        $content -match "import.*LandingPage"
    } else {
        $false
    }
} "Import LandingPage in App.tsx"

Test-Check "App.tsx has landing page logic" {
    if (Test-Path "apps\web-user\src\App.tsx") {
        $content = Get-Content "apps\web-user\src\App.tsx" -Raw
        $content -match "showLanding" -and $content -match "handleEnter"
    } else {
        $false
    }
} "Add landing page state logic to App.tsx"

Test-Check "styles.css imports landing.css" {
    if (Test-Path "apps\web-user\src\styles.css") {
        $content = Get-Content "apps\web-user\src\styles.css" -Raw
        $content -match "@import.*landing.css"
    } else {
        $false
    }
} "Add @import './components/landing.css' to styles.css"

# ═══════════════════════════════════════════════════════════════════════════
# 4. VOICE CHAT VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n[VOICE CHAT]`n" -ForegroundColor Blue

Test-Check "VoiceMode component exists" {
    Test-Path "apps\web-user\src\components\VoiceMode.tsx"
} "Voice chat component missing"

Test-Check "VoiceMode has TTS implementation" {
    if (Test-Path "apps\web-user\src\components\VoiceMode.tsx") {
        $content = Get-Content "apps\web-user\src\components\VoiceMode.tsx" -Raw
        $content -match "doSpeak" -and $content -match "/api/tts"
    } else {
        $false
    }
} "Add TTS implementation to VoiceMode"

Test-Check "VoiceMode has continuous mode" {
    if (Test-Path "apps\web-user\src\components\VoiceMode.tsx") {
        $content = Get-Content "apps\web-user\src\components\VoiceMode.tsx" -Raw
        $content -match "continuous"
    } else {
        $false
    }
} "Add continuous voice mode"

# ═══════════════════════════════════════════════════════════════════════════
# 5. DEPENDENCY CHECKS
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n[DEPENDENCIES]`n" -ForegroundColor Blue

Test-Check "Node.js installed (v18+)" {
    try {
        $nodeVersion = node -v
        $major = [int]($nodeVersion -replace 'v(\d+).*', '$1')
        $major -ge 18
    } catch {
        $false
    }
} "Install Node.js 18+ (recommend 22.x LTS)"

Test-Check "pnpm installed" {
    try {
        $null = pnpm -v
        $true
    } catch {
        $false
    }
} "Install pnpm: npm install -g pnpm"

Test-Check "Python 3.11+ installed" {
    try {
        $pythonVersion = python --version 2>&1
        if ($pythonVersion -match "Python (\d+)\.(\d+)") {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            ($major -eq 3 -and $minor -ge 11) -or ($major -gt 3)
        } else {
            $false
        }
    } catch {
        $false
    }
} "Install Python 3.11+"

Test-Check "Git available" {
    try {
        $null = git --version
        $true
    } catch {
        $false
    }
} "Install Git"

# ═══════════════════════════════════════════════════════════════════════════
# 6. OLLAMA CHECKS (IF AVAILABLE)
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n[OLLAMA / DEEPSEEK]`n" -ForegroundColor Blue

$ollamaAvailable = Test-Check "Ollama service reachable" {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        $response.StatusCode -eq 200
    } catch {
        $false
    }
} "Install Ollama: https://ollama.com/download"

if ($ollamaAvailable) {
    Test-Check "DeepSeek R1:8b model available" {
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 2
            $models = $response.models | Where-Object { $_.name -like "*deepseek-r1*8b*" }
            $null -ne $models
        } catch {
            $false
        }
    } "Run: ollama pull deepseek-r1:8b"
}

# ═══════════════════════════════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "`n╔═══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host   "║  VERIFICATION RESULTS                                                 ║" -ForegroundColor Cyan
Write-Host   "╚═══════════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$percentage = [Math]::Round(($score / $total) * 100, 1)

Write-Host "Score: $score / $total ($percentage percent)" -ForegroundColor White
Write-Host ""

if ($percentage -eq 100) {
    Write-Host "🎉 PERFECT SCORE — Ready for production build!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Run: .\scripts\build-production.ps1"
    Write-Host "  2. Deploy to koudama.com (see KOUDAMA_DEPLOYMENT_GUIDE.md)"
    Write-Host "  3. Configure SSL and Nginx"
    Write-Host "  4. Monitor logs and performance"
    Write-Host ""
} elseif ($percentage -ge 80) {
    Write-Host "✓ GOOD — Minor issues detected" -ForegroundColor Yellow
    Write-Host "Fix warnings above before production deployment" -ForegroundColor Gray
    Write-Host ""
} elseif ($percentage -ge 60) {
    Write-Host "⚠ NEEDS ATTENTION — Several issues found" -ForegroundColor Yellow
    Write-Host "Review failed checks above" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "❌ NOT READY — Critical issues detected" -ForegroundColor Red
    Write-Host "Fix all failed checks before proceeding" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

$guideMsg = "For deployment help: Get-Content KOUDAMA_DEPLOYMENT_GUIDE.md"
Write-Host $guideMsg -ForegroundColor Cyan
Write-Host ""
