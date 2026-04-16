# SDR Autopilot — Automated setup script (Windows PowerShell)
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "🚀 SDR Autopilot — Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ─── Check runtime ────────────────────────────────────────
$runtime = ""
if (Get-Command bun -ErrorAction SilentlyContinue) {
    $bunVer = bun --version
    Write-Host "✓ Using Bun ($bunVer)" -ForegroundColor Green
    $runtime = "bun"
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node -e "process.stdout.write(process.version)"
    Write-Host "✓ Using Node.js $nodeVer + npm" -ForegroundColor Green
    $runtime = "npm"
} else {
    Write-Host "✗ Neither Bun nor Node.js found." -ForegroundColor Red
    Write-Host "  Install Bun  → https://bun.sh" -ForegroundColor Yellow
    Write-Host "  Install Node → https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# ─── Create .env ──────────────────────────────────────────
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host ""
    Write-Host "─── Anthropic API Key ───────────────────────────────────" -ForegroundColor Yellow
    Write-Host "Get your key at https://console.anthropic.com" -ForegroundColor White
    Write-Host "Without a key, the app uses realistic demo data (still fully functional)." -ForegroundColor Yellow
    Write-Host ""
    $apiKey = Read-Host "Enter your Anthropic API key (press Enter to skip)"
    if ($apiKey) {
        (Get-Content .env) -replace 'ANTHROPIC_API_KEY=.*', "ANTHROPIC_API_KEY=$apiKey" | Set-Content .env
        Write-Host "✓ API key saved to .env" -ForegroundColor Green
    } else {
        Write-Host "⚠  Skipped — demo mode will be used" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ .env already exists" -ForegroundColor Green
}

# ─── Create db directory ──────────────────────────────────
New-Item -ItemType Directory -Force -Path db | Out-Null

# ─── Install dependencies ─────────────────────────────────
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Cyan
if ($runtime -eq "bun") {
    bun install
} else {
    npm install
}
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# ─── Database setup ───────────────────────────────────────
Write-Host ""
Write-Host "Setting up database..." -ForegroundColor Cyan
if ($runtime -eq "bun") {
    try { bun run db:generate } catch {}
    bun run db:push
} else {
    try { npm run db:generate } catch {}
    npm run db:push
}
Write-Host "✓ Database ready (./db/sdr.db)" -ForegroundColor Green

# ─── Done ─────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Start the app:  $runtime run dev" -ForegroundColor White
Write-Host "Then open:      http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host 'Click "Run Full Pipeline" to see the AI in action.' -ForegroundColor Cyan
Write-Host ""
