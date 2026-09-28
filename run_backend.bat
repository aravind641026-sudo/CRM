@echo off
title CallingCRM Backend Server
echo ====================================================
echo Starting CallingCRM Spring Boot Backend (Port 8080)...
echo ====================================================
set "JAVA_HOME=C:\Users\riosv\.jdk\jdk-17.0.10+7"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0backend"
call mvnw.cmd spring-boot:run
pause
