param(
    [Parameter(Mandatory=$true)]
    [string]$ScriptPath,

    [Parameter(Mandatory=$true)]
    [string]$ProofPath
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$parseTokens = $null
$parseErrors = $null

[void][System.Management.Automation.Language.Parser]::ParseFile(
    $ScriptPath,
    [ref]$parseTokens,
    [ref]$parseErrors
)

$scriptHash = (
    Get-FileHash `
        -LiteralPath $ScriptPath `
        -Algorithm SHA256 `
        -ErrorAction Stop
).Hash

$proofStatus = 'BLOCKED'

if (@($parseErrors).Count -eq 0) {
    $proofStatus = 'PASS'
}

$proofObject = [ordered]@{
    status     = $proofStatus
    sha256     = $scriptHash
    errorCount = @($parseErrors).Count
    psVersion  = $PSVersionTable.PSVersion.ToString()
    errors     = @(
        $parseErrors |
            ForEach-Object {
                [ordered]@{
                    line    = $_.Extent.StartLineNumber
                    column  = $_.Extent.StartColumnNumber
                    errorId = $_.ErrorId
                    message = $_.Message
                }
            }
    )
}

$proofObject |
    ConvertTo-Json -Depth 8 |
    Set-Content `
        -LiteralPath $ProofPath `
        -Encoding UTF8 `
        -ErrorAction Stop

$proofObject | ConvertTo-Json -Depth 8

if ($proofStatus -ne 'PASS') {
    exit 21
}

exit 0
