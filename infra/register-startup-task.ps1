# One-time setup: registers a Windows Scheduled Task that runs
# start-stack.ps1 automatically whenever this user logs in, so the whole
# Edupro Docker stack (and bench inside it) comes up without any manual step.
#
# Docker Desktop itself is a per-user app (not a Windows service) and can
# only fully start within a logged-in user session - so "at log on" is the
# earliest point this can reliably run, not "at system boot" before anyone
# logs in. Combined with Docker Desktop's own "start on sign-in" setting
# (already enabled - see settings-store.json), this means: turn the machine
# on, log in, and within a few minutes the whole stack is up with no other
# action needed.

$ErrorActionPreference = "Stop"
$taskName = "EdupraStackAutoStart"
$scriptPath = "C:\Edupro\infra\start-stack.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Starts the Edupro Docker stack (mariadb/redis/frappe/portal) and bench on user log on." | Out-Null

Write-Output "Registered scheduled task '$taskName' (trigger: at log on for $env:USERNAME)."
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
