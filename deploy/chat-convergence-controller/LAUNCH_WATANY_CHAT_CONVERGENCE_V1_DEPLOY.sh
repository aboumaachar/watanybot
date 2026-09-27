#!/usr/bin/env bash
set -Eeuo pipefail
ST='/home/dcagent/watany-staging/chat-convergence-v1'
CTL="$ST/RUN_WATANY_CHAT_CONVERGENCE_V1_DEPLOY.sh"
EXPECTED_CTL='63744dc1eb0821e1180daed012bb3bea296051de19e3af60b24cf14fb2b073a0'
EXPECTED_PACKAGE='4e80a677e40f2f3d273d0d5a3d022279aa151b25b73bcbf64320139f268444a4'
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
