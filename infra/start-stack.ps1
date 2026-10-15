# Brings the whole Edupro stack up unattended after a reboot/login: waits for
# the Docker engine (Docker Desktop itself is launched separately, via its own
# "start on sign-in" setting - this script just waits for it), starts the
# compose stack, then starts bench inside the frappe container since that
# container's own entrypoint is just `sleep infinity` (a bare bench shell you
# normally exec into by hand) and won't come up with bench running on its own.
#
# Registered as a Scheduled Task (trigger: at log on) - see infra/register-startup-task.ps1.
#
# Docker's CLI writes routine status lines (e.g. "Container X Running") to
# stderr - PowerShell wraps every stderr line from a native command into a
# terminating NativeCommandError when $ErrorActionPreference is "Stop", which
# aborted earlier versions of this script on totally successful runs. Every
# docker invocation below is run through cmd.exe so redirection happens at
# the OS level instead of PowerShell's stream system, and exit codes are
# checked explicitly rather than relying on PowerShell's error handling.

$dockerExe = "C:\Users\avonj\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
$composeFile = "C:\Edupro\infra\docker-compose.yml"
$logFile = "C:\Edupro\infra\start-stack.log"

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Add-Content -Path $logFile -Value $line
}

function Run-Docker($argString) {
    cmd /c "`"$dockerExe`" $argString >> `"$logFile`" 2>&1"
    return $LASTEXITCODE
}

Log "start-stack.ps1 invoked"

# Wait for the Docker engine to accept commands (Docker Desktop can take a
# couple of minutes to finish starting its WSL2 backend after launch).
$deadline = (Get-Date).AddMinutes(5)
$ready = $false
while ((Get-Date) -lt $deadline) {
    if ((Run-Docker "info") -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $ready) {
    Log "ERROR: Docker engine did not become ready within 5 minutes - giving up."
    exit 1
}
Log "Docker engine is ready."

$composeExit = Run-Docker "compose -f `"$composeFile`" up -d"
Log "docker compose up -d issued (exit $composeExit)."

# Wait for the frappe container to actually be running before exec'ing into it.
$deadline = (Get-Date).AddMinutes(2)
$frappeUp = $false
while ((Get-Date) -lt $deadline) {
    $state = cmd /c "`"$dockerExe`" inspect -f `"{{.State.Running}}`" infra-frappe-1 2>nul"
    if ($state.Trim() -eq "true") { $frappeUp = $true; break }
    Start-Sleep -Seconds 3
}
if (-not $frappeUp) {
    Log "ERROR: infra-frappe-1 did not reach Running state - skipping bench start."
    exit 1
}

# bench start isn't part of the container's own startup - launch it detached
# if it isn't already running (idempotent: safe to call after a plain
# container restart where bench never died, e.g. if this script re-runs).
$alreadyRunning = cmd /c "`"$dockerExe`" exec infra-frappe-1 bash -lc `"pgrep -f 'bench_helper frappe serve' > /dev/null && echo yes || echo no`""
if ($alreadyRunning.Trim() -eq "no") {
    Run-Docker "exec -d infra-frappe-1 bash -lc `"cd /home/frappe/frappe-bench && nohup bench start > /home/frappe/frappe-bench/logs/bench_start.log 2>&1 &`""
    Log "bench start launched inside infra-frappe-1."
} else {
    Log "bench already running inside infra-frappe-1 - nothing to do."
}

Log "start-stack.ps1 finished."
