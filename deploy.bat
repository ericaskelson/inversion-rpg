@echo off
REM Deploy to GitHub Pages
REM
REM Before first deploy:
REM   1. Create a GitHub repo
REM   2. Run: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
REM   3. Edit this file and set REPO_NAME below
REM
REM Usage: deploy.bat

REM === CONFIGURE THIS ===
set REPO_NAME=inversion-rpg
REM ======================

echo Building with base path: /%REPO_NAME%/
cd src
set VITE_BASE_PATH=/%REPO_NAME%/
call npm run build
if errorlevel 1 (
    echo Build failed!
    cd ..
    exit /b 1
)

echo.
echo Deploying to gh-pages branch...
call npm run deploy
if errorlevel 1 (
    echo Deploy failed!
    cd ..
    exit /b 1
)

cd ..
echo.
echo Done! Site will be available at:
echo   https://YOUR_USERNAME.github.io/%REPO_NAME%/
echo.
echo (Replace YOUR_USERNAME with your GitHub username)
