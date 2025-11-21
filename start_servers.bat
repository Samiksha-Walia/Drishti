@echo off
echo Starting Project Drishti Servers...

echo.
echo 1. Starting Flask API Server for Crowd and Fire/Smoke Detection...
start cmd /k "cd backend\app && python api.py"

echo.
echo 2. Starting Node.js Web Server...
start cmd /k "node server.js"

echo.
echo Servers started! Access the application at http://localhost:3000
echo.
echo Press any key to stop all servers...
pause > nul

echo.
echo Stopping servers...
taskkill /f /im python.exe /t
taskkill /f /im node.exe /t

echo.
echo Servers stopped.
pause