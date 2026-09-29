@echo off
title CallingCRM Mobile Expo Server
echo ====================================================
echo Starting CallingCRM Expo Mobile Dev Server (Port 8081)...
echo ====================================================
set "PATH=C:\Users\riosv\AppData\Local\OpenAI\Codex\runtimes\cua_node\13827bafdc0b5422\bin;%~dp0mobile\node_modules\.bin;%PATH%"
cd /d "%~dp0mobile"
call "node_modules\.bin\expo.cmd" start
pause
