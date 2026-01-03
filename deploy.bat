@echo off
REM Deploy to GitHub Pages (manual method for Windows with many files)
REM
REM Before first deploy:
REM   1. Create a GitHub repo
REM   2. Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

setlocal enabledelayedexpansion

REM === CONFIGURE THIS ===
set REPO_NAME=inversion-rpg
REM ======================

echo Building with base path: /
cd src
set VITE_BASE_PATH=/
call npm run build
if errorlevel 1 (
    echo Build failed!
    cd ..
    exit /b 1
)
cd ..

echo.
echo Deploying to gh-pages branch...

REM Get the remote URL
for /f "tokens=*" %%i in ('git remote get-url origin 2^>nul') do set REMOTE_URL=%%i
if "%REMOTE_URL%"=="" (
    echo Error: No remote 'origin' configured.
    echo Run: git remote add origin https://github.com/USERNAME/REPO.git
    exit /b 1
)

REM Create temp directory
set TEMP_DIR=%TEMP%\gh-pages-deploy-%RANDOM%
mkdir "%TEMP_DIR%"

echo Cloning gh-pages branch...
git clone --depth 1 --branch gh-pages "%REMOTE_URL%" "%TEMP_DIR%" 2>nul
if errorlevel 1 (
    echo No existing gh-pages branch, creating fresh...
    cd "%TEMP_DIR%"
    git init
    git checkout --orphan gh-pages
    git remote add origin "%REMOTE_URL%"
) else (
    cd "%TEMP_DIR%"
    REM Remove old files (except .git)
    for /f "delims=" %%i in ('dir /b /a-d 2^>nul') do del "%%i" 2>nul
    for /d %%i in (*) do if not "%%i"==".git" rd /s /q "%%i" 2>nul
)

echo Copying dist files...
xcopy /e /i /y "%~dp0src\dist\*" "." >nul

echo Committing...
git add -A
git commit -m "Deploy to GitHub Pages" >nul 2>&1
if errorlevel 1 (
    echo No changes to deploy.
    cd "%~dp0"
    rd /s /q "%TEMP_DIR%" 2>nul
    exit /b 0
)

echo Pushing to gh-pages...
git push -f origin gh-pages

cd "%~dp0"
rd /s /q "%TEMP_DIR%" 2>nul

echo.
echo Done! Site will be available at:
echo   https://YOUR_USERNAME.github.io/%REPO_NAME%/
echo.
pause
