@echo off
setlocal enabledelayedexpansion

echo 🚀 Monitor GitHub Actions - BINANCE-BOT
echo =======================================
echo.

set GH_CLI="C:\Program Files\GitHub CLI\gh.exe"
set REPO=tititasf/BINANCE-BOT

echo 📊 Verificando autenticação...
%GH_CLI% auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Não autenticado com GitHub
    echo.
    echo Para autenticar, execute:
    echo %GH_CLI% auth login --web
    echo.
    echo Depois execute este script novamente.
    pause
    exit /b 1
)

echo ✅ Autenticado com GitHub
echo.

echo 📋 Workflows em execução:
echo ========================
%GH_CLI% run list --repo %REPO% --limit 5
echo.

echo 🔍 Detalhes do último workflow:
echo ==============================
for /f "tokens=1" %%i in ('%GH_CLI% run list --repo %REPO% --limit 1 --json databaseId --jq ".[0].databaseId"') do set LATEST_RUN=%%i

if defined LATEST_RUN (
    echo ID da execução: %LATEST_RUN%
    echo.
    %GH_CLI% run view %LATEST_RUN% --repo %REPO%
    echo.
    
    echo 📊 Status dos jobs:
    %GH_CLI% run view %LATEST_RUN% --repo %REPO% --json jobs --jq ".jobs[] | {name: .name, status: .status, conclusion: .conclusion}"
    echo.
    
    echo 🔄 Para acompanhar em tempo real:
    echo %GH_CLI% run watch %LATEST_RUN% --repo %REPO%
    echo.
    
    echo 📝 Para ver logs:
    echo %GH_CLI% run view %LATEST_RUN% --repo %REPO% --log
    echo.
) else (
    echo ❌ Nenhuma execução encontrada
)

echo 🌐 Link direto:
echo https://github.com/%REPO%/actions
echo.

echo ⚡ Comandos úteis:
echo ================
echo # Listar execuções: %GH_CLI% run list --repo %REPO%
echo # Ver execução: %GH_CLI% run view [ID] --repo %REPO%
echo # Acompanhar: %GH_CLI% run watch [ID] --repo %REPO%
echo # Ver logs: %GH_CLI% run view [ID] --repo %REPO% --log
echo.

pause