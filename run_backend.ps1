param(
    [string]$Profile = ""
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Starting CallingCRM Spring Boot Backend (Port 8080)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$env:JAVA_HOME = "C:\Users\riosv\.jdk\jdk-17.0.10+7"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Set-Location -Path "$PSScriptRoot\backend"

if ($Profile) {
    Write-Host "Running with active profile: $Profile" -ForegroundColor Yellow
    .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=$Profile"
} else {
    .\mvnw.cmd spring-boot:run
}
