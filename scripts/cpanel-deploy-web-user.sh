#!/usr/bin/env bash
set -Eeuo pipefail

REPO="/home/koudama/repositories/watanybot"
WEB_ROOT="${REPO}/apps/web-user"
DIST="${WEB_ROOT}/dist"
PUBLIC_PARENT="/home/koudama/public_html"
LIVE="${PUBLIC_PARENT}/mcp"
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="${PUBLIC_PARENT}/.mcp-stage-${STAMP}"
PREVIOUS="${PUBLIC_PARENT}/mcp-previous-${STAMP}"
BACKUP="${PUBLIC_PARENT}/mcp-${STAMP}.tar.gz"
SWAPPED=0

fail() {
  printf '\nWATANYBOT CPANEL DEPLOYMENT: FAILED\n%s\n' "$1" >&2
  exit 1
}

rollback() {
  if [ "$SWAPPED" -eq 1 ] && [ -e "$PREVIOUS" ]; then
    FAILED="${LIVE}.failed-${STAMP}"
    rm -rf "$FAILED"

    if [ -e "$LIVE" ] || [ -L "$LIVE" ]; then
      mv "$LIVE" "$FAILED"
    fi

    mv "$PREVIOUS" "$LIVE"
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

[ "$BRANCH" = "main" ] || fail "Deployment is allowed only from main. Current branch: $BRANCH"
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

printf 'Building WatanyBot frontend for /mcp/...\n'
VITE_BASE=/mcp/ "${PNPM[@]}" --dir "$WEB_ROOT" build

[ -f "$DIST/index.html" ] || fail "Build did not create dist/index.html."

grep -Eq '(src|href)="/mcp/[^\"]+\.(js|css)' "$DIST/index.html" || \
  fail "Built index does not reference /mcp/ JavaScript or CSS assets."

cat > "$DIST/.htaccess" <<'HTACCESS'
DirectoryIndex index.html

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /mcp/

  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>
HTACCESS

cat > "$DIST/deploy-manifest.json" <<MANIFEST
{
  "application": "watanybot",
  "component": "web-user",
  "branch": "main",
  "commit": "${COMMIT}",
  "deployedAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "publicPath": "/mcp/"
}
MANIFEST

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -a "$DIST/." "$STAGE/"

[ -f "$STAGE/index.html" ] || fail "Staged release does not contain index.html."
[ -f "$STAGE/.htaccess" ] || fail "Staged release does not contain .htaccess."
[ -f "$STAGE/deploy-manifest.json" ] || fail "Staged release does not contain deploy-manifest.json."

grep -Fq "$COMMIT" "$STAGE/deploy-manifest.json" || \
  fail "Staged deployment manifest does not contain commit $COMMIT."

find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +

rm -rf "$PREVIOUS"

if [ -e "$LIVE" ] || [ -L "$LIVE" ]; then
  tar -czhf "$BACKUP" -C "$PUBLIC_PARENT" "$(basename "$LIVE")"
  [ -s "$BACKUP" ] || fail "Live frontend backup was not created."
  mv "$LIVE" "$PREVIOUS"
fi

mv "$STAGE" "$LIVE"
SWAPPED=1

sleep 3

PUBLIC_MANIFEST="$(
  curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --header 'Cache-Control: no-cache' \
    "https://koudama.com/mcp/deploy-manifest.json?cpanel=${STAMP}"
)"

printf '%s' "$PUBLIC_MANIFEST" | grep -Fq "$COMMIT" || \
  fail "Public deployment manifest does not contain commit $COMMIT."

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

SWAPPED=0
trap - ERR

printf '\nWATANYBOT CPANEL DEPLOYMENT: PASS\n'
printf 'Commit: %s\n' "$COMMIT"
printf 'Live path: %s\n' "$LIVE"
printf 'Backup: %s\n' "$BACKUP"
