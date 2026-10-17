@echo off
echo Starting Library Management System...
cd /d "%~dp0library-management-system"
call mvnw.cmd spring-boot:run
pause
