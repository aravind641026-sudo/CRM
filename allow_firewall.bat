@echo off
:: Batch script to allow inbound connections to port 8080 in Windows Firewall
echo ========================================================
echo  Configuring Windows Firewall for CallingCRM (Port 8080)
echo ========================================================
echo.
netsh advfirewall firewall add rule name="CallingCRM Backend 8080" dir=in action=allow protocol=TCP localport=8080
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Windows Firewall now allows incoming connections on port 8080!
) else (
    echo [ERROR] Failed to add firewall rule. Please right-click this file and select "Run as administrator".
)
echo.
pause
