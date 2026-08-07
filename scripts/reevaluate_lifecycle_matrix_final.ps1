param(
    [Parameter(Mandatory=$true)] [string]$RunSetManifest,
    [Parameter(Mandatory=$true)] [string]$OutputRoot
)

function Read-Json($p){ if(Test-Path $p){ Get-Content -Raw -LiteralPath $p | ConvertFrom-Json } else { $null } }
function Read-Lines($p){ if(-not (Test-Path $p)){ return @() } ; $c = Get-Content -LiteralPath $p -ErrorAction SilentlyContinue; if($null -eq $c){ return @() } ; if($c -is [System.Array]) { return $c } else { return ,$c } }
function Read-FirstNonEmptyLine($p){ if(-not (Test-Path $p)){ return $null } ; $lines = Read-Lines $p ; foreach($l in $lines){ $s = $l.Trim(); if($s -ne ''){ return $s } } ; return $null }

if(-not (Test-Path $RunSetManifest)) { Write-Error "RunSetManifest not found: $RunSetManifest"; exit 2 }
$manifest = Read-Json $RunSetManifest
if($null -eq $manifest){ Write-Error "Failed to parse RunSetManifest"; exit 3 }

# Ensure OutputRoot exists
if(-not (Test-Path $OutputRoot)){ New-Item -ItemType Directory -Path $OutputRoot | Out-Null }

$results = @()
$summary = [ordered]@{
    RunCount = $manifest.RunCount
    PassedRunCount = 0
    ExpectedNonzeroPassCount = 0
    MissingStdoutTokenCount = 0
    MissingStderrTokenCount = 0
    LineCountMismatchCount = 0
    BoundaryLineMismatchCount = 0
    DelayedOrderMismatchCount = 0
    WrongExitCodeCount = 0
    ExitCodeDisagreementCount = 0
    MissingArtifactCount = 0
    UnexpectedFailureTokenCount = 0
}

foreach($r in $manifest.Runs){
    $runRecord = [ordered]@{}
    $runRecord.RunId = $r.RunId
    $runRecord.AbsoluteRunDir = $r.AbsoluteRunDir
    $runRecord.Case = $r.Case
    $runRecord.Iteration = $r.Iteration

    # Required artifact paths
    $paths = [ordered]@{
        PRESTART = Join-Path $r.AbsoluteRunDir 'PRESTART.json'
        EFFECTIVE_COMMAND = Join-Path $r.AbsoluteRunDir 'EFFECTIVE_COMMAND.json'
        PROCESS_TREE = Join-Path $r.AbsoluteRunDir 'PROCESS_TREE.json'
        PORT_MATRIX = Join-Path $r.AbsoluteRunDir 'PORT_MATRIX.json'
        STDOUT = Join-Path $r.AbsoluteRunDir 'stdout.log'
        STDERR = Join-Path $r.AbsoluteRunDir 'stderr.log'
        EXIT_CODE = Join-Path $r.AbsoluteRunDir 'exit-code.txt'
        CHILD_MARKER = Join-Path $r.AbsoluteRunDir 'CHILD_FINAL.marker'
        RUN_SUMMARY = Join-Path $r.AbsoluteRunDir 'run-summary.json'
    }

    foreach($k in $paths.Keys){ $runRecord[$k+'_Present'] = Test-Path $paths[$k] }

    # Controller marker check at the runset root (optional). Build from workspace root if EvidenceGeneration is a relative name.
    $workspaceRoot = (Get-Location).Path
    if($manifest.EvidenceGeneration -and ($manifest.EvidenceGeneration -match '[:\\]')){
        $candidateRoot = $manifest.EvidenceGeneration
    } else {
        $candidateRoot = Join-Path (Join-Path $workspaceRoot '.pma\implementation') $manifest.EvidenceGeneration
    }
    $controllerMarker = Join-Path $candidateRoot 'CONTROLLER_FINAL.marker'
    if(Test-Path $controllerMarker){ $runRecord.CONTROLLER_FINAL_Present = $true } else { $runRecord.CONTROLLER_FINAL_Present = $false }

    # Read files with normalization
    $stdoutLines = Read-Lines $paths.STDOUT
    $stderrLines = Read-Lines $paths.STDERR
    $exitFromFile = Read-FirstNonEmptyLine $paths.EXIT_CODE
    $runSummary = Read-Json $paths.RUN_SUMMARY

    # exit code agreement
    $exitFromSummary = $null
    if($runSummary -ne $null -and $runSummary.PSObject.Properties.Name -contains 'ExitCode') { $exitFromSummary = $runSummary.ExitCode }
    $exitAgreement = $false
    if($exitFromFile -ne $null -and $exitFromSummary -ne $null){ try{ if([int]$exitFromFile -eq [int]$exitFromSummary){ $exitAgreement = $true } } catch{} }
    if(-not $exitAgreement){ $summary.ExitCodeDisagreementCount++ }

    # Token and content checks
    $missingStdout = @()
    $joinedStdout = $stdoutLines -join "`n"
    foreach($tok in $r.ExpectedStdoutTokens){ if(-not ($joinedStdout -match [regex]::Escape($tok))) { $missingStdout += $tok } }
    $missingStderr = @()
    $joinedStderr = $stderrLines -join "`n"
    foreach($tok in $r.ExpectedStderrTokens){ if(-not ($joinedStderr -match [regex]::Escape($tok))) { $missingStderr += $tok } }

    if($missingStdout.Count -gt 0){ $summary.MissingStdoutTokenCount += $missingStdout.Count }
    if($missingStderr.Count -gt 0){ $summary.MissingStderrTokenCount += $missingStderr.Count }

    # Line count checks (only when expected >= 0)
    $stdoutCount = $stdoutLines.Count
    $stderrCount = $stderrLines.Count
    $lineCountMismatch = $false
    if($r.ExpectedStdoutLineCount -ge 0 -and $stdoutCount -ne $r.ExpectedStdoutLineCount){ $lineCountMismatch = $true; $summary.LineCountMismatchCount++ }
    if($r.ExpectedStderrLineCount -ge 0 -and $stderrCount -ne $r.ExpectedStderrLineCount){ $lineCountMismatch = $true; $summary.LineCountMismatchCount++ }
    if($lineCountMismatch){ $summary.BoundaryLineMismatchCount++ }

    # Boundary checks: first/last line if provided and expected counts > 0
    $boundaryMismatch = $false
    if(($r.ExpectedStdoutFirstLine -ne '') -and ($stdoutCount -gt 0)){ $first = [string]$stdoutLines[0]; if($first.Trim() -ne $r.ExpectedStdoutFirstLine){ $boundaryMismatch = $true; $summary.BoundaryLineMismatchCount++ } }
    if(($r.ExpectedStdoutLastLine -ne '') -and ($stdoutCount -gt 0)){ $last = [string]$stdoutLines[$stdoutCount-1]; if($last.Trim() -ne $r.ExpectedStdoutLastLine){ $boundaryMismatch = $true; $summary.BoundaryLineMismatchCount++ } }
    if(($r.ExpectedStderrFirstLine -ne '') -and ($stderrCount -gt 0)){ $firste = [string]$stderrLines[0]; if($firste.Trim() -ne $r.ExpectedStderrFirstLine){ $boundaryMismatch = $true; $summary.BoundaryLineMismatchCount++ } }
    if(($r.ExpectedStderrLastLine -ne '') -and ($stderrCount -gt 0)){ $laste = [string]$stderrLines[$stderrCount-1]; if($laste.Trim() -ne $r.ExpectedStderrLastLine){ $boundaryMismatch = $true; $summary.BoundaryLineMismatchCount++ } }

    # Delayed order check
    $delayedMismatch = $false
    if($r.ExpectedDelayedOrder -eq $true){ $text = $stdoutLines -join "`n"; $pos1 = $text.IndexOf($r.ExpectedStdoutTokens[0]); $pos2 = $text.IndexOf($r.ExpectedStdoutTokens[1]); if($pos1 -lt 0 -or $pos2 -lt 0 -or $pos1 -ge $pos2){ $delayedMismatch = $true; $summary.DelayedOrderMismatchCount++ } }

    # Exit code check (expected)
    $exitMismatch = $false
    if($exitFromFile -ne $null){ try{ if([int]$exitFromFile -ne [int]$r.ExpectedExitCode){ $exitMismatch = $true; $summary.WrongExitCodeCount++ } } catch{} } else { $summary.MissingArtifactCount++ }

    # Determine status
    $status = 'FAIL'
    $expectedNonZero = $false
    if($r.ExpectedExitCode -ne 0){ $expectedNonZero = $true }
    if($expectedNonZero -and -not $exitMismatch -and $missingStdout.Count -eq 0 -and $missingStderr.Count -eq 0){ $status = 'PASS_EXPECTED_NONZERO'; $summary.ExpectedNonzeroPassCount++ }
    elseif(-not $expectedNonZero -and -not $exitMismatch -and $missingStdout.Count -eq 0 -and $missingStderr.Count -eq 0 -and -not $lineCountMismatch -and -not $boundaryMismatch -and -not $delayedMismatch){ $status = 'PASS'; $summary.PassedRunCount++ }

    if($runRecord.PRESTART_Present -eq $false -or $runRecord.EFFECTIVE_COMMAND_Present -eq $false -or $runRecord.PROCESS_TREE_Present -eq $false -or $runRecord.RUN_SUMMARY_Present -eq $false -or $runRecord.CHILD_MARKER_Present -eq $false){ $summary.MissingArtifactCount++ }

    $runRecord.StdoutLineCount = $stdoutCount
    $runRecord.StderrLineCount = $stderrCount
    $runRecord.MissingStdoutTokens = $missingStdout
    $runRecord.MissingStderrTokens = $missingStderr
    $runRecord.ExitFromFile = $exitFromFile
    $runRecord.ExitFromSummary = $exitFromSummary
    $runRecord.ExitAgreement = $exitAgreement
    $runRecord.Status = $status

    $results += $runRecord
}

$outReeval = [ordered]@{
    RunCount = $manifest.RunCount
    PassedRunCount = $summary.PassedRunCount
    ExpectedNonzeroPassCount = $summary.ExpectedNonzeroPassCount
    MissingStdoutTokenCount = $summary.MissingStdoutTokenCount
    MissingStderrTokenCount = $summary.MissingStderrTokenCount
    LineCountMismatchCount = $summary.LineCountMismatchCount
    BoundaryLineMismatchCount = $summary.BoundaryLineMismatchCount
    DelayedOrderMismatchCount = $summary.DelayedOrderMismatchCount
    WrongExitCodeCount = $summary.WrongExitCodeCount
    ExitCodeDisagreementCount = $summary.ExitCodeDisagreementCount
    MissingArtifactCount = $summary.MissingArtifactCount
    Results = $results
}

$outPath1 = Join-Path $OutputRoot '08_FINAL_TEN_RUN_REEVALUATION.json'
$outPath2 = Join-Path $OutputRoot '09_FINAL_TEN_RUN_RECONCILIATION.json'
$outReeval | ConvertTo-Json -Depth 6 | Out-File -FilePath $outPath1 -Encoding utf8
$outReeval | ConvertTo-Json -Depth 6 | Out-File -FilePath $outPath2 -Encoding utf8
Write-Output "Wrote $outPath1 and $outPath2"
