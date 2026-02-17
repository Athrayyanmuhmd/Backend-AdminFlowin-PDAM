@echo off
echo ========================================
echo  AQUALINK BACKEND RESTART SCRIPT
echo ========================================
echo.

echo [1/3] Killing existing backend process on port 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo Found process: %%a
    taskkill /PID %%a /F >nul 2>&1
    if errorlevel 1 (
        echo No process found or already killed
    ) else (
        echo Process %%a terminated successfully
    )
)

timeout /t 2 /nobreak >nul

echo.
echo [2/3] Port 5000 is now free
echo.

echo [3/3] Starting backend server...
echo.
npm start
