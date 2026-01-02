@echo off
echo Starting production preview server...
echo.
echo   Site: http://localhost:4173
echo   Uses WebP images (production mode)
echo.
cd /d "%~dp0src"
npm run preview
