@echo off
echo ========================================
echo    Sistema AURA - Setup Automatico
echo ========================================
echo.

:: Verificar se Node.js esta instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js 18+ de: https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js encontrado: 
node --version

:: Verificar se npm esta instalado
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] npm nao encontrado!
    pause
    exit /b 1
)

echo [INFO] npm encontrado:
npm --version
echo.

:: Instalar dependencias do projeto raiz
echo [STEP 1/6] Instalando dependencias do projeto raiz...
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias do projeto raiz
    pause
    exit /b 1
)
echo [OK] Dependencias do projeto raiz instaladas
echo.

:: Instalar dependencias do backend
echo [STEP 2/6] Instalando dependencias do backend...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias do backend
    pause
    exit /b 1
)
echo [OK] Dependencias do backend instaladas
cd ..
echo.

:: Instalar dependencias do frontend
echo [STEP 3/6] Instalando dependencias do frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias do frontend
    pause
    exit /b 1
)
echo [OK] Dependencias do frontend instaladas
cd ..
echo.

:: Verificar e corrigir problemas de linting
echo [STEP 4/6] Verificando e corrigindo problemas de codigo...
echo [INFO] Executando linter no backend...
cd backend
call npm run lint:fix 2>nul
echo [OK] Linter do backend executado
cd ..

echo [INFO] Executando linter no frontend...
cd frontend
call npm run lint:fix 2>nul
echo [OK] Linter do frontend executado
cd ..
echo.

:: Verificar arquivos de configuracao
echo [STEP 5/6] Verificando arquivos de configuracao...

if not exist ".env" (
    echo [INFO] Criando arquivo .env a partir do .env.example...
    copy ".env.example" ".env" >nul
    echo [AVISO] Configure suas variaveis de ambiente no arquivo .env
)

if not exist "backend\.env" (
    echo [INFO] Criando arquivo backend\.env...
    copy "backend\.env.example" "backend\.env" >nul 2>nul
    if not exist "backend\.env" (
        echo NODE_ENV=development > "backend\.env"
        echo PORT=8000 >> "backend\.env"
        echo DB_HOST=localhost >> "backend\.env"
        echo DB_PORT=5432 >> "backend\.env"
        echo DB_NAME=aura_trading >> "backend\.env"
        echo DB_USER=postgres >> "backend\.env"
        echo DB_PASSWORD=password >> "backend\.env"
        echo REDIS_HOST=localhost >> "backend\.env"
        echo REDIS_PORT=6379 >> "backend\.env"
        echo JWT_SECRET=your-super-secret-jwt-key-change-this >> "backend\.env"
        echo ENCRYPTION_KEY=your-32-character-encryption-key >> "backend\.env"
        echo BINANCE_USE_TESTNET=true >> "backend\.env"
    )
)

echo [OK] Arquivos de configuracao verificados
echo.

:: Executar testes basicos
echo [STEP 6/6] Executando testes basicos...
echo [INFO] Testando build do backend...
cd backend
call npm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Build do backend falhou - verifique os erros
) else (
    echo [OK] Build do backend bem-sucedido
)
cd ..

echo [INFO] Testando build do frontend...
cd frontend
call npm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Build do frontend falhou - verifique os erros
) else (
    echo [OK] Build do frontend bem-sucedido
)
cd ..
echo.

echo ========================================
echo           SETUP CONCLUIDO!
echo ========================================
echo.
echo Proximos passos:
echo 1. Configure suas variaveis de ambiente no arquivo .env
echo 2. Configure suas chaves da Binance no arquivo .env
echo 3. Certifique-se de que PostgreSQL e Redis estao rodando
echo 4. Execute: npm run dev
echo.
echo URLs importantes:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:8000
echo - Health Check: http://localhost:8000/api/v1/health
echo.
echo Para iniciar o sistema agora, pressione qualquer tecla...
pause >nul

echo.
echo [INFO] Iniciando sistema AURA...
call npm run dev

pause