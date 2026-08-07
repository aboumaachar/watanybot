# watany_app_doctor.ps1
# Purpose: Inspect current Watany app settings/config + KB presence + KB loader wiring
# Output: reports\watany_app_doctor_<timestamp>.md + .json
# Safe: read-only (no edits)

param(
  [string]$RepoPath = (Get-Location).Path,
  [switch]$DeepScan,
  [switch]$RunCommands,
  [int]$CmdTimeoutSec = 300,
  [int]$MaxMatchLines = 250
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function NowStamp(){ (Get-Date).ToString("yyyyMMdd_HHmmss") }
function New-DirSafe($p){ if(-not(Test-Path $p)){ New-Item -ItemType Directory -Path $p | Out-Null } }
function Read-TextSafe($p){ try { Get-Content -Raw -LiteralPath $p -ErrorAction Stop } catch { "" } }

function Invoke-NativeCommand {
  param([string]$Cmd,[string]$WorkDir,[int]$TimeoutSec = 0)
  $start = Get-Date
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/c $Cmd"
  $psi.WorkingDirectory = $WorkDir
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $null = $p.Start()

  if ($TimeoutSec -gt 0) {
    if (-not $p.WaitForExit($TimeoutSec*1000)) {
      try { $p.Kill() } catch {}
      return [pscustomobject]@{
        cmd=$Cmd; ok=$false; exitCode=$null; timedOut=$true
        stdout=""; stderr="Timed out after $TimeoutSec sec"
        durationSec=[math]::Round(((Get-Date)-$start).TotalSeconds,2)
      }
    }
  } else { $p.WaitForExit() }

  $stdout = $p.StandardOutput.ReadToEnd()
  $stderr = $p.StandardError.ReadToEnd()
  $exit   = $p.ExitCode
  [pscustomobject]@{
    cmd=$Cmd; ok=($exit -eq 0); exitCode=$exit; timedOut=$false
    stdout=$stdout; stderr=$stderr
    durationSec=[math]::Round(((Get-Date)-$start).TotalSeconds,2)
  }
}

function ConvertFrom-EnvFile($path){
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  foreach($ln in (Get-Content -LiteralPath $path -ErrorAction SilentlyContinue)){
    $t = $ln.Trim()
    if(-not $t -or $t.StartsWith("#")){ continue }
    $idx = $t.IndexOf("=")
    if($idx -lt 1){ continue }
    $k = $t.Substring(0,$idx).Trim()
    $v = $t.Substring($idx+1).Trim()
    $map[$k] = $v
  }
  return $map
}

function Find-PackageJsons($root){
  Get-ChildItem -Path $root -Recurse -File -Filter "package.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\dist\\' -and $_.FullName -notmatch '\\build\\' } |
    Sort-Object FullName
}

function Get-PackageManager($root){
  if (Test-Path (Join-Path $root "pnpm-lock.yaml")) { return "pnpm" }
  if (Test-Path (Join-Path $root "yarn.lock")) { return "yarn" }
  if (Test-Path (Join-Path $root "package-lock.json")) { return "npm" }
  return "npm"
}

function Read-JsonSafe($p){
  try { (Get-Content -Raw -LiteralPath $p -ErrorAction Stop) | ConvertFrom-Json } catch { $null }
}

function Get-EnvKeysUsed($root){
  $keys = New-Object System.Collections.Generic.HashSet[string]
  $patterns = @(
    'import\.meta\.env\.([A-Z0-9_]+)',
    'process\.env\.([A-Z0-9_]+)'
  )
  $files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\dist\\' -and $_.FullName -notmatch '\\build\\' }
  foreach($f in $files){
    $txt = Read-TextSafe $f.FullName
    if(-not $txt){ continue }
    foreach($pat in $patterns){
      foreach($m in [regex]::Matches($txt,$pat)){
        $k = $m.Groups[1].Value
        if($k){ $null = $keys.Add($k) }
      }
    }
  }
  ($keys | Sort-Object)
}

function Find-KBArtifacts($root){
  $patterns = @("*.sqlite","*.db","*.jsonl","*.csv","*.xlsx","*.yml","*.yaml")
  $files = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\dist\\' -and $_.FullName -notmatch '\\build\\' }
  $hits = @()
  foreach($f in $files){
    foreach($p in $patterns){
      if($f.Name -like $p){
        if($f.Name -match 'watany|watan|kb|rag|daleel|retired|military|salary|salaries|defense|law|mof|laf' -or
           $f.FullName -match '\\kb\\|\\data\\|\\doc\\|\\docs\\|\\inputs\\|\\assets\\|\\public\\'){
          $hits += $f
        }
        break
      }
    }
  }
  $hits | Sort-Object FullName -Unique
}

function Get-PythonExe(){
  if (Get-Command python -ErrorAction SilentlyContinue) { return (Get-Command python).Source }
  if (Get-Command py -ErrorAction SilentlyContinue) { return (Get-Command py).Source }
  return $null
}

function Test-Sqlite($sqlitePath){
  $py = Get-PythonExe
  if(-not $py){
    return [pscustomobject]@{ ok=$false; method="python_missing"; details="Python missing; skip sqlite deep checks"; tables=@(); counts=@{} }
  }
  $code = @"
import sqlite3, json, sys
p=sys.argv[1]
out={"ok":True,"tables":[],"counts":{},"errors":[]}
try:
  con=sqlite3.connect(p)
  cur=con.cursor()
  cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
  out["tables"]=[r[0] for r in cur.fetchall()]
  for t in out["tables"]:
    try:
      cur.execute(f"SELECT COUNT(1) FROM {t}")
      out["counts"][t]=cur.fetchone()[0]
    except Exception as e:
      out["errors"].append(f"count_failed:{t}:{e}")
  con.close()
except Exception as e:
  out["ok"]=False
  out["errors"].append(str(e))
print(json.dumps(out, ensure_ascii=False))
"@
  $tmp = Join-Path $env:TEMP ("watany_sqlite_check_" + (Get-Date -Format "yyyyMMddHHmmss") + ".py")
  Set-Content -Path $tmp -Value $code -Encoding utf8
  $cmd = if($py.ToLower().EndsWith("py.exe")) { "`"$py`" -3 `"$tmp`" `"$sqlitePath`"" } else { "`"$py`" `"$tmp`" `"$sqlitePath`"" }
  $res = Invoke-NativeCommand $cmd $RepoPath 120
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue | Out-Null
  if(-not $res.ok){ return [pscustomobject]@{ ok=$false; method="python"; details="sqlite check failed"; raw=$res.stderr } }
  try { return ($res.stdout.Trim() | ConvertFrom-Json) } catch { return [pscustomobject]@{ ok=$false; raw=$res.stdout } }
}

function Test-Jsonl($jsonlPath,[int]$MaxLines=3000){
  $py = Get-PythonExe
  if(-not $py){
    return [pscustomobject]@{ ok=$false; method="python_missing"; details="Python missing; skip jsonl deep checks" }
  }
  $code=@"
import json, sys
p=sys.argv[1]
mx=int(sys.argv[2])
lines=valid=invalid=0
bad=[]
with open(p,'r',encoding='utf-8',errors='ignore') as f:
  for ln in f:
    ln=ln.strip()
    if not ln: 
      continue
    lines += 1
    try:
      json.loads(ln)
      valid += 1
    except Exception:
      invalid += 1
      if len(bad)<3: bad.append(ln[:200])
    if lines>=mx: break
out={"ok": invalid==0 and valid>0, "lines_checked":lines, "valid":valid, "invalid":invalid, "bad_examples":bad}
print(json.dumps(out, ensure_ascii=False))
"@
  $tmp = Join-Path $env:TEMP ("watany_jsonl_check_" + (Get-Date -Format "yyyyMMddHHmmss") + ".py")
  Set-Content -Path $tmp -Value $code -Encoding utf8
  $cmd = if($py.ToLower().EndsWith("py.exe")) { "`"$py`" -3 `"$tmp`" `"$jsonlPath`" $MaxLines" } else { "`"$py`" `"$tmp`" `"$jsonlPath`" $MaxLines" }
  $res = Invoke-NativeCommand $cmd $RepoPath 120
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue | Out-Null
  if(-not $res.ok){ return [pscustomobject]@{ ok=$false; method="python"; details="jsonl check failed"; raw=$res.stderr } }
  try { return ($res.stdout.Trim() | ConvertFrom-Json) } catch { return [pscustomobject]@{ ok=$false; raw=$res.stdout } }
}

function Search-KBLoaderSignals($root){
  $signals = @(
    "kb", "rag", "jsonl", "sqlite", "better-sqlite3", "sqlite3", "drizzle", "prisma",
    "fs.readFile", "readFileSync", "createReadStream", "path.join",
    "KB_PATH", "KB_SQLITE", "KB_DB", "RAG_JSONL", "VECTOR", "EMBED", "SUPABASE", "OPENAI"
  )
  $files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.mjs,*.cjs -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\dist\\' -and $_.FullName -notmatch '\\build\\' }
  $matches = @()
  foreach($s in $signals){
    $m = Select-String -Path $files.FullName -Pattern $s -SimpleMatch -ErrorAction SilentlyContinue
    foreach($hit in $m){
      $matches += [pscustomobject]@{
        signal=$s
        file=$hit.Path
        line=$hit.LineNumber
        text=($hit.Line.Trim())
      }
      if($matches.Count -ge $MaxMatchLines){ break }
    }
    if($matches.Count -ge $MaxMatchLines){ break }
  }
  $matches
}

function Get-Framework($pkgJson){
  if(-not $pkgJson){ return "unknown" }
  $deps = @{}
  foreach($k in @("dependencies","devDependencies")){
    if($pkgJson.$k){
      $pkgJson.$k.PSObject.Properties | ForEach-Object { $deps[$_.Name] = $_.Value }
    }
  }
  if($deps.ContainsKey("next")){ return "nextjs" }
  if($deps.ContainsKey("vite")){ return "vite" }
  if($deps.ContainsKey("react-scripts")){ return "cra" }
  if($deps.ContainsKey("electron")){ return "electron" }
  return "unknown"
}

# ----------------------------
# Start
# ----------------------------
$stamp = NowStamp
$RepoPath = (Resolve-Path $RepoPath).Path

$reportsDir = Join-Path $RepoPath "reports"
New-DirSafe $reportsDir

$mdPath = Join-Path $reportsDir ("watany_app_doctor_" + $stamp + ".md")
$jsonPath = Join-Path $reportsDir ("watany_app_doctor_" + $stamp + ".json")

Write-Host "RepoPath: $RepoPath"
Write-Host "DeepScan: $DeepScan | RunCommands: $RunCommands"

# Collect system/tooling
$sys = [pscustomobject]@{
  time = (Get-Date).ToString("s")
  os = (Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture)
  ps = $PSVersionTable.PSVersion.ToString()
  user = $env:USERNAME
  node = (Invoke-NativeCommand "node -v" $RepoPath 30)
  npm  = (Invoke-NativeCommand "npm -v"  $RepoPath 30)
  pnpm = (Invoke-NativeCommand "pnpm -v" $RepoPath 30)
  yarn = (Invoke-NativeCommand "yarn -v" $RepoPath 30)
  python = (Get-PythonExe)
}

$pm = Get-PackageManager $RepoPath

# Project structure
$pkgs = Find-PackageJsons $RepoPath
$pkgInfos = @()
foreach($p in $pkgs){
  $j = Read-JsonSafe $p.FullName
  $pkgInfos += [pscustomobject]@{
    path = $p.FullName
    name = $j.name
    version = $j.version
    private = $j.private
    framework = (Get-Framework $j)
    scripts = if($j.scripts){ ($j.scripts.PSObject.Properties.Name | Sort-Object) } else { @() }
    deps_count = (
      (@($j.dependencies.PSObject.Properties).Count) + (@($j.devDependencies.PSObject.Properties).Count)
    )
  }
}

# Env
$envFiles = @(".env",".env.local",".env.development",".env.production",".env.test",".env.example") |
  ForEach-Object { Join-Path $RepoPath $_ } | Where-Object { Test-Path $_ }

$envMaps = @{}
foreach($f in $envFiles){
  $envMaps[(Split-Path $f -Leaf)] = ConvertFrom-EnvFile $f
}

$envKeysUsed = Get-EnvKeysUsed $RepoPath
$providedKeys = New-Object System.Collections.Generic.HashSet[string]
foreach($m in $envMaps.Values){
  foreach($k in $m.Keys){ $null = $providedKeys.Add($k) }
}
$missingEnv = @()
foreach($k in $envKeysUsed){
  if(-not $providedKeys.Contains($k)){ $missingEnv += $k }
}

# KB artifacts
$kbFiles = Find-KBArtifacts $RepoPath |
  Select-Object FullName, Length, LastWriteTime

$bestSqlite = $kbFiles | Where-Object { $_.FullName -match '\.(sqlite|db)$' } | Sort-Object Length -Descending | Select-Object -First 1
$bestJsonl  = $kbFiles | Where-Object { $_.FullName -match '\.jsonl$' } | Sort-Object Length -Descending | Select-Object -First 1

$sqliteCheck = $null
$jsonlCheck  = $null
if($bestSqlite){ $sqliteCheck = Test-Sqlite $bestSqlite.FullName }
if($bestJsonl){ $jsonlCheck  = Test-Jsonl  $bestJsonl.FullName 3000 }

# Signals in code: where KB is being loaded from
$signals = Search-KBLoaderSignals $RepoPath

# Heuristics: common reasons KB fails to load
$diagnosis = New-Object System.Collections.Generic.List[object]

# 1) Missing env keys used in code
if($missingEnv.Count -gt 0){
  $diagnosis.Add([pscustomobject]@{
    issue = "Missing environment variables used in code"
    severity = "HIGH"
    details = ($missingEnv -join ", ")
    fix_hint = "Create .env.local with these keys (or fix code to use existing keys), then restart dev server."
  })
}

# 2) No KB files found
if(-not $bestSqlite -and -not $bestJsonl){
  $diagnosis.Add([pscustomobject]@{
    issue = "No KB artifact found (sqlite/jsonl)"
    severity = "HIGH"
    details = "Script did not find any KB files in repo (or they are outside repo)."
    fix_hint = "Place KB in repo under /kb or /data and wire path via env (KB_SQLITE_PATH / RAG_JSONL_PATH), or update loader."
  })
}

# 3) SQLite exists but schema looks empty / wrong
if($bestSqlite -and $sqliteCheck){
  $tcount = @($sqliteCheck.tables).Count
  if(-not $sqliteCheck.ok -or $tcount -lt 2){
    $diagnosis.Add([pscustomobject]@{
      issue = "SQLite KB exists but validation indicates schema or access issue"
      severity = "HIGH"
      details = "tables=$tcount, ok=$($sqliteCheck.ok)"
      fix_hint = "Confirm the app points to THIS sqlite file path, and that file is readable by runtime. Check Windows path vs relative path."
    })
  }
}

# 4) JSONL exists but invalid
if($bestJsonl -and $jsonlCheck -and -not $jsonlCheck.ok){
  $diagnosis.Add([pscustomobject]@{
    issue = "RAG JSONL has invalid lines"
    severity = "MED"
    details = "invalid=$($jsonlCheck.invalid), sample=$($jsonlCheck.bad_examples -join ' | ')"
    fix_hint = "Regenerate JSONL or fix encoding/line breaks."
  })
}

# 5) Frontend reading filesystem directly (common Vite/Cra issue)
$fsHits = $signals | Where-Object { $_.signal -in @("fs.readFile","readFileSync","createReadStream") }
if($fsHits.Count -gt 0){
  $diagnosis.Add([pscustomobject]@{
    issue = "Code references filesystem reads (fs.*). This will fail in browser-only builds."
    severity = "HIGH"
    details = "Found fs usage in code. If this is used in client bundle, KB load will fail."
    fix_hint = "Move KB loading to backend/API route (Node server) or use server-side Next route; client should call API."
  })
}

# 6) Path-like env vars that might be wrong
$pathLikeKeys = @("KB_PATH","KB_SQLITE_PATH","KB_DB_PATH","RAG_JSONL_PATH","KB_FILE","KB_SQLITE","RAG_FILE","DATA_DIR")
$pathProblems = @()
foreach($fileName in $envMaps.Keys){
  $m = $envMaps[$fileName]
  foreach($k in $pathLikeKeys){
    if($m.ContainsKey($k)){
      $v = $m[$k]
      if($v){
        $candidate = $v
        # handle quotes
        $candidate = $candidate.Trim('"').Trim("'")
        $resolved = $candidate
        if(-not ([System.IO.Path]::IsPathRooted($resolved))){
          $resolved = (Join-Path $RepoPath $resolved)
        }
        if(-not (Test-Path $resolved)){
          $pathProblems += [pscustomobject]@{ env_file=$fileName; key=$k; value=$v; resolved=$resolved; exists=$false }
        }
      }
    }
  }
}
if($pathProblems.Count -gt 0){
  $diagnosis.Add([pscustomobject]@{
    issue="KB path env vars point to missing files"
    severity="HIGH"
    details=($pathProblems | ForEach-Object { "$($_.env_file):$($_.key) -> $($_.value)" }) -join " ; "
    fix_hint="Update path env vars to correct location of KB files (absolute or repo-relative), then restart app."
  })
}

# Optionally run commands
$cmdResults = @()
if($RunCommands -and $pkgs.Count -gt 0){
  $rootPkg = $pkgs | Sort-Object FullName | Select-Object -First 1
  $rootDir = Split-Path $rootPkg.FullName -Parent
  $rootJson = Read-JsonSafe $rootPkg.FullName
  $scripts = @()
  if($rootJson -and $rootJson.scripts){
    $scripts = $rootJson.scripts.PSObject.Properties.Name
  }

  function RunIfScript($name){
    if($scripts -contains $name){
      switch($pm){
        "pnpm" { $cmdResults += (Invoke-NativeCommand "pnpm run $name" $rootDir $CmdTimeoutSec) }
        "yarn" { $cmdResults += (Invoke-NativeCommand "yarn $name" $rootDir $CmdTimeoutSec) }
        default { $cmdResults += (Invoke-NativeCommand "npm run $name" $rootDir $CmdTimeoutSec) }
      }
    }
  }

  RunIfScript "typecheck"
  RunIfScript "lint"
  RunIfScript "test"
  RunIfScript "build"
}

# Compose report objects
$reportObj = [pscustomobject]@{
  timestamp = $stamp
  repoPath = $RepoPath
  packageManager = $pm
  system = $sys
  packageJsons = $pkgInfos
  envFiles = $envFiles
  envKeysUsed = $envKeysUsed
  envMissing = $missingEnv
  envPathProblems = $pathProblems
  kbFiles = $kbFiles
  bestSqlite = $bestSqlite
  bestJsonl = $bestJsonl
  sqliteCheck = $sqliteCheck
  jsonlCheck = $jsonlCheck
  codeSignals = $signals
  diagnosis = $diagnosis
  commands = $cmdResults
}

# Write Markdown
$md = @()
$md += "# Watany App Doctor Report"
$md += ""
$md += "**Timestamp:** $stamp"
$md += "**Repo:** $RepoPath"
$md += ""
$md += "## Tooling"
$md += "- Node: " + ($(if($sys.node.ok){$sys.node.stdout.Trim()}else{"MISSING"}))
$md += "- npm : " + ($(if($sys.npm.ok){$sys.npm.stdout.Trim()}else{"MISSING"}))
$md += "- pnpm: " + ($(if($sys.pnpm.ok){$sys.pnpm.stdout.Trim()}else{"MISSING"}))
$md += "- yarn: " + ($(if($sys.yarn.ok){$sys.yarn.stdout.Trim()}else{"MISSING"}))
$md += "- Python: " + ($(if($sys.python){$sys.python}else{"MISSING"}))
$md += "- Package Manager detected: **$pm**"
$md += ""
$md += "## package.json inventory"
foreach($pi in $pkgInfos){
  $md += "- $($pi.path)"
  $md += "  - name: $($pi.name) | framework: $($pi.framework) | scripts: $($pi.scripts -join ', ')"
}
$md += ""
$md += "## Environment"
$md += "- Env files found: " + ($(if($envFiles){($envFiles | ForEach-Object { Split-Path $_ -Leaf }) -join ", "}else{"(none)"}))
$md += "- Env keys used in code (detected): " + ($(if($envKeysUsed){$envKeysUsed -join ", "}else{"(none)"}))
$md += "- Missing keys (used but not provided): " + ($(if($missingEnv.Count -gt 0){$missingEnv -join ", "}else{"(none)"}))
if($pathProblems.Count -gt 0){
  $md += ""
  $md += "### Env path problems"
  foreach($pp in $pathProblems){
    $md += "- $($pp.env_file) :: $($pp.key) = $($pp.value) -> resolved: $($pp.resolved) (missing)"
  }
}
$md += ""
$md += "## KB Artifacts found"
if($kbFiles.Count -gt 0){
  foreach($k in $kbFiles){
    $md += "- $($k.FullName) | $([math]::Round($k.Length/1KB,1)) KB | $($k.LastWriteTime)"
  }
} else {
  $md += "- (none found)"
}
$md += ""
$md += "## SQLite check"
if($bestSqlite){
  $md += "- File: $($bestSqlite.FullName)"
  if($sqliteCheck){
    $md += "- ok: $($sqliteCheck.ok)"
    $md += "- tables: " + ($(if($sqliteCheck.tables){$sqliteCheck.tables -join ", "}else{"(none)"}))
  }
} else { $md += "- (no sqlite detected)" }

$md += ""
$md += "## JSONL check"
if($bestJsonl){
  $md += "- File: $($bestJsonl.FullName)"
  if($jsonlCheck){
    $md += "- ok: $($jsonlCheck.ok) | lines_checked: $($jsonlCheck.lines_checked) | invalid: $($jsonlCheck.invalid)"
  }
} else { $md += "- (no jsonl detected)" }

$md += ""
$md += "## KB loader signals in code (top matches)"
if($signals.Count -gt 0){
  foreach($s in ($signals | Select-Object -First $MaxMatchLines)){
    $md += "- [$($s.signal)] $($s.file):$($s.line) :: $($s.text)"
  }
} else {
  $md += "- (no signals found — or repo is large; try -DeepScan)"
}

$md += ""
$md += "## Diagnosis (most likely causes of 'KB not loading')"
if($diagnosis.Count -gt 0){
  foreach($d in $diagnosis){
    $md += "- **[$($d.severity)]** $($d.issue)"
    $md += "  - Details: $($d.details)"
    $md += "  - Fix hint: $($d.fix_hint)"
  }
} else {
  $md += "- No obvious blockers detected by heuristics."
}

$md += ""
$md += "## Commands run"
if($cmdResults.Count -gt 0){
  foreach($c in $cmdResults){
    $md += "- `$($c.cmd)` => ok=$($c.ok) exit=$($c.exitCode) duration=$($c.durationSec)s"
    if(-not $c.ok){
      $err = ($c.stderr -replace "`r","" -split "`n" | Select-Object -First 20) -join " | "
      $md += "  - stderr(first20): $err"
    }
  }
} else {
  $md += "- (none)"
}

Set-Content -Path $mdPath -Value ($md -join "`n") -Encoding utf8
($reportObj | ConvertTo-Json -Depth 10) | Set-Content -Path $jsonPath -Encoding utf8

Write-Host ""
Write-Host "DONE ✅" -ForegroundColor Green
Write-Host "Report:" -ForegroundColor Cyan
Write-Host " - $mdPath"
Write-Host " - $jsonPath"
Write-Host ""
Write-Host "Next: paste the 'Diagnosis' section + the first 30 KB loader signal lines here, and I’ll give you an exact fix patch for your KB loader." -ForegroundColor Yellow
