$ErrorActionPreference = "Stop"

$pgDump = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
$backupDir = "f:\Projects\AkLearningPlatform\backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $backupDir "ak_learning_platform_$timestamp.sql"

if (-not $env:PGPASSWORD) {
    $env:PGPASSWORD = "postgres"
}

& $pgDump -U postgres -h localhost -p 5433 -F p -f $outFile ak_learning_platform
Write-Host "Backup created: $outFile"

# Retain only the 14 most recent backups
Get-ChildItem $backupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
