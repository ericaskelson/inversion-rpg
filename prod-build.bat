@echo off
echo Building for production...
echo   - Converting images to WebP
echo   - Compiling TypeScript
echo   - Bundling with Vite
echo   - Cleaning dist (WebP only)
echo.
cd /d "%~dp0src"
call npm run build
echo.
echo Done! Run prod-server.bat to preview, or prod-open.bat to open in browser.
pause
