@echo off
echo Starting development server (with editor support)...
echo.
echo   Site: http://localhost:5173
echo   Edit mode available in UI
echo.
cd /d "%~dp0src"
npm run dev:edit
