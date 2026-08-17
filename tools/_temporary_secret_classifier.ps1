param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$EvidenceRoot
)

$ErrorActionPreference = 'Stop'
$jsonlPath = Join-Path $EvidenceRoot 'worktree-candidate-inventory.jsonl'
$summaryPath = Join-Path $EvidenceRoot 'worktree-candidate-summary.json'
$writer = [IO.StreamWriter]::new($jsonlPath, $false, [Text.Encoding]::UTF8)
$skipDirs = '\\(node_modules|\.venv|dist|build|coverage|\.git|\.cache|\.next|__pycache__|\.pma|\.apex|\.watany\.pma|\.git-backups|\.git-filter-repo-mirror|_watany_diagnostics)\\'
$skipExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.gz', '.db', '.sqlite', '.pyc', '.pyd', '.dll', '.exe', '.bin', '.map', '.lock', '.bundle', '.pack', '.tar')
$rules = @(
    [PSCustomObject]@{ Name = 'PRIVATE_KEY'; Regex = '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
    [PSCustomObject]@{ Name = 'BEARER_TOKEN'; Regex = '(?i)bearer\s+[A-Za-z0-9._~+/=-]{20,}' },
    [PSCustomObject]@{ Name = 'JWT'; Regex = '\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b' },
    [PSCustomObject]@{ Name = 'CREDENTIAL_ASSIGNMENT'; Regex = '(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|auth[_-]?token)\b\s*[:=]' },
    [PSCustomObject]@{ Name = 'CONNECTION_STRING'; Regex = '(?i)(mongodb|postgres|mysql|redis)://[^\s"'']+:[^\s"'']+@' },
    [PSCustomObject]@{ Name = 'AWS_ACCESS_KEY'; Regex = '\bAKIA[0-9A-Z]{16}\b' }
)
$counts = @{ CONFIRMED_SECRET = 0; HIGH_CONFIDENCE_SECRET = 0; DOCUMENTATION_PLACEHOLDER = 0; TEST_FIXTURE_NON_SECRET = 0; FALSE_POSITIVE = 0; UNRESOLVED = 0 }
$fileCount = 0
$candidateCount = 0
$readErrorCount = 0
$oversizeCount = 0
$readErrors = New-Object System.Collections.Generic.List[string]

try {
    foreach ($relativePath in @(git -C $Repository ls-files -co --exclude-standard)) {
        if ([string]::IsNullOrWhiteSpace($relativePath)) { continue }
        $fullPath = Join-Path $Repository $relativePath
        try { $extension = [IO.Path]::GetExtension($relativePath).ToLowerInvariant() } catch { continue }
        if ($fullPath -match $skipDirs -or $skipExtensions -contains $extension) { continue }
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { continue }
        try { $fileInfo = Get-Item -LiteralPath $fullPath -ErrorAction Stop } catch { continue }
        if ($fileInfo.Length -gt 20000000) { $oversizeCount++; continue }
        $fileCount++
        try {
            $reader = [IO.StreamReader]::new($fullPath, [Text.Encoding]::UTF8, $true)
            $lineNumber = 0
            while (($line = $reader.ReadLine()) -ne $null) {
                $lineNumber++
                foreach ($rule in $rules) {
                    $match = [regex]::Match($line, $rule.Regex)
                    if (-not $match.Success) { continue }
                    $candidateCount++
                    $lineText = $line.Trim()
                    $lower = ($line + ' ' + $relativePath).ToLowerInvariant()
                    $hashBytes = [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($lineText))
                    $redactedHash = ([BitConverter]::ToString($hashBytes)).Replace('-', '')
                    $placeholder = $lower -match 'replace_with_|replace-me|replace-locally|placeholder|your[-_ ]|example\.invalid|sample|dummy|fake|changeme|<value>|<secret>|<token>|user:pass@|password123|not-a-real'
                    $expression = $lower -match 'process\.env|import\.meta\.env|os\.getenv|settings\.|config\.|hash_password|verify_password|password_hash|password_field|undefined|null|none|secrets\.|github\.token|secretname|env\.'
                    $declaration = $lower -match '\b(interface|type|enum|schema|label|placeholder|field|prop|parameter|argument|description|documentation)\b|^\s*(#|//|/\*|\*)'
                    $testFixture = ($relativePath -match '(?i)(test|spec|fixture|mock|sample|example)') -and ($lower -match 'localhost|127\.0\.0\.1|fake|dummy|fixture|sample|test[_-]?(token|secret|password)')
                    $strongRule = $rule.Name -in @('PRIVATE_KEY', 'JWT', 'BEARER_TOKEN', 'AWS_ACCESS_KEY')
                    $assignmentMatch = [regex]::Match($line, '(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|auth[_-]?token)\b\s*[:=]\s*(?<value>.*)$')
                    $literalAssignment = $assignmentMatch.Success -and ($assignmentMatch.Groups['value'].Value.Trim() -match '^["''][^"'']{4,}["'']$|^[A-Za-z0-9_./:+=@-]{8,}$')
                    if ($placeholder) { $classification = 'DOCUMENTATION_PLACEHOLDER' }
                    elseif ($testFixture) { $classification = 'TEST_FIXTURE_NON_SECRET' }
                    elseif ($expression -or $declaration -or -not $literalAssignment) { $classification = 'FALSE_POSITIVE' }
                    elseif ($strongRule) { $classification = 'HIGH_CONFIDENCE_SECRET' }
                    else { $classification = 'UNRESOLVED' }
                    $counts[$classification]++
                    $record = [ordered]@{
                        CANDIDATE_ID = ('WT-{0:D6}' -f $candidateCount)
                        PATH = $relativePath
                        LINE_NUMBER = $lineNumber
                        CATEGORY = $rule.Name
                        REDACTED_VALUE_SHA256 = $redactedHash
                        VALUE_LENGTH = $lineText.Length
                        MATCH_RULE = $rule.Name
                        CLASSIFICATION = $classification
                        DISPOSITION = if ($classification -in @('HIGH_CONFIDENCE_SECRET', 'UNRESOLVED')) { 'BLOCKING' } else { 'NON_BLOCKING' }
                    }
                    $writer.WriteLine(($record | ConvertTo-Json -Compress))
                    break
                }
            }
            $reader.Dispose()
        }
        catch {
            $readErrorCount++
            $readErrors.Add($relativePath)
        }
    }
}
finally {
    $writer.Flush()
    $writer.Dispose()
}

$gate = if ($readErrorCount -eq 0 -and $oversizeCount -eq 0 -and $counts.CONFIRMED_SECRET -eq 0 -and $counts.HIGH_CONFIDENCE_SECRET -eq 0 -and $counts.UNRESOLVED -eq 0) { 'PASS' } else { 'BLOCKED' }
$summary = [ordered]@{
    VERSIONABLE_TEXT_FILE_COUNT = $fileCount
    SKIPPED_OVERSIZE_FILE_COUNT = $oversizeCount
    READ_ERROR_COUNT = $readErrorCount
    READ_ERROR_PATHS = @($readErrors)
    CANDIDATE_COUNT = $candidateCount
    COUNTS = $counts
    WORKTREE_SECRET_SCAN_GATE = $gate
    EVIDENCE_JSONL = $jsonlPath
}
$summary | ConvertTo-Json -Depth 8 | Set-Content $summaryPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 8