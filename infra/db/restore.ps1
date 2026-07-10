# Windows PowerShell restore script
if ($args.Count -ne 1) {
    Write-Host "Usage: .\restore.ps1 <path_to_backup_file.sql>" -ForegroundColor Yellow
    exit 1
}

$BackupFile = $args[0]

if (!(Test-Path $BackupFile)) {
    Write-Host "Error: Backup file '$BackupFile' not found." -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)

Write-Host "Starting PostgreSQL database restore from $BackupFile..."
Get-Content $BackupFile | docker-compose -f (Join-Path $ProjectRoot "docker-compose.yml") exec -T db psql -U inventory_user -d inventory_db

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database successfully restored from $BackupFile" -ForegroundColor Green
} else {
    Write-Host "Error: Database restore failed." -ForegroundColor Red
    exit 1
}
