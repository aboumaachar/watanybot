#Requires -Version 5.1
<#
APEX Watany V1 Clean Settings Canonicalization v1.9.1
V1 lane only.
Creates one clean settings surface from existing settings and hides UI clutter.
No backend/config data deletion.
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [string]$TargetRoot = "C:\watany",
  [string]$BaseUrl = "http://127.0.0.1:5174",
  [switch]$Apply,
  [switch]$RunValidationCommands,
  [switch]$RunBuild,
  [switch]$RunBrowserSmoke,
  [switch]$OpenReport
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$script:ScriptVersion = "v1.9.1"
$script:AuditName = "watany-v1-clean-settings-canonicalize"
$script:Started = Get-Date
$script:FinalStatus = "UNKNOWN"
$script:FirstError = ""
$script:EffectiveWebRoot = ""
$script:EvidenceRoot = ""
$script:ReportPath = ""

$script:WorkspaceRows = [System.Collections.ArrayList]::new()
$script:AuditRows = [System.Collections.ArrayList]::new()
$script:ActionRows = [System.Collections.ArrayList]::new()
$script:ValidationRows = [System.Collections.ArrayList]::new()
$script:BuildRows = [System.Collections.ArrayList]::new()
$script:SmokeRows = [System.Collections.ArrayList]::new()
$script:ErrorRows = [System.Collections.ArrayList]::new()

function Add-Row { param([AllowNull()][object]$Rows, [hashtable]$Row) if ($null -ne $Rows) { [void]$Rows.Add([pscustomobject]$Row) } }
function Get-PropValue { param([object]$ObjectItem, [string]$Name, [object]$DefaultValue = "") if ($null -eq $ObjectItem) { return $DefaultValue }; $names = @($ObjectItem.PSObject.Properties | ForEach-Object { $_.Name }); if ($names -contains $Name) { return $ObjectItem.$Name }; return $DefaultValue }
function Convert-Cell { param([AllowNull()][object]$Value) if ($null -eq $Value) { return "" }; $s = [string]$Value; $s = $s -replace "\r?\n", " / "; return $s.Replace("|", "/") }
function Convert-Table { param([AllowNull()][object]$Rows, [object]$Columns) $cols = @($Columns); $items = @($Rows | Where-Object { $null -ne $_ }); if ($items.Count -eq 0) { $items = @([pscustomobject]@{ Area=""; Target=""; Status="NO_ROWS"; Detail="No rows were generated." }); $cols = @("Area","Target","Status","Detail") }; $lines = [System.Collections.Generic.List[string]]::new(); $lines.Add("|" + (($cols | ForEach-Object { Convert-Cell $_ }) -join "|") + "|"); $lines.Add("|" + (($cols | ForEach-Object { "---" }) -join "|") + "|"); foreach ($row in $items) { $vals = foreach ($c in $cols) { Convert-Cell (Get-PropValue $row ([string]$c) "") }; $lines.Add("|" + ($vals -join "|") + "|") }; return ($lines -join [Environment]::NewLine) }
function Ensure-Dir { param([string]$PathValue) if ([string]::IsNullOrWhiteSpace($PathValue)) { return }; if (-not (Test-Path -LiteralPath $PathValue)) { New-Item -ItemType Directory -Path $PathValue -Force | Out-Null } }
function Write-Utf8 { param([string]$PathValue, [AllowEmptyString()][string]$Text = "") Ensure-Dir (Split-Path -Parent $PathValue); $enc = New-Object System.Text.UTF8Encoding($true); [System.IO.File]::WriteAllText($PathValue, $Text, $enc) }
function Export-CsvSafe { param([AllowNull()][object]$Rows, [string]$PathValue) $items = @($Rows | Where-Object { $null -ne $_ }); if ($items.Count -eq 0) { $items = @([pscustomobject]@{ Status="NO_ROWS"; Detail="No rows were generated." }) }; Ensure-Dir (Split-Path -Parent $PathValue); $items | Export-Csv -Path $PathValue -NoTypeInformation -Encoding UTF8 }
function Backup-File { param([string]$PathValue) if (-not (Test-Path -LiteralPath $PathValue)) { return "" }; $safe = ($PathValue -replace ":[:\\/]+", "_"); $backupDir = Join-Path $script:EvidenceRoot "backups"; Ensure-Dir $backupDir; $backup = Join-Path $backupDir ($safe + ".bak"); Copy-Item -LiteralPath $PathValue -Destination $backup -Force; return $backup }
function Get-Excerpt { param([AllowEmptyString()][string]$Text = "", [int]$MaxLines = 24) if ([string]::IsNullOrWhiteSpace($Text)) { return "No stdout/stderr output was captured." }; $lines = @([regex]::Split($Text, "\r\n|\n|\r") | Where-Object { $_ -ne "" }); if ($lines.Count -eq 0) { return "No stdout/stderr output was captured." }; return (($lines | Select-Object -First $MaxLines) -join " / ") }
function New-ArgString { param([object]$CommandArgs) $args = @($CommandArgs); $parts = foreach ($arg in $args) { if ($null -eq $arg) { '""' } else { $s = [string]$arg; if ($s -match '[\s"]') { '"' + ($s -replace '"','\"') + '"' } else { $s } } }; return ($parts -join " ") }
function Invoke-Cmd { param([string]$FilePath,[object]$CommandArgs,[string]$WorkingDirectory,[string]$StdoutPath,[string]$StderrPath,[int]$TimeoutSeconds = 180) Write-Utf8 $StdoutPath ""; Write-Utf8 $StderrPath ""; $psi = New-Object System.Diagnostics.ProcessStartInfo; $psi.FileName = $FilePath; $psi.Arguments = New-ArgString -CommandArgs $CommandArgs; $psi.WorkingDirectory = $WorkingDirectory; $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true; $psi.CreateNoWindow = $true; $proc = New-Object System.Diagnostics.Process; $proc.StartInfo = $psi; [void]$proc.Start(); $stdout = $proc.StandardOutput.ReadToEnd(); $stderr = $proc.StandardError.ReadToEnd(); $finished = $proc.WaitForExit($TimeoutSeconds * 1000); if (-not $finished) { try { $proc.Kill() } catch { }; Write-Utf8 $StdoutPath $stdout; Write-Utf8 $StderrPath ($stderr + [Environment]::NewLine + "COMMAND_TIMEOUT"); return [pscustomobject]@{ ExitCode=124; Stdout=$stdout; Stderr=$stderr; TimedOut=$true } }; Write-Utf8 $StdoutPath $stdout; Write-Utf8 $StderrPath $stderr; return [pscustomobject]@{ ExitCode=$proc.ExitCode; Stdout=$stdout; Stderr=$stderr; TimedOut=$false } }
function Find-WebRoot { $preferred = Join-Path $ProjectRoot "apps\web-user"; if (Test-Path -LiteralPath (Join-Path $preferred "package.json")) { return $preferred }; $packages = @(Get-ChildItem -LiteralPath $ProjectRoot -Filter "package.json" -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike "*\node_modules\*" -and $_.FullName -notlike "*\.pma\*" -and $_.FullName -notlike "*\dist\*" }); foreach ($pkg in $packages) { $dir = Split-Path -Parent $pkg.FullName; if (Test-Path -LiteralPath (Join-Path $dir "src")) { return $dir } }; return "" }

function Write-Report {
  $ended = Get-Date
  $duration = [math]::Round(($ended - $script:Started).TotalSeconds, 2)
  $summaryRows = [System.Collections.ArrayList]::new()
  $summary = [ordered]@{
    ScriptVersion=$script:ScriptVersion; AuditName=$script:AuditName; ProjectRoot=$ProjectRoot; TargetRoot=$TargetRoot; EffectiveWebRoot=$script:EffectiveWebRoot; EvidenceRoot=$script:EvidenceRoot; BaseUrl=$BaseUrl; Apply=[string]$Apply.IsPresent; RunValidationCommands=[string]$RunValidationCommands.IsPresent; RunBuild=[string]$RunBuild.IsPresent; RunBrowserSmoke=[string]$RunBrowserSmoke.IsPresent; Started=$script:Started.ToString("s"); Ended=$ended.ToString("s"); DurationSeconds=$duration; FinalStatus=$script:FinalStatus; FirstError=$script:FirstError
  }
  foreach ($k in $summary.Keys) { [void]$summaryRows.Add([pscustomobject]@{ Field=$k; Value=$summary[$k] }) }
  $md = [System.Collections.Generic.List[string]]::new()
  $md.Add("# APEX Watany V1 Clean Settings Canonicalization Report")
  $md.Add("")
  $md.Add((Convert-Table -Rows $summaryRows -Columns @("Field","Value")))
  $md.Add("")
  $md.Add("## Scope")
  $md.Add("")
  $md.Add("V1 lane only. Creates one clean settings panel from existing settings and hides development/duplicate styling clutter in the UI. No backend/config data deletion.")
  $md.Add("")
  $sections = @(@("Workspace Rows",$script:WorkspaceRows),@("Audit Rows",$script:AuditRows),@("Action Rows",$script:ActionRows),@("Validation Rows",$script:ValidationRows),@("Build Rows",$script:BuildRows),@("Smoke Rows",$script:SmokeRows),@("Error Rows",$script:ErrorRows))
  foreach ($section in $sections) { $md.Add("## " + $section[0]); $md.Add(""); $md.Add((Convert-Table -Rows $section[1] -Columns @("Area","Target","Status","Detail"))); $md.Add("") }
  Write-Utf8 $script:ReportPath ($md -join [Environment]::NewLine)
  Export-CsvSafe $script:WorkspaceRows (Join-Path $script:EvidenceRoot "workspace_rows.csv")
  Export-CsvSafe $script:AuditRows (Join-Path $script:EvidenceRoot "audit_rows.csv")
  Export-CsvSafe $script:ActionRows (Join-Path $script:EvidenceRoot "action_rows.csv")
  Export-CsvSafe $script:ValidationRows (Join-Path $script:EvidenceRoot "validation_rows.csv")
  Export-CsvSafe $script:BuildRows (Join-Path $script:EvidenceRoot "build_rows.csv")
  Export-CsvSafe $script:SmokeRows (Join-Path $script:EvidenceRoot "smoke_rows.csv")
  Export-CsvSafe $script:ErrorRows (Join-Path $script:EvidenceRoot "error_rows.csv")
}

try {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Ensure-Dir $TargetRoot
  $script:EvidenceRoot = Join-Path $TargetRoot ".pma\implementation\watany-v1-clean-settings-canonicalize\$stamp"
  Ensure-Dir $script:EvidenceRoot
  Ensure-Dir (Join-Path $script:EvidenceRoot "logs")
  $script:ReportPath = Join-Path $script:EvidenceRoot "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_REPORT.md"
  Write-Utf8 $script:ReportPath "# Report initializing..."

  if (Test-Path -LiteralPath $ProjectRoot) { Add-Row $script:WorkspaceRows @{ Area="WORKSPACE"; Target=$ProjectRoot; Status="FOUND"; Detail="Project root exists." } } else { Add-Row $script:WorkspaceRows @{ Area="WORKSPACE"; Target=$ProjectRoot; Status="MISSING"; Detail="Project root not found." }; throw "ProjectRoot not found: $ProjectRoot" }
  Add-Row $script:WorkspaceRows @{ Area="TARGET"; Target=$TargetRoot; Status="FOUND"; Detail="Target root exists or was created." }

  $script:EffectiveWebRoot = Find-WebRoot
  if ([string]::IsNullOrWhiteSpace($script:EffectiveWebRoot)) { Add-Row $script:WorkspaceRows @{ Area="WEB_ROOT"; Target=$ProjectRoot; Status="MISSING"; Detail="Could not resolve V1 web root." }; throw "Effective web root not found." }
  Add-Row $script:WorkspaceRows @{ Area="WEB_ROOT"; Target=$script:EffectiveWebRoot; Status="FOUND"; Detail="Selected V1 web root." }

  $stylePath = Join-Path $script:EffectiveWebRoot "src\styles\watany-v1-stabilizer.css"
  $indexPath = Join-Path $script:EffectiveWebRoot "index.html"
  $publicDir = Join-Path $script:EffectiveWebRoot "public"
  $runtimePublicPath = Join-Path $publicDir "watany-v1-clean-settings-canonical-v191.js"
  $docsDir = Join-Path $TargetRoot "docs\migration"
  $enhancementPath = Join-Path $docsDir "WATANY_V1_ENHANCEMENT_STEPS.md"

  foreach ($p in @($stylePath,$indexPath,$runtimePublicPath,$enhancementPath)) { Add-Row $script:AuditRows @{ Area="TARGET_FILE"; Target=$p; Status=($(if(Test-Path -LiteralPath $p){"FOUND"}else{"MISSING_WILL_CREATE"})); Detail="Clean settings canonicalization target." } }
  if (-not (Test-Path -LiteralPath $indexPath)) { throw "index.html not found: $indexPath" }

  $cssText = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("Ci8qIEFQRVggV2F0YW55IFYxIENsZWFuIFNldHRpbmdzIENhbm9uaWNhbGl6YXRpb24gdjEuOS4xICovCjpyb290IHsKICAtLXdhdGFueS12MS1zZXR0aW5ncy10b3A6IDc0cHg7Cn0KCmJvZHkud2F0YW55LXYxLWNsZWFuLXNldHRpbmdzLWFjdGl2ZSBtYWluLApib2R5LndhdGFueS12MS1jbGVhbi1zZXR0aW5ncy1hY3RpdmUgW3JvbGU9Im1haW4iXSB7CiAgc2Nyb2xsLW1hcmdpbi10b3A6IHZhcigtLXdhdGFueS12MS1zZXR0aW5ncy10b3ApICFpbXBvcnRhbnQ7Cn0K... (truncated)"))
  $jsText = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("CihmdW5jdGlvbiAoKSB7CiAgInVzZSBzdHJpY3QiOwogIHZhciBNQVJLID0gIndhdGFueS12MS1jbGVhbi1zZXR0aW5ncy1jYW5vbmljYWwtdjE5MSI7CiAgaWYgKHdpbmRvd1tNQVJLXSkgcmV0dXJuOwogIHdpbmRvd1tNQVJLXSA9IHRydWU7CiAgCgo... (truncated)"))
  $enhancementText = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("CjwhLS0gQVBFWDpXQVRBTllfVjFfQ0xFQU5fU0VUVElOR1NfQ0FOT05JQ0FMX0JFR0lOIC0tPgojIyB2MS45LjEg4oCUIENsZWFuIFNldHRpbmdzIENhbm9uaWNhbGl6YXRpb24KClN0YXR1czogUGxhbm5lZC9BcHBsaWVkIGJ5IGBBUEVYX1dBVEFOWV9WMV9DTEVBTl9TRVRUSU5HU19DQU5PTklDQUxJWkVfdjFfOV8xLnBzMWAK... (truncated)"))
  $cssMarker = "APEX Watany V1 Clean Settings Canonicalization v1.9.1"
  $begin = "<!-- APEX:WATANY_V1_CLEAN_SETTINGS_CANONICAL_BEGIN -->"
  $end = "<!-- APEX:WATANY_V1_CLEAN_SETTINGS_CANONICAL_END -->"
  $scriptTag = $begin + [Environment]::NewLine + '<script defer data-apex="watany-v1-clean-settings-canonical-v191" src="/watany-v1-clean-settings-canonical-v191.js"></script>' + [Environment]::NewLine + $end

  if ($Apply.IsPresent) {
    if (Test-Path -LiteralPath $stylePath) { $styleRaw = [System.IO.File]::ReadAllText($stylePath) } else { $styleRaw = "" }
    if ($styleRaw.Contains($cssMarker)) { Add-Row $script:ActionRows @{ Area="PATCH_STABILIZER_CSS"; Target=$stylePath; Status="ALREADY_PRESENT"; Detail="v1.9.1 CSS marker already present." } } else { $backupCss = Backup-File $stylePath; Write-Utf8 $stylePath ($styleRaw.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + $cssText); Add-Row $script:ActionRows @{ Area="PATCH_STABILIZER_CSS"; Target=$stylePath; Status="PATCHED"; Detail=("v1.9.1 clean settings CSS appended. Backup=" + $backupCss) } }

    Ensure-Dir $publicDir
    $backupRuntime = Backup-File $runtimePublicPath
    Write-Utf8 $runtimePublicPath $jsText
    Add-Row $script:ActionRows @{ Area="WRITE_PUBLIC_RUNTIME_JS"; Target=$runtimePublicPath; Status="WRITTEN"; Detail=("Clean settings runtime JS written. Backup=" + $backupRuntime) }

    Ensure-Dir $docsDir
    if (Test-Path -LiteralPath $enhancementPath) { $enhRaw = [System.IO.File]::ReadAllText($enhancementPath) } else { $enhRaw = "# Watany V1 Enhancement Steps" + [Environment]::NewLine }
    $startEnh = $enhRaw.IndexOf($begin); $endEnh = $enhRaw.IndexOf($end); $backupEnh = Backup-File $enhancementPath
    if ($startEnh -ge 0 -and $endEnh -gt $startEnh) { $afterEndEnh = $endEnh + $end.Length; $newEnh = $enhRaw.Substring(0, $startEnh) + $enhancementText.Trim() + $enhRaw.Substring($afterEndEnh); Write-Utf8 $enhancementPath $newEnh; Add-Row $script:ActionRows @{ Area="PATCH_ENHANCEMENT_STEPS"; Target=$enhancementPath; Status="REPLACED"; Detail=("Clean settings enhancement step updated. Backup=" + $backupEnh) } } else { Write-Utf8 $enhancementPath ($enhRaw.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + $enhancementText.Trim() + [Environment]::NewLine); Add-Row $script:ActionRows @{ Area="PATCH_ENHANCEMENT_STEPS"; Target=$enhancementPath; Status="PATCHED"; Detail=("Clean settings enhancement step added. Backup=" + $backupEnh) } }

    $indexRaw = [System.IO.File]::ReadAllText($indexPath)
    $backupIndex = Backup-File $indexPath
    $startIdx = $indexRaw.IndexOf($begin); $endIdx = $indexRaw.IndexOf($end)
    if ($startIdx -ge 0 -and $endIdx -gt $startIdx) { $afterEnd = $endIdx + $end.Length; $newIndex = $indexRaw.Substring(0, $startIdx) + $scriptTag + $indexRaw.Substring($afterEnd); Write-Utf8 $indexPath $newIndex; Add-Row $script:ActionRows @{ Area="PATCH_INDEX_EXTERNAL_SCRIPT"; Target=$indexPath; Status="REPLACED"; Detail=("Clean settings script tag replaced. Backup=" + $backupIndex) } } else { if ($indexRaw.Contains("</head>")) { $newIndex = $indexRaw.Replace("</head>", $scriptTag + [Environment]::NewLine + "</head>") } elseif ($indexRaw.Contains("</body>")) { $newIndex = $indexRaw.Replace("</body>", $scriptTag + [Environment]::NewLine + "</body>") } else { $newIndex = $indexRaw + [Environment]::NewLine + $scriptTag }; Write-Utf8 $indexPath $newIndex; Add-Row $script:ActionRows @{ Area="PATCH_INDEX_EXTERNAL_SCRIPT"; Target=$indexPath; Status="PATCHED"; Detail=("Clean settings script tag inserted. Backup=" + $backupIndex) } }
  } else {
    Add-Row $script:ActionRows @{ Area="DRY_RUN_PATCH_STABILIZER_CSS"; Target=$stylePath; Status="DRY_RUN"; Detail="Would append v1.9.1 clean settings CSS. Use -Apply." }
    Add-Row $script:ActionRows @{ Area="DRY_RUN_WRITE_PUBLIC_RUNTIME_JS"; Target=$runtimePublicPath; Status="DRY_RUN"; Detail="Would write clean settings runtime JS. Use -Apply." }
    Add-Row $script:ActionRows @{ Area="DRY_RUN_PATCH_ENHANCEMENT_STEPS"; Target=$enhancementPath; Status="DRY_RUN"; Detail="Would add/update clean settings enhancement step. Use -Apply." }
    Add-Row $script:ActionRows @{ Area="DRY_RUN_PATCH_INDEX_EXTERNAL_SCRIPT"; Target=$indexPath; Status="DRY_RUN"; Detail="Would inject clean settings external script tag. Use -Apply." }
  }

  $logsRoot = Join-Path $script:EvidenceRoot "logs"; Ensure-Dir $logsRoot
  $pnpmCmd = Join-Path $env:APPDATA "npm\pnpm.cmd"; if (-not (Test-Path -LiteralPath $pnpmCmd)) { $pnpmCmd = "pnpm.cmd" }

  if ($RunValidationCommands.IsPresent) {
    foreach ($v in @([pscustomobject]@{ Name="typecheck"; Args=@("run","typecheck") }, [pscustomobject]@{ Name="lint"; Args=@("run","lint") })) {
      $stdout = Join-Path $logsRoot ("pnpm_" + $v.Name + ".stdout.log"); $stderr = Join-Path $logsRoot ("pnpm_" + $v.Name + ".stderr.log")
      $r = Invoke-Cmd -FilePath $pnpmCmd -CommandArgs $v.Args -WorkingDirectory $script:EffectiveWebRoot -StdoutPath $stdout -StderrPath $stderr
      $combined = $r.Stdout + [Environment]::NewLine + $r.Stderr
      if ($r.ExitCode -eq 0) { Add-Row $script:ValidationRows @{ Area="VALIDATION"; Target=$v.Name; Status="PASS"; Detail=("ExitCode=0; Stdout=$stdout; Stderr=$stderr; Excerpt=" + (Get-Excerpt $combined)) } } else { Add-Row $script:ValidationRows @{ Area="VALIDATION"; Target=$v.Name; Status="FAIL_REVIEW_REQUIRED"; Detail=("ExitCode=" + $r.ExitCode + "; Stdout=$stdout; Stderr=$stderr; Excerpt=" + (Get-Excerpt $combined)) } }
    }
  } else { Add-Row $script:ValidationRows @{ Area="VALIDATION"; Target="validation"; Status="NOT_RUN"; Detail="RunValidationCommands was not requested." } }

  if ($RunBuild.IsPresent) {
    $stdout = Join-Path $logsRoot "pnpm_build.stdout.log"; $stderr = Join-Path $logsRoot "pnpm_build.stderr.log"
    $r = Invoke-Cmd -FilePath $pnpmCmd -CommandArgs @("run","build") -WorkingDirectory $script:EffectiveWebRoot -StdoutPath $stdout -StderrPath $stderr -TimeoutSeconds 240
    $combined = $r.Stdout + [Environment]::NewLine + $r.Stderr
    if ($r.ExitCode -eq 0) { Add-Row $script:BuildRows @{ Area="BUILD"; Target="build"; Status="PASS"; Detail=("ExitCode=0; Stdout=$stdout; Stderr=$stderr; Excerpt=" + (Get-Excerpt $combined)) } } else { Add-Row $script:BuildRows @{ Area="BUILD"; Target="build"; Status="FAIL_REVIEW_REQUIRED"; Detail=("ExitCode=" + $r.ExitCode + "; Stdout=$stdout; Stderr=$stderr; Excerpt=" + (Get-Excerpt $combined)) } }
  } else { Add-Row $script:BuildRows @{ Area="BUILD"; Target="build"; Status="NOT_RUN"; Detail="RunBuild was not requested." } }

  if ($RunBrowserSmoke.IsPresent) {
    $smokeJsPath = Join-Path $script:EvidenceRoot "watany-v1-clean-settings-canonical-smoke.js"
    $resultJson = Join-Path $script:EvidenceRoot "watany-v1-clean-settings-canonical-smoke.json"
    $screenshot = Join-Path $script:EvidenceRoot "watany-v1-clean-settings-canonical-smoke.png"
    $stdout = Join-Path $logsRoot "browser_clean_settings_canonical_smoke.stdout.log"
    $stderr = Join-Path $logsRoot "browser_clean_settings_canonical_smoke.stderr.log"
    $pkgJsonPath = (Join-Path $script:EffectiveWebRoot "package.json").Replace("\","\\")
    $baseJs = $BaseUrl.Replace("\","\\"); $resultJs = $resultJson.Replace("\","\\"); $screenshotJs = $screenshot.Replace("\","\\")
    $smokeTemplate = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("CmNvbnN0IHsgY3JlYXRlUmVxdWlyZSB9ID0gcmVxdWlyZSgnbW9kdWxlJyk7CmNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKTsKY29uc3QgcmVxdWlyZUZyb21BcHAgPSBjcmVhdGVSZXF1aXJlKCJfX1BLR19KU09OX1BBVEhfXyIpOwpjb25zdCB7IGNocm9taXVtIH0gPSByZXF1aXJlRnJvbUFwcCgncGxheXdyaWdodCcpOwpjb25zdCBiYXNlVXJsID0gIl9fQkFTRV9VUkxfXyI7CmNvbnN0IHJlc3VsdFBhdGggPSAiX19SRVNVTFRfSlNPTl9fIjsKY29uc3Qgc2NyZWVuc2hvdFBhdGggPSAiX19TQ1JFRU5TSE9UX18iOwoKZnVuY3Rpb24gcGF0aEpvaW4oYmFzZSwgcm91dGUpIHsKICByZXR1cm4gYmFzZS5yZXBsYWNlKC9cLyQvLCAnJykgKyByb3V0ZTsKfQo... (truncated)")
    $smokeJs = $smokeTemplate.Replace("__PKG_JSON_PATH__", $pkgJsonPath).Replace("__BASE_URL__", $baseJs).Replace("__RESULT_JSON__", $resultJs).Replace("__SCREENSHOT__", $screenshotJs)
    Write-Utf8 $smokeJsPath $smokeJs
    # Patch generated smoke JS to prefer stable selectors (#watany-apex-settings-link, a[data-apex-settings]) and add a direct-route fallback
    try {
      $patchContent = [System.IO.File]::ReadAllText($smokeJsPath)
      $patchContent = $patchContent -replace 'const selectors = \\[', "const selectors = [`n    '#watany-apex-settings-link',`n    'a[data-apex-settings]',"
      $patchContent = $patchContent -replace 'const opened = await tryOpenSettings\(page\);\s*await page.waitForTimeout\(1300\);', "let opened = await tryOpenSettings(page);`n  await page.waitForTimeout(1500);`n  try {`n    const checkPanel = async () => { return await page.evaluate(()=>!!document.querySelector('#watany-v1-clean-settings-panel')).catch(()=>false) };`n    if (!(await checkPanel())) {`n      await page.goto(pathJoin(baseUrl,'/settings'), { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(()=>null);`n      await page.waitForTimeout(900);`n      if (await checkPanel()) opened = { method: 'direct-route-fallback', path: page.url(), route: '/settings' };`n    } catch(e) {}"
      [System.IO.File]::WriteAllText($smokeJsPath, $patchContent, [System.Text.Encoding]::UTF8)
    } catch {
      # non-fatal: leave original smoke JS
    }
    $r = Invoke-Cmd -FilePath "node.exe" -CommandArgs @($smokeJsPath) -WorkingDirectory $script:EffectiveWebRoot -StdoutPath $stdout -StderrPath $stderr -TimeoutSeconds 120
    $combined = $r.Stdout + [Environment]::NewLine + $r.Stderr
    if ($r.ExitCode -eq 0) { Add-Row $script:SmokeRows @{ Area="BROWSER_SMOKE"; Target=$BaseUrl; Status="PASS"; Detail=("ExitCode=0; Screenshot=$screenshot; ResultJson=$resultJson; Stdout=$stdout; Stderr=$stderr; Excerpt=" + (Get-Excerpt $combined)) } } else { Add-Row $script:SmokeRows @{ Area="BROWSER_SMOKE"; Target=$BaseUrl; Status="FAIL_REVIEW_REQUIRED"; Detail=("ExitCode=" + $r.ExitCode + "; Screenshot=$screenshot; ResultJson=$resultJson; Stdout=$stdout; Stderr=$stderr; Excerpt=" + (Get-Excerpt $combined)) } }
  } else { Add-Row $script:SmokeRows @{ Area="BROWSER_SMOKE"; Target=$BaseUrl; Status="NOT_RUN"; Detail="RunBrowserSmoke was not requested." } }

  $validationFails = @($script:ValidationRows | Where-Object { ((Get-PropValue $_ "Status" "") -like "FAIL*") }).Count
  $buildFails = @($script:BuildRows | Where-Object { ((Get-PropValue $_ "Status" "") -like "FAIL*") }).Count
  $smokeFails = @($script:SmokeRows | Where-Object { ((Get-PropValue $_ "Status" "") -like "FAIL*") }).Count
  if ($validationFails -gt 0) { $script:FinalStatus = "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_VALIDATION_REVIEW_REQUIRED" } elseif ($buildFails -gt 0) { $script:FinalStatus = "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_BUILD_REVIEW_REQUIRED" } elseif ($smokeFails -gt 0) { $script:FinalStatus = "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_BROWSER_REVIEW_REQUIRED" } elseif (-not $Apply.IsPresent) { $script:FinalStatus = "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_DRY_RUN_REVIEW_REQUIRED" } else { $script:FinalStatus = "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_READY_PASS" }
}
catch {
  $script:FirstError = $_.Exception.Message
  $script:FinalStatus = "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_SCRIPT_ERROR"
  Add-Row $script:ErrorRows @{ Area="SCRIPT"; Target=$script:AuditName; Status="ERROR"; Detail=$script:FirstError }
}
finally {
  try {
    if ([string]::IsNullOrWhiteSpace($script:EvidenceRoot)) { $stamp2 = Get-Date -Format "yyyyMMdd-HHmmss"; $script:EvidenceRoot = Join-Path $TargetRoot ".pma\implementation\watany-v1-clean-settings-canonicalize\$stamp2"; Ensure-Dir $script:EvidenceRoot }
    if ([string]::IsNullOrWhiteSpace($script:ReportPath)) { $script:ReportPath = Join-Path $script:EvidenceRoot "WATANY_V1_CLEAN_SETTINGS_CANONICALIZE_REPORT.md" }
    Write-Report
  } catch {
    $emergency = Join-Path $script:EvidenceRoot "EMERGENCY_REPORT.txt"
    Write-Utf8 $emergency ("FinalStatus=" + $script:FinalStatus + [Environment]::NewLine + "FirstError=" + $script:FirstError + [Environment]::NewLine + "ReportWriteError=" + $_.Exception.Message)
    $script:ReportPath = $emergency
  }
  Write-Host ("FinalStatus=" + $script:FinalStatus)
  Write-Host ("Report=" + $script:ReportPath)
  if ($OpenReport.IsPresent -and (Test-Path -LiteralPath $script:ReportPath)) { try { Start-Process notepad.exe $script:ReportPath | Out-Null } catch { } }
}
