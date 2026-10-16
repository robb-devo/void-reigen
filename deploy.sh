#!/usr/bin/env bash
# One-shot deploy to https://robb-devo.github.io/void-reigen/ (needs `gh auth login` done once on this box).
set -euo pipefail
cd "$(dirname "$0")"
gh auth status >/dev/null
gh repo view robb-devo/void-reigen >/dev/null 2>&1 || gh repo create robb-devo/void-reigen --public --description "Void Reigen – idle space mining tycoon (PWA)"
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/robb-devo/void-reigen.git
gh auth setup-git
git add -A && (git commit -qm "Void Reigen update $(date +%F_%H%M)" || true)
git push -u origin main
gh api -X POST repos/robb-devo/void-reigen/pages -f build_type=workflow >/dev/null 2>&1 || gh api -X PUT repos/robb-devo/void-reigen/pages -f build_type=workflow >/dev/null 2>&1 || true
gh workflow run pages.yml -R robb-devo/void-reigen >/dev/null 2>&1 || true
echo "Pushed. Live in ~1 min at https://robb-devo.github.io/void-reigen/"
