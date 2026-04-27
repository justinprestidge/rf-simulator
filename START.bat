@echo off
title RF Sales Call Simulator
color 0A

echo.
echo  ========================================
echo   RF Sales Call Simulator
echo  ========================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js is not installed.
    echo.
    echo  Please install Node.js from:
    echo  https://nodejs.org
    echo.
    echo  Download the LTS version, run the
    echo  installer, then try again.
    echo.
    pause
    exit /b 1
)

:: Check if apikey.txt exists
if not exist "apikey.txt" (
    echo  SETUP REQUIRED:
    echo.
    echo  Create a file called "apikey.txt" in
    echo  this folder and paste your Anthropic
    echo  API key into it.
    echo.
    echo  Get a key at: console.anthropic.com
    echo.
    echo  Press any key to open that page now...
    pause >nul
    start https://console.anthropic.com
    exit /b 1
)

echo  Starting simulator...
echo  Your browser will open automatically.
echo.
echo  Keep this window open while using the simulator.
echo  Close it when you are done.
echo.

node server-standalone.js
pause
