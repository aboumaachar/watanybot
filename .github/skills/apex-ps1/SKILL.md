---
name: apex-ps1
description: >
  Mandatory WatanyBot Windows PowerShell 5.1 APEX execution, validation,
  regression-prevention, runtime-proof, evidence, repair, installer,
  repository-audit, deployment, Git-automation, and executable-Markdown
  control skill. Load whenever a task involves PowerShell, PS1, APEX, PMA
  automation, repository audits, repair/install/validation scripts,
  deployment commands, Git automation, or executable Markdown instructions.
---

APEX_NATIVE_SKILL_SOURCE=C:\xampp\htdocs\projectx\watanybot\.pma\skills\apex-ps1\SKILL.md
APEX_NATIVE_SKILL_SOURCE_SHA256=CE317015ACF91FB84C0D4AEE4EE91F8E2B2C0A75F81926C87AB098F922BB33EB

# APEX PS1 Skill - WatanyBot Local Authority

- One autonomous controller/state machine.
- Full historical + local regression preload.
- Whole-artifact guard enforcement.
- Live progress.
- Durable checkpointing.
- Mandatory complete report package on every execution.
- Register before repair.
- In-place bounded repair.
- Retry only after concrete recovery action.
- Resume same stage.
- Zero/one/many safe collection boundaries.
- Strict UTF-8.
- Windows PowerShell 5.1.
- Runtime proof required.
- No endless recovery-wrapper chains.

<!-- APEX_FULL_FINALIZER_MANAGED_CONTRACT_START -->
## Mandatory execution reporting and convergence contract

1. Every execution, including parser/preflight failures, retries, blockers, circuit-breakers and closeout failures, must create a durable report package before substantive execution.
2. `FINAL_REPORT.md`, `summary.json`, `FINAL_STATUS.txt`, `progress.json`, `progress.csv`, `checkpoint.json`, `validations.csv`, `actions.csv`, `failures.csv`, `warnings.csv`, `ERROR_LOG.txt`, `EXECUTION_LOG.txt`, stage reports and report-manifest verification are mandatory.
3. Every stage report must be precreated as `NOT_STARTED`; a failure before a later stage must never create a false missing-artifact report-integrity failure.
4. `ERROR_LOG.txt` starts before preflight and captures every failure, warning, recovery failure and report-open failure.
5. The original primary failure must remain preserved when report closeout also fails.
6. `FINAL_REPORT.md` must be opened automatically at execution end using the default application with Notepad fallback.
7. A retry is permitted only after a concrete state-changing repair.
8. Safe uniquely classifiable controller defects are repaired in the same controller, the same run, then the affected stage is re-preflighted and resumed.
9. Do not create successive narrow recovery-wrapper lineages for repairable defects.
10. Load the complete built-in, historical and local regression register before substantive mutation and scan equivalent boundaries globally.
11. Progress must be live through `Write-Progress` and durable through progress/checkpoint artifacts.
12. Final report artifacts are frozen before hashing; no manifest-listed artifact may change after successful verification.
13. Parser PASS is never runtime proof. UI closeout requires build plus browser/runtime proof.
14. PMA execution reports start exactly with `APEX_PS1_SKILL_UPDATE_REQUIRED` or `APEX_PS1_SKILL_UPDATE_NOT_REQUIRED`.
15. Unknown failures fail closed, but the controller still continues all safe independent stages and always reaches mandatory reporting.
16. Every generated `.ps1` must pass an independent Windows PowerShell parser preflight on the exact final bytes before hash publication, download handoff, or `-File` execution. Self-preflight is insufficient because a parse-invalid script cannot start.
17. Delimiter balance is not parser proof. Balanced square brackets must never be accepted as evidence that a PowerShell type literal is valid.
18. Globally forbid newline-split PowerShell type literals used for static type calls, casts, attributes, or generic expressions. Keep the type token intact, for example `[System.IO.File]::Exists(...)`.
19. Before delivery, scan the whole executable artifact for previously registered failure patterns. Any recurrence of a known class blocks delivery and must be repaired before a hash is published.
20. The external parser gate must report all parser errors with line, column, error id, and message; parser-error count must equal zero before execution.
21. The exact bytes that pass external parser preflight are the same bytes that are hashed and handed off. Any post-preflight mutation invalidates the proof and requires re-preflight plus re-hash.
22. `APEX_POWERSHELL_SPLIT_TYPE_LITERAL_NEWLINE_PARSER_DEFECT`, `APEX_STATIC_DELIMITER_BALANCE_FALSE_PARSER_CONFIDENCE_DEFECT`, and `APEX_SELF_PREFLIGHT_CANNOT_CATCH_OWN_PARSE_FAILURE_BEFORE_EXECUTION_DEFECT` are permanent ACTIVE guards.
23. Browser proof must emulate and persist the media/input conditions targeted by a repair. A touch repair gated by coarse-pointer or no-hover media must be proved in a context with touch/mobile emulation and recorded media-query state.
24. A smartphone-width viewport alone is not smartphone touch proof. Record `hasTouch` behavior through `navigator.maxTouchPoints` and record `pointer: coarse`, `any-pointer: coarse`, and `hover: none` media states.
25. If the proof environment does not satisfy the repair media condition, classify a harness/proof-environment defect; do not report the application UI as failing the touch contract.
26. Touch-target proof must persist the computed touch-token value and per-failing-element computed min sizes, display, transform, and dimensions.
27. A second touch repair round must change strategy or state. Rewriting an identical managed CSS section is forbidden.
28. Evidence-specific second-stage touch repair may target only stable selectors observed in browser proof, must remain idempotent, and must be re-built and re-proved across all 21 smartphone contracts.
29. Computed touch evidence must drive repair decisions. Capturing `min-inline-size`, `min-block-size`, `min-width`, `min-height`, transforms, zoom, layout dimensions, and rendered dimensions without using them is a controller defect.
30. Remaining small targets must be classified before final mutation into at least: important cascade override, repair rule not matched, rendered shrink after layout, layout box still small after rule match, or unknown.
31. Generic specificity escalation is forbidden when evidence proves an `!important` override; an evidence-scoped important declaration is permitted only for stable selectors with a proven matching important override and must be counted as debt.
32. A minimum-size rule is not a valid repair for a rendered box shrunk after layout. Compensate the pre-transform layout size from measured rendered/layout ratios and re-prove all contracts.
33. A blind mutation is forbidden for unknown touch root causes. Unknown rows remain explicit blockers with durable evidence.
34. V4 touch repair sections are managed and idempotent; any retry must change root-cause strategy or state.
35. Browser touch evidence must resolve repair selectors in the DOM and verify that the target element is actually included before any selector is trusted.
36. Selector generation must prefer stable IDs and stable `data-*` attributes before complex utility classes. Complex CSS-escaped class selectors must not be rejected merely because a downstream regex cannot parse them.
37. Every candidate selector must persist match count, target-included state, explicit-surface match count, non-explicit overmatch count, strategy, and rejection reason.
38. Group selectors are repairable only when the target is included, match count is bounded, and non-explicit overmatch count is zero.
39. A generic tag fallback is evidence only, not automatically safe. Attempt stable ancestor scoping and explicit-category selectors before declaring unresolved.
40. `TouchTargetEvidenceSelectorCount` must describe the current proof run. It must never remain a stale V2-only metric when V2 is skipped.
41. Selector-resolution failure is a distinct blocker from touch root-cause failure; do not collapse `UNSAFE_OR_UNSTABLE_SELECTOR` into `UNKNOWN` without candidate diagnostics.
42. V5 selector-targeted repairs are managed, idempotent, state-changing, and re-proved across all 21 contracts.
43. After an incremental repair chain stalls, do not add another V-number repair layer. Perform one full forensic census, snapshot, delete/recreate only APEX-managed generated repair artifacts, and rebuild one unified current-evidence repair model.
44. Historical APEX-managed runtime repair sections must not coexist indefinitely. A total finalizer recreates the managed repair file from scratch and imports it exactly once.
45. Browser evidence must persist every failing explicit touch target, not a fixed first-N sample.
46. A whole-run defect census includes repository PowerShell parser errors, JSON parse errors, strict UTF-8, mojibake, CSS authority/import integrity, token collisions, runtime style injection risks, and the complete 21-contract browser matrix before mutation.
47. Two mutation passes maximum are allowed: normal unified repair, then force unified repair from fresh reproof evidence. The second pass must recreate the managed file from scratch and materially change strategy.
48. A last-resort structural selector is allowed only when generated in the browser, DOM-verified to include the exact target, bounded in cardinality, and zero-overmatching non-explicit controls.
49. Deletion is permitted only for files proven APEX-managed by exact generator markers. Non-APEX-managed files must never be deleted by uncertainty.
50. Token collisions must receive an explicit disposition. Same-value duplicates may be documented; conflicting values in APEX-managed files must be normalized; unresolved non-managed conflicts remain explicit evidence.
51. One finalizer owns the complete audit-repair-rebuild-reproof-closeout lifecycle. Do not create another narrow wrapper for a defect already inside that lifecycle.
52. Architecture-specific self-preflight invariants must be removed when the referenced symbol or subsystem is removed. Never require cardinality for an obsolete implementation boundary.
53. Golden Gate variables must either be initialized explicitly or derive directly from the owned collection at the point of use. An orphaned count variable is a controller defect.
54. A managed artifact has exactly one rollback owner. The unified runtime-repair file is rolled back only by the unified checkpoint subsystem; legacy global rollback state must not delete it.
55. Broad repository census results must separate actionable current-scope defects from advisory archive/fixture/example findings.
56. Comment-tolerant JSONC surfaces such as TypeScript configuration and editor configuration must not be reported as strict JSON defects merely because `ConvertFrom-Json` rejects comments or trailing commas.
57. When all required browser contracts pass, systemic diagnosis is `NONE_PASS_21_OF_21`; advisory console noise must not masquerade as the dominant failure dimension.
58. A current run's successful typecheck, build, encoding, and 21/21 browser proof is the closeout authority. Historical controller failures remain historical evidence and do not become current blockers.
<!-- APEX_FULL_FINALIZER_MANAGED_CONTRACT_END -->