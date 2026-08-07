[CmdletBinding()]
param(
    [string]$ProjectRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$ApprovedViewerPath = '',
    [string]$ApprovedContractPath = '',
    [switch]$SkipRuntimeValidation,
    [switch]$RunFullTests,
    [ValidateRange(5100, 5999)]
    [int]$RuntimePort = 5197,
    [ValidateRange(60, 3600)]
    [int]$NativeTimeoutSec = 1200,
    [ValidateRange(50, 1000)]
    [int]$MaxEvidenceReports = 400
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'Continue'

$script:Version = 'v1.0-apex-current-state-theme-strategy-audit'
$script:CompleteToken = 'APEX_WATANYBOT_CURRENT_STATE_THEME_STRATEGY_AUDIT_V1_COMPLETED'
$script:UnverifiedToken = 'APEX_WATANYBOT_CURRENT_STATE_THEME_STRATEGY_AUDIT_V1_RUNTIME_UNVERIFIED'
$script:BlockedToken = 'APEX_WATANYBOT_CURRENT_STATE_THEME_STRATEGY_AUDIT_V1_BLOCKED'
$script:ExitComplete = 0
$script:ExitUnverified = 2
$script:ExitBlocked = 97
$script:ExpectedViewerSHA256 = 'ac52f3985f67fe3ef01161858059f864e525b011d7f40aa9f386833ff0d7df44'
$script:FailureRegister = @(
    'APEX_AUDIT_PROJECT_ROOT_NOT_FOUND_DEFECT',
    'APEX_AUDIT_WEB_USER_ROOT_NOT_FOUND_DEFECT',
    'APEX_AUDIT_APPROVED_VIEWER_NOT_FOUND_DEFECT',
    'APEX_AUDIT_APPROVED_VIEWER_HASH_MISMATCH_DEFECT',
    'APEX_AUDIT_APPROVED_CONTRACT_NOT_FOUND_DEFECT',
    'APEX_AUDIT_APPROVED_CONTRACT_HASH_BINDING_DEFECT',
    'APEX_AUDIT_WINDOWS_POWERSHELL_5_1_REQUIRED_DEFECT',
    'APEX_AUDIT_SCRIPT_PARSER_FAILED_DEFECT',
    'APEX_AUDIT_SCRIPT_NON_ASCII_DEFECT',
    'APEX_AUDIT_SCRIPT_BOM_DEFECT',
    'APEX_AUDIT_SOURCE_INVENTORY_FAILED_DEFECT',
    'APEX_AUDIT_ROUTE_FEATURE_MATRIX_FAILED_DEFECT',
    'APEX_AUDIT_THEME_OWNER_MAP_FAILED_DEFECT',
    'APEX_AUDIT_BASELINE_AUTHORITY_DISCOVERY_FAILED_DEFECT',
    'APEX_AUDIT_NATIVE_PROCESS_START_FAILED_DEFECT',
    'APEX_AUDIT_NATIVE_PROCESS_TIMEOUT_DEFECT',
    'APEX_AUDIT_RUNTIME_SERVER_START_FAILED_DEFECT',
    'APEX_AUDIT_RUNTIME_SERVER_HEALTH_TIMEOUT_DEFECT',
    'APEX_AUDIT_RUNTIME_PROCESS_CLEANUP_FAILED_DEFECT',
    'APEX_AUDIT_EVIDENCE_MANIFEST_FAILED_DEFECT',
    'APEX_AUDIT_UNHANDLED_EXCEPTION_DEFECT',
    'APEX_THEME_UPGRADE_SCOPE_INVERSION_DEFECT',
    'APEX_GREEN_FUNCTIONAL_BASELINE_NOT_BOUND_DEFECT',
    'APEX_CURRENT_THEME_WORK_SALVAGE_LEDGER_MISSING_DEFECT',
    'APEX_PRESENTATION_ONLY_THEME_BOUNDARY_NOT_ENFORCED_DEFECT',
    'APEX_FULL_PRODUCT_REBUILD_NOT_AUTHORIZED_DEFECT'
)

function Write-Utf8NoBomText {
    param([Parameter(Mandatory = $true)][string]$Path,[Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path,$Text,(New-Object System.Text.UTF8Encoding($false)))
}

function Write-AsciiLines {
    param([Parameter(Mandatory = $true)][string]$Path,[Parameter(Mandatory = $true)][AllowEmptyCollection()][AllowEmptyString()][string[]]$Lines)
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [System.IO.File]::WriteAllLines($Path,[string[]]@($Lines),[System.Text.Encoding]::ASCII)
}

function Write-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path,[Parameter(Mandatory = $true)]$Value,[int]$Depth = 80)
    Write-Utf8NoBomText -Path $Path -Text (($Value | ConvertTo-Json -Depth $Depth) + [Environment]::NewLine)
}

function Get-ApexSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = $null
    $sha = $null
    try {
        $stream = [System.IO.File]::Open($Path,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::Read)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()
    }
    finally {
        if ($sha) { $sha.Dispose() }
        if ($stream) { $stream.Dispose() }
    }
}

function Test-AsciiNoBom {
    param([Parameter(Mandatory = $true)][string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $nonAscii = 0
    foreach ($byte in $bytes) { if ($byte -gt 127) { $nonAscii++ } }
    return [pscustomobject]@{
        Path = $Path
        NonAsciiByteCount = $nonAscii
        Utf8Bom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    }
}

function Test-PowerShellParser {
    param([Parameter(Mandatory = $true)][string]$Path)
    $tokens = $null
    $errors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($Path,[ref]$tokens,[ref]$errors)
    return [pscustomobject]@{
        ErrorCount = @($errors).Count
        Errors = @($errors | ForEach-Object { [pscustomobject]@{ Message = $_.Message; Line = $_.Extent.StartLineNumber; Column = $_.Extent.StartColumnNumber } })
        GatePass = (@($errors).Count -eq 0)
    }
}

function Resolve-FailureClass {
    param([Parameter(Mandatory = $true)][Exception]$Exception)
    if ([string]$Exception.Message -match '^(APEX_[A-Z0-9_]+)') { return [string]$Matches[1] }
    return 'APEX_AUDIT_UNHANDLED_EXCEPTION_DEFECT'
}

function ConvertTo-QuotedArgument {
    param([AllowEmptyString()][string]$Value)
    if ($null -eq $Value) { return '""' }
    if ($Value -notmatch '[\s"]') { return $Value }
    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq [char]92) { $slashes++; continue }
        if ($character -eq '"') {
            [void]$builder.Append((''.PadLeft(($slashes * 2 + 1),[char]92)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$builder.Append((''.PadLeft($slashes,[char]92))); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) { [void]$builder.Append((''.PadLeft(($slashes * 2),[char]92))) }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function New-NativeSpec {
    param([Parameter(Mandatory = $true)][string]$FilePath,[Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Arguments)
    $extension = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
    if ($extension -in @('.cmd','.bat')) {
        $command = ConvertTo-QuotedArgument -Value $FilePath
        foreach ($argument in @($Arguments)) { $command += ' ' + (ConvertTo-QuotedArgument -Value ([string]$argument)) }
        return [pscustomobject]@{ FilePath = $env:ComSpec; Arguments = @('/d','/s','/c',$command) }
    }
    return [pscustomobject]@{ FilePath = $FilePath; Arguments = @($Arguments) }
}

function Invoke-NativeCapture {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$EvidenceDirectory,
        [int]$TimeoutSec = 1200
    )
    New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
    $spec = New-NativeSpec -FilePath $FilePath -Arguments $Arguments
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $spec.FilePath
    $startInfo.Arguments = ((@($spec.Arguments) | ForEach-Object { ConvertTo-QuotedArgument -Value ([string]$_) }) -join ' ')
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    $startedUtc = [DateTime]::UtcNow
    try { if (-not $process.Start()) { throw 'APEX_AUDIT_NATIVE_PROCESS_START_FAILED_DEFECT' } }
    catch { throw 'APEX_AUDIT_NATIVE_PROCESS_START_FAILED_DEFECT' }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $completed = $process.WaitForExit($TimeoutSec * 1000)
    $timedOut = -not $completed
    if ($timedOut) {
        $taskkill = Join-Path $env:SystemRoot 'System32\taskkill.exe'
        $killSpec = New-NativeSpec -FilePath $taskkill -Arguments @('/PID',[string]$process.Id,'/T','/F')
        $killInfo = New-Object System.Diagnostics.ProcessStartInfo
        $killInfo.FileName = $killSpec.FilePath
        $killInfo.Arguments = ((@($killSpec.Arguments) | ForEach-Object { ConvertTo-QuotedArgument -Value ([string]$_) }) -join ' ')
        $killInfo.UseShellExecute = $false
        $killInfo.CreateNoWindow = $true
        $kill = [System.Diagnostics.Process]::Start($killInfo)
        if ($kill) { [void]$kill.WaitForExit(20000); $kill.Dispose() }
        [void]$process.WaitForExit(5000)
    }
    $stdout = [string]$stdoutTask.Result
    $stderr = [string]$stderrTask.Result
    Write-Utf8NoBomText -Path (Join-Path $EvidenceDirectory 'stdout.txt') -Text $stdout
    Write-Utf8NoBomText -Path (Join-Path $EvidenceDirectory 'stderr.txt') -Text $stderr
    $exitCode = $null
    if ($process.HasExited) { $exitCode = [int]$process.ExitCode }
    $summary = [ordered]@{
        Name = $Name
        FilePath = $spec.FilePath
        Arguments = @($spec.Arguments)
        WorkingDirectory = $WorkingDirectory
        ProcessId = [int]$process.Id
        StartedUtc = $startedUtc.ToString('o')
        EndedUtc = [DateTime]::UtcNow.ToString('o')
        TimedOut = $timedOut
        ExitCode = $exitCode
        StdoutLength = $stdout.Length
        StderrLength = $stderr.Length
        EvidenceDirectory = $EvidenceDirectory
        CaptureComplete = $true
    }
    Write-JsonFile -Path (Join-Path $EvidenceDirectory 'summary.json') -Value $summary
    $process.Dispose()
    if ($timedOut) { throw 'APEX_AUDIT_NATIVE_PROCESS_TIMEOUT_DEFECT' }
    return [pscustomobject]$summary
}

function Start-LongRunningProcess {
    param([Parameter(Mandatory = $true)][string]$FilePath,[Parameter(Mandatory = $true)][string[]]$Arguments,[Parameter(Mandatory = $true)][string]$WorkingDirectory)
    $spec = New-NativeSpec -FilePath $FilePath -Arguments $Arguments
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $spec.FilePath
    $info.Arguments = ((@($spec.Arguments) | ForEach-Object { ConvertTo-QuotedArgument -Value ([string]$_) }) -join ' ')
    $info.WorkingDirectory = $WorkingDirectory
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    if (-not $process.Start()) { throw 'APEX_AUDIT_RUNTIME_SERVER_START_FAILED_DEFECT' }
    return [pscustomobject]@{ Process = $process; StdoutTask = $process.StandardOutput.ReadToEndAsync(); StderrTask = $process.StandardError.ReadToEndAsync(); StartedUtc = [DateTime]::UtcNow }
}

function Stop-LongRunningProcess {
    param([Parameter(Mandatory = $true)]$Handle,[Parameter(Mandatory = $true)][string]$EvidenceDirectory)
    New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
    $process = $Handle.Process
    $pidValue = [int]$process.Id
    if (-not $process.HasExited) {
        $taskkill = Join-Path $env:SystemRoot 'System32\taskkill.exe'
        [void](Invoke-NativeCapture -Name 'runtime-cleanup' -FilePath $taskkill -Arguments @('/PID',[string]$pidValue,'/T','/F') -WorkingDirectory $ProjectRoot -EvidenceDirectory (Join-Path $EvidenceDirectory 'taskkill') -TimeoutSec 30)
        [void]$process.WaitForExit(10000)
    }
    $stdout = [string]$Handle.StdoutTask.Result
    $stderr = [string]$Handle.StderrTask.Result
    Write-Utf8NoBomText -Path (Join-Path $EvidenceDirectory 'stdout.txt') -Text $stdout
    Write-Utf8NoBomText -Path (Join-Path $EvidenceDirectory 'stderr.txt') -Text $stderr
    $remaining = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
    $result = [ordered]@{ ProcessId = $pidValue; RemainingProcessCount = @($remaining).Count; StdoutLength = $stdout.Length; StderrLength = $stderr.Length; GatePass = (@($remaining).Count -eq 0) }
    Write-JsonFile -Path (Join-Path $EvidenceDirectory 'summary.json') -Value $result
    $process.Dispose()
    if (-not $result.GatePass) { throw 'APEX_AUDIT_RUNTIME_PROCESS_CLEANUP_FAILED_DEFECT' }
    return [pscustomobject]$result
}

function Test-HttpReady {
    param([Parameter(Mandatory = $true)][string]$Url,[int]$TimeoutSec = 120)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $request = [System.Net.HttpWebRequest]::Create($Url)
            $request.Method = 'GET'
            $request.Timeout = 3000
            $response = $request.GetResponse()
            $status = [int]$response.StatusCode
            $response.Close()
            if ($status -ge 200 -and $status -lt 500) { return $true }
        }
        catch {}
        Start-Sleep -Milliseconds 750
    }
    return $false
}

function Find-Executable {
    param([Parameter(Mandatory = $true)][string[]]$Names)
    foreach ($name in @($Names)) {
        $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) { return [string]$command.Source }
    }
    return ''
}

function Get-RelativePathSafe {
    param([Parameter(Mandatory = $true)][string]$Root,[Parameter(Mandatory = $true)][string]$Path)
    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $pathFull = [System.IO.Path]::GetFullPath($Path)
    if ($pathFull.StartsWith($rootFull,[System.StringComparison]::OrdinalIgnoreCase)) { return $pathFull.Substring($rootFull.Length) }
    return $pathFull
}

function Get-BrowserAuditLines {
    return [string[]]@(
        'const fs = require(''fs'');',
        'const path = require(''path'');',
        'const { chromium } = require(''playwright'');',
        'const baseUrl = process.argv[2];',
        'const outputPath = process.argv[3];',
        'const screenshotRoot = process.argv[4];',
        'const routes = JSON.parse(process.argv[5]);',
        'const widths = [390,430,1440];',
        'function ensure(p){fs.mkdirSync(p,{recursive:true});}',
        '(async()=>{',
        '  ensure(screenshotRoot);',
        '  const browser = await chromium.launch({headless:true});',
        '  const rows=[]; const consoleErrors=[]; const networkFailures=[];',
        '  let fatal='''';',
        '  try{',
        '    for(const width of widths){',
        '      const context=await browser.newContext({viewport:{width,height:900}});',
        '      const page=await context.newPage();',
        '      page.on(''console'',m=>{if(m.type()===''error'')consoleErrors.push({width,url:page.url(),text:m.text()});});',
        '      page.on(''requestfailed'',r=>networkFailures.push({width,url:r.url(),failure:r.failure()}));',
        '      for(const route of routes){',
        '        let navigationError='''';',
        '        try{await page.goto(baseUrl+route,{waitUntil:''networkidle'',timeout:30000});}catch(e){navigationError=String(e);}',
        '        await page.waitForTimeout(350);',
        '        const facts=await page.evaluate(()=>{',
        '          const root=document.querySelector(''#root'');',
        '          const body=document.body;',
        '          const overlay=document.querySelector(''vite-error-overlay'');',
        '          const text=(body&&body.innerText||'''').trim();',
        '          const candidates=[...document.querySelectorAll(''main,section,[data-watany-feature],.watany-drawer-phone,.watany-public-shell,.watany-recovery-shell'')];',
        '          const shell=candidates.find(el=>{const r=el.getBoundingClientRect();return r.width>250&&r.height>300;})||root;',
        '          const rect=shell?shell.getBoundingClientRect():null;',
        '          return {',
        '            finalPath:location.pathname,',
        '            textLength:text.length,',
        '            rootPresent:!!root,',
        '            errorOverlayPresent:!!overlay,',
        '            placeholderCount:document.querySelectorAll(''.watany-unavailable,[data-placeholder=true]'').length,',
        '            horizontalOverflow:body?Math.max(0,body.scrollWidth-innerWidth):0,',
        '            shellWidth:rect?Math.round(rect.width):0,',
        '            shellCentered:rect?Math.abs((rect.left+rect.width/2)-innerWidth/2)<=12:false',
        '          };',
        '        });',
        '        const row={width,route,navigationError,...facts};',
        '        row.routePass=!navigationError&&row.finalPath===route&&row.rootPresent&&!row.errorOverlayPresent&&row.textLength>=20;',
        '        row.smartphoneShellPass=width<560?row.shellWidth<=width+2:(row.shellWidth>0&&row.shellWidth<=500&&row.shellCentered);',
        '        row.geometryPass=row.horizontalOverflow===0&&row.smartphoneShellPass;',
        '        row.pass=row.routePass&&row.geometryPass;',
        '        rows.push(row);',
        '        if(route===''/''||route===''/welcome''||route===''/login''||route===''/salary''||route===''/faq''||route===''/world-cup''){',
        '          await page.screenshot({path:path.join(screenshotRoot,`${route===''/''?''home'':route.slice(1)}-${width}.png`),fullPage:true});',
        '        }',
        '      }',
        '      await context.close();',
        '    }',
        '  }catch(e){fatal=String(e&&e.stack||e);}',
        '  await browser.close();',
        '  const report={',
        '    status:fatal?''BLOCKED'':''COMPLETE'',fatal,rows,consoleErrors,networkFailures,',
        '    routePassCount:rows.filter(r=>r.routePass).length,',
        '    geometryPassCount:rows.filter(r=>r.geometryPass).length,',
        '    fullPassCount:rows.filter(r=>r.pass).length,',
        '    totalRowCount:rows.length,',
        '    gatePass:!fatal&&rows.length>0',
        '  };',
        '  fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+''\n'',''utf8'');',
        '  process.exit(report.gatePass?0:97);',
        '})().catch(e=>{fs.writeFileSync(outputPath,JSON.stringify({status:''BLOCKED'',fatal:String(e&&e.stack||e),gatePass:false},null,2)+''\n'',''utf8'');process.exit(97);});'
    )
}

function Get-PropertyValue {
    param($Object,[Parameter(Mandatory = $true)][string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
    if ($property) { return $property.Value }
    return $null
}

$startedUtc = [DateTime]::UtcNow
$runRoot = ''
$finalStatus = 'BLOCKED'
$finalToken = $script:BlockedToken
$finalExitCode = $script:ExitBlocked
$failureClass = ''
$failureMessage = ''
$productReadiness = 'UNVERIFIED'
$recommendedStrategy = 'BLOCKED'
$serverHandle = $null
$runtimeEvidenceComplete = $false
$runtimeEvidenceAttempted = -not [bool]$SkipRuntimeValidation
$currentPhase = 'INITIALIZATION'

try {
    $selfPath = [System.IO.Path]::GetFullPath($MyInvocation.MyCommand.Path)
    $ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw 'APEX_AUDIT_PROJECT_ROOT_NOT_FOUND_DEFECT' }
    $webRoot = Join-Path $ProjectRoot 'apps\web-user'
    $srcRoot = Join-Path $webRoot 'src'
    if (-not (Test-Path -LiteralPath $srcRoot -PathType Container)) { throw 'APEX_AUDIT_WEB_USER_ROOT_NOT_FOUND_DEFECT' }
    if ([string]::IsNullOrWhiteSpace($ApprovedViewerPath)) {
        $ApprovedViewerPath = Join-Path $env:USERPROFILE 'Downloads\WATANYBOT_SOURCE_OF_TRUTH_UI_VIEWER_V4_FULL_FEATURE_REGISTRY.html'
    }
    if ([string]::IsNullOrWhiteSpace($ApprovedContractPath)) {
        $ApprovedContractPath = Join-Path $env:USERPROFILE 'Downloads\WATANYBOT_APPROVED_THEME_V4_CONTRACT.json'
    }
    if (-not (Test-Path -LiteralPath $ApprovedViewerPath -PathType Leaf)) { throw 'APEX_AUDIT_APPROVED_VIEWER_NOT_FOUND_DEFECT' }
    if (-not (Test-Path -LiteralPath $ApprovedContractPath -PathType Leaf)) { throw 'APEX_AUDIT_APPROVED_CONTRACT_NOT_FOUND_DEFECT' }
    $ApprovedViewerPath = [System.IO.Path]::GetFullPath($ApprovedViewerPath)
    $ApprovedContractPath = [System.IO.Path]::GetFullPath($ApprovedContractPath)
    $timestamp = [DateTime]::Now.ToString('yyyyMMdd-HHmmss')
    $runRoot = Join-Path $ProjectRoot ('.pma\audits\apex-watanybot-current-state-theme-strategy-v1\' + $timestamp)
    New-Item -ItemType Directory -Path $runRoot -Force | Out-Null

    $currentPhase = 'PREFLIGHT'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 3
    $parser = Test-PowerShellParser -Path $selfPath
    $ascii = Test-AsciiNoBom -Path $selfPath
    $viewerHash = Get-ApexSha256 -Path $ApprovedViewerPath
    $contractObject = Get-Content -Raw -LiteralPath $ApprovedContractPath | ConvertFrom-Json
    $contractViewerHash = [string](Get-PropertyValue -Object $contractObject -Name 'approvedViewerSHA256')
    $preflight = [ordered]@{
        ScriptVersion = $script:Version
        ScriptPath = $selfPath
        ScriptSHA256 = Get-ApexSha256 -Path $selfPath
        PowerShellVersion = $PSVersionTable.PSVersion.ToString()
        ParserErrorCount = $parser.ErrorCount
        ParserErrors = $parser.Errors
        NonAsciiByteCount = $ascii.NonAsciiByteCount
        Utf8Bom = $ascii.Utf8Bom
        ProjectRoot = $ProjectRoot
        WebRoot = $webRoot
        ApprovedViewerPath = $ApprovedViewerPath
        ApprovedViewerSHA256 = $viewerHash
        ExpectedViewerSHA256 = $script:ExpectedViewerSHA256
        ApprovedContractPath = $ApprovedContractPath
        ContractViewerSHA256 = $contractViewerHash
        SkipRuntimeValidation = [bool]$SkipRuntimeValidation
        RunFullTests = [bool]$RunFullTests
        GatePass = (
            $PSVersionTable.PSVersion.Major -eq 5 -and
            $PSVersionTable.PSVersion.Minor -eq 1 -and
            $parser.GatePass -and
            $ascii.NonAsciiByteCount -eq 0 -and
            -not $ascii.Utf8Bom -and
            $viewerHash -eq $script:ExpectedViewerSHA256 -and
            $contractViewerHash -eq $script:ExpectedViewerSHA256
        )
    }
    Write-JsonFile -Path (Join-Path $runRoot '00_PREFLIGHT.json') -Value $preflight
    Write-JsonFile -Path (Join-Path $runRoot '01_FAILURE_AND_REGRESSION_REGISTER.json') -Value ([ordered]@{ ScriptVersion = $script:Version; FailureClasses = $script:FailureRegister })
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) { throw 'APEX_AUDIT_WINDOWS_POWERSHELL_5_1_REQUIRED_DEFECT' }
    if (-not $parser.GatePass) { throw 'APEX_AUDIT_SCRIPT_PARSER_FAILED_DEFECT' }
    if ($ascii.NonAsciiByteCount -ne 0) { throw 'APEX_AUDIT_SCRIPT_NON_ASCII_DEFECT' }
    if ($ascii.Utf8Bom) { throw 'APEX_AUDIT_SCRIPT_BOM_DEFECT' }
    if ($viewerHash -ne $script:ExpectedViewerSHA256) { throw 'APEX_AUDIT_APPROVED_VIEWER_HASH_MISMATCH_DEFECT' }
    if ($contractViewerHash -ne $script:ExpectedViewerSHA256) { throw 'APEX_AUDIT_APPROVED_CONTRACT_HASH_BINDING_DEFECT' }

    $gitPath = Find-Executable -Names @('git.exe','git')
    if ($gitPath) {
        [void](Invoke-NativeCapture -Name 'git-status-before' -FilePath $gitPath -Arguments @('status','--porcelain=v1','--untracked-files=all') -WorkingDirectory $ProjectRoot -EvidenceDirectory (Join-Path $runRoot '02_GIT_STATUS_BEFORE') -TimeoutSec 60)
    }
    else {
        Write-JsonFile -Path (Join-Path $runRoot '02_GIT_STATUS_BEFORE\summary.json') -Value ([ordered]@{ ToolAvailable = $false; CaptureComplete = $false })
    }

    $currentPhase = 'SOURCE_INVENTORY'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 10
    $sourceFiles = @(
        Get-ChildItem -LiteralPath $srcRoot -Recurse -File -ErrorAction Stop |
        Where-Object { $_.Extension.ToLowerInvariant() -in @('.ts','.tsx','.js','.jsx','.css','.scss','.json') -and $_.Length -le 2097152 }
    )
    $extensionGroups = @(
        $sourceFiles | Group-Object Extension | Sort-Object Name | ForEach-Object {
            [pscustomobject]@{ Extension = $_.Name; Count = $_.Count; TotalBytes = [int64](($_.Group | Measure-Object Length -Sum).Sum) }
        }
    )
    $themeCandidates = @(
        $sourceFiles | Where-Object {
            $_.FullName -match '(?i)(watany|theme|visual|approved|recovery|shell|launcher|home|icon|layout|glossy|clone|raster|final)'
        } | ForEach-Object {
            [pscustomobject]@{
                RelativePath = Get-RelativePathSafe -Root $ProjectRoot -Path $_.FullName
                Extension = $_.Extension
                SizeBytes = $_.Length
                SHA256 = Get-ApexSha256 -Path $_.FullName
            }
        }
    )
    $sourceInventory = [ordered]@{
        SourceRoot = $srcRoot
        SourceFileCount = @($sourceFiles).Count
        ExtensionGroups = $extensionGroups
        ThemeCandidateCount = @($themeCandidates).Count
        ThemeCandidates = $themeCandidates
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '03_SOURCE_INVENTORY.json') -Value $sourceInventory -Depth 80

    $currentPhase = 'ROUTE_FEATURE_MATRIX'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 20
    $mandatoryRoutes = @($contractObject.mandatoryRoutes)
    $featureIds = @($contractObject.smartShortcutIds) + @($contractObject.canonicalFeatureIds) + @($contractObject.supplementarySurfaceIds)
    $featureAliases = [ordered]@{
        'most-requested' = @('most-requested','mostRequested','featured-most-requested')
        'latest' = @('latest','featured-latest')
        'for-you' = @('for-you','forYou','featured-important')
        'login' = @('/login','login','auth')
        'profile' = @('/profile','profile')
        'install' = @('install','beforeinstallprompt','pwa')
        'documents' = @('/documents','documents','myDocuments')
        'notifications' = @('/notifications','notifications','notification-badge')
        'messages' = @('/messages','messages','inbox')
        'administration' = @('/admin','administration','superadmin')
        'users' = @('/users','user-management','users')
        'roles' = @('/roles','role-management','roles')
        'activity-log' = @('activity-log','activityLog','audit-log')
        'news' = @('/news','news')
        'fake-fact' = @('fake-fact','fakeFact','fact-check','factCheck')
        'circulars' = @('circulars','recruitment','volunteering')
        'marketplace' = @('/marketplace','marketplace')
        'jobs' = @('/jobs','jobs')
        'ads' = @('/ads','advertisements','classifieds')
        'salary' = @('/salary','pension','salary')
        'forms' = @('/forms','forms','form-viewer','universal-form')
        'schools' = @('/school-grants','schools','school-grants')
        'network' = @('/network','network')
        'taxi' = @('/taxi','taxi')
        'voting' = @('/voting','voting','survey')
        'faq' = @('/faq','faq','frequently-asked')
        'laws' = @('/legal','laws','legal')
        'procedures' = @('/procedures','procedures')
        'world-cup' = @('/world-cup','world-cup','worldcup')
        'community' = @('/community','community')
        'voice' = @('/voice','voice')
        'deaths' = @('/deaths','wafiyat','deceased')
        'health' = @('/health','health')
        'ask-watany' = @('/chat','ask-watany','hybrid-chat')
    }
    $routeRows = @()
    foreach ($route in $mandatoryRoutes) {
        $sourceMatches = @()
        foreach ($file in @($sourceFiles | Where-Object { $_.Extension -match '^\.(ts|tsx|js|jsx)$' })) {
            $text = [System.IO.File]::ReadAllText($file.FullName)
            if ($text.IndexOf([string]$route,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $sourceMatches += Get-RelativePathSafe -Root $ProjectRoot -Path $file.FullName
            }
        }
        $routeRows += [pscustomobject]@{ Route = [string]$route; SourceMatchCount = @($sourceMatches | Select-Object -Unique).Count; SourceMatches = @($sourceMatches | Select-Object -Unique); SourcePresent = (@($sourceMatches).Count -gt 0) }
    }
    $featureRows = @()
    foreach ($featureId in $featureIds) {
        $aliases = @($featureAliases[[string]$featureId])
        $sourceMatches = @()
        foreach ($file in @($sourceFiles | Where-Object { $_.Extension -match '^\.(ts|tsx|js|jsx|json)$' })) {
            $text = [System.IO.File]::ReadAllText($file.FullName)
            $found = $false
            foreach ($alias in $aliases) {
                if ($text.IndexOf([string]$alias,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $found = $true; break }
            }
            if ($found) { $sourceMatches += Get-RelativePathSafe -Root $ProjectRoot -Path $file.FullName }
        }
        $featureRows += [pscustomobject]@{ FeatureId = [string]$featureId; Aliases = $aliases; SourceMatchCount = @($sourceMatches | Select-Object -Unique).Count; SourceMatches = @($sourceMatches | Select-Object -Unique); SourcePresent = (@($sourceMatches).Count -gt 0) }
    }
    $routeFeatureMatrix = [ordered]@{
        MandatoryRouteCount = @($mandatoryRoutes).Count
        PresentRouteCount = @($routeRows | Where-Object { $_.SourcePresent }).Count
        MissingRouteCount = @($routeRows | Where-Object { -not $_.SourcePresent }).Count
        FeatureCount = @($featureIds).Count
        PresentFeatureCount = @($featureRows | Where-Object { $_.SourcePresent }).Count
        MissingFeatureCount = @($featureRows | Where-Object { -not $_.SourcePresent }).Count
        RouteRows = $routeRows
        FeatureRows = $featureRows
        SourcePresenceIsRuntimeProof = $false
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '04_ROUTE_FEATURE_MATRIX.json') -Value $routeFeatureMatrix -Depth 100

    $currentPhase = 'THEME_OWNER_MAP'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 32
    $entryCandidates = @(
        (Join-Path $srcRoot 'main.tsx'),
        (Join-Path $srcRoot 'main.ts'),
        (Join-Path $srcRoot 'index.tsx'),
        (Join-Path $srcRoot 'App.tsx'),
        (Join-Path $srcRoot 'components\AppShell.tsx')
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf }
    $activeCssImports = @()
    foreach ($entry in $entryCandidates) {
        $entryText = [System.IO.File]::ReadAllText($entry)
        $cssMatches = [regex]::Matches($entryText,'(?im)import\s+[''"](?<path>[^''"]+\.css)[''"]')
        foreach ($match in $cssMatches) {
            $relativeImport = [string]$match.Groups['path'].Value
            $resolved = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $entry) $relativeImport))
            $activeCssImports += [pscustomobject]@{ Entry = Get-RelativePathSafe -Root $ProjectRoot -Path $entry; Import = $relativeImport; ResolvedPath = $resolved; Exists = (Test-Path -LiteralPath $resolved -PathType Leaf) }
        }
    }
    $visualVariantFiles = @(
        $sourceFiles | Where-Object {
            $_.Name -match '(?i)(approved|clean|final|forceclone|raster|visualclone|v3|v4|recovery)' -and
            $_.Name -match '(?i)(home|shell|layout|chrome|launcher|theme)'
        } | ForEach-Object { Get-RelativePathSafe -Root $ProjectRoot -Path $_.FullName }
    )
    $mutationRows = @()
    foreach ($file in @($sourceFiles | Where-Object { $_.Extension -match '^\.(ts|tsx|js|jsx)$' })) {
        $text = [System.IO.File]::ReadAllText($file.FullName)
        $terms = @()
        foreach ($term in @('MutationObserver','document.querySelector','document.body.classList','appendChild(','insertAdjacentHTML','setAttribute(')) {
            if ($text.IndexOf($term,[System.StringComparison]::Ordinal) -ge 0) { $terms += $term }
        }
        if (@($terms).Count -gt 0) { $mutationRows += [pscustomobject]@{ RelativePath = Get-RelativePathSafe -Root $ProjectRoot -Path $file.FullName; Terms = $terms } }
    }
    $themeOwnerMap = [ordered]@{
        EntryCandidates = @($entryCandidates | ForEach-Object { Get-RelativePathSafe -Root $ProjectRoot -Path $_ })
        ActiveCssImportCount = @($activeCssImports).Count
        ActiveCssImports = $activeCssImports
        VisualVariantCount = @($visualVariantFiles).Count
        VisualVariantFiles = $visualVariantFiles
        MutationStyleScriptCount = @($mutationRows).Count
        MutationStyleScripts = $mutationRows
        ThemeCandidateCount = @($themeCandidates).Count
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '05_THEME_OWNER_MAP.json') -Value $themeOwnerMap -Depth 100

    $currentPhase = 'THEME_SIGNATURES'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 43
    $viewerText = [System.IO.File]::ReadAllText($ApprovedViewerPath,[System.Text.Encoding]::UTF8)
    $approvedTokenMatches = [regex]::Matches($viewerText,'(?im)(?<name>--[A-Za-z0-9_-]+)\s*:\s*(?<value>[^;\r\n]+);')
    $approvedTokens = @()
    foreach ($match in $approvedTokenMatches) { $approvedTokens += [pscustomobject]@{ Name = $match.Groups['name'].Value; Value = $match.Groups['value'].Value.Trim().ToLowerInvariant() } }
    $approvedColors = @([regex]::Matches($viewerText,'(?i)#[0-9a-f]{6}') | ForEach-Object { $_.Value.ToLowerInvariant() } | Select-Object -Unique)
    $cssFiles = @($sourceFiles | Where-Object { $_.Extension -match '^\.(css|scss)$' })
    $currentColors = @()
    $currentCssText = New-Object System.Text.StringBuilder
    $cssRows = @()
    foreach ($css in $cssFiles) {
        $text = [System.IO.File]::ReadAllText($css.FullName)
        [void]$currentCssText.AppendLine($text)
        $colors = @([regex]::Matches($text,'(?i)#[0-9a-f]{6}') | ForEach-Object { $_.Value.ToLowerInvariant() } | Select-Object -Unique)
        $currentColors += $colors
        $cssRows += [pscustomobject]@{ RelativePath = Get-RelativePathSafe -Root $ProjectRoot -Path $css.FullName; SizeBytes = $css.Length; ColorCount = @($colors).Count; ApprovedColorMatchCount = @($colors | Where-Object { $_ -in $approvedColors }).Count; SHA256 = Get-ApexSha256 -Path $css.FullName }
    }
    $currentColors = @($currentColors | Select-Object -Unique)
    $approvedColorMatches = @($approvedColors | Where-Object { $_ -in $currentColors })
    $keywords = @('welcome','login','topbar','ticker','feature-icon','listing','chat','popup','form-viewer','salary','sticky','drawer','menu')
    $keywordRows = @()
    $allCssLower = $currentCssText.ToString().ToLowerInvariant()
    foreach ($keyword in $keywords) { $keywordRows += [pscustomobject]@{ Keyword = $keyword; Present = ($allCssLower.IndexOf($keyword) -ge 0) } }
    $currentThemeSignature = [ordered]@{
        CssFileCount = @($cssFiles).Count
        CurrentColorCount = @($currentColors).Count
        ApprovedColorMatchCount = @($approvedColorMatches).Count
        ApprovedColorCount = @($approvedColors).Count
        ApprovedColorMatchPercent = $(if (@($approvedColors).Count -gt 0) { [math]::Round(100 * @($approvedColorMatches).Count / @($approvedColors).Count,2) } else { 0 })
        RequiredKeywordCount = @($keywords).Count
        RequiredKeywordPresentCount = @($keywordRows | Where-Object { $_.Present }).Count
        RequiredKeywordPresentPercent = [math]::Round(100 * @($keywordRows | Where-Object { $_.Present }).Count / @($keywords).Count,2)
        KeywordRows = $keywordRows
        CssRows = $cssRows
        PublicVisualAssetCount = @(
            Get-ChildItem -LiteralPath (Join-Path $webRoot 'public') -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Extension -match '^\.(png|svg|jpg|jpeg|webp)$' -and $_.FullName -match '(?i)watany|icon|logo' }
        ).Count
        GatePass = $true
    }
    $approvedThemeSignature = [ordered]@{
        ViewerPath = $ApprovedViewerPath
        ViewerSHA256 = $viewerHash
        ScreenIds = @($contractObject.screenIds)
        SmartShortcutIds = @($contractObject.smartShortcutIds)
        CanonicalFeatureIds = @($contractObject.canonicalFeatureIds)
        SupplementarySurfaceIds = @($contractObject.supplementarySurfaceIds)
        TokenCount = @($approvedTokens).Count
        Tokens = $approvedTokens
        ApprovedColors = $approvedColors
        Requirements = $contractObject.requirements
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '06_CURRENT_THEME_SIGNATURE.json') -Value $currentThemeSignature -Depth 100
    Write-JsonFile -Path (Join-Path $runRoot '07_APPROVED_THEME_SIGNATURE.json') -Value $approvedThemeSignature -Depth 100

    $currentPhase = 'BASELINE_AUTHORITY'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 53
    $reportFiles = @(
        Get-ChildItem -LiteralPath (Join-Path $ProjectRoot '.pma') -Recurse -Filter 'FINAL_REPORT.json' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First $MaxEvidenceReports
    )
    $baselineCandidates = @()
    foreach ($reportFile in $reportFiles) {
        try {
            $raw = [System.IO.File]::ReadAllText($reportFile.FullName)
            $object = $raw | ConvertFrom-Json
            $score = 0
            if ($raw -match '(?i)"greenAuthority"\s*:\s*true') { $score += 50 }
            if ($raw -match '(?i)"finalAuthorizationPass"\s*:\s*true') { $score += 40 }
            if ($raw -match '(?i)"finalStatus"\s*:\s*"PASS"') { $score += 25 }
            if ($raw -match '(?i)"exitCode"\s*:\s*0') { $score += 15 }
            if ($raw -match '(?i)SOURCE_OF_TRUTH.*GREEN') { $score += 25 }
            if ($raw -match '(?i)"sourceFiles"\s*:') { $score += 20 }
            if ($score -gt 0) {
                $baselineCandidates += [pscustomobject]@{
                    Path = $reportFile.FullName
                    RelativePath = Get-RelativePathSafe -Root $ProjectRoot -Path $reportFile.FullName
                    LastWriteTimeUtc = $reportFile.LastWriteTimeUtc.ToString('o')
                    Score = $score
                    SHA256 = Get-ApexSha256 -Path $reportFile.FullName
                    ParsedObject = $object
                }
            }
        }
        catch {}
    }
    $selectedBaseline = $baselineCandidates | Sort-Object Score,LastWriteTimeUtc -Descending | Select-Object -First 1
    $baselineSourceRows = @()
    if ($selectedBaseline) {
        $baselineAuthorityObject = Get-PropertyValue -Object $selectedBaseline.ParsedObject -Name 'baselineAuthority'
        $sourceRowsObject = Get-PropertyValue -Object $baselineAuthorityObject -Name 'sourceFiles'
        foreach ($row in @($sourceRowsObject)) {
            $pathValue = [string](Get-PropertyValue -Object $row -Name 'path')
            $expectedValue = [string](Get-PropertyValue -Object $row -Name 'expectedSha256')
            if (-not $expectedValue) { $expectedValue = [string](Get-PropertyValue -Object $row -Name 'actualSha256') }
            if ($pathValue) {
                $currentPath = Join-Path $ProjectRoot $pathValue
                $exists = Test-Path -LiteralPath $currentPath -PathType Leaf
                $currentHash = $(if ($exists) { Get-ApexSha256 -Path $currentPath } else { '' })
                $baselineSourceRows += [pscustomobject]@{ RelativePath = $pathValue; ExpectedSHA256 = $expectedValue.ToLowerInvariant(); CurrentSHA256 = $currentHash; Exists = $exists; Match = ($exists -and $expectedValue -and $currentHash -eq $expectedValue.ToLowerInvariant()) }
            }
        }
    }
    $baselineAuthority = [ordered]@{
        ScannedReportCount = @($reportFiles).Count
        CandidateCount = @($baselineCandidates).Count
        Selected = $(if ($selectedBaseline) { [ordered]@{ Path = $selectedBaseline.Path; RelativePath = $selectedBaseline.RelativePath; Score = $selectedBaseline.Score; SHA256 = $selectedBaseline.SHA256; LastWriteTimeUtc = $selectedBaseline.LastWriteTimeUtc } } else { $null })
        AuthoritativeGreenBaselineFound = ($null -ne $selectedBaseline -and $selectedBaseline.Score -ge 65)
        BaselineSourceRowCount = @($baselineSourceRows).Count
        BaselineSourceMatchCount = @($baselineSourceRows | Where-Object { $_.Match }).Count
        BaselineSourceMatchPercent = $(if (@($baselineSourceRows).Count -gt 0) { [math]::Round(100 * @($baselineSourceRows | Where-Object { $_.Match }).Count / @($baselineSourceRows).Count,2) } else { 0 })
        BaselineSourceRows = $baselineSourceRows
        FullProductRebuildAuthorized = $false
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '08_BASELINE_AUTHORITY.json') -Value $baselineAuthority -Depth 100

    $currentPhase = 'RUNTIME_VALIDATION'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 64
    $validationResults = [ordered]@{
        Attempted = $runtimeEvidenceAttempted
        Typecheck = $null
        Build = $null
        FullTests = $null
        PlaywrightResolution = $null
        Browser = $null
        BrowserReportPath = $null
        BrowserReport = $null
        RuntimeEvidenceComplete = $false
    }
    if (-not $SkipRuntimeValidation) {
        $nodePath = Find-Executable -Names @('node.exe','node')
        $pnpmPath = Find-Executable -Names @('pnpm.cmd','pnpm')
        $npmPath = Find-Executable -Names @('npm.cmd','npm')
        $packageTool = ''
        $packageToolName = ''
        if ($pnpmPath) { $packageTool = $pnpmPath; $packageToolName = 'pnpm' }
        elseif ($npmPath) { $packageTool = $npmPath; $packageToolName = 'npm' }
        if ($packageTool -and $nodePath) {
            $typeArgs = $(if ($packageToolName -eq 'pnpm') { @('run','typecheck') } else { @('run','typecheck') })
            $validationResults.Typecheck = Invoke-NativeCapture -Name 'typecheck' -FilePath $packageTool -Arguments $typeArgs -WorkingDirectory $webRoot -EvidenceDirectory (Join-Path $runRoot '09_RUNTIME_VALIDATION\typecheck') -TimeoutSec $NativeTimeoutSec
            $buildArgs = $(if ($packageToolName -eq 'pnpm') { @('exec','vite','build','--outDir',(Join-Path $runRoot 'validation-dist'),'--emptyOutDir') } else { @('exec','--','vite','build','--outDir',(Join-Path $runRoot 'validation-dist'),'--emptyOutDir') })
            $validationResults.Build = Invoke-NativeCapture -Name 'build' -FilePath $packageTool -Arguments $buildArgs -WorkingDirectory $webRoot -EvidenceDirectory (Join-Path $runRoot '09_RUNTIME_VALIDATION\build') -TimeoutSec $NativeTimeoutSec
            if ($RunFullTests) {
                $testArgs = $(if ($packageToolName -eq 'pnpm') { @('exec','vitest','run') } else { @('exec','--','vitest','run') })
                $validationResults.FullTests = Invoke-NativeCapture -Name 'full-tests' -FilePath $packageTool -Arguments $testArgs -WorkingDirectory $webRoot -EvidenceDirectory (Join-Path $runRoot '09_RUNTIME_VALIDATION\full-tests') -TimeoutSec $NativeTimeoutSec
            }
            $playwright = Invoke-NativeCapture -Name 'playwright-resolution' -FilePath $nodePath -Arguments @('-e',"require.resolve('playwright');process.stdout.write('PLAYWRIGHT_OK')") -WorkingDirectory $webRoot -EvidenceDirectory (Join-Path $runRoot '09_RUNTIME_VALIDATION\playwright-resolution') -TimeoutSec 60
            $validationResults.PlaywrightResolution = $playwright
            if ($playwright.ExitCode -eq 0 -and $playwright.StderrLength -eq 0) {
                $serverArgs = $(if ($packageToolName -eq 'pnpm') { @('exec','vite','--host','127.0.0.1','--port',[string]$RuntimePort) } else { @('exec','--','vite','--host','127.0.0.1','--port',[string]$RuntimePort) })
                $serverHandle = Start-LongRunningProcess -FilePath $packageTool -Arguments $serverArgs -WorkingDirectory $webRoot
                $baseUrl = 'http://127.0.0.1:' + [string]$RuntimePort
                if (-not (Test-HttpReady -Url ($baseUrl + '/') -TimeoutSec 120)) { throw 'APEX_AUDIT_RUNTIME_SERVER_HEALTH_TIMEOUT_DEFECT' }
                $browserScript = Join-Path $runRoot '09_RUNTIME_VALIDATION\browser-audit.cjs'
                Write-AsciiLines -Path $browserScript -Lines (Get-BrowserAuditLines)
                $browserReport = Join-Path $runRoot '09_RUNTIME_VALIDATION\browser-report.json'
                $screenshots = Join-Path $runRoot '09_RUNTIME_VALIDATION\screenshots'
                $routesJson = $mandatoryRoutes | ConvertTo-Json -Compress
                $validationResults.Browser = Invoke-NativeCapture -Name 'browser-audit' -FilePath $nodePath -Arguments @($browserScript,$baseUrl,$browserReport,$screenshots,$routesJson) -WorkingDirectory $webRoot -EvidenceDirectory (Join-Path $runRoot '09_RUNTIME_VALIDATION\browser-process') -TimeoutSec 600
                if (Test-Path -LiteralPath $browserReport -PathType Leaf) {
                    $validationResults.BrowserReportPath = $browserReport
                    $validationResults.BrowserReport = Get-Content -Raw -LiteralPath $browserReport | ConvertFrom-Json
                }
            }
            $runtimeEvidenceComplete = (
                $null -ne $validationResults.Typecheck -and
                $null -ne $validationResults.Build -and
                $null -ne $validationResults.BrowserReport
            )
        }
    }
    $validationResults.RuntimeEvidenceComplete = $runtimeEvidenceComplete
    Write-JsonFile -Path (Join-Path $runRoot '09_VALIDATION_RESULTS.json') -Value $validationResults -Depth 100

    $currentPhase = 'STRATEGY_SCORING'
    Write-Progress -Activity 'APEX WatanyBot status and theme strategy audit' -Status $currentPhase -PercentComplete 84
    $routePercent = [math]::Round(100 * $routeFeatureMatrix.PresentRouteCount / [math]::Max(1,$routeFeatureMatrix.MandatoryRouteCount),2)
    $featurePercent = [math]::Round(100 * $routeFeatureMatrix.PresentFeatureCount / [math]::Max(1,$routeFeatureMatrix.FeatureCount),2)
    $typecheckPass = ($null -ne $validationResults.Typecheck -and $validationResults.Typecheck.ExitCode -eq 0 -and $validationResults.Typecheck.StderrLength -eq 0)
    $buildPass = ($null -ne $validationResults.Build -and $validationResults.Build.ExitCode -eq 0 -and $validationResults.Build.StderrLength -eq 0)
    $browserRoutePercent = 0
    $browserGeometryPercent = 0
    if ($null -ne $validationResults.BrowserReport -and $validationResults.BrowserReport.totalRowCount -gt 0) {
        $browserRoutePercent = [math]::Round(100 * $validationResults.BrowserReport.routePassCount / $validationResults.BrowserReport.totalRowCount,2)
        $browserGeometryPercent = [math]::Round(100 * $validationResults.BrowserReport.geometryPassCount / $validationResults.BrowserReport.totalRowCount,2)
    }
    $functionalScore = [math]::Round(
        0.25 * $routePercent +
        0.20 * $featurePercent +
        0.15 * $(if ($typecheckPass) { 100 } elseif ($runtimeEvidenceAttempted) { 0 } else { 50 }) +
        0.15 * $(if ($buildPass) { 100 } elseif ($runtimeEvidenceAttempted) { 0 } else { 50 }) +
        0.15 * $(if ($runtimeEvidenceComplete) { $browserRoutePercent } else { 50 }) +
        0.10 * $(if ($baselineAuthority.AuthoritativeGreenBaselineFound) { [math]::Max(50,$baselineAuthority.BaselineSourceMatchPercent) } else { 0 }),
        2
    )
    $themeScore = [math]::Round(
        0.35 * $currentThemeSignature.ApprovedColorMatchPercent +
        0.35 * $currentThemeSignature.RequiredKeywordPresentPercent +
        0.15 * [math]::Min(100,10 * $currentThemeSignature.PublicVisualAssetCount) +
        0.15 * $(if ($themeOwnerMap.ActiveCssImportCount -ge 1 -and $themeOwnerMap.ActiveCssImportCount -le 4) { 100 } elseif ($themeOwnerMap.ActiveCssImportCount -le 8) { 50 } else { 10 }),
        2
    )
    $fragmentationScore = [math]::Min(100,
        8 * $themeOwnerMap.VisualVariantCount +
        4 * $themeOwnerMap.MutationStyleScriptCount +
        3 * [math]::Max(0,$themeOwnerMap.ActiveCssImportCount - 4)
    )
    $baselineAvailable = [bool]$baselineAuthority.AuthoritativeGreenBaselineFound
    if ($functionalScore -ge 80 -and $fragmentationScore -le 35) {
        if ($themeScore -ge 70) { $recommendedStrategy = 'PATCH_IN_PLACE' }
        else { $recommendedStrategy = 'CONTROLLED_THEME_OVERLAY_ON_CURRENT_FUNCTIONAL_OWNERS' }
    }
    elseif ($baselineAvailable -and $functionalScore -ge 55) {
        $recommendedStrategy = 'BASELINE_PLUS_VISUAL_SALVAGE'
    }
    elseif ($baselineAvailable) {
        $recommendedStrategy = 'CLEAN_PRESENTATION_REBUILD_ON_GREEN_BASELINE'
    }
    elseif ($functionalScore -ge 65) {
        $recommendedStrategy = 'CONTROLLED_THEME_OVERLAY_ON_CURRENT_FUNCTIONAL_OWNERS'
    }
    else {
        $recommendedStrategy = 'BLOCKED_BASELINE_AUTHORITY_REQUIRED'
    }
    $productReadiness = $(if ($functionalScore -ge 85 -and $themeScore -ge 80 -and $browserRoutePercent -ge 95 -and $browserGeometryPercent -ge 95) { 'GREEN_CANDIDATE_REQUIRES_FULL_RELEASE_GATE' } elseif ($functionalScore -ge 65) { 'RECOVERABLE_PATCH_OR_OVERLAY' } elseif ($baselineAvailable) { 'RESTORE_GREEN_BASELINE_THEN_APPLY_THEME' } else { 'BLOCKED' })
    $scorecard = [ordered]@{
        RouteSourceCoveragePercent = $routePercent
        FeatureSourceCoveragePercent = $featurePercent
        BrowserRouteCoveragePercent = $browserRoutePercent
        BrowserGeometryCoveragePercent = $browserGeometryPercent
        FunctionalScore = $functionalScore
        ThemeConformanceScore = $themeScore
        FragmentationScore = $fragmentationScore
        BaselineAuthorityAvailable = $baselineAvailable
        BaselineSourceMatchPercent = $baselineAuthority.BaselineSourceMatchPercent
        RecommendedStrategy = $recommendedStrategy
        ProductReadiness = $productReadiness
        FullProductRebuildAuthorized = $false
        InstallFromScratchScope = 'PRESENTATION_LAYER_ON_GREEN_BASELINE_ONLY'
        DecisionRulesVersion = '1.0'
        GatePass = $true
    }
    Write-JsonFile -Path (Join-Path $runRoot '10_STRATEGY_SCORECARD.json') -Value $scorecard -Depth 50

    $summaryLines = @(
        '# WatanyBot Current State and Theme Strategy Audit',
        '',
        ('Evidence root: ' + $runRoot),
        ('Approved viewer SHA-256: ' + $viewerHash),
        ('Functional score: ' + [string]$functionalScore),
        ('Theme conformance score: ' + [string]$themeScore),
        ('Fragmentation score: ' + [string]$fragmentationScore),
        ('Baseline authority available: ' + [string]$baselineAvailable),
        ('Recommended strategy: ' + $recommendedStrategy),
        ('Product readiness: ' + $productReadiness),
        '',
        'Full product rebuild is not authorized.',
        'Install-from-scratch means presentation-layer reconstruction on the authoritative green baseline only.',
        'Source presence is not runtime proof. Use the validation and browser evidence before implementation.'
    )
    Write-AsciiLines -Path (Join-Path $runRoot '11_AUDIT_SUMMARY.md') -Lines $summaryLines

    if ($runtimeEvidenceComplete) {
        $finalStatus = 'AUDIT_COMPLETE'
        $finalToken = $script:CompleteToken
        $finalExitCode = $script:ExitComplete
    }
    else {
        $finalStatus = 'AUDIT_COMPLETE_RUNTIME_UNVERIFIED'
        $finalToken = $script:UnverifiedToken
        $finalExitCode = $script:ExitUnverified
    }
}
catch {
    $failureClass = Resolve-FailureClass -Exception $_.Exception
    $failureMessage = [string]$_.Exception.Message
    if ($runRoot) {
        Write-JsonFile -Path (Join-Path $runRoot 'UNHANDLED_EXCEPTION_DETAIL.json') -Value ([ordered]@{
            ExceptionType = $_.Exception.GetType().FullName
            ExceptionMessage = $_.Exception.Message
            FullyQualifiedErrorId = $_.FullyQualifiedErrorId
            CategoryInfo = [string]$_.CategoryInfo
            ScriptStackTrace = $_.ScriptStackTrace
            CurrentPhase = $currentPhase
        })
    }
}
finally {
    if ($serverHandle -and $runRoot) {
        try { [void](Stop-LongRunningProcess -Handle $serverHandle -EvidenceDirectory (Join-Path $runRoot '12_RUNTIME_CLEANUP')) }
        catch {
            if (-not $failureClass) {
                $failureClass = 'APEX_AUDIT_RUNTIME_PROCESS_CLEANUP_FAILED_DEFECT'
                $failureMessage = $_.Exception.Message
                $finalStatus = 'BLOCKED'
                $finalToken = $script:BlockedToken
                $finalExitCode = $script:ExitBlocked
            }
        }
    }
    if ($runRoot) {
        $finalReport = [ordered]@{
            ScriptVersion = $script:Version
            ProjectRoot = $ProjectRoot
            EvidenceRoot = $runRoot
            ApprovedViewerPath = $ApprovedViewerPath
            ApprovedViewerSHA256 = $script:ExpectedViewerSHA256
            StartedUtc = $startedUtc.ToString('o')
            EndedUtc = [DateTime]::UtcNow.ToString('o')
            FinalStatus = $finalStatus
            ExitCode = $finalExitCode
            FinalToken = $finalToken
            FailureClass = $failureClass
            FailureMessage = $failureMessage
            LastPhase = $currentPhase
            RuntimeEvidenceAttempted = $runtimeEvidenceAttempted
            RuntimeEvidenceComplete = $runtimeEvidenceComplete
            ProductReadiness = $productReadiness
            RecommendedStrategy = $recommendedStrategy
            FullProductRebuildAuthorized = $false
            SourceMutationPerformed = $false
            GitMutationPerformed = $false
        }
        Write-JsonFile -Path (Join-Path $runRoot 'FINAL_REPORT.json') -Value $finalReport -Depth 50
        Write-AsciiLines -Path (Join-Path $runRoot 'FINAL.marker') -Lines @($finalToken)
        try {
            $manifestRows = @()
            foreach ($file in @(Get-ChildItem -LiteralPath $runRoot -Recurse -File -ErrorAction Stop | Where-Object { $_.Name -ne 'SHA256SUMS.json' })) {
                $manifestRows += [pscustomobject]@{ RelativePath = Get-RelativePathSafe -Root $runRoot -Path $file.FullName; SizeBytes = $file.Length; SHA256 = Get-ApexSha256 -Path $file.FullName }
            }
            Write-JsonFile -Path (Join-Path $runRoot 'SHA256SUMS.json') -Value ([ordered]@{ Rows = $manifestRows; EntryCount = @($manifestRows).Count; GatePass = $true }) -Depth 100
        }
        catch {
            $failureClass = 'APEX_AUDIT_EVIDENCE_MANIFEST_FAILED_DEFECT'
            $failureMessage = $_.Exception.Message
            $finalStatus = 'BLOCKED'
            $finalToken = $script:BlockedToken
            $finalExitCode = $script:ExitBlocked
            $finalReport.FinalStatus = $finalStatus
            $finalReport.ExitCode = $finalExitCode
            $finalReport.FinalToken = $finalToken
            $finalReport.FailureClass = $failureClass
            $finalReport.FailureMessage = $failureMessage
            Write-JsonFile -Path (Join-Path $runRoot 'FINAL_REPORT.json') -Value $finalReport -Depth 50
            Write-AsciiLines -Path (Join-Path $runRoot 'FINAL.marker') -Lines @($finalToken)
        }
    }
    Write-Host ('FINAL_STATUS=' + $finalStatus)
    Write-Host ('EXIT_CODE=' + [string]$finalExitCode)
    Write-Host ('FINAL_TOKEN=' + $finalToken)
    Write-Host ('FAILURE_CLASS=' + $failureClass)
    Write-Host ('PRODUCT_READINESS=' + $productReadiness)
    Write-Host ('RECOMMENDED_STRATEGY=' + $recommendedStrategy)
    Write-Host ('EVIDENCE_ROOT=' + $runRoot)
}

exit $finalExitCode
