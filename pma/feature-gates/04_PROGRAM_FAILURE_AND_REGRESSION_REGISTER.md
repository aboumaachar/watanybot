# Program Failure and Regression Register

| FAILURE_CLASS | FIRST_OBSERVED_DATE | AFFECTED_COMMAND_OR_TOOL | ROOT_CAUSE | REMEDIATION | REGRESSION_TEST | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| VISUAL_AUTHORITY_SEARCH_LIMITED_TO_LOCAL_REPOSITORY | 2026-08-02 | repository search | authority was externally mounted | bind approved read-only path and verify hash | exact path/size/hash/title check | CLOSED_BY_EVIDENCE |
| VISUAL_AUTHORITY_EXISTS_BUT_NOT_MOUNTED_OR_BOUND | 2026-08-02 | planning audit | external authority was not available to initial audit | record mount and binding evidence | authority contract validation | CLOSED_BY_EVIDENCE |
| WELCOME_ROUTE_DUAL_RENDER_CONTROL_PATH | 2026-08-02 | route audit | early return plus one JSX route | classify and test both controls; no duplicate path count | source-location and route-count check | OPEN_FOR_GATE_1 |
| WILDCARD_ROUTE_REACHABILITY_FALSE_POSITIVE | 2026-08-02 | registry validator | wildcard paths treated as literal paths | wildcard-aware route matching | registry reachability test | CLOSED_BY_VALIDATOR_REPAIR |
| POWERSHELL_REPORTING_EXPRESSION_PARSE_FAILURE | 2026-08-02 | PowerShell evidence command | malformed pipeline expression | simplify command and rerun | Windows PowerShell 5.1 parser preflight | CLOSED_BY_COMMAND_REPAIR |
| POWERSHELL_CONTINUATION_PROMPT_DURING_EVIDENCE_WRITE | 2026-08-02 | PowerShell evidence command | quoting/continuation ambiguity | use simpler commands and file APIs | noninteractive command exit check | OPEN |
| UNSUPPORTED_CREDENTIAL_ROTATION_COMPLETION_INFERENCE | 2026-08-02 | security gate | rotation not evidenced | retain pending owner status | explicit attestation check | OPEN_SECURITY_BLOCKER |
| ROTATION_ATTESTATION_PLACEHOLDER_ACCEPTED_AS_EVIDENCE | 2026-08-02 | security gate | placeholder could be mistaken for proof | require factual owner evidence | token and evidence-source check | OPEN |
| OVERSIZED_POWERSHELL_SERIALIZATION_OUTPUT | 2026-08-02 | report generation | large serialized output exceeds practical transport | cap excerpts and write structured evidence | output-size threshold check | OPEN |
| APEX_NATIVE_FAILURE_EVIDENCE_INCOMPLETE_BEFORE_CLASSIFICATION_DEFECT | 2026-08-08 | native child classification | specific root cause emitted before mandatory evidence bundle exists | prohibit specific classification until evidence is complete and internally consistent | collector evidence-completeness gate | BLOCKED |
| APEX_NATIVE_FAILURE_DIAGNOSTIC_CONTEXT_LOST_AFTER_CHILD_EXIT_DEFECT | 2026-08-08 | native child lifecycle | command, environment, diagnostic, or toolchain context was not frozen before child state disappeared | freeze command, process, streams, exit code, timestamps, and hashes before classification | original-failure freeze fixture | BLOCKED |
| APEX_NATIVE_FAILURE_SPECULATIVE_ROOT_CAUSE_CLASSIFICATION_DEFECT | 2026-08-08 | native failure classifier | root cause inferred from incomplete, stale, historical, or single-token evidence | require declared multi-factor classifier signals; otherwise emit UNKNOWN_NATIVE_FAILURE | partial-signature fixture | BLOCKED |
| APEX_NATIVE_DEEP_DIAGNOSTIC_RERUN_MUTATES_AUTHORITY_DEFECT | 2026-08-08 | deep diagnostic rerun | reproduction changes canonical dirty workspace or production state | run diagnostics only in isolated disposable roots | workspace hash before/after gate | BLOCKED |
| APEX_V106_PRODUCTION_MCP_ASSET_BASE_MISMATCH | 2026-08-10 | V1.0.6 production build/deploy | `/mcp/assets/*` falls through to SPA HTML while production serves root-relative assets | build with `VITE_BASE=/` and verify JavaScript/CSS MIME responses | root-base build plus public asset content-type probes | CLOSED_BY_REPAIR |
| APEX_V106_LIVE_ROOT_DESTRUCTIVE_SWAP_UNDOCUMENTED_ASSET_RISK | 2026-08-10 | cPanel frontend deployment | replacing the whole document root can remove public files outside the current build | archive the full root and overlay only generated files | remote-only manifest and predicted filesystem delta | CLOSED_BY_REPAIR |
| APEX_V106_CPANEL_MAIN_BRANCH_AUTHORITY_OBSOLETE | 2026-08-10 | cPanel frontend deployment | deployment script required a nonexistent remote `main` branch | pin the proven integration release branch | remote branch inventory and script assertion | CLOSED_BY_REPAIR |
| APEX_V106_CPANEL_MCP_SUBDIRECTORY_TARGET_OBSOLETE | 2026-08-10 | cPanel frontend deployment | deployment script targeted an absent `/home/koudama/public_html/mcp` directory | deploy to the proven `/home/koudama/public_html` root | live-root inventory and public route probes | CLOSED_BY_REPAIR |
| APEX_V106_STALE_APACHE_4001_ROUTE_CONFLICT | 2026-08-10 | Apache standard-vhost proxy rules | obsolete HTTP rules reference unavailable port 4001 | preserve evidence and do not mutate without standard-vhost consumer proof | active include census and route graph | OPEN_UNVERIFIED |
| APEX_V106_STALE_APACHE_4500_HEALTH_ROUTE_CONFLICT | 2026-08-10 | Apache HTTPS MCP proxy rules | obsolete `/mcp/health` route shadowed the canonical 8015 gateway health route | remove only the duplicate health directives after backup/configtest | config backup, `httpd -t`, restart, public health probes | CLOSED_BY_REPAIR |
| APEX_V106_GLOBAL_LINT_PREEXISTING_TAXI_HOOK_BLOCKER | 2026-08-10 | `pnpm --dir apps/web-user lint` | regular helper name began with `use`, triggering rules-of-hooks | rename helper without changing behavior | candidate-scoped lint and full lint capture | CLOSED_BY_REPAIR |

```text
PROGRAM_FAILURE_REGISTER_CREATED=YES
FAIL_CLOSED=YES
```
