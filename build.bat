@echo off
echo Building DB Client...

REM Create frontend dist directory if it doesn't exist
if not exist "frontend\dist" mkdir "frontend\dist"

REM Build the application
wails build

echo Build complete!