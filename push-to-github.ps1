# SDR Autopilot — GitHub Push Script (Windows PowerShell)
# Run this once from E:\SDR auto RAYR\SDR Claude

$ErrorActionPreference = "Stop"
$REPO = "https://github.com/Rayr-06/sdr-auto-rayr.git"

Write-Host ""
Write-Host "SDR Autopilot — Pushing to GitHub" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Init git if needed
if (-not (Test-Path ".git")) {
    git init
    Write-Host "✓ Git initialized" -ForegroundColor Green
}

# Set remote
$remotes = git remote 2>$null
if ($remotes -notcontains "origin") {
    git remote add origin $REPO
    Write-Host "✓ Remote added: $REPO" -ForegroundColor Green
} else {
    git remote set-url origin $REPO
    Write-Host "✓ Remote updated" -ForegroundColor Green
}

# Stage and commit
git add .
$status = git status --short
if ($status) {
    git commit -m "feat: complete SDR Autopilot v1 - multi-LLM, real pipeline, premium UI"
    Write-Host "✓ Changes committed" -ForegroundColor Green
} else {
    Write-Host "✓ Nothing new to commit" -ForegroundColor Yellow
}

# Push
Write-Host ""
Write-Host "Pushing to $REPO..." -ForegroundColor Cyan
git push -u origin main --force

Write-Host ""
Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
Write-Host "   View at: $REPO" -ForegroundColor White
Write-Host ""
