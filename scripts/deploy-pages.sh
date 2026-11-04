#!/usr/bin/env bash
# Publish the game to the gh-pages branch (served at https://<user>.github.io/<repo>/).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
python3 "$ROOT/scripts/build-sw.py"
TMP="$(mktemp -d)"
trap 'git -C "$ROOT" worktree remove --force "$TMP" >/dev/null 2>&1 || true' EXIT
if git -C "$ROOT" ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git -C "$ROOT" fetch -q origin gh-pages
  git -C "$ROOT" worktree add -q -B gh-pages "$TMP" origin/gh-pages
else
  git -C "$ROOT" worktree add -q --detach "$TMP"
  git -C "$TMP" checkout -q --orphan gh-pages
  git -C "$TMP" rm -rq --cached . >/dev/null 2>&1 || true
fi
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r "$ROOT/overcharge/." "$TMP/"
rm -rf "$TMP/test" "$TMP"/_* 2>/dev/null || true
touch "$TMP/.nojekyll"
git -C "$TMP" add -A
git -C "$TMP" commit -q -m "Deploy OVERCHARGE $(git -C "$ROOT" rev-parse --short HEAD)" || { echo "nothing to deploy"; exit 0; }
git -C "$TMP" push -q -u origin gh-pages
echo "Deployed to gh-pages"
