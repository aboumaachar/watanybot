#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Generate an interactive HTML dashboard from reconstruction reports
#>

param(
    [string]$ReportDir = "$PSScriptRoot\..\..\reconstruction-reports",
    [string]$OutputFile = "$PSScriptRoot\..\..\reconstruction-reports\dashboard.html"
)

$Root = Resolve-Path "$PSScriptRoot\..\.."

# Load all phase reports
$phaseFiles = @(
    @{id=0; file="phase0-audit.json";       name="Audit"},
    @{id=1; file="phase1-foundation.json";  name="Foundation"},
    @{id=2; file="phase2-backend.json";     name="Backend"},
    @{id=3; file="phase3-frontend.json";    name="Frontend"},
    @{id=4; file="phase4-integration.json"; name="Integration"},
    @{id=5; file="phase5-testing.json";     name="Testing"},
    @{id=6; file="phase6-deployment.json";  name="Deployment"},
    @{id=7; file="phase7-monitoring.json";  name="Monitoring"}
)

$phaseData = @()
foreach ($pf in $phaseFiles) {
    $path = Join-Path $ReportDir $pf.file
    if (Test-Path $path) {
        $data = Get-Content $path -Raw | ConvertFrom-Json
        $phaseData += @{ id=$pf.id; name=$pf.name; data=$data }
    } else {
        $phaseData += @{ id=$pf.id; name=$pf.name; data=@{passRate=0; scorePercent=0; status="not-run"; issues=@(); checks=@(); steps=@()} }
    }
}

# Load master report
$masterPath = Join-Path $ReportDir "MASTER_REPORT.json"
$master = if (Test-Path $masterPath) { Get-Content $masterPath -Raw | ConvertFrom-Json } else { @{overallScore=0; criticalIssues=0; warnings=0; duration="N/A"} }

# Build phase scores JSON
$scoresJson = ($phaseData | ForEach-Object {
    $score = 0
    if ($_.data.passRate) { $score = $_.data.passRate }
    elseif ($_.data.scorePercent) { $score = $_.data.scorePercent }
    "{`"id`":$($_.id),`"name`":`"$($_.name)`",`"score`":$score}"
}) -join ","

# Build issues JSON
$issuesJson = "[]"
if ($master.allIssues) {
    $issuesList = $master.allIssues | ForEach-Object {
        $sev = if ($_.severity) { $_.severity } else { "info" }
        $msg = if ($_.msg) { $_.msg -replace '"','\"' } else { "" }
        "{`"severity`":`"$sev`",`"msg`":`"$msg`"}"
    }
    $issuesJson = "[$($issuesList -join ',')]"
}

$overallScore = if ($master.overallScore) { $master.overallScore } else { 0 }
$critCount = if ($master.criticalIssues) { $master.criticalIssues } else { 0 }
$warnCount = if ($master.warnings) { $master.warnings } else { 0 }
$duration = if ($master.duration) { $master.duration } else { "N/A" }

$html = @"
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WatanyBot — Reconstruction Dashboard</title>
<style>
  :root { --bg:#0d1117; --card:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e;
          --green:#3fb950; --yellow:#d29922; --red:#f85149; --blue:#58a6ff; --purple:#bc8cff;
          --cyan:#39d353; --accent:#58a6ff; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',system-ui,sans-serif; background:var(--bg); color:var(--text);
         min-height:100vh; padding:2rem; }
  h1 { text-align:center; font-size:1.8rem; margin-bottom:.5rem; }
  .subtitle { text-align:center; color:var(--muted); margin-bottom:2rem; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem; margin-bottom:2rem; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:1.25rem; }
  .card h3 { font-size:.9rem; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:.75rem; }
  .big-num { font-size:3rem; font-weight:700; line-height:1; }
  .big-num.green { color:var(--green); }
  .big-num.yellow { color:var(--yellow); }
  .big-num.red { color:var(--red); }
  .bar-container { background:#21262d; border-radius:8px; height:28px; overflow:hidden; margin:1rem 0; position:relative; }
  .bar-fill { height:100%; border-radius:8px; transition:width .6s ease; }
  .bar-label { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-weight:600; font-size:.85rem; }
  .phase-row { display:flex; align-items:center; gap:.75rem; padding:.6rem 0; border-bottom:1px solid var(--border); }
  .phase-row:last-child { border-bottom:none; }
  .phase-id { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center;
              font-weight:700; font-size:.8rem; flex-shrink:0; }
  .phase-name { flex:1; font-weight:500; }
  .phase-score { font-weight:700; min-width:45px; text-align:right; }
  .phase-bar { width:120px; height:8px; background:#21262d; border-radius:4px; overflow:hidden; }
  .phase-bar-fill { height:100%; border-radius:4px; }
  .issue { padding:.5rem .75rem; border-radius:6px; margin-bottom:.4rem; font-size:.85rem; }
  .issue.critical { background:#f8514920; border-left:3px solid var(--red); }
  .issue.warning { background:#d2992220; border-left:3px solid var(--yellow); }
  .issue.info { background:#58a6ff15; border-left:3px solid var(--blue); }
  .actions { list-style:none; }
  .actions li { padding:.5rem 0; border-bottom:1px solid var(--border); font-size:.9rem; }
  .actions li:last-child { border-bottom:none; }
  .actions li::before { content:'→ '; color:var(--accent); font-weight:700; }
  .status-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:.75rem; font-weight:600; }
  .badge-pass { background:#3fb95025; color:var(--green); }
  .badge-warn { background:#d2992225; color:var(--yellow); }
  .badge-fail { background:#f8514925; color:var(--red); }
  .timestamp { text-align:center; color:var(--muted); font-size:.8rem; margin-top:2rem; }
</style>
</head>
<body>

<h1>🏗️ WatanyBot Reconstruction Dashboard</h1>
<p class="subtitle">Automated parallel phase execution — Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')</p>

<!-- Summary Cards -->
<div class="grid">
  <div class="card">
    <h3>Overall Readiness</h3>
    <div class="big-num" id="overall-score">$overallScore%</div>
    <div class="bar-container">
      <div class="bar-fill" id="overall-bar" style="width:${overallScore}%;background:var(--green)"></div>
      <div class="bar-label">${overallScore}%</div>
    </div>
  </div>
  <div class="card">
    <h3>Critical Issues</h3>
    <div class="big-num red">$critCount</div>
    <p style="color:var(--muted);margin-top:.5rem">Must fix before production</p>
  </div>
  <div class="card">
    <h3>Warnings</h3>
    <div class="big-num yellow">$warnCount</div>
    <p style="color:var(--muted);margin-top:.5rem">Should address for quality</p>
  </div>
  <div class="card">
    <h3>Execution Time</h3>
    <div class="big-num" style="color:var(--blue)">$duration</div>
    <p style="color:var(--muted);margin-top:.5rem">All phases executed in parallel</p>
  </div>
</div>

<!-- Phase Scores -->
<div class="grid" style="grid-template-columns:1fr 1fr">
  <div class="card">
    <h3>Phase Scores</h3>
    <div id="phase-list"></div>
  </div>
  <div class="card">
    <h3>Issues</h3>
    <div id="issues-list" style="max-height:400px;overflow-y:auto"></div>
  </div>
</div>

<!-- Actions -->
<div class="card" style="max-width:800px;margin:0 auto">
  <h3>Recommended Actions</h3>
  <ul class="actions" id="actions-list">
    $(if ($master.actions) { $master.actions | ForEach-Object { "<li>$_</li>" } } else { "<li>Run the orchestrator first: .\reconstruct.ps1</li>" })
  </ul>
</div>

<p class="timestamp">Generated by WatanyBot Reconstruction Orchestrator • $duration</p>

<script>
const phases = [$scoresJson];
const issues = $issuesJson;
const overall = $overallScore;

// Color score
const el = document.getElementById('overall-score');
const bar = document.getElementById('overall-bar');
if (overall >= 80) { el.className='big-num green'; bar.style.background='var(--green)'; }
else if (overall >= 50) { el.className='big-num yellow'; bar.style.background='var(--yellow)'; }
else { el.className='big-num red'; bar.style.background='var(--red)'; }

// Phase list
const colors = ['#58a6ff','#d29922','#3fb950','#bc8cff','#79c0ff','#39d353','#f0883e','#56d364'];
const phaseList = document.getElementById('phase-list');
phases.forEach((p,i) => {
  const c = p.score>=80?'var(--green)':p.score>=50?'var(--yellow)':'var(--red)';
  phaseList.innerHTML += '<div class="phase-row">' +
    '<div class="phase-id" style="background:'+colors[i%8]+'30;color:'+colors[i%8]+'">'+p.id+'</div>' +
    '<div class="phase-name">'+p.name+'</div>' +
    '<div class="phase-bar"><div class="phase-bar-fill" style="width:'+p.score+'%;background:'+c+'"></div></div>' +
    '<div class="phase-score" style="color:'+c+'">'+p.score+'%</div>' +
    '</div>';
});

// Issues
const issueList = document.getElementById('issues-list');
issues.forEach(i => {
  issueList.innerHTML += '<div class="issue '+i.severity+'">'+i.msg+'</div>';
});
if (issues.length===0) issueList.innerHTML='<p style="color:var(--muted)">No issues found — run the orchestrator first.</p>';
</script>
</body>
</html>
"@

New-Item -ItemType Directory -Force -Path (Split-Path $OutputFile) | Out-Null
$html | Set-Content -Path $OutputFile -Encoding UTF8

Write-Host "Dashboard generated: $OutputFile" -ForegroundColor Green
return $OutputFile
