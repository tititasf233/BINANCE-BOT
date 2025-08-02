@echo off
echo ========================================
echo    MONITOR DE LOGS - SISTEMA AURA
echo ========================================
echo.

:: Verificar se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado!
    echo Por favor, instale o Python de: https://python.org/
    pause
    exit /b 1
)

echo [INFO] Python encontrado:
python --version
echo.

:: Verificar se o arquivo de monitoramento existe
if not exist "log_monitor.py" (
    echo [ERRO] Arquivo log_monitor.py nao encontrado!
    pause
    exit /b 1
)

echo [INFO] Iniciando monitor de logs...
echo [INFO] O monitor ira iniciar automaticamente o backend e frontend
echo [INFO] Pressione Ctrl+C para parar todos os servicos
echo.

:: Executar o monitor
python log_monitor.py

pause