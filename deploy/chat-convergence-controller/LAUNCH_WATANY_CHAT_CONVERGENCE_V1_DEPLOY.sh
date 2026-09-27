#!/usr/bin/env bash
set -Eeuo pipefail
ST='/home/dcagent/watany-staging/chat-convergence-v1'
CTL="$ST/RUN_WATANY_CHAT_CONVERGENCE_V1_DEPLOY.sh"
EXPECTED_CTL='72f6c6057710269c76fb088437de64b6a0039a9da363e481e63bf0a6d35dda43'
EXPECTED_PACKAGE='860428fa900fe3443a7758cd58269211a0007d76d617f2f11c4de3524127e90d'
[ "$(id -u)" -eq 0 ] || { echo 'LAUNCH_FAILURE=ROOT_REQUIRED'; exit 1; }
[ -f "$CTL" ] || { echo 'LAUNCH_FAILURE=CONTROLLER_MISSING'; exit 1; }
[ "$(sha256sum "$CTL" | awk '{print $1}')" = "$EXPECTED_CTL" ] || { echo 'LAUNCH_FAILURE=CONTROLLER_HASH'; exit 1; }
[ "$(sha256sum "$ST/PACKAGE_MANIFEST.sha256" | awk '{print $1}')" = "$EXPECTED_PACKAGE" ] || { echo 'LAUNCH_FAILURE=PACKAGE_MANIFEST_HASH'; exit 1; }
VERIFY_OUT="$(mktemp)"; VERIFY_ERR="$(mktemp)"
trap 'rm -f "$VERIFY_OUT" "$VERIFY_ERR"' EXIT
(cd "$ST" && sha256sum -c PACKAGE_MANIFEST.sha256 > "$VERIFY_OUT" 2> "$VERIFY_ERR") || { cat "$VERIFY_ERR"; echo 'LAUNCH_FAILURE=PACKAGE_CONTENT_HASH'; exit 1; }
[ ! -s "$VERIFY_ERR" ] || { cat "$VERIFY_ERR"; echo 'LAUNCH_FAILURE=PACKAGE_VERIFY_STDERR'; exit 1; }
if grep -Eqi 'FAILED|ERROR|FATAL' "$VERIFY_OUT"; then echo 'LAUNCH_FAILURE=PACKAGE_FAILURE_TOKEN'; exit 1; fi
echo 'WATANY_CHAT_CONVERGENCE_V1_LAUNCH_PREFLIGHT=PASS'
exec bash "$CTL"
