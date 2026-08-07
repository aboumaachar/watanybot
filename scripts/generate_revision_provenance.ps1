param()

$Root = "C:\\xampp\\htdocs\\projectx\\watanybot"
$EvidenceRoot = Join-Path $Root ".pma\\implementation\\full-feature-restoration-green-closure-v1"
$FullManifest = Join-Path $EvidenceRoot "diagnostics_revisions\\full_diagnostics_revision_manifest.json"

if (-not (Test-Path $FullManifest)) {
    Write-Error "Full diagnostics manifest not found: $FullManifest"
    exit 1
}

$ps1HashesPath = Join-Path $EvidenceRoot "diagnostics_revisions\\ps1_revision_hashes.json"
$ps1Hashes = @{}
if (Test-Path $ps1HashesPath) {
    $raw = Get-Content $ps1HashesPath -Raw | ConvertFrom-Json
    foreach ($x in $raw) { $ps1Hashes[$x.file] = $x.sha256 }
}

$full = Get-Content $FullManifest -Raw | ConvertFrom-Json
$out = @()

foreach ($item in $full) {
    $abs = $item.path
    $sha = $item.sha256
    $bytes = $item.bytes
    try { $capture = (Get-Item $abs).LastWriteTimeUtc.ToString("o") } catch { $capture = "1970-01-01T00:00:00Z" }
    $rel = $abs.Replace($Root + '\\', '') -replace '\\','/'

    $prov = 'UNVERIFIED'
    $origRun = $null
    $authoritative = $false
    $recon = ''
    $confidence = 0.5

    if ($rel -match 'before_trace_patch' -or $rel -match 'backups/server.ts.prechange') {
        $prov = 'EXACT_CAPTURED_BEFORE_EDIT'; $confidence = 0.99
    } elseif ($rel -match 'after_env_fix' -or $rel -match 'after_pid_fix') {
        $prov = 'EXACT_CAPTURED_AFTER_EDIT'; $confidence = 0.99
    } elseif ($rel -match 'ps1_revision_hashes.json' -or $rel -match 'diagnose_gateway_bootstrap_v1.ps1.current_copy') {
        $prov = 'CURRENT_COPY'; $confidence = 0.95
    } elseif ($rel -match 'server.ts.before_trace_patch') {
        $prov = 'EXACT_CAPTURED_BEFORE_EDIT'; $confidence = 0.99
    } elseif ($rel -match '26_GATEWAY_REAL_CONFIG_BOOT_TRACE.json') {
        $prov = 'EXACT_CAPTURED_AFTER_EDIT'; $origRun = '26C'; $authoritative = $true; $confidence = 0.999
    }

    $out += [pscustomobject]@{
        File = $rel
        SHA256 = $sha
        SizeBytes = $bytes
        CaptureTimeUtc = $capture
        ProvenanceType = $prov
        OriginalExecutionRunId = $origRun
        AuthoritativeForRun = $authoritative
        ReconstructionBasis = $recon
        Confidence = $confidence
    }
}

$outPath = Join-Path $EvidenceRoot '30_DIAGNOSTIC_REVISION_MANIFEST.json'
$out | ConvertTo-Json -Depth 6 | Out-File -FilePath $outPath -Encoding utf8
Write-Output $outPath

# Build trace run history with controller SHA mapping where possible
$history = @(
    @{ runId = '26A'; file = 'diagnostics_revisions/26A_GATEWAY_TRACE_ENV_CLEARED.json'; note = 'Simulated prior run with env cleared'; controllerFile = 'diagnostics_revisions/diagnose_gateway_bootstrap_v1.before_env_fix.ps1' },
    @{ runId = '26B'; file = 'diagnostics_revisions/26B_GATEWAY_TRACE_ENV_INHERITED_BEFORE_PID_FIX.json'; note = 'Run after env-preserve change before PID fix'; controllerFile = 'diagnostics_revisions/diagnose_gateway_bootstrap_v1.after_env_fix.ps1' },
    @{ runId = '26C'; file = '26_GATEWAY_REAL_CONFIG_BOOT_TRACE.json'; note = 'Current controller run (after PID fix)'; controllerFile = 'diagnostics_revisions/diagnose_gateway_bootstrap_v1.ps1.current_copy.ps1' }
)

$detailed = @()
foreach ($h in $history) {
    $cf = Join-Path $EvidenceRoot $h.controllerFile
    $sha = $null; $cap = $null; $auth = $false
    if (Test-Path $cf) { $sha = (Get-FileHash -Algorithm SHA256 $cf).Hash; $cap = (Get-Item $cf).LastWriteTimeUtc.ToString('o') }
    if ($h.runId -eq '26C') { $auth = $true }
    $detailed += [pscustomobject]@{
        RunId = $h.runId
        TraceFile = $h.file
        Note = $h.note
        ControllerFile = $h.controllerFile
        ControllerSHA256 = $sha
        ControllerCaptureTimeUtc = $cap
        AuthoritativeForRun = $auth
    }
}

$historyPath = Join-Path $EvidenceRoot '31_TRACE_RUN_HISTORY.json'
$detailed | ConvertTo-Json -Depth 6 | Out-File -FilePath $historyPath -Encoding utf8
Write-Output $historyPath
