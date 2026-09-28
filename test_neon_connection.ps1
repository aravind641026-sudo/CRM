param (
    [string]$Password = "npg_e3Bb6jtLEHGW"
)

$PsqlPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $PsqlPath)) {
    Write-Host "[!] psql.exe not found at standard path $PsqlPath" -ForegroundColor Red
    exit 1
}

$HostName = "ep-nameless-glitter-b513ehd2-pooler.c-7.us-east-2.aws.neon.tech"
$Database = "crmq"
$User = "neondb_owner"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Testing Neon PostgreSQL Connection" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Host:     $HostName"
Write-Host "Database: $Database"
Write-Host "User:     $User"
Write-Host "Testing credentials..." -ForegroundColor Yellow

$ConnString = "postgresql://${User}:${Password}@${HostName}/${Database}?sslmode=require"

$env:PGPASSWORD = $Password
$output = & $PsqlPath $ConnString -c "SELECT current_database() AS db, current_user AS usr, version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Successfully connected to Neon PostgreSQL database '$Database'!" -ForegroundColor Green
    Write-Host $output
} else {
    Write-Host "`n[ERROR] Connection failed!" -ForegroundColor Red
    Write-Host $output -ForegroundColor Red
    Write-Host "`nNote: In Neon Console, click 'Reset password' next to role '$User' or click the 'Show password' eye icon to verify your exact active password." -ForegroundColor Yellow
}
