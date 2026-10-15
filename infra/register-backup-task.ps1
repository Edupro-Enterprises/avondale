# One-time setup: registers a daily Scheduled Task that runs
# backup-site.ps1 automatically, so the school's financial records get
# backed up (DB + uploaded files) without anyone having to remember to
# do it by hand.
#
# Runs at 18:00 (after the school day, while the Bursar's PC - and so
# the Docker stack, which only starts on log-on, see start-stack.ps1 -
# is most likely still on). StartWhenAvailable means a day the PC was
# off at 18:00 still gets a backup as soon as it's next on, rather than
# silently skipping that day.

$ErrorActionPreference = "Stop"
$taskName = "EdupraDailyBackup"
$scriptPath = "C:\Edupro\infra\backup-site.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

$trigger = New-ScheduledTaskTrigger -Daily -At "18:00"

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Backs up the Edupro Frappe site (database + files) daily to C:\Edupro\infra\backups and OneDrive." | Out-Null

Write-Output "Registered scheduled task '$taskName' (trigger: daily at 18:00)."
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
