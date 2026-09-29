param(
    [string]$Mode = ""
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Starting CallingCRM Expo Mobile Dev Server (Port 8081)" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$env:PATH = "C:\Users\riosv\AppData\Local\OpenAI\Codex\runtimes\cua_node\13827bafdc0b5422\bin;c:\Users\riosv\OneDrive\Documents\CRM\CRM\mobile\node_modules\.bin;$env:PATH"

Set-Location -Path "$PSScriptRoot\mobile"

if ($Mode) {
    & ".\node_modules\.bin\expo.cmd" start "--$Mode"
} else {
    & ".\node_modules\.bin\expo.cmd" start
}
