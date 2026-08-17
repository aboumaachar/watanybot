$ErrorActionPreference = 'Stop'
$repo = (Get-Location).Path
$runId = 'full-convergence-20260817-193500'
$protectedCrmPaths = @('apps/gateway-api/src/routes/admin-crm-contacts.ts','apps/gateway-api/src/routes/erpnext-readiness.ts','apps/gateway-api/src/integrations/erpnext/client.ts','apps/gateway-api/src/bootstrap/routes.ts','apps/gateway-api/src/lib/config.ts','apps/web-user/src/components/superadmin/SuperadminCrmCommandCenter.tsx','apps/web-user/src/lib/api.ts')
$outRoot = Join-Path $repo ('apex-reports\' + $runId)
New-Item -ItemType Directory -Force -Path $outRoot | Out-Null
function Invoke-GitText([string[]]$GitArgs) {
  $result = & git @GitArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "git failed: $($GitArgs -join ' ')`n$($result -join "`n")" }
  return [string]::Join("`n", [string[]]$result)
}
function Get-Blob([string]$Path, [string]$Ref) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $value = & git -c core.quotepath=false rev-parse "$Ref`:$Path" 2>$null
  $ErrorActionPreference = $previousPreference
  if ($LASTEXITCODE -eq 0) { return ([string]$value).Trim() }
  return $null
}
function Get-WorkingHash([string]$Path) {
  if (Test-Path -LiteralPath (Join-Path $repo $Path) -PathType Leaf) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $value = & git hash-object -- $Path 2>$null
    $ErrorActionPreference = $previousPreference
    if ($LASTEXITCODE -eq 0) { return ([string]$value).Trim() }
  }
  return $null
}
function Get-Disposition([string]$Path) {
  if ($protectedCrmPaths -contains $Path) { return 'SEALED_CRM_PROTECTED' }
  if ($Path -eq 'pma/feature-gates/04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md') { return 'GOVERNANCE_REQUIRED' }
  if ($Path -match '^(\.apex-evidence|_apex_backups|_watany_diagnostics|apex-reports|evidence|logs|chat_logs|backups|playwright-report|test-results|runtime|temp_patch1|temp_patch2|tmp)/') { return 'GENERATED_EVIDENCE_EXCLUDED' }
  if ($Path -match '(^|/)(runtime-evidence|plugins\.sqlite)$' -or $Path -match '^data/(plugins\.sqlite|admin-payments\.json)$') { return 'RUNTIME_STATE_EXCLUDED' }
  if ($Path -match '^(APEX_|scripts/.*\.ps1$|tmp_phase3_.*\.ps1$|pma/theme/extract-schools-hat\.py$)') { return 'VALIDATION_ONLY_EXCLUDED' }
  if ($Path -match '^apps/(gateway-api/src/|web-user/src/|web-user/public/data/location/|web-user/public/mof/|web-user/public/data/primary-retirement-forms\.partial\.manifest\.json$)|^mof/|^watany_kb_tables_v4/watany_rag_chunks_v4\.jsonl$') { return 'CURRENT_RELEASE_REQUIRED' }
  if ($Path -match '^apps/gateway-api/src/db/migrations/031_community_chats_forward_message\.sql$') { return 'CURRENT_RELEASE_REQUIRED' }
  if ($Path -match '^apps/web-user/public/mof/') { return 'CURRENT_RELEASE_REQUIRED' }
  return 'UNRELATED_WORK_EXCLUDED'
}
$branch = 'integration/theme-upgrade-20260728'
$head = ([string](& git rev-parse HEAD)).Trim()
$origin = (Invoke-GitText @('rev-parse','origin/integration/theme-upgrade-20260728')).Trim()
$raw = [string](& git -c core.quotepath=false status --porcelain=v1 -z --untracked-files=all)
$tokens = $raw -split [char]0 | Where-Object { $_ -ne '' }
$rows = New-Object System.Collections.Generic.List[object]
foreach ($token in $tokens) {
  $status = if ($token.Length -ge 2) { $token.Substring(0,2) } else { '' }
  $path = if ($token.Length -gt 3) { $token.Substring(3) } else { $token }
  $disposition = Get-Disposition $path
  $row = [ordered]@{ path=$path; status=$status; disposition=$disposition; workingBlob=Get-WorkingHash $path; headBlob=Get-Blob $path 'HEAD'; originBlob=Get-Blob $path 'origin/integration/theme-upgrade-20260728' }
  $rows.Add([pscustomobject]$row)
}
$counts = @{}
foreach ($row in $rows) { if (-not $counts.ContainsKey($row.disposition)) { $counts[$row.disposition] = 0 }; $counts[$row.disposition]++ }
$unknown = @($rows | Where-Object { $_.disposition -eq 'UNKNOWN_BLOCKER' }).Count
$rowArray = @($rows | ForEach-Object { $_ })
$predecessor = [ordered]@{ runId=$runId; repository=$repo; branch=$branch; sealedProductionRelease='f57421a2cc312f3d0ced98ba9584fa57fd26d46d8'; postCloseoutOrigin='4e0d8c4d14af1dcc317dc1f77e13b270ae316aee'; primaryHead=$head; originHead=$origin; statusCapture='git status --porcelain=v1 -z --untracked-files=all'; pathEncoding='core.quotepath=false; NUL-delimited'; capturedAt=(Get-Date).ToUniversalTime().ToString('o') }
$predecessor | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $outRoot 'FC_00_PREDECESSOR_REOPEN.json')
$census = [ordered]@{ runId=$runId; pathCount=$rows.Count; dispositions=$counts; unknownBlockerCount=$unknown; rows=$rowArray }
$census | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $outRoot 'FC_01_LOCAL_GIT_CENSUS.json')
[ordered]@{ runId=$runId; source='FC_01_LOCAL_GIT_CENSUS.json'; unionCount=$rows.Count; unknownBlockerCount=$unknown; rows=$rowArray } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $outRoot 'FC_02_FULL_LOCAL_DELTA_UNION.json')
$rows | Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $outRoot 'FC_03_DELTA_AUTHORITY_MATRIX.csv')
[ordered]@{ runId=$runId; allowedReleaseMembership=@('CURRENT_RELEASE_REQUIRED','GOVERNANCE_REQUIRED'); protectedPaths=$protectedCrmPaths; unknownBlockerCount=$unknown; rows=$rowArray } | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $outRoot 'FC_03_DELTA_AUTHORITY_MATRIX.json')
Write-Output "RUN_ID=$runId"
Write-Output "PATH_COUNT=$($rows.Count)"
Write-Output "UNKNOWN_BLOCKER_COUNT=$unknown"
$counts.GetEnumerator() | Sort-Object Name | ForEach-Object { Write-Output ("DISPOSITION_{0}={1}" -f $_.Name,$_.Value) }
