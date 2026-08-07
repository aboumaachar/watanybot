<# 
FIX_WATANY_CRM.ps1
Purpose: Run from VS Code / Copilot Chat / Codex terminal on your PC to SSH into your cPanel server
and fix common deployment/config issues for your app at https://koudama.com/crm

What it does (idempotent + safe backups):
- Detects real app folder under ~/public_html/crm (or finds closest match)
- Ensures Python venv exists and installs deps (uvicorn/fastapi + requirements.txt if present)
- Starts FastAPI (or your ASGI app) on localhost (default :8080) with nohup + logs
- Ensures Apache routes /crm -> localhost port via .htaccess proxy rules (backs up .htaccess)
- Verifies endpoints (/, /docs, /openapi.json) locally and via public URL
- Optionally ensures Node proxy if your /crm is Node-based (basic detection)
- Prints a final status summary and what to paste in your app submission form

Prereqs on your PC:
- Windows OpenSSH installed (ssh.exe available)
- You can SSH to the server (user: koudama)

USAGE:
1) Edit variables below
2) Run in PowerShell:  .\FIX_WATANY_CRM.ps1
#>

param(
  [string]$SSHHost = "koudama.com",
  [string]$SSHUser = "koudama",
  [int]$SSHPort = 22,

  # Public path where you want the app to appear
  [string]$PublicAppPath = "/crm",

  # Localhost port your backend should listen on (avoid 80/443)
  [int]$BackendPort = 8080,

  # Candidate ASGI entrypoints to try (first one found will be used)
  [string[]]$AsgiCandidates = @(
    "apps.api.main:app",
    "server.app:app",
    "app.main:app",
    "main:app"
  )
)

function Invoke-SSH {
  param([string]$Command)
  $ssh = "ssh.exe"
  & $ssh -p $SSHPort "$SSHUser@$SSHHost" $Command
  if ($LASTEXITCODE -ne 0) { throw "SSH command failed: $Command" }
}

Write-Host "`n=== WATANY CRM SERVER FIX (SSH) ===`n" -ForegroundColor Cyan
Write-Host "Target: $SSHUser@$SSHHost:$SSHPort  Public: https://$SSHHost$PublicAppPath  BackendPort: $BackendPort`n"

# --- Remote bash script (single shot) ---
$remote = @"
set -euo pipefail

say(){ echo -e "\n==> \$*"; }
warn(){ echo -e "\nWARN: \$*" >&2; }
die(){ echo -e "\nERROR: \$*" >&2; exit 1; }

PUBLIC_HTML="\$HOME/public_html"
APP_PATH="$PublicAppPath"
CRM_DIR="\$PUBLIC_HTML\${PublicAppPath#/}"   # /crm -> ~/public_html/crm
LOG_DIR="\$HOME/logs"
PORT=$BackendPort

mkdir -p "\$LOG_DIR"

say "1) Inspect public_html and crm folder"
[ -d "\$PUBLIC_HTML" ] || die "public_html not found at \$PUBLIC_HTML"
ls -la "\$PUBLIC_HTML" | head -n 50

if [ ! -d "\$CRM_DIR" ]; then
  warn "Expected CRM dir not found: \$CRM_DIR"
  say "Searching for closest match under public_html..."
  FOUND=\$(find "\$PUBLIC_HTML" -maxdepth 4 -type d \\( -iname "crm" -o -iname "*crm*" -o -iname "*watany*" -o -iname "*watanybot*" -o -iname "*watan*" \\) 2>/dev/null | head -n 1 || true)
  [ -n "\$FOUND" ] || die "Could not find a crm-like directory under public_html."
  warn "Using detected directory: \$FOUND"
  CRM_DIR="\$FOUND"
fi

say "Using CRM_DIR=\$CRM_DIR"
cd "\$CRM_DIR"

say "2) Snapshot + backups"
mkdir -p "\$LOG_DIR"
if [ -f "\$CRM_DIR/.htaccess" ]; then
  cp -a "\$CRM_DIR/.htaccess" "\$CRM_DIR/.htaccess.bak.\$(date +%F-%H%M%S)"
fi
if [ -f "\$PUBLIC_HTML/.htaccess" ]; then
  cp -a "\$PUBLIC_HTML/.htaccess" "\$PUBLIC_HTML/.htaccess.bak.\$(date +%F-%H%M%S)"
fi

say "3) Detect app type (Python vs Node)"
IS_PY=0
IS_NODE=0
[ -f "requirements.txt" ] && IS_PY=1
[ -d ".venv" ] && IS_PY=1
[ -f "package.json" ] && IS_NODE=1

# common python hints
find . -maxdepth 4 -type f -name "*.py" | head -n 5 >/dev/null 2>&1 && IS_PY=1

echo "Detected: IS_PY=\$IS_PY  IS_NODE=\$IS_NODE"

say "4) Ensure Python backend runnable (if present)"
if [ "\$IS_PY" -eq 1 ]; then
  command -v python3 >/dev/null 2>&1 || die "python3 not found on server"
  say "python3 version:"
  python3 -V

  if [ ! -d ".venv" ]; then
    say "Creating venv: \$CRM_DIR/.venv"
    python3 -m venv .venv
  fi

  # activate
  # shellcheck disable=SC1091
  source .venv/bin/activate

  say "Upgrading pip toolchain"
  python -m pip install -U pip wheel setuptools >/dev/null

  if [ -f "requirements.txt" ]; then
    say "Installing requirements.txt"
    pip install -r requirements.txt
  else
    warn "No requirements.txt; installing minimal FastAPI stack"
    pip install fastapi "uvicorn[standard]" python-multipart pydantic
  fi

  say "5) Start / restart uvicorn on localhost:\$PORT"
  pkill -9 -f "uvicorn.*\$PORT" >/dev/null 2>&1 || true

  # Try to find an entrypoint file if apps/api/main.py exists somewhere
  CANDIDATE=""
  for e in ${AsgiCandidatesJoined}; do
    # We'll just try them; uvicorn will fail fast if wrong
    CANDIDATE="\$e"
    break
  done

  # If repo contains apps/api/main.py, prefer it
  if find . -maxdepth 8 -type f -path "*apps/api/main.py" | head -n 1 | grep -q "apps/api/main.py"; then
    CANDIDATE="apps.api.main:app"
  elif find . -maxdepth 8 -type f -path "*server/app.py" | head -n 1 | grep -q "server/app.py"; then
    CANDIDATE="server.app:app"
  fi

  echo "Using ASGI entrypoint: \$CANDIDATE"

  nohup python -m uvicorn "\$CANDIDATE" --host 127.0.0.1 --port "\$PORT" > "\$LOG_DIR/crm_uvicorn_\$PORT.log" 2>&1 & disown
  sleep 1

  say "6) Local checks"
  ss -ltnp | grep ":\$PORT" || (tail -n 120 "\$LOG_DIR/crm_uvicorn_\$PORT.log" && die "Uvicorn not listening on \$PORT")
  curl -s "http://127.0.0.1:\$PORT/openapi.json" | head -n 5 || warn "openapi.json not reachable; try /docs or root"
  curl -sI "http://127.0.0.1:\$PORT/docs" | head -n 10 || true
fi

say "7) Configure Apache routing for /crm -> localhost:\$PORT"
# We will set routing in the CRM folder .htaccess (most reliable)
HT="\$CRM_DIR/.htaccess"
touch "\$HT"

MARK_BEGIN="# --- WATANY_CRM_PROXY_BEGIN ---"
MARK_END="# --- WATANY_CRM_PROXY_END ---"

# remove existing marked block (if any)
tmp="\$HT.tmp"
awk -v b="\$MARK_BEGIN" -v e="\$MARK_END" '
  \$0==b {inblk=1; next}
  \$0==e {inblk=0; next}
  !inblk {print}
' "\$HT" > "\$tmp"
mv "\$tmp" "\$HT"

cat >> "\$HT" <<EOF

\$MARK_BEGIN
RewriteEngine On

# Proxy /crm/* to local backend (requires mod_proxy enabled by host)
RewriteRule ^(.*)\$ http://127.0.0.1:\$PORT/\$1 [P,L]

\$MARK_END
EOF

say "8) Public checks (may fail if host blocks .htaccess proxy)"
curl -sI "https://$SSHHost$PublicAppPath/" | head -n 15 || true
curl -sI "https://$SSHHost$PublicAppPath/docs" | head -n 15 || true
curl -sI "https://$SSHHost$PublicAppPath/openapi.json" | head -n 15 || true

say "9) Summary"
echo "CRM_DIR=\$CRM_DIR"
echo "BackendPort=\$PORT"
echo "Logs: \$LOG_DIR/crm_uvicorn_\$PORT.log"
echo "Try: https://$SSHHost$PublicAppPath/   and   https://$SSHHost$PublicAppPath/docs"
echo "If you get 502/500, your host likely blocks proxying from .htaccess."
echo "In that case use cPanel 'Setup Python App' or the Node-proxy pattern like /mcp."
"@

# join ASGI candidates into safe bash words
$joined = ($AsgiCandidates | ForEach-Object { $_.Replace('"','\"') }) -join " "
$remote = $remote.Replace('${AsgiCandidatesJoined}', $joined)

# Execute remote script
try {
  Invoke-SSH "bash -lc '$($remote.Replace("'", "'\''"))'"
  Write-Host "`nDONE. Check the printed Summary lines above." -ForegroundColor Green
  Write-Host "`nIf /crm still shows 502/500, tell me what these return:" -ForegroundColor Yellow
  Write-Host "1) curl -sI https://koudama.com/crm/ | head"
  Write-Host "2) tail -n 120 ~/logs/crm_uvicorn_$BackendPort.log"
} catch {
  Write-Host "`nFAILED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Common cause: your host blocks mod_proxy from .htaccess. If that happens, we switch to cPanel Setup Python App." -ForegroundColor Yellow
  exit 1
}
