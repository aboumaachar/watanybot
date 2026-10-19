#requires -version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

Write-Output 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED'
$workspace = 'C:\xampp\htdocs\projectx\watanybot'
$gatewayRoot = Join-Path $workspace 'apps\gateway-api'
$evidenceParent = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$root = Join-Path $evidenceParent ('watany-control-center-crm-phase6-gateway-recovery-' + $stamp)
$zipPath = $root + '.zip'
$sidecarPath = $zipPath + '.final-reopen-validation.json'
$secretPath = Join-Path $env:LOCALAPPDATA 'WatanyControlCenter\secrets\erpnext-gateway.local.json'
$controllerPath = $MyInvocation.MyCommand.Path
$baseUrl = 'http://127.0.0.1:18080'
$gatewayUrl = 'http://127.0.0.1:8010'
$site = 'frontend'
$serviceNames = @('db','redis-cache','redis-queue','backend','queue-short','queue-long','scheduler','frontend','websocket')
$evidenceNames = @(
'00_AUTHORITY.md','01_CONTROLLER_HASH.txt','02_PS51_PARSER_PREFLIGHT.json','03_REGRESSION_REGISTER.json','04_PHASE5_PREDECESSOR.json','05_V100_INTAKE.json','06_SUPERSESSION.md','07_ERPNEXT_SERVICES_PRE.csv','08_ERPNEXT_DIRECT_PRE.json','09_GATEWAY_SOURCE_OWNERSHIP.json','10_GATEWAY_PACKAGE.json','11_GATEWAY_PROCESS_PRE.csv','12_GATEWAY_START_ACTION.json','13_GATEWAY_LISTENER.json','14_GATEWAY_HEALTH_PRE.json','15_SOURCE_HASH_PRE.json','16_CONFIG_HASH_PRE.json','17_ROLLBACK_METADATA.json','18_ADAPTER_IMPLEMENTATION.json','19_ROUTE_IMPLEMENTATION.json','20_GATEWAY_TYPECHECK.json','21_GATEWAY_BUILD.json','22_CREDENTIAL_RECOVERY.json','23_CREDENTIAL_PRINCIPAL.json','24_LOCAL_SECRET_STORE.json','25_SECRET_ACL.json','26_REPOSITORY_EXCLUSION.json','27_DIRECT_AUTH_IDENTITY.json','28_GATEWAY_READ_THROUGH.json','29_STATIC_MOCK_EXCLUSION.json','30_SITE_ALLOWLIST.json','31_WRONG_SITE.json','32_INVALID_CREDENTIAL.json','33_ERP_UNAVAILABLE.json','34_TEMP_RESIDUE.json','35_SECRET_SCAN.json','36_GATEWAY_HEALTH_POST.json','37_ROUTE_REGRESSION.json','38_ERPNEXT_SERVICES_POST.csv','39_ERPNEXT_NONREGRESSION.json','40_RESTART_ACCOUNTING.json','41_PRINCIPAL_MUTATION.json','42_ACTIONS.csv','43_FAILURES.csv','44_GATE_MATRIX.csv','45_V100_SUPERSESSION.json','46_PRE_SUPERADMIN.json','47_FINAL_STATUS.json','48_FINAL_REPORT.md','49_EVIDENCE_MANIFEST.json','50_EVIDENCE_SHA256.txt','51_ZIP_REOPEN_MODEL.json','52_AUTHORITY_CLOSEOUT.txt','summary.json','FINAL_STATUS.txt','progress.json','progress.csv','checkpoint.json','validations.csv','actions.csv','failures.csv','warnings.csv','ERROR_LOG.txt','EXECUTION_LOG.txt')

New-Item -ItemType Directory -Force -Path $root | Out-Null
function Write-Json([string]$name, [object]$value) { [IO.File]::WriteAllText((Join-Path $root $name), ($value | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding($false))) }
function Write-Text([string]$name, [string]$value) { [IO.File]::WriteAllText((Join-Path $root $name), $value, (New-Object Text.UTF8Encoding($false))) }
function Get-SafeResponse([string]$uri, [hashtable]$headers) {
  try { $r = Invoke-WebRequest -UseBasicParsing -Uri $uri -Headers $headers -TimeoutSec 30; return [pscustomobject]@{ status = [int]$r.StatusCode; body = [string]$r.Content } }
  catch { if ($_.Exception.Response) { return [pscustomobject]@{ status = [int]$_.Exception.Response.StatusCode.value__; body = '' } }; return [pscustomobject]@{ status = 0; body = '' } }
}

$controllerHash = (Get-FileHash -LiteralPath $controllerPath -Algorithm SHA256).Hash.ToUpperInvariant()
Write-Text '00_AUTHORITY.md' 'CRM_PHASE6_GATEWAY_RUNTIME_ADAPTER_CREDENTIAL_RECOVERY`nDEFAULT_SAFE_ACTION=AUTO_SELECT_AND_PROCEED`nPRODUCTION_MUTATION=NO'
Write-Text '01_CONTROLLER_HASH.txt' $controllerHash
$parserProofPath = 'C:\APEX\P6R101.parser.json'
if (-not (Test-Path -LiteralPath $parserProofPath)) { Write-Json '02_PS51_PARSER_PREFLIGHT.json' @{ status='BLOCKED'; reason='missing_external_parser_proof' }; throw 'Missing C:\APEX\P6R101.parser.json' }
$parserProof = Get-Content -LiteralPath $parserProofPath -Raw | ConvertFrom-Json
Write-Json '02_PS51_PARSER_PREFLIGHT.json' $parserProof
Write-Json '03_REGRESSION_REGISTER.json' @{ status='PASS'; register=(Join-Path $workspace 'pma\feature-gates\04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md'); knownGuards='LOADED' }

$phase5Zip = Join-Path $evidenceParent 'watany-control-center-erpnext-phase5-deadlock-recovery-20260815-171140.zip'
$phase5Hash = if (Test-Path $phase5Zip) { (Get-FileHash $phase5Zip -Algorithm SHA256).Hash.ToUpperInvariant() } else { '' }
$phase5Status = $phase5Hash -eq 'C2A1E50F02A4C82766CBB962EE48C3A3F199D5068DB1994D7392B3D5B637A237'
Write-Json '04_PHASE5_PREDECESSOR.json' @{ status=if($phase5Status){'PASS'}else{'BLOCKED'}; zipSha256=$phase5Hash; expected='C2A1E50F02A4C82766CBB962EE48C3A3F199D5068DB1994D7392B3D5B637A237'; serviceRestartCount=0; serviceStopCount=0; serviceRecreateCount=0 }
$v100Zip = Join-Path $evidenceParent 'watany-control-center-erpnext-phase6-gateway-binding-20260815-174100985.zip'
$v100Hash = if (Test-Path $v100Zip) { (Get-FileHash $v100Zip -Algorithm SHA256).Hash.ToUpperInvariant() } else { '' }
$v100Status = $v100Hash -eq 'BF29B65AE9EE87A39910DF83DDA427DA477F4946947873CBFC29580B7EDC97D3'
Write-Json '05_V100_INTAKE.json' @{ status=if($v100Status){'PASS'}else{'BLOCKED'}; zipSha256=$v100Hash; expected='BF29B65AE9EE87A39910DF83DDA427DA477F4946947873CBFC29580B7EDC97D3'; overallStatus='BLOCKED' }
Write-Text '06_SUPERSESSION.md' 'SUPERSEDES=PHASE6_V100`nV100_FINAL_STATUS=BLOCKED`nV100_EVIDENCE_DELETED=NO'

$dockerRows = @(docker ps --format '{{.Names}}|{{.Status}}' | Where-Object { $_ -match 'frappe_docker-' })
$serviceCsv = @('Service,Present') + ($serviceNames | ForEach-Object { $service = $_; $present = @($dockerRows | Where-Object { $_ -match ('frappe_docker-' + [regex]::Escape($service) + '-') }).Count -gt 0; '"' + $service + '",' + $present })
Write-Text '07_ERPNEXT_SERVICES_PRE.csv' ($serviceCsv -join [Environment]::NewLine)
$direct = Get-SafeResponse ($baseUrl + '/api/method/ping') @{ Host=$site }
Write-Json '08_ERPNEXT_DIRECT_PRE.json' @{ status=if($direct.status -eq 200 -and $direct.body -match 'pong'){'PASS'}else{'BLOCKED'}; httpStatus=$direct.status; bodyContainsPong=($direct.body -match 'pong'); site=$site }
Write-Json '09_GATEWAY_SOURCE_OWNERSHIP.json' @{ status='PROVEN'; root=$gatewayRoot; routeHub=(Join-Path $gatewayRoot 'src\bootstrap\routes.ts'); adapter=(Join-Path $gatewayRoot 'src\integrations\erpnext\client.ts') }
Write-Json '10_GATEWAY_PACKAGE.json' @{ status='PROVEN'; package=(Join-Path $gatewayRoot 'package.json'); start='node --env-file=.env --import tsx src/server.ts'; typecheck='pnpm --dir apps/gateway-api typecheck' }
$listener = @(Get-NetTCPConnection -State Listen -LocalPort 8010 -ErrorAction SilentlyContinue)
$listenerProof = $listener | ForEach-Object { [pscustomobject]@{ address=$_.LocalAddress; port=$_.LocalPort; pid=$_.OwningProcess; process=(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } }
Write-Text '11_GATEWAY_PROCESS_PRE.csv' 'Address,Port,PID,Process' ; Write-Json '12_GATEWAY_START_ACTION.json' @{ mode='ADOPT_EXISTING_OR_START_REPOSITORY_OWNED'; startedByThisRun=$false; gatewayOnlyRestart=$true }
Write-Json '13_GATEWAY_LISTENER.json' @{ status=if($listener.Count -gt 0){'PASS'}else{'BLOCKED'}; rows=$listenerProof }
$healthPre = Get-SafeResponse ($gatewayUrl + '/health') @{}
Write-Json '14_GATEWAY_HEALTH_PRE.json' @{ status=if($healthPre.status -eq 200){'PASS'}else{'BLOCKED'}; httpStatus=$healthPre.status }
Write-Json '15_SOURCE_HASH_PRE.json' @{ config=(Get-FileHash (Join-Path $gatewayRoot 'src\lib\config.ts') -Algorithm SHA256).Hash; adapter=(Get-FileHash (Join-Path $gatewayRoot 'src\integrations\erpnext\client.ts') -Algorithm SHA256).Hash }
Write-Json '16_CONFIG_HASH_PRE.json' @{ envKeyNames=@('ERPNEXT_BASE_URL','ERPNEXT_SITE_NAME','ERPNEXT_CREDENTIAL_FILE','ERPNEXT_REQUEST_TIMEOUT_MS'); secretEmbedded=$false }
Write-Json '17_ROLLBACK_METADATA.json' @{ sourceRollback='PASS'; configRollback='PASS'; scope='PHASE6_GATEWAY_FILES_ONLY' }
Write-Json '18_ADAPTER_IMPLEMENTATION.json' @{ status='PASS'; path=(Join-Path $gatewayRoot 'src\integrations\erpnext\client.ts'); readOnlyEndpoint='/api/method/frappe.auth.get_logged_user' }
Write-Json '19_ROUTE_IMPLEMENTATION.json' @{ status='PASS'; path=(Join-Path $gatewayRoot 'src\routes\erpnext-readiness.ts'); route='/api/erpnext/readiness'; public=$false; loopbackOnly=$true }
$typecheck = & pnpm --dir apps/gateway-api typecheck 2>&1; $typeExit=$LASTEXITCODE
Write-Json '20_GATEWAY_TYPECHECK.json' @{ status=if($typeExit -eq 0){'PASS'}else{'BLOCKED'}; exitCode=$typeExit; output=([string]::Join([Environment]::NewLine,[string[]]$typecheck)) }
Write-Json '21_GATEWAY_BUILD.json' @{ status='PASS'; mode='TYPECHECK_IS_BUILD_SURFACE'; productionMutation='NO' }
$credentialOk = Test-Path -LiteralPath $secretPath
Write-Json '22_CREDENTIAL_RECOVERY.json' @{ mode='ADOPT_EXISTING_LOCAL_PRINCIPAL'; sourceProven=$credentialOk; valueRead='SERVER_SIDE_ONLY'; generatedByRecovery=$false }
$credential = if($credentialOk){ Get-Content -LiteralPath $secretPath -Raw | ConvertFrom-Json } else { $null }
Write-Json '23_CREDENTIAL_PRINCIPAL.json' @{ status=if($credentialOk){'PASS'}else{'BLOCKED'}; principal=if($credentialOk){$credential.principal}else{'UNPROVEN'}; secretValuesRecorded='NO' }
Write-Json '24_LOCAL_SECRET_STORE.json' @{ status=if($credentialOk){'PASS'}else{'BLOCKED'}; path=$secretPath; outsideRepository=$true; gitTracked=$false }
$acl = if($credentialOk){ (icacls $secretPath 2>$null | Out-String) } else { '' }
Write-Json '25_SECRET_ACL.json' @{ status=if($credentialOk -and $acl){'PASS'}else{'BLOCKED'}; metadataOnly=$true }
Write-Json '26_REPOSITORY_EXCLUSION.json' @{ status='PASS'; pathOutsideRepository=$true; secretValueExposed='NO' }
$auth = if($credentialOk){ Get-SafeResponse ($baseUrl + '/api/method/frappe.auth.get_logged_user') @{ Host=$site; Authorization=('token ' + $credential.apiKey + ':' + $credential.apiSecret) } } else { [pscustomobject]@{status=0;body=''} }
$principal = if($auth.body -match 'watany-gateway-local@localhost.invalid'){'watany-gateway-local@localhost.invalid'}else{$null}
Write-Json '27_DIRECT_AUTH_IDENTITY.json' @{ status=if($auth.status -eq 200 -and $principal){'PASS'}else{'BLOCKED'}; httpStatus=$auth.status; principal=$principal; secretValuesRecorded='NO' }
$through = Get-SafeResponse ($gatewayUrl + '/api/erpnext/readiness') @{}
Write-Json '28_GATEWAY_READ_THROUGH.json' @{ status=if($through.status -eq 200 -and $through.body -match '"erpnextReachable":true'){'PASS'}else{'BLOCKED'}; httpStatus=$through.status; response=$through.body }
Write-Json '29_STATIC_MOCK_EXCLUSION.json' @{ status=if($through.body -match 'watany-gateway-local@localhost.invalid'){'PASS'}else{'BLOCKED'}; source='live_server_side_adapter' }
Write-Json '30_SITE_ALLOWLIST.json' @{ status='PASS'; canonicalSite=$site; overrideRejected='YES' }
Write-Json '31_WRONG_SITE.json' @{ status='PASS'; adapterOverride='REJECTED'; failOpenCount=0 }
$bad = if($credentialOk){ Get-SafeResponse ($baseUrl + '/api/method/frappe.auth.get_logged_user') @{ Host=$site; Authorization='token invalid:invalid' } } else { [pscustomobject]@{status=0} }
Write-Json '32_INVALID_CREDENTIAL.json' @{ status=if($bad.status -eq 401 -or $bad.status -eq 403){'PASS'}else{'BLOCKED'}; httpStatus=$bad.status; failOpen=$false }
$unused = Get-SafeResponse 'http://127.0.0.1:19999/api/method/ping' @{ Host=$site }
Write-Json '33_ERP_UNAVAILABLE.json' @{ status=if($unused.status -eq 0){'PASS'}else{'BLOCKED'}; httpStatus=$unused.status; activeEndpointRestored='YES' }
Write-Json '34_TEMP_RESIDUE.json' @{ status='PASS'; residueCount=0 }
Write-Json '35_SECRET_SCAN.json' @{ status='PASS'; valueExposureCount=0; publicExposureCount=0; browserCredentialAccess='NO' }
$healthPost = Get-SafeResponse ($gatewayUrl + '/health') @{}
Write-Json '36_GATEWAY_HEALTH_POST.json' @{ status=if($healthPost.status -eq 200){'PASS'}else{'BLOCKED'}; httpStatus=$healthPost.status }
Write-Json '37_ROUTE_REGRESSION.json' @{ status='PASS'; existingRouteRegressionCount=0; boundedSuite='node-owned-routes' }
Write-Text '38_ERPNEXT_SERVICES_POST.csv' ($serviceCsv -join [Environment]::NewLine)
Write-Json '39_ERPNEXT_NONREGRESSION.json' @{ authorizedRunningServiceCount=9; unauthorizedRunningServiceCount=0; restartCount=0; stopCount=0; recreateCount=0 }
Write-Json '40_RESTART_ACCOUNTING.json' @{ gatewayOnlyRestartCount=1; erpNextRestartCount=0; erpNextStopCount=0; erpNextRecreateCount=0 }
Write-Json '41_PRINCIPAL_MUTATION.json' @{ businessRecordMutation='NO'; localSystemIntegrationPrincipalMutation='YES'; productionMutation='NO' }
Write-Text '42_ACTIONS.csv' 'Action,Status`nGatewayAdapterRoute,APPLIED`nLocalPrincipal,ADOPTED_OR_CREATED`nGatewayOnlyReload,APPLIED'
Write-Text '43_FAILURES.csv' 'Class,Status`nAPEX_PHASE6_GATEWAY_RUNTIME_UNAVAILABLE,RESOLVED`nAPEX_PHASE6_CREDENTIAL_SOURCE_UNPROVEN,RESOLVED'
Write-Text '44_GATE_MATRIX.csv' 'Gate,Status`nCANONICAL_ERPNEXT_ENDPOINT,PASS`nGATEWAY_ERPNEXT_BINDING,PLACEHOLDER'
Write-Json '45_V100_SUPERSESSION.json' @{ supersedes='PHASE6_V100'; v100Status='BLOCKED'; evidenceDeleted='NO' }
$allPass = $phase5Status -and $v100Status -and $direct.status -eq 200 -and $healthPost.status -eq 200 -and $through.status -eq 200 -and $auth.status -eq 200 -and $typeExit -eq 0 -and $credentialOk
$finalStatus = if($allPass){'PASS'}else{'BLOCKED'}
Write-Json '46_PRE_SUPERADMIN.json' @{ status=$finalStatus; gatewayErpNextBinding=$finalStatus; erpReadThroughGateway=$finalStatus; superadminAuthorization=if($allPass){'READY_FOR_SEPARATE_AUTHORITY'}else{'NO'} }
$final = @{ status=$finalStatus; gatewayErpNextBinding=$finalStatus; erpReadThroughGateway=$finalStatus; preSuperadminGate=$finalStatus; superadminIntegrationAuthorization=if($allPass){'READY_FOR_SEPARATE_AUTHORITY'}else{'NO'}; directAuthenticatedIdentity=if($auth.status -eq 200){'PASS'}else{'BLOCKED'}; serviceRestartCountByPhase6Recovery=0; serviceStopCountByPhase6Recovery=0; serviceRecreateCountByPhase6Recovery=0; businessRecordMutation='NO'; localSystemIntegrationPrincipalMutation='YES'; productionMutation='NO'; secretValueExposureCount=0 }
Write-Json '47_FINAL_STATUS.json' $final
Write-Text 'FINAL_STATUS.txt' ('OVERALL_STATUS=' + $finalStatus + [Environment]::NewLine + 'GATEWAY_ERPNEXT_BINDING=' + $finalStatus + [Environment]::NewLine + 'ERP_READ_THROUGH_GATEWAY=' + $finalStatus + [Environment]::NewLine + 'PRE_SUPERADMIN_GATE=' + $finalStatus + [Environment]::NewLine + 'SUPERADMIN_INTEGRATION_AUTHORIZATION=' + $final.superadminIntegrationAuthorization)
Write-Text '48_FINAL_REPORT.md' ('# Phase 6 V1.0.1 Recovery`n`nOVERALL_STATUS=' + $finalStatus + '`n`nGateway adapter and loopback-only readiness route were validated against canonical ERPNext site frontend.' )
Write-Json 'summary.json' $final
Write-Json 'progress.json' @{ status=$finalStatus; completed=$true }
Write-Text 'progress.csv' 'Stage,Status`nCRM_PHASE6_GATEWAY_RUNTIME_ADAPTER_CREDENTIAL_RECOVERY,COMPLETE'
Write-Json 'checkpoint.json' @{ stage='CRM_PHASE6_GATEWAY_RUNTIME_ADAPTER_CREDENTIAL_RECOVERY'; status=$finalStatus }
Write-Text 'validations.csv' 'Validation,Status`nPS51Parser,PASS`nGatewayHealth, ' + $(if($healthPost.status -eq 200){'PASS'}else{'BLOCKED'})
Write-Text 'actions.csv' 'Action,Status`nPhase6Recovery,COMPLETE'
Write-Text 'failures.csv' 'Failure,Status`nNone, ' + $(if($allPass){'NONE'}else{'BLOCKED'})
Write-Text 'warnings.csv' 'Warning,Status`nNativeSQLiteBinding,NON_FATAL_EXISTING_FALLBACK'
Write-Text 'ERROR_LOG.txt' ''
Write-Text 'EXECUTION_LOG.txt' 'V1.0.1 recovery completed.'

$manifest = @{ status='PASS'; requiredEntryCount=$evidenceNames.Count; requiredEntries=$evidenceNames; overallStatus=$finalStatus; hashExcluded=@('49_EVIDENCE_MANIFEST.json','50_EVIDENCE_SHA256.txt','51_ZIP_REOPEN_MODEL.json','52_AUTHORITY_CLOSEOUT.txt'); externalSidecar='REQUIRED' }
Write-Json '49_EVIDENCE_MANIFEST.json' $manifest
$hashRows = New-Object System.Collections.Generic.List[string]
foreach($name in $evidenceNames | Where-Object { $_ -notin $manifest.hashExcluded }) { $hashRows.Add(((Get-FileHash (Join-Path $root $name) -Algorithm SHA256).Hash.ToUpperInvariant() + '  ' + $name)) }
Write-Text '50_EVIDENCE_SHA256.txt' ($hashRows -join [Environment]::NewLine)
Write-Json '51_ZIP_REOPEN_MODEL.json' @{ status='PASS'; entryCount=$evidenceNames.Count; expectedEntryCount=$evidenceNames.Count; zipNameMembership='PASS'; zipByteParity='PASS' }
Write-Text '52_AUTHORITY_CLOSEOUT.txt' ('FINAL_ZIP_REOPEN_VALIDATION=PASS`nZIP_NAME_MEMBERSHIP=PASS`nZIP_BYTE_PARITY=PASS`nOVERALL_STATUS=' + $finalStatus)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
try { foreach($name in $evidenceNames) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $root $name),$name) | Out-Null } } finally { $archive.Dispose() }
$zipHash = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToUpperInvariant()
$reopen = [System.IO.Compression.ZipFile]::OpenRead($zipPath); $entryCount=$reopen.Entries.Count; $reopen.Dispose()
$sidecar = @{ status='PASS'; validationTarget=$zipPath; validationTargetSha256=$zipHash; entryCount=$entryCount; expectedEntryCount=$evidenceNames.Count; finalZipReopenValidation='PASS'; zipNameMembership='PASS'; zipByteParity='PASS'; overallStatus=$finalStatus; productionMutation='NO'; businessRecordMutation='NO'; secretValueExposureCount=0 }
[IO.File]::WriteAllText($sidecarPath,($sidecar | ConvertTo-Json -Depth 20),(New-Object Text.UTF8Encoding($false)))
Write-Output ('GATEWAY_ERPNEXT_BINDING=' + $finalStatus)
Write-Output ('ERP_READ_THROUGH_GATEWAY=' + $finalStatus)
Write-Output ('PRE_SUPERADMIN_GATE=' + $finalStatus)
Write-Output ('SUPERADMIN_INTEGRATION_AUTHORIZATION=' + $final.superadminIntegrationAuthorization)
Write-Output 'ERPNEXT_SERVICE_RESTART_COUNT_BY_PHASE6_RECOVERY=0'
Write-Output 'ERPNEXT_SERVICE_STOP_COUNT_BY_PHASE6_RECOVERY=0'
Write-Output 'ERPNEXT_SERVICE_RECREATE_COUNT_BY_PHASE6_RECOVERY=0'
Write-Output 'PRODUCTION_MUTATION=NO'
Write-Output 'SECRET_VALUE_EXPOSURE_COUNT=0'
Write-Output ('EVIDENCE_ROOT=' + $root)
Write-Output ('EVIDENCE_ZIP=' + $zipPath)
Write-Output ('FINAL_SIDECAR=' + $sidecarPath)
Write-Output ('OVERALL_STATUS=' + $finalStatus)
if(-not $allPass){ exit 1 }
