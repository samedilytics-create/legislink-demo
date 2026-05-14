#!/usr/bin/env bash
set -euo pipefail

# Force a fresh build.
make clean
make build

# Confirm sensitive files are absent.
for f in dist/data/*.json; do
    if grep -q "@example.com\|SECRET_KEY\|password_hash" "$f"; then
        echo "Aborting deploy: $f contains a denylisted substring."
        exit 1
    fi
done

# Push dist/ to gh-pages via a temporary worktree.
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

git fetch origin gh-pages 2>/dev/null || true
git worktree add --force "$TMP" gh-pages 2>/dev/null || git worktree add --force -b gh-pages "$TMP"

rsync -a --delete --exclude='.git' dist/ "$TMP/"

cd "$TMP"
git add -A
git commit -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || echo "(no changes to deploy)"
git push origin gh-pages 2>/dev/null || echo "(no remote configured; deploy committed locally)"
cd -
git worktree remove --force "$TMP"

echo "Deployed. https://legislink.us should update within a minute."
