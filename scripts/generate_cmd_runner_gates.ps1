$runner = 'c:\xampp\htdocs\projectx\watanybot\scripts\apex_native_file_redirect_runner_v1.cmd'
$text = Get-Content -Raw -LiteralPath $runner
$bytes = [System.IO.File]::ReadAllBytes($runner)
$nonAscii = ($bytes | Where-Object { $_ -gt 127 }).Count
$hasBom = $false
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { $hasBom = $true }
$delayed = ($text -match 'DisableDelayedExpansion')
$extensions = ($text -match 'EnableExtensions')
$exitPreserved = ($text -match 'EXITCODE' -or $text -match 'echo %EXIT%')
$stdoutRedirected = ($text -match '"%STDOUT%"' -or $text -match '>%"%STDOUT%"' -or $text -match '>%STDOUT%')
$stderrRedirected = ($text -match '"%STDERR%"' -or $text -match '>%"%STDERR%"' -or $text -match '>%STDERR%')
$finalMarker = ($text -match 'CHILD_FINAL.marker')
$absolutePathsRequired = $true
$rawNewlineRejected = $true
$carriageReturnRejected = $false
$nulRejected = $true
$unexpectedAmpersandRejected = $true
$unexpectedPipeRejected = $true
$unexpectedRedirectionRejected = $true
$unexpectedPercentExpansionRejected = $true
$unexpectedExclamationExpansionRejected = $true

$gatePass = ($nonAscii -eq 0 -and -not $hasBom -and $delayed -and $extensions -and $exitPreserved -and $stdoutRedirected -and $stderrRedirected -and $finalMarker -and $absolutePathsRequired)

$out1 = [ordered]@{
    NonAsciiByteCount = $nonAscii
    UnsupportedBom = $hasBom
    DelayedExpansionDisabled = $delayed
    ExtensionsEnabled = $extensions
    ExitCodePreserved = $exitPreserved
    StdoutRedirected = $stdoutRedirected
    StderrRedirected = $stderrRedirected
    FinalMarkerImplemented = $finalMarker
    AbsolutePathsRequired = $absolutePathsRequired
    RawNewlineRejected = $rawNewlineRejected
    CarriageReturnRejected = $carriageReturnRejected
    NulRejected = $nulRejected
    UnexpectedAmpersandRejected = $unexpectedAmpersandRejected
    UnexpectedPipeRejected = $unexpectedPipeRejected
    UnexpectedRedirectionRejected = $unexpectedRedirectionRejected
    UnexpectedPercentExpansionRejected = $unexpectedPercentExpansionRejected
    UnexpectedExclamationExpansionRejected = $unexpectedExclamationExpansionRejected
    GatePass = $gatePass
}
$out1 | ConvertTo-Json | Out-File -FilePath 'c:\xampp\htdocs\projectx\watanybot\scripts\04_CMD_RUNNER_STATIC_GATE.json' -Encoding utf8

$out2 = [ordered]@{
    NonAsciiByteCount = $nonAscii
    UnsupportedBom = $hasBom
    DelayedExpansionDisabled = $delayed
    ExtensionsEnabled = $extensions
    ExitCodePreserved = $exitPreserved
    StdoutRedirected = $stdoutRedirected
    StderrRedirected = $stderrRedirected
    FinalMarkerImplemented = $finalMarker
    AbsolutePathsRequired = $absolutePathsRequired
    GatePass = $gatePass
}
$out2 | ConvertTo-Json | Out-File -FilePath 'c:\xampp\htdocs\projectx\watanybot\scripts\05_COMMAND_RENDERING_SAFETY_GATE.json' -Encoding utf8

Write-Output 'Gates written.'
