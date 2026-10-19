# APEX WatanyBot UL1D V1.0.1

This directory is the successor execution package for the Universal Address Locator integration. It intentionally does not reuse the V1.0.0 launcher.

## Execution contract

`launch-ul1d.cmd` only resolves the package/workspace inputs, verifies the explicit Windows PowerShell 5.1 path and required package files, invokes `controller.ps1`, and returns its exit code.

The controller accepts only:

- `ProjectRoot`
- `Mode` (`audit` or `install`)
- `OwnerApprovalToken`

Preflight computes its own session and report paths. It fails closed when the approved runtime ZIP or canonical install contract is absent. Candidate data is never promoted automatically.

## Invocation

```cmd
launch-ul1d.cmd C:\xampp\htdocs\projectx\watanybot audit OWNER_APPROVAL_TOKEN
```

Use `install` only after the owner-approved runtime ZIP is placed at:

```text
runtime\ul1d-canonical-runtime.zip
```

The ZIP must contain:

```text
public\data\location\canonical\manifest.json
public\data\location\canonical\locator.json
public\data\location\canonical\aliases.csv
public\data\location\canonical\provenance.json
public\data\location\canonical\validation-summary.json
docs\location\canonical-dataset\README.md
docs\location\canonical-dataset\migration-register.csv
```

## Current truthful status

The repository currently has a candidate vendor JSON and a starter CSV, not an approved canonical runtime ZIP. Therefore this package is expected to return `UL1D_STATUS=BLOCKED` until the approved dataset and owner approval are supplied. No PASS claim is valid before installation, migration, runtime, browser, build, typecheck, locator, consumer, and evidence gates all pass.

Evidence is written under `evidence\<session-id>` with command, stdout, stderr, summary, hash, runtime, locator, and browser records.
