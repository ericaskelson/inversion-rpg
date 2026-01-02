@echo off
echo Starting Inverse RPG in Edit Mode...
echo Vite dev server on http://localhost:5173
echo Editor API on http://localhost:3001
cd /d "%~dp0src"
npm run dev:edit
