@echo off
echo Killing process on port 5000...

REM Find and kill process using port 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    taskkill /F /PID %%a 2>nul
)

echo Port 5000 freed!
timeout /t 2 /nobreak >nul

echo Starting backend server...
npm start