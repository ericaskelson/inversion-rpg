@echo off
echo Building for development...
cd /d "%~dp0src"
call npm run build:dev
echo.
echo Done! Run dev-server.bat to preview, or dev-open.bat to open in browser.
pause
