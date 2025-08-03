@echo off
setlocal enabledelayedexpansion

REM AURA Trading System - Docker Helper Script (Windows)
REM Este script facilita o gerenciamento das imagens Docker no Windows

set REGISTRY=ghcr.io
set REPO_OWNER=%GITHUB_REPOSITORY_OWNER%
set REPO_NAME=%GITHUB_REPOSITORY_NAME%

REM Se as variáveis não estão definidas, tentar extrair do git
if "%REPO_OWNER%"=="" (
    for /f "tokens=*" %%i in ('git config --get remote.origin.url') do set GIT_URL=%%i
    REM Extrair owner do URL do git (simplificado)
    set REPO_OWNER=seu-usuario
)

if "%REPO_NAME%"=="" (
    set REPO_NAME=aura-trading-system
)

set FULL_REPO=%REPO_OWNER%/%REPO_NAME%

REM Função para mostrar ajuda
if "%1"=="help" goto :show_help
if "%1"=="--help" goto :show_help
if "%1"=="-h" goto :show_help
if "%1"=="" goto :show_help

REM Processar comandos
if "%1"=="build" goto :build_images
if "%1"=="pull" goto :pull_images
if "%1"=="push" goto :push_images
if "%1"=="run" goto :run_service
if "%1"=="logs" goto :show_logs
if "%1"=="clean" goto :clean_images
if "%1"=="list" goto :list_images
if "%1"=="inspect" goto :inspect_image
if "%1"=="shell" goto :open_shell
if "%1"=="health" goto :check_health

echo [ERROR] Comando inválido. Use 'docker-helper.bat help' para ver os comandos disponíveis.
exit /b 1

:show_help
echo AURA Trading System - Docker Helper (Windows)
echo.
echo Uso: docker-helper.bat [COMANDO] [OPÇÕES]
echo.
echo Comandos:
echo   build [service]     - Build local das imagens (backend, frontend, ou all)
echo   pull [tag]          - Pull das imagens do registry (latest, develop, etc.)
echo   push [tag]          - Push das imagens para o registry
echo   run [service]       - Executar um serviço localmente
echo   logs [service]      - Mostrar logs de um serviço
echo   clean               - Limpar imagens não utilizadas
echo   list                - Listar imagens do projeto
echo   inspect [service]   - Inspecionar uma imagem
echo   shell [service]     - Abrir shell dentro de uma imagem
echo   health [service]    - Verificar health check de um serviço
echo.
echo Exemplos:
echo   docker-helper.bat build all
echo   docker-helper.bat pull latest
echo   docker-helper.bat run backend
echo   docker-helper.bat logs frontend
echo   docker-helper.bat clean
goto :eof

:build_images
set service=%2
if "%service%"=="" set service=all

if "%service%"=="backend" goto :build_backend
if "%service%"=="frontend" goto :build_frontend
if "%service%"=="all" goto :build_all

echo [ERROR] Serviço inválido. Use: backend, frontend, ou all
exit /b 1

:build_backend
echo [INFO] Building backend image...
docker build -f Dockerfile.backend -t aura/backend:local .
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build backend image
    exit /b 1
)
echo [SUCCESS] Backend image built successfully
if "%service%"=="backend" goto :eof
goto :build_frontend

:build_frontend
echo [INFO] Building frontend image...
docker build -f Dockerfile.frontend -t aura/frontend:local .
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build frontend image
    exit /b 1
)
echo [SUCCESS] Frontend image built successfully
goto :eof

:build_all
goto :build_backend

:pull_images
set tag=%2
if "%tag%"=="" set tag=latest

echo [INFO] Pulling images with tag: %tag%

docker pull %REGISTRY%/%FULL_REPO%/backend:%tag%
docker pull %REGISTRY%/%FULL_REPO%/frontend:%tag%

echo [SUCCESS] Pull completed
goto :eof

:push_images
set tag=%2
if "%tag%"=="" set tag=latest

echo [INFO] Pushing images with tag: %tag%

REM Tag local images
docker tag aura/backend:local %REGISTRY%/%FULL_REPO%/backend:%tag%
docker tag aura/frontend:local %REGISTRY%/%FULL_REPO%/frontend:%tag%

REM Push images
docker push %REGISTRY%/%FULL_REPO%/backend:%tag%
docker push %REGISTRY%/%FULL_REPO%/frontend:%tag%

echo [SUCCESS] Push completed
goto :eof

:run_service
set service=%2
set tag=%3
if "%tag%"=="" set tag=local

if "%service%"=="backend" goto :run_backend
if "%service%"=="frontend" goto :run_frontend

echo [ERROR] Serviço inválido. Use: backend ou frontend
exit /b 1

:run_backend
echo [INFO] Starting backend service...
docker run -d --name aura-backend-dev -p 3001:3001 -e NODE_ENV=development aura/backend:%tag%
echo [SUCCESS] Backend started successfully
goto :eof

:run_frontend
echo [INFO] Starting frontend service...
docker run -d --name aura-frontend-dev -p 3000:3000 aura/frontend:%tag%
echo [SUCCESS] Frontend started successfully
goto :eof

:show_logs
set service=%2

if "%service%"=="backend" (
    docker logs -f aura-backend-dev
    goto :eof
)

if "%service%"=="frontend" (
    docker logs -f aura-frontend-dev
    goto :eof
)

echo [ERROR] Serviço inválido. Use: backend ou frontend
exit /b 1

:clean_images
echo [INFO] Cleaning unused images...

docker image prune -f
docker images -f "dangling=true" -q > temp_images.txt
if exist temp_images.txt (
    for /f %%i in (temp_images.txt) do docker rmi %%i
    del temp_images.txt
)

echo [SUCCESS] Cleanup completed
goto :eof

:list_images
echo [INFO] AURA Trading System Images:
echo.
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | findstr /i "aura"
goto :eof

:inspect_image
set service=%2
set tag=%3
if "%tag%"=="" set tag=local

if "%service%"=="backend" (
    docker inspect aura/backend:%tag%
    goto :eof
)

if "%service%"=="frontend" (
    docker inspect aura/frontend:%tag%
    goto :eof
)

echo [ERROR] Serviço inválido. Use: backend ou frontend
exit /b 1

:open_shell
set service=%2
set tag=%3
if "%tag%"=="" set tag=local

if "%service%"=="backend" (
    echo [INFO] Opening shell in backend:%tag%...
    docker run -it --rm aura/backend:%tag% sh
    goto :eof
)

if "%service%"=="frontend" (
    echo [INFO] Opening shell in frontend:%tag%...
    docker run -it --rm aura/frontend:%tag% sh
    goto :eof
)

echo [ERROR] Serviço inválido. Use: backend ou frontend
exit /b 1

:check_health
set service=%2

if "%service%"=="backend" (
    echo [INFO] Checking backend health...
    curl -f http://localhost:3001/api/v1/health
    goto :eof
)

if "%service%"=="frontend" (
    echo [INFO] Checking frontend health...
    curl -f http://localhost:3000/health
    goto :eof
)

echo [ERROR] Serviço inválido. Use: backend ou frontend
exit /b 1