#!/usr/bin/env bash
# SDR Autopilot — GitHub Push Script (macOS / Linux)
set -e
REPO="https://github.com/Rayr-06/sdr-auto-rayr.git"

echo ""
echo "SDR Autopilot — Pushing to GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ ! -d .git ] && git init && echo "✓ Git initialized"

git remote get-url origin 2>/dev/null && git remote set-url origin $REPO || git remote add origin $REPO
echo "✓ Remote: $REPO"

git add .
if ! git diff --cached --quiet; then
  git commit -m "feat: complete SDR Autopilot v1 - multi-LLM, real pipeline, premium UI"
  echo "✓ Committed"
fi

git push -u origin main --force
echo ""
echo "✅ Pushed to GitHub!"
echo "   $REPO"
