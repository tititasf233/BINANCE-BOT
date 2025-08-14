@echo off
setlocal enabledelayedexpansion

REM AURA Trading System - Development Docker Script (Windows)
REM Script para gerenciar o ambiente de desenvolvimento com bind mounts

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."

REM Cores para output (Windows)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

REM Funções de log
:log_info
echo %BLUE%[INFO]%NC% %~1
goto :eof

:log_success
echo %GREEN%[SUCCESS]%NC% %~1
goto :eof

:log_warning
echo %YELLOW%[WARNING]%NC% %~1
goto :eof

:log_error
echo %RED%[ERROR]%NC% %~1
goto :eof

REM Verificar se Docker está instalado
:check_docker
docker --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker não está instalado. Por favor, instale o Docker primeiro."
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    call :log_error "Docker não está rodando. Por favor, inicie o Docker primeiro."
    exit /b 1
)

call :log_success "Docker e Docker Compose estão prontos"
goto :eof

REM Função para iniciar o ambiente de desenvolvimento
:start_dev
call :log_info "Iniciando ambiente de desenvolvimento..."

REM Fazer build das imagens de desenvolvimento
call :log_info "Fazendo build das imagens de desenvolvimento..."
docker-compose -f docker-compose.dev.yml build
if errorlevel 1 (
    call :log_error "Erro ao fazer build das imagens"
    exit /b 1
)

REM Iniciar serviços
call :log_info "Iniciando serviços..."
docker-compose -f docker-compose.dev.yml up -d
if errorlevel 1 (
    call :log_error "Erro ao iniciar serviços"
    exit /b 1
)

call :log_success "Ambiente de desenvolvimento iniciado!"
call :log_info "Frontend: http://localhost:3000"
call :log_info "Backend: http://localhost:3001"
call :log_info "PostgreSQL: localhost:5432"
call :log_info "Redis: localhost:6379"
goto :eof

REM Função para parar o ambiente
:stop_dev
call :log_info "Parando ambiente de desenvolvimento..."
docker-compose -f docker-compose.dev.yml down
call :log_success "Ambiente parado!"
goto :eof

REM Função para reiniciar o ambiente
:restart_dev
call :log_info "Reiniciando ambiente de desenvolvimento..."
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
call :log_success "Ambiente reiniciado!"
goto :eof

REM Função para ver logs
:show_logs
if "%~1"=="" (
    call :log_info "Mostrando logs de todos os serviços..."
    docker-compose -f docker-compose.dev.yml logs -f
) else (
    call :log_info "Mostrando logs do serviço: %~1"
    docker-compose -f docker-compose.dev.yml logs -f "%~1"
)
goto :eof

REM Função para entrar no container
:exec_container
if "%~1"=="" set "service=backend"
if not "%~1"=="" set "service=%~1"
call :log_info "Entrando no container: !service!"
docker-compose -f docker-compose.dev.yml exec "!service!" sh
goto :eof

REM Função para rebuild das imagens
:rebuild
if "%~1"=="" (
    call :log_info "Rebuild de todas as imagens..."
    docker-compose -f docker-compose.dev.yml build --no-cache
) else (
    call :log_info "Rebuild da imagem: %~1"
    docker-compose -f docker-compose.dev.yml build --no-cache "%~1"
)
goto :eof

REM Função para limpar volumes
:cleanup
call :log_warning "Isso irá remover todos os volumes. Tem certeza? (y/N)"
set /p response=
if /i "!response!"=="y" (
    call :log_info "Removendo volumes..."
    docker-compose -f docker-compose.dev.yml down -v
    docker volume prune -f
    call :log_success "Volumes removidos!"
) else (
    call :log_info "Operação cancelada."
)
goto :eof

REM Função para mostrar status
:show_status
call :log_info "Status dos containers:"
docker-compose -f docker-compose.dev.yml ps
goto :eof

REM Função para mostrar ajuda
:show_help
echo 🚀 AURA Trading System - Development Docker Helper
echo.
echo Uso: %~nx0 [comando]
echo.
echo Comandos disponíveis:
echo   start     - Iniciar ambiente de desenvolvimento
echo   stop      - Parar ambiente de desenvolvimento
echo   restart   - Reiniciar ambiente de desenvolvimento
echo   logs      - Mostrar logs (opcional: especificar serviço)
echo   exec      - Entrar no container (padrão: backend)
echo   rebuild   - Rebuild das imagens (opcional: especificar serviço)
echo   cleanup   - Limpar volumes
echo   status    - Mostrar status dos containers
echo   help      - Mostrar esta ajuda
echo.
echo Exemplos:
echo   %~nx0 start
echo   %~nx0 logs backend
echo   %~nx0 exec frontend
echo   %~nx0 rebuild backend
goto :eof

REM Main
if "%~1"=="" goto :show_help

if "%~1"=="start" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :start_dev
    goto :eof
)

if "%~1"=="stop" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :stop_dev
    goto :eof
)

if "%~1"=="restart" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :restart_dev
    goto :eof
)

if "%~1"=="logs" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :show_logs "%~2"
    goto :eof
)

if "%~1"=="exec" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :exec_container "%~2"
    goto :eof
)

if "%~1"=="rebuild" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :rebuild "%~2"
    goto :eof
)

if "%~1"=="cleanup" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :cleanup
    goto :eof
)

if "%~1"=="status" (
    call :check_docker
    if errorlevel 1 exit /b 1
    call :show_status
    goto :eof
)

if "%~1"=="help" (
    call :show_help
    goto :eof
)

call :log_error "Comando inválido: %~1"
call :show_help
exit /b 1 