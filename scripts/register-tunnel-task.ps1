# Run this once (as Administrator) to register the tunnel as a Windows startup task.
# It will auto-run on every login, keeping the Cloudflare tunnel alive.

$taskName   = 'HomerNemoClawTunnel'
$scriptPath = "$PSScriptRoot\start-tunnel.ps1"
$action     = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""

# Trigger: at log-on of current user
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Settings: allow running even on battery, restart on failure
$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 2) `
  -StartWhenAvailable

# Remove old task if it exists
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Register
Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -RunLevel Highest `
  -Force | Out-Null

Write-Host "Scheduled task '$taskName' registered — runs at every login."
Write-Host "To run it now:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "To remove it:   Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
