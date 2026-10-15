# Daily backup: dumps the Frappe site (database + files) inside the
# container, copies the dump out to the host (so it survives loss of the
# Docker volume it was made in), and replicates it into OneDrive for
# off-site redundancy (this machine already has OneDrive actively syncing
# real school documents - reusing it avoids standing up a second set of
# cloud credentials just for this).
#
# Registered as a daily Scheduled Task - see infra/register-backup-task.ps1.

$dockerExe = "C:\Users\avonj\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
$container = "infra-frappe-1"
$site = "avondale.localhost"
$logFile = "C:\Edupro\infra\backup-site.log"
$localBackupDir = "C:\Edupro\infra\backups"
$offsiteDir = "$env:USERPROFILE\OneDrive\Edupro-Backups"
$retentionDays = 30

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $logFile -Value $line
}

function Run-Docker($argString) {
    cmd /c "`"$dockerExe`" $argString >> `"$logFile`" 2>&1"
    return $LASTEXITCODE
}

Log "backup-site.ps1 invoked"

$state = cmd /c "`"$dockerExe`" inspect -f `"{{.State.Running}}`" $container 2>nul"
if ($state.Trim() -ne "true") {
    Log "ERROR: $container is not running - skipping backup (stack is down)."
    exit 1
}

New-Item -ItemType Directory -Force -Path $localBackupDir | Out-Null

# --with-files also archives uploaded documents (exemption supporting
# docs, procurement attachments, student photos) - not just the DB.
$backupExit = Run-Docker "exec $container bash -lc `"cd /home/frappe/frappe-bench && bench --site $site backup --with-files`""
if ($backupExit -ne 0) {
    Log "ERROR: bench backup failed (exit $backupExit) - see log above for detail."
    exit 1
}
Log "bench backup completed."

# Pull out only today's backup set (Frappe names each file
# <timestamp>-<site>-{database.sql.gz,files.tar,private-files.tar,site_config_backup.json})
# rather than re-copying every historical backup on every run.
$today = Get-Date -Format "yyyyMMdd"
$remoteBackupPath = "/home/frappe/frappe-bench/sites/$site/private/backups"
$fileList = cmd /c "`"$dockerExe`" exec $container bash -lc `"ls $remoteBackupPath`" 2>nul"
$todaysFiles = $fileList -split "`n" | Where-Object { $_ -like "$today*" }

if (-not $todaysFiles) {
    Log "ERROR: no backup files found for $today in $remoteBackupPath."
    exit 1
}

foreach ($f in $todaysFiles) {
    $f = $f.Trim()
    if (-not $f) { continue }
    & $dockerExe cp "${container}:${remoteBackupPath}/${f}" "$localBackupDir\$f" *>> $logFile
}
Log "Copied $($todaysFiles.Count) file(s) to $localBackupDir."

if (Test-Path "$env:USERPROFILE\OneDrive") {
    New-Item -ItemType Directory -Force -Path $offsiteDir | Out-Null
    foreach ($f in $todaysFiles) {
        $f = $f.Trim()
        if (-not $f) { continue }
        Copy-Item -Path "$localBackupDir\$f" -Destination "$offsiteDir\$f" -Force
    }
    Log "Replicated to OneDrive at $offsiteDir (syncs off-site automatically)."
} else {
    Log "WARNING: no OneDrive folder found at $env:USERPROFILE\OneDrive - backup stayed local-only. Point `$offsiteDir at wherever off-site storage is available."
}

# Local retention - OneDrive keeps its own version history, so pruning
# the local staging copy doesn't lose the off-site copy.
$cutoff = (Get-Date).AddDays(-$retentionDays)
Get-ChildItem -Path $localBackupDir -File | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
    Remove-Item $_.FullName -Force
    Log "Pruned old local backup: $($_.Name)"
}

Log "backup-site.ps1 finished."
