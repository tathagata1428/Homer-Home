# Homer NemoClaw Tunnel — auto-starts cloudflared and updates Vercel env
# Registered as a Windows scheduled task on startup via register-tunnel-task.ps1

param(
  [string]$OllamaUrl  = 'http://localhost:11434',
  [string]$EnvVarName = 'NEMOCLAW_GATEWAY_URL',
  [string]$VercelProject = 'homer-home-qh6u'
)

$CF   = "$env:LOCALAPPDATA\cloudflared\cloudflared.exe"
$LOG  = "$env:LOCALAPPDATA\cloudflared\tunnel.log"
$PIDFILE = "$env:LOCALAPPDATA\cloudflared\tunnel.pid"

# Kill any previous cloudflared process we launched
if (Test-Path $PIDFILE) {
  $oldPid = Get-Content $PIDFILE -ErrorAction SilentlyContinue
  if ($oldPid) {
    Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $PIDFILE -Force -ErrorAction SilentlyContinue
}
if (Test-Path $LOG) { Remove-Item $LOG -Force -ErrorAction SilentlyContinue }

# Wait for Ollama to be ready (up to 60s after boot)
Write-Host "[tunnel] Waiting for Ollama at $OllamaUrl..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -Uri $OllamaUrl -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    if ($r.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $ready) { Write-Host "[tunnel] Ollama not responding — aborting"; exit 1 }
Write-Host "[tunnel] Ollama ready."

# Start cloudflared quick tunnel
$proc = Start-Process -FilePath $CF `
  -ArgumentList "tunnel","--url",$OllamaUrl `
  -RedirectStandardError $LOG `
  -NoNewWindow -PassThru
$proc.Id | Out-File $PIDFILE -Force
Write-Host "[tunnel] cloudflared PID $($proc.Id) started."

# Wait for URL in log (up to 30s)
$url = ''
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  $content = Get-Content $LOG -Raw -ErrorAction SilentlyContinue
  if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
    $url = $Matches[0]; break
  }
}

if (-not $url) {
  Write-Host "[tunnel] ERROR: could not detect tunnel URL."
  Get-Content $LOG -ErrorAction SilentlyContinue | Select-Object -Last 20
  exit 1
}

Write-Host "[tunnel] URL: $url"

# Update Vercel env var
Write-Host "[tunnel] Updating Vercel env $EnvVarName..."
$url | & vercel env add $EnvVarName production --force 2>&1 | Write-Host

# Redeploy
Write-Host "[tunnel] Triggering production redeploy..."
& vercel --prod --yes 2>&1 | Select-String 'Aliased|Error' | Write-Host

Write-Host "[tunnel] Done. Tunnel is live at $url"
