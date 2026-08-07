<#
.SYNOPSIS
  APEX-WATANY-PHASE2A-INTERNAL-GAP-CLOSURE

.DESCRIPTION
  Read-only Phase 2A internal gap-closure runner for the WatanyBot workspace.

  It consumes the current PMA audit and reviewed-decision artifacts, classifies
  flagged WAT items into internal-action versus deferred tracks, and writes a
  Phase 2A closure package without modifying application code.

.EXAMPLES
  powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\apex\APEX-WATANY-PHASE2A-INTERNAL-GAP-CLOSURE.ps1" -ProjectRoot "C:\xampp\htdocs\projectx\watanybot"

  powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\apex\APEX-WATANY-PHASE2A-INTERNAL-GAP-CLOSURE.ps1" -ProjectRoot "C:\xampp\htdocs\projectx\watanybot" -OpenReport
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [switch]$OpenReport
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Utf8Bom([string]$Path,[string]$Content){
  $dir = Split-Path -Parent $Path
  if($dir -and -not(Test-Path $dir)){ New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $enc = New-Object System.Text.UTF8Encoding($true)
  [System.IO.File]::WriteAllText($Path,$Content,$enc)
}

function Add-Line($List,[string]$Line=""){
  $List.Add($Line) | Out-Null
}

function Read-Utf8Text([string]$Path){
  return Get-Content -LiteralPath $Path -Raw -Encoding utf8
}

function Parse-GapTable([string]$GapText){
  $items = @()
  foreach($line in ($GapText -split "`r?`n")){
    if($line -match '^\|\s*(WAT-\d+)\s*\|\s*(.*?)\s*\|\s*([A-Z_]+)\s*\|\s*(\d+)\s*\|'){
      $items += [pscustomobject]@{
        Id = $Matches[1]
        Title = $Matches[2]
        AuditStatus = $Matches[3]
        Hits = [int]$Matches[4]
      }
    }
  }
  return $items
}

function Parse-ReviewedDecisions([string]$DecisionText){
  $map = @{}
  foreach($line in ($DecisionText -split "`r?`n")){
    if($line -match '^\|\s*(WAT-\d+)\s*\|\s*(.*?)\s*\|\s*([A-Z_]+)\s*\|\s*(\d+)\s*\|\s*([A-Z_]+)\s*\|\s*(.*?)\s*\|'){
      $map[$Matches[1]] = [pscustomobject]@{
        Id = $Matches[1]
        Title = $Matches[2]
        AuditStatus = $Matches[3]
        Hits = [int]$Matches[4]
        Disposition = $Matches[5]
        Summary = $Matches[6]
      }
    }
  }
  return $map
}

function Parse-FieldTable([string]$Text){
  $map = @{}
  foreach($line in ($Text -split "`r?`n")){
    if($line -match '^\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$'){
      $key = $Matches[1]
      $value = $Matches[2]
      if($key -and $key -ne 'Field' -and $key -ne '---'){
        $map[$key] = $value
      }
    }
  }
  return $map
}

function Get-ClosureBucket([string]$Disposition,[string]$AuditStatus){
  if([string]::IsNullOrWhiteSpace($Disposition)){
    if($AuditStatus -in @('MISSING','PARTIAL','BROKEN','UNVERIFIED')){ return 'ACTIVE_INTERNAL' }
    return 'NO_ACTION'
  }

  switch -Regex ($Disposition){
    '^SCOPE_DEFERRED$' { return 'DEFERRED_OUT_OF_SCOPE' }
    '^APPROVED_PARTIAL_DEFERRED$' { return 'ACCEPTED_PARTIAL_CAPABILITY' }
    'DEFERRED$' { return 'DEFERRED_REVIEWED' }
    '^REJECTED' { return 'REJECTED' }
    default { return 'ACTIVE_INTERNAL' }
  }
}

function Get-ClosureAction([string]$Bucket,[string]$Disposition,[string]$Title){
  switch($Bucket){
    'ACTIVE_INTERNAL' { return "Create a targeted, item-specific implementation plan for $Title before any code changes." }
    'DEFERRED_OUT_OF_SCOPE' { return 'Keep deferred outside the current WatanyBot product scope; do not schedule code changes.' }
    'ACCEPTED_PARTIAL_CAPABILITY' { return 'Retain current partial tooling as accepted; no new implementation wave is approved.' }
    'DEFERRED_REVIEWED' { return "Honor the reviewed disposition $Disposition and keep the item out of the active build queue." }
    'REJECTED' { return 'Do not implement unless governance reopens the item.' }
    default { return 'No action required from this Phase 2A closure pass.' }
  }
}

$root = [IO.Path]::GetFullPath($ProjectRoot)
if(-not (Test-Path -LiteralPath $root)){
  throw "ProjectRoot does not exist: $root"
}

$started = Get-Date
$auditRoot = Join-Path $root '.pma\audit\watany-phase1'
$implRoot = Join-Path $root '.pma\implementation\watany-phase2'
$governanceRoot = Join-Path $root '.pma\implementation\watany-phase2-final'
$outRoot = Join-Path $root '.pma\implementation\watany-phase2a-internal-gap-closure'
New-Item -ItemType Directory -Path $outRoot -Force | Out-Null

$gapFile = Join-Path $auditRoot '07_GAP_ANALYSIS.md'
$decisionFile = Join-Path $implRoot '00_REVIEWED_GAP_DECISIONS.md'
$queueFile = Join-Path $implRoot '01_IMPLEMENTATION_QUEUE.md'
$governanceReport = Join-Path $governanceRoot '07_PHASE2_FINAL_GOVERNANCE_REPORT.md'

if(-not (Test-Path -LiteralPath $gapFile)){
  throw "Required Phase 1 gap file not found: $gapFile. Run APEX-WATANY-PMA-SECOND-TWO-PHASE.ps1 -Phase Audit or -Phase Full first."
}

$gapText = Read-Utf8Text $gapFile
$decisionText = if(Test-Path -LiteralPath $decisionFile){ Read-Utf8Text $decisionFile } else { '' }
$queueText = if(Test-Path -LiteralPath $queueFile){ Read-Utf8Text $queueFile } else { '' }
$governanceText = if(Test-Path -LiteralPath $governanceReport){ Read-Utf8Text $governanceReport } else { '' }

$gapItems = @(Parse-GapTable $gapText)
$reviewedMap = Parse-ReviewedDecisions $decisionText
$governanceFields = Parse-FieldTable $governanceText

$classified = New-Object System.Collections.Generic.List[object]
$activeInternal = New-Object System.Collections.Generic.List[object]
$deferredOutOfScopeCount = 0
$acceptedPartialCount = 0
$reviewedDeferredCount = 0
$rejectedCount = 0

foreach($gap in $gapItems){
  $review = $null
  if($reviewedMap.ContainsKey($gap.Id)){
    $review = $reviewedMap[$gap.Id]
  }

  $disposition = if($review){ $review.Disposition } else { '' }
  $summary = if($review){ $review.Summary } else { 'No reviewed disposition recorded yet.' }
  $bucket = Get-ClosureBucket -Disposition $disposition -AuditStatus $gap.AuditStatus
  $action = Get-ClosureAction -Bucket $bucket -Disposition $disposition -Title $gap.Title

  $row = [pscustomobject]@{
    Id = $gap.Id
    Title = $gap.Title
    AuditStatus = $gap.AuditStatus
    Hits = $gap.Hits
    Disposition = $disposition
    ClosureBucket = $bucket
    Summary = $summary
    Action = $action
  }

  $classified.Add($row) | Out-Null

  switch($bucket){
    'ACTIVE_INTERNAL' {
      $activeInternal.Add($row) | Out-Null
    }
    'DEFERRED_OUT_OF_SCOPE' {
      $deferredOutOfScopeCount++
    }
    'ACCEPTED_PARTIAL_CAPABILITY' {
      $acceptedPartialCount++
    }
    'DEFERRED_REVIEWED' {
      $reviewedDeferredCount++
    }
    'REJECTED' {
      $rejectedCount++
    }
  }
}

$inputDoc = New-Object System.Collections.Generic.List[string]
Add-Line $inputDoc '# Phase 2A Internal Gap Closure Inputs'
Add-Line $inputDoc ''
Add-Line $inputDoc '| Source | Exists | Notes |'
Add-Line $inputDoc '|---|---:|---|'
Add-Line $inputDoc "| .pma\\audit\\watany-phase1\\07_GAP_ANALYSIS.md | $([bool](Test-Path -LiteralPath $gapFile)) | Phase 1 flagged WAT items. |"
Add-Line $inputDoc "| .pma\\implementation\\watany-phase2\\00_REVIEWED_GAP_DECISIONS.md | $([bool](Test-Path -LiteralPath $decisionFile)) | Reviewed dispositions layered on top of the audit. |"
Add-Line $inputDoc "| .pma\\implementation\\watany-phase2\\01_IMPLEMENTATION_QUEUE.md | $([bool](Test-Path -LiteralPath $queueFile)) | Current reviewed Phase 2 queue summary. |"
Add-Line $inputDoc "| .pma\\implementation\\watany-phase2-final\\07_PHASE2_FINAL_GOVERNANCE_REPORT.md | $([bool](Test-Path -LiteralPath $governanceReport)) | Final governance package summary if present. |"
if($governanceFields.Count -gt 0){
  Add-Line $inputDoc ''
  Add-Line $inputDoc '## Governance Snapshot'
  Add-Line $inputDoc ''
  Add-Line $inputDoc '| Field | Value |'
  Add-Line $inputDoc '|---|---|'
  foreach($key in @('ActiveBuildItems','DeferredItems','RejectedItems','UndecidedItems','CodeModified')){
    if($governanceFields.ContainsKey($key)){
      Add-Line $inputDoc "| $key | $($governanceFields[$key]) |"
    }
  }
}
Write-Utf8Bom (Join-Path $outRoot '00_INPUTS.md') ($inputDoc -join "`r`n")

$matrix = New-Object System.Collections.Generic.List[string]
Add-Line $matrix '# Internal Gap Classification Matrix'
Add-Line $matrix ''
if($classified.Count -eq 0){
  Add-Line $matrix 'No flagged Phase 1 WAT items were found in the current gap file.'
}else{
  Add-Line $matrix '| WAT ID | Requirement | Audit Status | Hits | Reviewed Disposition | Closure Bucket | Summary | Action |'
  Add-Line $matrix '|---|---|---|---:|---|---|---|---|'
  foreach($item in $classified){
    $disp = if([string]::IsNullOrWhiteSpace($item.Disposition)){ 'UNREVIEWED' } else { $item.Disposition }
    Add-Line $matrix "| $($item.Id) | $($item.Title) | $($item.AuditStatus) | $($item.Hits) | $disp | $($item.ClosureBucket) | $($item.Summary) | $($item.Action) |"
  }
}
Write-Utf8Bom (Join-Path $outRoot '01_INTERNAL_GAP_MATRIX.md') ($matrix -join "`r`n")

$actions = New-Object System.Collections.Generic.List[string]
Add-Line $actions '# Active Internal Actions'
Add-Line $actions ''
if($activeInternal.Count -eq 0){
  Add-Line $actions 'No active internal implementation items remain after applying the reviewed dispositions.'
  if($queueText -match 'No active Phase 2 implementation items remain after reviewed scope and partial-capability decisions\.'){
    Add-Line $actions ''
    Add-Line $actions 'The existing reviewed Phase 2 queue already confirms this zero-active-item state.'
  }
}else{
  Add-Line $actions '| WAT ID | Requirement | Audit Status | Hits | Next Action |'
  Add-Line $actions '|---|---|---|---:|---|'
  foreach($item in $activeInternal){
    Add-Line $actions "| $($item.Id) | $($item.Title) | $($item.AuditStatus) | $($item.Hits) | $($item.Action) |"
  }
}
Write-Utf8Bom (Join-Path $outRoot '02_ACTIVE_INTERNAL_ACTIONS.md') ($actions -join "`r`n")

$validation = New-Object System.Collections.Generic.List[string]
Add-Line $validation '# Phase 2A Validation Notes'
Add-Line $validation ''
Add-Line $validation '- This script is read-only and does not patch application code.'
Add-Line $validation '- Re-run the canonical two-phase PMA runner before this script if the audit or reviewed decisions change.'
Add-Line $validation '- Re-run governance packaging if leadership changes any reviewed disposition.'
if($activeInternal.Count -eq 0){
  Add-Line $validation '- Current result: no in-scope internal implementation items are approved for a new code-change wave.'
}else{
  Add-Line $validation '- Current result: at least one in-scope internal implementation item still requires a targeted closure script.'
}
Write-Utf8Bom (Join-Path $outRoot '03_VALIDATION_NOTES.md') ($validation -join "`r`n")

$ended = Get-Date
$status = if($activeInternal.Count -eq 0){ 'PHASE2A_INTERNAL_GAP_CLOSURE_NO_ACTIVE_ITEMS' } else { 'PHASE2A_INTERNAL_GAP_CLOSURE_ACTION_REQUIRED' }
$final = New-Object System.Collections.Generic.List[string]
Add-Line $final '# Phase 2A Internal Gap Closure Report'
Add-Line $final ''
Add-Line $final '| Field | Value |'
Add-Line $final '|---|---|'
Add-Line $final "| Status | $status |"
Add-Line $final "| ProjectRoot | $root |"
Add-Line $final "| Started | $($started.ToString('o')) |"
Add-Line $final "| Ended | $($ended.ToString('o')) |"
Add-Line $final "| DurationSeconds | $([int]($ended-$started).TotalSeconds) |"
Add-Line $final '| CodeModified | False |'
Add-Line $final "| FlaggedAuditItems | $($gapItems.Count) |"
Add-Line $final "| ActiveInternalItems | $($activeInternal.Count) |"
Add-Line $final "| DeferredOutOfScopeItems | $deferredOutOfScopeCount |"
Add-Line $final "| AcceptedPartialItems | $acceptedPartialCount |"
Add-Line $final "| ReviewedDeferredItems | $reviewedDeferredCount |"
Add-Line $final "| RejectedItems | $rejectedCount |"
Add-Line $final ''
Add-Line $final '## Outputs'
foreach($name in @('00_INPUTS.md','01_INTERNAL_GAP_MATRIX.md','02_ACTIVE_INTERNAL_ACTIONS.md','03_VALIDATION_NOTES.md','04_PHASE2A_INTERNAL_GAP_CLOSURE_REPORT.md')){
  Add-Line $final "- $name"
}
Add-Line $final ''
Add-Line $final '## Next Step'
if($activeInternal.Count -eq 0){
  Add-Line $final 'Keep the current reviewed Phase 2 and governance outputs as the source of truth. No internal code-change closure wave is required from this script.'
}else{
  Add-Line $final 'Create focused, item-specific closure scripts only for the active internal rows listed above, then validate each slice separately.'
}

$finalPath = Join-Path $outRoot '04_PHASE2A_INTERNAL_GAP_CLOSURE_REPORT.md'
Write-Utf8Bom $finalPath ($final -join "`r`n")

Write-Host "APEX Watany Phase 2A internal gap closure completed."
Write-Host "Report: $finalPath"

if($OpenReport){
  Start-Process notepad.exe $finalPath
}