# start_sidecar.ps1 — Run the Python REST sidecar on port 8001
# Usage: .\start_sidecar.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvPython = Join-Path $scriptDir "sidecar\.venv\Scripts\uvicorn.exe"

Write-Host "Starting Kotak Neo Python Sidecar on http://localhost:8001" -ForegroundColor Cyan
& $venvPython main:app --app-dir "$scriptDir\sidecar" --host 127.0.0.1 --port 8001 --reload
