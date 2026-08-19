@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8734 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)
