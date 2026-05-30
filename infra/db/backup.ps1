# Windows PowerShell backup script
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupDir = Join-Path $ScriptDir "backups"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "inventory_db_backup_$Timestamp.sql"

Write-Host "Starting PostgreSQL database backup..."
docker-compose exec -T db pg_dump -U inventory_user -d inventory_db > $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup successfully created: $BackupFile" -ForegroundColor Green
} else {
    Write-Host "Error: Database backup failed." -ForegroundColor Red
    exit 1
}
