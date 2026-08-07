<#
.SYNOPSIS
  APEX-WATANY-PMA-SECOND-TWO-PHASE

.DESCRIPTION
  Canonical two-phase PMA Second runner for the WatanyBot workspace.

  Phase Audit:
    Read-only inspection of the actual workspace.
    Produces .pma/audit/watany-phase1/

  Phase Implement:
    Reads Phase 1 findings and creates safe implementation planning artifacts.
    It does not blindly patch code.

  Phase Full:
    Runs Audit, then Implement.

.EXAMPLES
  powershell -NoProfile -ExecutionPolicy Bypass -File "C:\pma-runner\scripts\APEX-WATANY-PMA-SECOND-TWO-PHASE.ps1" -ProjectRoot "C:\xampp\htdocs\projectx\watanybot" -Phase Audit

  powershell -NoProfile -ExecutionPolicy Bypass -File "C:\pma-runner\scripts\APEX-WATANY-PMA-SECOND-TWO-PHASE.ps1" -ProjectRoot "C:\xampp\htdocs\projectx\watanybot" -Phase Full -OpenReport
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [ValidateSet("Audit","Implement","Full")]
  [string]$Phase = "Audit",
  [switch]$OpenReport
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

function Write-Utf8Bom([string]$Path,[string]$Content){
  $dir = Split-Path -Parent $Path
  if($dir -and -not(Test-Path $dir)){ New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $enc = New-Object System.Text.UTF8Encoding($true)
  [System.IO.File]::WriteAllText($Path,$Content,$enc)
}
function Add-Line($List,[string]$Line=""){ $List.Add($Line) | Out-Null }
function RelPath([string]$Path,[string]$Root){
  if([string]::IsNullOrWhiteSpace($Path)){ return "" }
  try{
    $r=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
    $p=[IO.Path]::GetFullPath($Path)
    if($p.StartsWith($r,[StringComparison]::OrdinalIgnoreCase)){ return $p.Substring($r.Length).TrimStart('\','/') }
  }catch{}
  return $Path
}
function Get-TextFiles([string]$Root){
  $exclude=@("\node_modules\","\.git\","\.next\","\dist\","\build\","\.pma\quarantine\")
  $exts=@(".ts",".tsx",".js",".jsx",".json",".md",".txt",".html",".css",".scss",".yml",".yaml",".py",".sql",".prisma",".env",".example")
  Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
    $p=$_.FullName; $ok=$true
    foreach($frag in $exclude){ if($p.IndexOf($frag,[StringComparison]::OrdinalIgnoreCase) -ge 0){$ok=$false;break} }
    $ok -and ($exts -contains $_.Extension.ToLowerInvariant()) -and $_.Length -lt 3000000
  }
}
function Get-WorkspaceFiles([string]$Root){
  $dirs=New-Object System.Collections.Generic.Stack[string]
  $dirs.Push([IO.Path]::GetFullPath($Root))
  $files=New-Object System.Collections.Generic.List[System.IO.FileInfo]
  $skipDirNames=@("node_modules",".git",".next","dist","build","quarantine",".venv","venv","__pycache__",".pma",".apex",".apex-backups","_apex_backups","apex-reports","backups",".snapshots")
  while($dirs.Count -gt 0){
    $dir=$dirs.Pop()
    try{
      foreach($subdir in (Get-ChildItem -LiteralPath $dir -Directory -ErrorAction SilentlyContinue)){
        if($skipDirNames -contains $subdir.Name){ continue }
        if($subdir.FullName -match "\\.pma\\quarantine($|\\)"){ continue }
        if($subdir.FullName -match '\\watany_kb\\tmp($|\\)'){ continue }
        if($subdir.FullName -match '\\kb_studio\\runtime($|\\)'){ continue }
        if($subdir.FullName -match '\\temp_patch\d*($|\\)'){ continue }
        $dirs.Push($subdir.FullName)
      }
      foreach($file in (Get-ChildItem -LiteralPath $dir -File -ErrorAction SilentlyContinue)){
        $files.Add($file) | Out-Null
      }
    }catch{}
  }
  return $files
}
function Count-Hits($Files,[string]$Pattern){
  try{
    $paths=@($Files | ForEach-Object { $_.FullName })
    if(-not $paths -or $paths.Count -eq 0){ return 0 }
    $matches=Select-String -Path $paths -Pattern $Pattern -CaseSensitive:$false -ErrorAction SilentlyContinue
    if($matches){ return ($matches | Measure-Object).Count }
  }catch{}
  return 0
}
function Find-HitFiles($Files,[string]$Pattern,[string]$Root,[int]$Max=8){
  $out=New-Object System.Collections.Generic.List[string]
  try{
    $paths=@($Files | ForEach-Object { $_.FullName })
    if(-not $paths -or $paths.Count -eq 0){ return "" }
    $matches=Select-String -Path $paths -Pattern $Pattern -CaseSensitive:$false -ErrorAction SilentlyContinue
    if($matches){
      $uniquePaths=$matches | Select-Object -ExpandProperty Path -Unique | Select-Object -First $Max
      foreach($path in $uniquePaths){ Add-Line $out (RelPath $path $Root) }
    }
  }catch{}
  return ($out -join "; ")
}
function Get-ExampleFileRank([string]$Path){
  $normalized=$Path.Replace('/','\\')
  $extension=[IO.Path]::GetExtension($normalized).ToLowerInvariant()
  if($normalized -match '^(\.apex|\.apex-backups|_apex_backups|apex-reports|backups|temp_patch\d*|watany_kb\\tmp|kb_studio\\runtime|legacy|archive|\.snapshots)\\'){ return 90 }
  if($normalized -match '(^|\\)(tests?|__tests__|specs?|fixtures)\\' -or $normalized -match '\.(test|spec)\.(ts|tsx|js|jsx|py)$'){ return 70 }
  if(($normalized -match '^(apps|packages)\\') -and ($normalized -match '(^|\\)(src|app|apps\\api|pages|components|routes|routers|store|lib|types|pwa|themes)\\') -and (@('.ts','.tsx','.js','.jsx','.py') -contains $extension)){ return 0 }
  if(($normalized -match '^(apps|packages)\\') -and ($normalized -match '(^|\\)(src|app|apps\\api|pages|components|routes|routers|store|lib|types|pwa|themes)\\') -and (@('.css','.scss') -contains $extension)){ return 1 }
  if(($normalized -match '^(apps|packages)\\') -and (@('.ts','.tsx','.js','.jsx','.py') -contains $extension)){ return 2 }
  if($normalized -match '^(apps|packages)\\[^\\]+\\(public|docs|data|tests?|scripts)\\'){ return 5 }
  if(@('.env','.example','.json','.md','.txt','.html','.yml','.yaml','.sql','.prisma') -contains $extension){ return 6 }
  if(($normalized -match '^(scripts|tools)\\') -and (@('.ts','.tsx','.js','.jsx','.py') -contains $extension)){ return 7 }
  if($normalized -match '^(docs|pma|reports)\\'){ return 8 }
  return 9
}
function Build-PatternIndex($Files,[string[]]$Patterns,[string]$Root,[int]$Max=8){
  $index=@{}
  $patternHits=@{}
  foreach($pattern in $Patterns){
    if(-not $index.ContainsKey($pattern)){
      $index[$pattern]=[pscustomobject]@{ Count = 0; Files = (New-Object System.Collections.Generic.List[string]); AllFiles = (New-Object System.Collections.Generic.List[string]) }
    }
    if(-not $patternHits.ContainsKey($pattern)){
      $patternHits[$pattern]=New-Object System.Collections.Generic.List[string]
    }
  }
  try{
    $paths=@($Files | ForEach-Object { $_.FullName })
    if($paths -and $paths.Count -gt 0){
      $matches=Select-String -Path $paths -Pattern $Patterns -CaseSensitive:$false -ErrorAction SilentlyContinue
      foreach($match in $matches){
        $pattern=$match.Pattern
        if(-not $index.ContainsKey($pattern)){ continue }
        $entry=$index[$pattern]
        $entry.Count++
        $rel=RelPath $match.Path $Root
        if(-not ($patternHits[$pattern] -contains $rel)){
          Add-Line $patternHits[$pattern] $rel
        }
      }
    }
  }catch{}
  foreach($pattern in $Patterns){
    if(-not $index.ContainsKey($pattern)){ continue }
    $sortedHits=@(
      $patternHits[$pattern] |
        Sort-Object -Property @(
          @{ Expression = { Get-ExampleFileRank $_ }; Ascending = $true },
          @{ Expression = { $_ }; Ascending = $true }
        )
    )
    foreach($rel in $sortedHits){
      Add-Line $index[$pattern].AllFiles $rel
    }
    $preferred=@(
      $sortedHits |
        Select-Object -First $Max
    )
    foreach($rel in $preferred){
      Add-Line $index[$pattern].Files $rel
    }
  }
  return $index
}
function Get-Status([int]$Hits,[string]$Feature){
  if($Hits -le 0){ return "MISSING" }
  if($Feature -match "Voting|groups|message reactions|reply/quote|delete-for-me|typing indicators|read receipts|death crawlers|TV integrations"){ if($Hits -lt 5){ return "UNVERIFIED" } }
  if($Feature -match "document ingestion pipeline|OCR|upload"){ return "PARTIAL" }
  return "BUILT_OR_PRESENT_NEEDS_REVIEW"
}

function Get-WatExamplePatterns([string]$WatId){
  switch($WatId){
    "WAT-002" {
      return @(
        'apps\\web-user\\src\\components\\sheets\\DirectorySheet\.tsx$',
        'apps\\web-user\\src\\components\\PensionAttestationForm\.tsx$',
        'apps\\gateway-api\\src\\hybrid\\cta-generator\.ts$',
        'apps\\web-user\\src\\lib\\service-catalog\.ts$',
        'apps\\web-user\\src\\components\\(ChatScreen|HomeScreen|DecisionTree)\.tsx$',
        'apps\\web-user\\src\\pages\\FaqPage\.tsx$'
      )
    }
    "WAT-008" {
      return @(
        'apps\\web-user\\src\\components\\chat\\whatsapp\\WhatsAppChatShell\.tsx$',
        'apps\\web-user\\src\\components\\chat\\whatsapp\\whatsapp-chat\.css$',
        'apps\\web-user\\src\\store\\app\.tsx$',
        'apps\\web-user\\src\\components\\ChatScreen\.tsx$',
        'apps\\web-admin\\src\\pages\\ChatMonitorPage\.tsx$'
      )
    }
    "WAT-012" {
      return @(
        'apps\\gateway-api\\src\\auth\\otp-routes\.ts$',
        'apps\\gateway-api\\src\\auth\\sms\.ts$',
        'apps\\web-user\\src\\pages\\LoginPage\.tsx$',
        'apps\\web-user\\src\\lib\\auth\.ts$',
        'apps\\web-user\\src\\styles\\mobile\.css$'
      )
    }
    "WAT-015" {
      return @(
        'apps\\api-backend\\scripts\\rebuild_from_kb_studio_export\.py$',
        'apps\\api-backend\\scripts\\rebuild_full_procedures_kb\.py$',
        'build_watany_kb_v4\.py$',
        'rebuild_kb(?:_complete)?\.py$',
        'scripts\\ocr_tif_to_docx\.py$',
        'arabic_ocr_proofreader\.py$'
      )
    }
    "WAT-016" {
      return @(
        'apps\\web-user\\src\\pages\\ProfilePage\.tsx$',
        'apps\\web-user\\src\\store\\app\.tsx$',
        'apps\\web-user\\src\\lib\\service-catalog\.ts$',
        'apps\\web-user\\src\\lib\\mofCaseVariants\.ts$',
        'apps\\web-user\\src\\pages\\LoginPage\.tsx$'
      )
    }
    default {
      return @()
    }
  }
}

function Get-WatExampleAnchorRank([string]$WatId,[string]$Path){
  $patterns=Get-WatExamplePatterns $WatId
  if(-not $patterns -or $patterns.Count -eq 0){ return 100 }
  for($i=0; $i -lt $patterns.Count; $i++){
    if($Path -match $patterns[$i]){ return $i }
  }
  return 100
}

function Select-WatExampleFiles([string]$WatId,$Files,[int]$Max=8){
  $items=@($Files)
  if(-not $items -or $items.Count -eq 0){ return @() }
  $patterns=Get-WatExamplePatterns $WatId
  if(-not $patterns -or $patterns.Count -eq 0){
    return @($items | Select-Object -First $Max)
  }
  return @(
    $items |
      Sort-Object -Property @(
        @{ Expression = { Get-WatExampleAnchorRank -WatId $WatId -Path $_ }; Ascending = $true },
        @{ Expression = { Get-ExampleFileRank $_ }; Ascending = $true },
        @{ Expression = { $_ }; Ascending = $true }
      ) |
      Select-Object -First $Max
  )
}

function Get-ReviewedGapDecisions(){
  $decisions=@{}
  foreach($decision in @(
    [pscustomobject]@{ Id="WAT-003"; Disposition="WORKSPACE_MAPPING_REQUIRED"; Summary="Voting workspace integration must be mapped before choosing a merge path."; Reason="User requested full integration planning across the Watani chatbot workspace plus the added voting app workspace only, with no merge before mapping is complete." },
    [pscustomobject]@{ Id="WAT-004"; Disposition="SCOPE_DEFERRED"; Summary="Lebanese TV and broadcasting integration is not part of the current product baseline."; Reason="No live route, UI surface, or owned service contract in the workspace treats broadcast playback as a core veteran-assistance feature." },
    [pscustomobject]@{ Id="WAT-005"; Disposition="SCOPE_DEFERRED"; Summary="Arabic satellite channel aggregation is deferred out of the current app scope."; Reason="The workspace has no owned satellite-content integration surface and the current roadmap prioritizes official-source and service-assistance features instead." },
    [pscustomobject]@{ Id="WAT-015"; Disposition="APPROVED_PARTIAL_DEFERRED"; Summary="Existing KB, OCR, and rebuild tooling remain accepted as a partial capability without a new implementation wave."; Reason="The repo already contains KB rebuild, OCR, and ingestion tooling, but not a dedicated reviewed production ingestion workflow that warrants immediate Phase 2 feature work." }
  )){
    $decisions[$decision.Id]=$decision
  }
  return $decisions
}

function Parse-GapTable([string]$GapText){
  $items=@()
  foreach($line in ($GapText -split "`r?`n")){
    if($line -match '^\|\s*(WAT-\d+)\s*\|\s*(.*?)\s*\|\s*([A-Z_]+)\s*\|\s*(\d+)\s*\|'){
      $items += [pscustomobject]@{ Id=$Matches[1]; Title=$Matches[2]; Status=$Matches[3]; Hits=[int]$Matches[4] }
    }
  }
  return $items
}

function Invoke-PhaseAudit([string]$Root){
  $started=Get-Date
  $AuditRoot=Join-Path $Root ".pma\audit\watany-phase1"
  New-Item -ItemType Directory -Path $AuditRoot -Force | Out-Null
  $allFiles=@(Get-WorkspaceFiles $Root)
  $textExts=@(".ts",".tsx",".js",".jsx",".json",".md",".txt",".html",".css",".scss",".yml",".yaml",".py",".sql",".prisma",".env",".example")
  $files=@($allFiles | Where-Object {
    $_.FullName -notmatch "\\.pma\\quarantine\\" -and
    ($textExts -contains $_.Extension.ToLowerInvariant()) -and
    $_.Length -lt 3000000
  })

  $features=@(
    @{Name="MOF integration";Pattern="mof|retiredinfo|pensionattestation|وزارة|مالية"},
    @{Name="banks directory";Pattern="watany-open-directory|DirectorySheet|directory_banks_open|مصارف الدفع|bank-byblos|bank-credit-libanais|BLC Bank|مصرف لبنان|PensionAttestationForm|banks"},
    @{Name="security apparatus directory";Pattern="security apparatus|قوى الأمن|الأمن الداخلي|الأمن العام|أمن الدولة"},
    @{Name="rabita integration";Pattern="rabita|رابطة|الرابطة"},
    @{Name="voting module";Pattern="voting|vote|اقتراع|انتخاب"},
    @{Name="broadcast module";Pattern="broadcast|stream|قنوات|بث"},
    @{Name="Lebanese TV";Pattern="Lebanese TV|تلفزيون|لبنانية|LBC|MTV|الجديد|OTV|NBN"},
    @{Name="satellite news";Pattern="satellite|فضائية|العربية|الحدث|سكاي نيوز|المشهد"},
    @{Name="OTP verification";Pattern="requestOtp|verifyOtp|sendOtp|otp|auth-otp|OTP_PROVIDER|WHATSAPP_ACCOUNT_NUMBER|WHATSAPP_TEST_RECEIVER_NUMBER|sms\.ts|otp-routes|whatsapp|verify|verification|رمز|تحقق"},
    @{Name="WhatsApp-like chat features";Pattern="whatsapp|wa-mode|waMode|whatsapp-mode|WhatsAppChatShell|composer|chat-composer|bubble|msg-bubble|sticky|wa-ticks|واتساب"},
    @{Name="groups";Pattern="group|groups|مجموعة|مجموعات"},
    @{Name="message reactions";Pattern="reaction|reactions|emoji|تفاعل"},
    @{Name="reply/quote";Pattern="reply|quote|اقتباس|رد"},
    @{Name="delete-for-me";Pattern="delete for me|deleteForMe|حذف لدي"},
    @{Name="typing indicators";Pattern="typing|isTyping|يكتب"},
    @{Name="read receipts";Pattern="read receipt|readReceipts|seen|delivered|مقروء"},
    @{Name="dynamic menu";Pattern="dynamic menu|menu|قائمة|quick actions|quickActions"},
    @{Name="profile engine";Pattern="ProfilePage|profile\.isAuthed|loginWithProfile|updateProfile|profile-grid|beneficiary|retired|martyr|disability|family_direct|mofCaseVariants|حسابي|ملف"},
    @{Name="legal entitlement engine";Pattern="entitlement|eligibility|legal|benefit|قانون|استحقاق|حقوق"},
    @{Name="document ingestion pipeline";Pattern="upload|ocr|ingest|document|review|publish|kb"},
    @{Name="death notices";Pattern="death|obituary|martyr|نعوة|وفيات|شهيد"},
    @{Name="Army source integration";Pattern="army|laf|الجيش|المؤسسة العسكرية"},
    @{Name="ISF source integration";Pattern="isf|internal security|قوى الأمن الداخلي"}
  )
  $external=@(
    @{Name="MOF embed";Pattern="mof|retiredinfo|وزارة المالية"},
    @{Name="SMS API";Pattern="sms api|sms|twilio|verify|otp"},
    @{Name="Voting app";Pattern="voting|vote|اقتراع|انتخاب"},
    @{Name="death crawlers";Pattern="crawler|crawl|scrape|death|obituary"},
    @{Name="bank datasets";Pattern="banks|bank dataset|مصارف|مصرف"},
    @{Name="TV integrations";Pattern="stream|m3u|tv|broadcast|satellite"}
  )
  $wat=@(
    @{Id="WAT-001";Title="Ministry/MOF integration";Pattern="mof|retiredinfo|pensionattestation|وزارة|مالية"},
    @{Id="WAT-002";Title="Banks directory";Pattern="watany-open-directory|DirectorySheet|directory_banks_open|مصارف الدفع|bank-byblos|bank-credit-libanais|BLC Bank|مصرف لبنان|PensionAttestationForm|banks"},
    @{Id="WAT-003";Title="Voting workspace full integration";Pattern="voting|vote|انتخاب|اقتراع|workspace|integration|auth|database|api|route|iframe|native merge"},
    @{Id="WAT-004";Title="Lebanese TV/broadcasting";Pattern="broadcast|tv|stream|قنوات|بث"},
    @{Id="WAT-005";Title="Arabic satellite channels";Pattern="satellite|فضائية|العربية|سكاي نيوز|المشهد"},
    @{Id="WAT-006";Title="Official-source media policy";Pattern="official source|مصدر رسمي|broadcast|media"},
    @{Id="WAT-007";Title="PWA/mobile shell";Pattern="pwa|manifest|install|mobile shell|service worker"},
    @{Id="WAT-008";Title="WhatsApp-like chat UX";Pattern="whatsapp|wa-mode|waMode|whatsapp-mode|WhatsAppChatShell|composer|chat-composer|bubble|msg-bubble|sticky|wa-ticks|واتساب"},
    @{Id="WAT-009";Title="Elderly-first UX";Pattern="elderly|guided|أو شي تاني|accessibility|need-state"},
    @{Id="WAT-010";Title="Arabic/Arabizi normalization";Pattern="arabizi|wrong keyboard|keyboard|عربي|فرانكو|normalization"},
    @{Id="WAT-011";Title="Voice STT/TTS";Pattern="voice|speech|stt|tts|microphone|audio"},
    @{Id="WAT-012";Title="OTP/SMS/WhatsApp verification";Pattern="requestOtp|verifyOtp|sendOtp|otp|auth-otp|OTP_PROVIDER|WHATSAPP_ACCOUNT_NUMBER|WHATSAPP_TEST_RECEIVER_NUMBER|sms\.ts|otp-routes|whatsapp|verify|verification|رمز|تحقق"},
    @{Id="WAT-013";Title="Document preview/share/download";Pattern="preview|download|share|pdf|docx|attachment|mammoth"},
    @{Id="WAT-014";Title="Admin/RBAC/moderation";Pattern="admin|superadmin|rbac|moderation|permission|role"},
    @{Id="WAT-015";Title="KB/OCR ingestion";Pattern="upload|ocr|ingest|kb|knowledge|review|publish"},
    @{Id="WAT-016";Title="Profile/identity engine";Pattern="ProfilePage|profile\.isAuthed|loginWithProfile|updateProfile|profile-grid|beneficiary|retired|martyr|disability|family_direct|mofCaseVariants|حسابي|ملف"},
    @{Id="WAT-017";Title="Pension/salary engine";Pattern="salary|pension|retirement|rank|degree|medal|spouse|children"},
    @{Id="WAT-018";Title="Death/obituary admin-only";Pattern="death|obituary|martyr|نعوة|وفيات|شهيد"},
    @{Id="WAT-019";Title="Legal entitlement intelligence";Pattern="entitlement|eligibility|legal|law|benefit|قانون|استحقاق|حقوق"}
  )
  $apiPatterns=@("/api/","fastify.","router.","Route path","app.get","app.post","app.patch","app.delete")
  $contentPatterns=New-Object System.Collections.Generic.List[string]
  foreach($group in @($features,$external,$wat)){
    foreach($item in $group){
      $pattern=[string]$item.Pattern
      if(-not [string]::IsNullOrWhiteSpace($pattern) -and -not ($contentPatterns -contains $pattern)){
        Add-Line $contentPatterns $pattern
      }
    }
  }
  foreach($pattern in ($apiPatterns | ForEach-Object { [regex]::Escape($_) })){
    if(-not ($contentPatterns -contains $pattern)){
      Add-Line $contentPatterns $pattern
    }
  }
  $contentPatternIndex=Build-PatternIndex -Files $files -Patterns @($contentPatterns) -Root $Root -Max 8

  $doc=New-Object System.Collections.Generic.List[string]
  Add-Line $doc "# PHASE-1-WATANY-REALITY-AUDIT Coverage"
  Add-Line $doc ""
  Add-Line $doc "| Field | Value |"; Add-Line $doc "|---|---|"
  Add-Line $doc "| ProjectRoot | $Root |"; Add-Line $doc "| Started | $($started.ToString('o')) |"; Add-Line $doc "| AuditMode | READ_ONLY |"; Add-Line $doc "| TextFilesScanned | $($files.Count) |"; Add-Line $doc "| TotalFilesObserved | $($allFiles.Count) |"; Add-Line $doc "| OutputRoot | $AuditRoot |"
  Write-Utf8Bom (Join-Path $AuditRoot "00_PHASE1_COVERAGE.md") ($doc -join "`r`n")

  $tree=New-Object System.Collections.Generic.List[string]
  Add-Line $tree "# Workspace Map"; Add-Line $tree ""; Add-Line $tree "Top-level folders/files:"; Add-Line $tree ""
  Get-ChildItem -Path $Root -Force -ErrorAction SilentlyContinue|Sort-Object PSIsContainer,Name -Descending|ForEach-Object{Add-Line $tree "- $($_.Name)"}
  Add-Line $tree ""; Add-Line $tree "Important folders:"
  foreach($p in @("apps","packages","scripts",".pma","apps\gateway-api","apps\web-user","apps\web-admin","apps\api-backend")){Add-Line $tree "- $p : $(Test-Path (Join-Path $Root $p))"}
  Write-Utf8Bom (Join-Path $AuditRoot "01_WORKSPACE_MAP.md") ($tree -join "`r`n")

  $feat=New-Object System.Collections.Generic.List[string]
  Add-Line $feat "# Feature Existence Audit"; Add-Line $feat ""; Add-Line $feat "| Feature | Hits | Status | Example Files |"; Add-Line $feat "|---|---:|---|---|"
  foreach($f in $features){
    $stats=$contentPatternIndex[$f.Pattern]
    $h=if($stats){$stats.Count}else{0}
    $exampleFiles=if($stats){$stats.Files -join "; "}else{""}
    Add-Line $feat "| $($f.Name) | $h | $(Get-Status $h $f.Name) | $exampleFiles |"
  }
  Write-Utf8Bom (Join-Path $AuditRoot "02_FEATURE_EXISTENCE_AUDIT.md") ($feat -join "`r`n")

  $routes=New-Object System.Collections.Generic.List[string]
  Add-Line $routes "# Route and API Map"; Add-Line $routes ""; Add-Line $routes "## Route-like files"; Add-Line $routes ""
  $routeFiles=$files|Where-Object{$_.FullName -match "\\routes\\|router|Route|pages|api"}
  foreach($rf in ($routeFiles|Select-Object -First 300)){Add-Line $routes "- $(RelPath $rf.FullName $Root)"}
  Add-Line $routes ""; Add-Line $routes "## API string hits"; Add-Line $routes ""; Add-Line $routes "| Pattern | Hits |"; Add-Line $routes "|---|---:|"
  foreach($p in $apiPatterns){
    $stats=$contentPatternIndex[[regex]::Escape($p)]
    $h=if($stats){$stats.Count}else{0}
    Add-Line $routes "| $p | $h |"
  }
  Write-Utf8Bom (Join-Path $AuditRoot "03_ROUTE_AND_API_MAP.md") ($routes -join "`r`n")

  $db=New-Object System.Collections.Generic.List[string]
  Add-Line $db "# Database Schema Map"; Add-Line $db ""
  $schemaFiles=$allFiles|Where-Object{$_.Name -match "schema\.prisma|migration|\.sql$|models?\.|entity|entities"}|Select-Object -First 300
  if(-not $schemaFiles){Add-Line $db "No obvious schema/migration files found by static scan."}
  foreach($sf in $schemaFiles){Add-Line $db "- $(RelPath $sf.FullName $Root)"}
  Write-Utf8Bom (Join-Path $AuditRoot "04_DATABASE_SCHEMA_MAP.md") ($db -join "`r`n")

  $ext=New-Object System.Collections.Generic.List[string]
  Add-Line $ext "# External Integrations Audit"; Add-Line $ext ""; Add-Line $ext "| Integration | Hits | Status | Example Files |"; Add-Line $ext "|---|---:|---|---|"
  foreach($e in $external){
    $stats=$contentPatternIndex[$e.Pattern]
    $h=if($stats){$stats.Count}else{0}
    $exampleFiles=if($stats){$stats.Files -join "; "}else{""}
    Add-Line $ext "| $($e.Name) | $h | $(Get-Status $h $e.Name) | $exampleFiles |"
  }
  Add-Line $ext ""; Add-Line $ext "## External Workspace Discovery"
  $parent=Split-Path -Parent $Root
  foreach($name in @("sms api","sms-api","voting","voting app","voting-app")){$candidate=Join-Path $parent $name; Add-Line $ext "- $candidate : $(Test-Path $candidate)"}
  Write-Utf8Bom (Join-Path $AuditRoot "05_EXTERNAL_INTEGRATIONS_AUDIT.md") ($ext -join "`r`n")

  $trace=New-Object System.Collections.Generic.List[string]
  Add-Line $trace "# PMA Traceability Matrix WAT-001 to WAT-019"; Add-Line $trace ""; Add-Line $trace "| WAT ID | Requirement | Hits | Status | Example Files |"; Add-Line $trace "|---|---|---:|---|---|"
  $gapItems=@()
  foreach($w in $wat){
    $stats=$contentPatternIndex[$w.Pattern]
    $h=if($stats){$stats.Count}else{0}
    $status=Get-Status $h $w.Title
    if($status -in @("MISSING","PARTIAL","BROKEN","UNVERIFIED")){$gapItems += [pscustomobject]@{Id=$w.Id;Title=$w.Title;Status=$status;Hits=$h}}
    $exampleFiles=if($stats){(Select-WatExampleFiles -WatId $w.Id -Files $stats.AllFiles -Max 8) -join "; "}else{""}
    Add-Line $trace "| $($w.Id) | $($w.Title) | $h | $status | $exampleFiles |"
  }
  Write-Utf8Bom (Join-Path $AuditRoot "06_PMA_TRACEABILITY_MATRIX.md") ($trace -join "`r`n")

  $gap=New-Object System.Collections.Generic.List[string]
  Add-Line $gap "# Gap Analysis"; Add-Line $gap ""
  if($gapItems.Count -eq 0){Add-Line $gap "No MISSING/PARTIAL/UNVERIFIED items detected by static scan. Human review still required."}else{Add-Line $gap "| WAT ID | Requirement | Status | Hits |";Add-Line $gap "|---|---|---|---:|";foreach($g in $gapItems){Add-Line $gap "| $($g.Id) | $($g.Title) | $($g.Status) | $($g.Hits) |"}}
  Write-Utf8Bom (Join-Path $AuditRoot "07_GAP_ANALYSIS.md") ($gap -join "`r`n")

  $plan=New-Object System.Collections.Generic.List[string]
  Add-Line $plan "# Implementation Plan Phase 2"; Add-Line $plan ""; Add-Line $plan "Priority order:"; Add-Line $plan ""; Add-Line $plan "1. Resolve only the WAT items still flagged by the latest audit output."; Add-Line $plan "2. Tackle partial platform capabilities before net-new integration tracks."; Add-Line $plan "3. Keep external civic, broadcast, and satellite tracks separate from core app fixes."; Add-Line $plan ""; Add-Line $plan "## Items requiring Phase 2 attention"
  if($gapItems.Count -eq 0){Add-Line $plan "- None from static scan. Validate manually before implementation."}else{foreach($g in $gapItems){Add-Line $plan "- $($g.Id) — $($g.Title) — $($g.Status)"}}
  Write-Utf8Bom (Join-Path $AuditRoot "08_IMPLEMENTATION_PLAN_PHASE2.md") ($plan -join "`r`n")

  $end=Get-Date
  $final=New-Object System.Collections.Generic.List[string]
  Add-Line $final "# Phase 1 Final Report"; Add-Line $final ""; Add-Line $final "| Field | Value |"; Add-Line $final "|---|---|"; Add-Line $final "| Status | PHASE1_AUDIT_COMPLETE_READ_ONLY |"; Add-Line $final "| ProjectRoot | $Root |"; Add-Line $final "| Started | $($started.ToString('o')) |"; Add-Line $final "| Ended | $($end.ToString('o')) |"; Add-Line $final "| DurationSeconds | $([int]($end-$started).TotalSeconds) |"; Add-Line $final "| WATItemsFlaggedForPhase2 | $($gapItems.Count) |"; Add-Line $final ""; Add-Line $final "## Outputs"
  foreach($name in @("00_PHASE1_COVERAGE.md","01_WORKSPACE_MAP.md","02_FEATURE_EXISTENCE_AUDIT.md","03_ROUTE_AND_API_MAP.md","04_DATABASE_SCHEMA_MAP.md","05_EXTERNAL_INTEGRATIONS_AUDIT.md","06_PMA_TRACEABILITY_MATRIX.md","07_GAP_ANALYSIS.md","08_IMPLEMENTATION_PLAN_PHASE2.md","09_PHASE1_FINAL_REPORT.md")){Add-Line $final "- $name"}
  Add-Line $final ""; Add-Line $final "## Next Step"; Add-Line $final "Review this audit. Then run -Phase Implement to create the implementation queue and patch plan."
  $finalPath=Join-Path $AuditRoot "09_PHASE1_FINAL_REPORT.md"
  Write-Utf8Bom $finalPath ($final -join "`r`n")
  return [pscustomobject]@{FinalReport=$finalPath}
}

function Invoke-PhaseImplement([string]$Root){
  $started=Get-Date
  $AuditRoot=Join-Path $Root ".pma\audit\watany-phase1"
  $ImplRoot=Join-Path $Root ".pma\implementation\watany-phase2"
  New-Item -ItemType Directory -Path $ImplRoot -Force | Out-Null
  $gapFile=Join-Path $AuditRoot "07_GAP_ANALYSIS.md"
  $gapText=if(Test-Path $gapFile){Get-Content $gapFile -Raw}else{"Phase 1 gap file missing."}
  $reviewDecisions=Get-ReviewedGapDecisions
  $gapItems=@(Parse-GapTable $gapText)
  $resolvedGapItems=New-Object System.Collections.Generic.List[object]
  $activeGapItems=New-Object System.Collections.Generic.List[object]
  foreach($gapItem in $gapItems){
    if($reviewDecisions.ContainsKey($gapItem.Id)){
      $decision=$reviewDecisions[$gapItem.Id]
      $resolvedGapItems.Add([pscustomobject]@{ Id=$gapItem.Id; Title=$gapItem.Title; AuditStatus=$gapItem.Status; Hits=$gapItem.Hits; Disposition=$decision.Disposition; Summary=$decision.Summary; Reason=$decision.Reason }) | Out-Null
      continue
    }
    $activeGapItems.Add($gapItem) | Out-Null
  }
  $decisionDoc=New-Object System.Collections.Generic.List[string]
  Add-Line $decisionDoc "# Reviewed Gap Decisions"
  Add-Line $decisionDoc ""
  Add-Line $decisionDoc "These reviewed dispositions sit on top of the read-only Phase 1 audit; they do not rewrite the audit findings."
  Add-Line $decisionDoc ""
  if($resolvedGapItems.Count -eq 0){
    Add-Line $decisionDoc "No reviewed gap decisions recorded."
  }else{
    Add-Line $decisionDoc "| WAT ID | Requirement | Audit Status | Hits | Reviewed Disposition | Summary |"
    Add-Line $decisionDoc "|---|---|---|---:|---|---|"
    foreach($item in $resolvedGapItems){
      Add-Line $decisionDoc "| $($item.Id) | $($item.Title) | $($item.AuditStatus) | $($item.Hits) | $($item.Disposition) | $($item.Summary) |"
    }
    Add-Line $decisionDoc ""
    Add-Line $decisionDoc "## Rationale"
    foreach($item in $resolvedGapItems){
      Add-Line $decisionDoc "- $($item.Id): $($item.Reason)"
    }
  }
  Write-Utf8Bom (Join-Path $ImplRoot "00_REVIEWED_GAP_DECISIONS.md") ($decisionDoc -join "`r`n")
  $queue=New-Object System.Collections.Generic.List[string]
  Add-Line $queue "# Phase 2 Implementation Queue"; Add-Line $queue ""; Add-Line $queue "Source: Phase 1 audit outputs."; Add-Line $queue ""; Add-Line $queue "Rule: implement only items classified as MISSING, PARTIAL, BROKEN, or UNVERIFIED after human review."; Add-Line $queue ""; Add-Line $queue "Priority: follow the current gap file only; do not carry forward cleared WAT items into the queue."; Add-Line $queue ""; Add-Line $queue "Reviewed dispositions: see 00_REVIEWED_GAP_DECISIONS.md."; Add-Line $queue ""; Add-Line $queue "## Phase 1 gap excerpt"; Add-Line $queue "~~~markdown"; Add-Line $queue ($gapText.Substring(0,[Math]::Min(6000,$gapText.Length))); Add-Line $queue "~~~"; Add-Line $queue ""; Add-Line $queue "## Reviewed dispositions"
  if($resolvedGapItems.Count -eq 0){
    Add-Line $queue "- None."
  }else{
    Add-Line $queue "| WAT ID | Reviewed Disposition | Summary |"
    Add-Line $queue "|---|---|---|"
    foreach($item in $resolvedGapItems){
      Add-Line $queue "| $($item.Id) | $($item.Disposition) | $($item.Summary) |"
    }
  }
  Add-Line $queue ""
  Add-Line $queue "## Active Phase 2 items after reviewed dispositions"
  if($activeGapItems.Count -eq 0){
    Add-Line $queue "No active Phase 2 implementation items remain after reviewed scope and partial-capability decisions."
  }else{
    Add-Line $queue "| WAT ID | Requirement | Status | Hits |"
    Add-Line $queue "|---|---|---|---:|"
    foreach($item in $activeGapItems){
      Add-Line $queue "| $($item.Id) | $($item.Title) | $($item.Status) | $($item.Hits) |"
    }
  }
  Write-Utf8Bom (Join-Path $ImplRoot "01_IMPLEMENTATION_QUEUE.md") ($queue -join "`r`n")
  foreach($pair in @(
    @("02_PATCH_PLAN.md","This runner intentionally does not patch application code automatically. Create item-specific APEX scripts for approved gaps, with backups, logs, focused validation, and reports."),
    @("03_DB_MIGRATION_PLAN.md","No migrations are generated by this canonical runner. If needed, create a dedicated migration plan with rollback and validation."),
    @("04_ROUTE_ADDITIONS.md","Use Phase 1 route/API map to avoid duplicate routes. Add routes only for reviewed gaps."),
    @("05_COMPONENT_WORKLIST.md","Use Phase 1 component/page scan and avoid duplicating existing components."),
    @("06_VALIDATION_PLAN.md","Recommended: gateway typecheck, web-user typecheck/build, web-admin typecheck/build, targeted regression tests, route smoke tests, Phase 8F evidence refresh if affected.")
  )){Write-Utf8Bom (Join-Path $ImplRoot $pair[0]) ("# " + ($pair[0] -replace '^\d+_','' -replace '\.md$','' -replace '_',' ') + "`r`n`r`n" + $pair[1])}
  $end=Get-Date
  $report=New-Object System.Collections.Generic.List[string]
  $scopeDeferredCount=@($resolvedGapItems | Where-Object { $_.Disposition -eq "SCOPE_DEFERRED" }).Count
  $acceptedPartialCount=@($resolvedGapItems | Where-Object { $_.Disposition -eq "APPROVED_PARTIAL_DEFERRED" }).Count
  Add-Line $report "# Phase 2 Completion Report"; Add-Line $report ""; Add-Line $report "| Field | Value |"; Add-Line $report "|---|---|"; Add-Line $report "| Status | PHASE2_IMPLEMENTATION_PLANNING_PACKAGE_CREATED |"; Add-Line $report "| ProjectRoot | $Root |"; Add-Line $report "| Started | $($started.ToString('o')) |"; Add-Line $report "| Ended | $($end.ToString('o')) |"; Add-Line $report "| DurationSeconds | $([int]($end-$started).TotalSeconds) |"; Add-Line $report "| CodeModified | False |"; Add-Line $report "| ActiveImplementationItems | $($activeGapItems.Count) |"; Add-Line $report "| ScopeDeferredItems | $scopeDeferredCount |"; Add-Line $report "| ApprovedPartialDeferredItems | $acceptedPartialCount |"; Add-Line $report ""; Add-Line $report "## Outputs"; foreach($name in @("00_REVIEWED_GAP_DECISIONS.md","01_IMPLEMENTATION_QUEUE.md","02_PATCH_PLAN.md","03_DB_MIGRATION_PLAN.md","04_ROUTE_ADDITIONS.md","05_COMPONENT_WORKLIST.md","06_VALIDATION_PLAN.md","07_PHASE2_COMPLETION_REPORT.md")){Add-Line $report "- $name"}
  $finalPath=Join-Path $ImplRoot "07_PHASE2_COMPLETION_REPORT.md"
  Write-Utf8Bom $finalPath ($report -join "`r`n")
  return [pscustomobject]@{FinalReport=$finalPath}
}

$Root=[IO.Path]::GetFullPath($ProjectRoot)
if(-not(Test-Path $Root)){Write-Error "ProjectRoot not found: $Root"; exit 2}
$reports=@()
if($Phase -eq "Audit" -or $Phase -eq "Full"){$a=Invoke-PhaseAudit $Root; $reports += $a.FinalReport}
if($Phase -eq "Implement" -or $Phase -eq "Full"){
  if(-not(Test-Path (Join-Path $Root ".pma\audit\watany-phase1\09_PHASE1_FINAL_REPORT.md"))){Write-Warning "Phase 1 audit report not found. Running Audit first."; $a=Invoke-PhaseAudit $Root; $reports += $a.FinalReport}
  $i=Invoke-PhaseImplement $Root; $reports += $i.FinalReport
}
Write-Host ""
Write-Host "APEX Watany PMA Second two-phase runner completed." -ForegroundColor Green
foreach($r in $reports){Write-Host "Report: $r"}
if($OpenReport -and $reports.Count -gt 0){Start-Process notepad.exe $reports[-1]}
