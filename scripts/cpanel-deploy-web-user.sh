#!/usr/bin/env bash
set -Eeuo pipefail

REPO="/home/koudama/repositories/watanybot"
WEB_ROOT="${REPO}/apps/web-user"
DIST="${WEB_ROOT}/dist"
PUBLIC_PARENT="/home/koudama"
LIVE="${PUBLIC_PARENT}/public_html"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="${PUBLIC_PARENT}/.watany-stage-${STAMP}"
BACKUP="${PUBLIC_PARENT}/watany-public_html-${STAMP}.tar.gz"
DEPLOYED=0

fail() {
  printf '\nWATANYBOT CPANEL DEPLOYMENT: FAILED\n%s\n' "$1" >&2
  exit 1
}

rollback() {
  if [ "$DEPLOYED" -eq 1 ] && [ -s "$BACKUP" ]; then
    RESTORE="${PUBLIC_PARENT}/.watany-restore-${STAMP}"
    rm -rf "$RESTORE"
    mkdir -p "$RESTORE"
    tar -xzf "$BACKUP" --no-same-owner -C "$RESTORE"
    RESTORE_ROOT="${RESTORE}/$(basename "$LIVE")"
    [ -d "$RESTORE_ROOT" ] || return 1

    find "$LIVE" -mindepth 1 -maxdepth 1 ! -name '.htaccess' ! -name '.well-known' -exec rm -rf {} +
    tar --exclude='./.htaccess' --exclude='./.well-known' --exclude='./.apex-deployed-sha' -C "$RESTORE_ROOT" -cf - . |
      tar --no-same-owner -xf - -C "$LIVE"
    rm -rf "$RESTORE"
    printf 'ROLLBACK: PASS\n'
  fi
}

trap 'rollback' ERR

[ "$(id -un)" = "koudama" ] || fail "Deployment must run as the cPanel user koudama."
[ -d "$REPO/.git" ] || fail "Repository not found: $REPO"
[ -d "$WEB_ROOT" ] || fail "Frontend source not found: $WEB_ROOT"

cd "$REPO"

BRANCH="$(git branch --show-current)"
STATUS="$(git status --porcelain --untracked-files=all)"
COMMIT="$(git rev-parse HEAD)"

[ "$BRANCH" = "integration/theme-upgrade-20260728" ] || fail "Deployment is allowed only from integration/theme-upgrade-20260728. Current branch: $BRANCH"
[ -z "$STATUS" ] || fail "Repository worktree is not clean."

export PATH="${HOME}/.local/bin:${HOME}/bin:${PATH}"

if command -v pnpm >/dev/null 2>&1; then
  PNPM=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  PNPM=(corepack pnpm)
elif command -v npm >/dev/null 2>&1; then
  LOCAL_PREFIX="${HOME}/.local"
  PNPM_BIN="${LOCAL_PREFIX}/bin/pnpm"

  if [ ! -x "$PNPM_BIN" ]; then
    printf 'Installing pnpm 10.34.1 for the cPanel user...\n'
    mkdir -p "$LOCAL_PREFIX"
    npm install --global --prefix "$LOCAL_PREFIX" pnpm@10.34.1
  fi

  [ -x "$PNPM_BIN" ] || fail "pnpm installation did not create $PNPM_BIN."
  PNPM=("$PNPM_BIN")
else
  fail "pnpm, corepack, and npm are unavailable for the cPanel user."
fi

command -v curl >/dev/null 2>&1 || fail "curl is required for post-deployment smoke checks."

printf 'Using pnpm: %s\n' "${PNPM[*]}"
"${PNPM[@]}" --version

printf 'Installing locked frontend dependencies...\n'
"${PNPM[@]}" install --frozen-lockfile --ignore-scripts

printf 'Building WatanyBot frontend for the /mcp/ document-root fallback...\n'
VITE_BASE=/ VITE_API_URL=/mcp "${PNPM[@]}" --dir "$WEB_ROOT" build

[ -f "$DIST/index.html" ] || fail "Build did not create dist/index.html."

grep -Eq '(src|href)="/assets/[^\"]+\.(js|css)' "$DIST/index.html" || \
  fail "Built index does not reference root JavaScript or CSS assets."

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -a "$DIST/." "$STAGE/"
printf '%s\n' "$COMMIT" > "$STAGE/.apex-deployed-sha"

[ -f "$STAGE/index.html" ] || fail "Staged release does not contain index.html."
[ -f "$STAGE/.htaccess" ] || fail "Staged release does not contain .htaccess."
[ -f "$STAGE/.apex-deployed-sha" ] || fail "Staged release does not contain .apex-deployed-sha."

grep -Fq "$COMMIT" "$STAGE/.apex-deployed-sha" || \
  fail "Staged deployment marker does not contain commit $COMMIT."

find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +

tar -czhf "$BACKUP" -C "$PUBLIC_PARENT" "$(basename "$LIVE")"
[ -s "$BACKUP" ] || fail "Live frontend backup was not created."

tar --exclude='./.htaccess' --exclude='./.well-known' --exclude='./.apex-deployed-sha' -C "$STAGE" -cf - . |
  tar --no-same-owner -xf - -C "$LIVE"
printf '%s\n' "$COMMIT" > "$LIVE/.apex-deployed-sha"
DEPLOYED=1

sleep 3

PUBLIC_MARKER="$(
  curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --header 'Cache-Control: no-cache' \
    "https://koudama.com/.apex-deployed-sha?cpanel=${STAMP}"
)"

printf '%s' "$PUBLIC_MARKER" | grep -Fq "$COMMIT" || \
  fail "Public deployment marker does not contain commit $COMMIT."

ASSET_PATH="$(grep -oE 'src="/assets/[^\"]+\.js' "$DIST/index.html" | head -n 1 | cut -c 6-)"
[ -n "$ASSET_PATH" ] || fail "Built index did not expose a root asset path."
curl --fail --silent --show-error --location \
  --header 'Cache-Control: no-cache' \
  "https://koudama.com${ASSET_PATH}?cpanel=${STAMP}" > /dev/null

for PUBLIC_URL in \
  "https://koudama.com/mcp/?cpanel=${STAMP}" \
  "https://koudama.com/mcp/chat?cpanel=${STAMP}"
do
  PAGE="$(
    curl \
      --fail \
      --silent \
      --show-error \
      --location \
      --header 'Cache-Control: no-cache' \
      "$PUBLIC_URL"
  )"

  printf '%s' "$PAGE" | grep -Eiq '<!doctype html|<div id="?root"?' || \
    fail "Frontend shell was not detected at $PUBLIC_URL."
done

DEPLOYED=0
trap - ERR

printf '\nWATANYBOT CPANEL DEPLOYMENT: PASS\n'
printf 'Commit: %s\n' "$COMMIT"
printf 'Live path: %s\n' "$LIVE"
printf 'Backup: %s\n' "$BACKUP"
