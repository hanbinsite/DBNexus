@echo off
echo ========================================
echo    DB Client 启动中...
echo ========================================
echo.
echo 版本: v1.0.0
echo 作者: DB Client Team
echo.
echo 正在启动应用程序...
echo.

db-server.exe

if %errorlevel% neq 0 (
    echo.
    echo [错误] 应用程序启动失败！
    echo 错误代码: %errorlevel%
    pause
    exit /b %errorlevel%
)

echo.
echo 应用程序已关闭
pause
