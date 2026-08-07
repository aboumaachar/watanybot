#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$envFile = Join-Path $repoRoot "apps/web-user/.env.production"
$deployStaging = Join-Path $repoRoot ".deploy-staging"
$deployHost = "root@54.39.157.227"
$frontPath = "/home/koudama/public_html/mcp"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$zipName = "web-user-dist-auth-rollback-$stamp.zip"
$zipLocal = Join-Path $deployStaging $zipName

if (!(Test-Path $deployStaging)) {
  New-Item -ItemType Directory -Path $deployStaging | Out-Null
}

$envRaw = ""
if (Test-Path $envFile) {
  $envRaw = Get-Content -Path $envFile -Raw
}

if ($envRaw -match '(?m)^VITE_DISABLE_AUTH=') {
  $envRaw = [regex]::Replace($envRaw, '(?m)^VITE_DISABLE_AUTH=.*$', 'VITE_DISABLE_AUTH=false')
} else {
  if ($envRaw.Length -gt 0 -and -not $envRaw.EndsWith("`n")) {
    $envRaw += "`n"
  }
  $envRaw += "VITE_DISABLE_AUTH=false`n"
}

Set-Content -Path $envFile -Value $envRaw -Encoding UTF8

Write-Host "[rollback-auth] Building frontend with VITE_DISABLE_AUTH=false" -ForegroundColor Cyan
pnpm --dir apps/web-user build
if ($LASTEXITCODE -ne 0) {
  throw "Frontend build failed"
}

$drive = $repoRoot.Substring(0, 1).ToLowerInvariant()
$rest = $repoRoot.Substring(2).Replace("\\", "/")
$repoUnix = "/mnt/$drive$rest"
$zipUnix = "$repoUnix/.deploy-staging/$zipName"

Write-Host "[rollback-auth] Packaging frontend dist" -ForegroundColor Cyan
wsl.exe bash -lc "set -e; cd '$repoUnix/apps/web-user/dist'; zip -r '$zipUnix' . >/dev/null"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to package frontend dist"
}

Write-Host "[rollback-auth] Uploading package to server" -ForegroundColor Cyan
scp $zipLocal $deployHost
if ($LASTEXITCODE -ne 0) {
  throw "Failed to upload package"
}
ssh $deployHost "mv '$zipName' '/tmp/$zipName'"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to move package to /tmp on server"
}

$remoteScriptName = "deploy_front_auth_rollback-$stamp.sh"
$remoteScriptLocal = Join-Path ([System.IO.Path]::GetTempPath()) $remoteScriptName

$remoteScript = @"
set -e
FRONT=$frontPath
STAMP=auth-rollback-$stamp
ZIP=/tmp/$zipName

mkdir -p /root/watanybot-deploy-backups

tar -czf /root/watanybot-deploy-backups/mcp-before-$stamp.tar.gz \
  \$FRONT 2>/dev/null || true

rm -rf \${FRONT}.__new
mkdir -p \${FRONT}.__new
unzip -q \$ZIP -d \${FRONT}.__new
test -f \${FRONT}.__new/index.html
cp -a \${FRONT}/.htaccess \${FRONT}.__new/.htaccess 2>/dev/null || true
rm -rf \${FRONT}.__old
if [ -d \$FRONT ]; then
  mv \$FRONT \${FRONT}.__old
fi
mv \${FRONT}.__new \$FRONT
chown -R koudama:koudama \$FRONT 2>/dev/null || true

echo ROLLBACK_DEPLOY_OK
"@

Set-Content -Path $remoteScriptLocal -Value $remoteScript -NoNewline -Encoding Ascii

Write-Host "[rollback-auth] Deploying to server" -ForegroundColor Cyan
scp $remoteScriptLocal $deployHost
if ($LASTEXITCODE -ne 0) {
  Remove-Item -Path $remoteScriptLocal -Force -ErrorAction SilentlyContinue
  throw "Failed to upload remote deploy script"
}
ssh $deployHost "mv '$remoteScriptName' '/root/$remoteScriptName'"
if ($LASTEXITCODE -ne 0) {
  Remove-Item -Path $remoteScriptLocal -Force -ErrorAction SilentlyContinue
  throw "Failed to move remote deploy script into /root"
}

ssh $deployHost "bash /root/$remoteScriptName"
$sshExit = $LASTEXITCODE

Remove-Item -Path $remoteScriptLocal -Force -ErrorAction SilentlyContinue

if ($sshExit -ne 0) {
  throw "Remote deploy failed"
}

Write-Host "[rollback-auth] Done. Login is re-enabled on server." -ForegroundColor Green
Write-Host "[rollback-auth] Smoke check: https://koudama.com/mcp/login" -ForegroundColor Green
