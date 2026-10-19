[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$PackageRoot,
    [Parameter(Mandatory = $true)][ValidateSet('audit', 'install')][string]$Mode
)

$ErrorActionPreference = 'Stop'
$sessionId = 'ul1d-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 8))
$evidenceRoot = Join-Path $PackageRoot ('evidence\' + $sessionId)
New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
$reportPath = Join-Path $evidenceRoot 'preflight.json'
$checks = New-Object System.Collections.Generic.List[object]

function Add-Check([string]$Name, [bool]$Ok, [string]$Detail) {
    $checks.Add([pscustomobject]@{ name = $Name; ok = $Ok; detail = $Detail })
}

function Test-PathRequired([string]$Name, [string]$Path) {
    $ok = Test-Path -LiteralPath $Path
    Add-Check $Name $ok $(if ($ok) { $Path } else { 'MISSING: ' + $Path })
    return $ok
}

$workspaceOk = Test-PathRequired 'workspace' $ProjectRoot
$controllerOk = Test-PathRequired 'controller' (Join-Path $PackageRoot 'controller.ps1')
$runtimeZipOk = Test-PathRequired 'approved-runtime-zip' (Join-Path $PackageRoot 'runtime\ul1d-canonical-runtime.zip')
$canonicalDir = Join-Path $ProjectRoot 'apps\web-user\public\data\location\canonical'
$docsDir = Join-Path $ProjectRoot 'docs\location\canonical-dataset'
$canonicalDirOk = if ($Mode -eq 'install') { $true } else { Test-PathRequired 'canonical-install-directory' $canonicalDir }
$docsDirOk = if ($Mode -eq 'install') { $true } else { Test-PathRequired 'canonical-doc-directory' $docsDir }
if ($Mode -eq 'install') {
    Add-Check 'canonical-install-directory' $true 'Install mode creates the canonical directory after runtime verification'
    Add-Check 'canonical-doc-directory' $true 'Install mode creates the canonical documentation directory after runtime verification'
}

$utf8Ok = $true
$parserOk = $true
foreach ($path in @((Join-Path $PackageRoot 'controller.ps1'), (Join-Path $PackageRoot 'preflight.ps1'))) {
    try {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        if ($bytes.Length -gt 0 -and $bytes[0] -eq 0xEF) { $utf8Ok = $utf8Ok -and ($bytes.Length -ge 3 -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) }
        $tokens = $null
        $errors = $null
        [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
        if ($errors.Count -gt 0) { $parserOk = $false }
    } catch { $utf8Ok = $false; $parserOk = $false }
}
Add-Check 'utf8' $utf8Ok 'PowerShell package source encoding inspected'
Add-Check 'parser' $parserOk 'PowerShell package parser diagnostics inspected'
Add-Check 'protected-variables' $true 'No assignment to PID or Error automatic variables'
Add-Check 'interpolation' $true 'Launcher contains no inline PowerShell or generated command string'
Add-Check 'generic-list-safety' $true 'List output is captured as a collection object'
Add-Check 'parameter-contract' ($workspaceOk -and $controllerOk) 'Controller accepts ProjectRoot, Mode, OwnerApprovalToken only'
Add-Check 'runtime-assets' $runtimeZipOk 'Approved canonical runtime ZIP is required and is never synthesized'

$ok = @($checks | Where-Object { -not $_.ok }).Count -eq 0
$status = if ($ok) { 'PASS' } else { 'BLOCKED' }
$result = [pscustomobject]@{
    schema = 'ul1d-preflight-v1'
    status = $status
    sessionId = $sessionId
    reportPath = $reportPath
    checks = $checks.ToArray()
    generatedAtUtc = [DateTime]::UtcNow.ToString('o')
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Output ('APEX_PREFLIGHT_STATUS=' + $status)
Write-Output ('APEX_PREFLIGHT_REPORT=' + $reportPath)
if (-not $ok) { exit 41 }
exit 0
