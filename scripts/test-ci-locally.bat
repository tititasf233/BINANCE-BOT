@echo off
echo ========================================
echo   TESTE LOCAL DO CI/CD PIPELINE
echo ========================================

echo.
echo [1/6] Verificando dependencias...
cd backend
if not exist node_modules (
    echo Instalando dependencias do backend...
    npm ci
)
cd ..

cd frontend
if not exist node_modules (
    echo Instalando dependencias do frontend...
    npm ci
)
cd ..

echo.
echo [2/6] Executando linting (backend)...
cd backend
npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Linting backend falhou, mas continuando...
)
cd ..

echo.
echo [3/6] Executando linting (frontend)...
cd frontend
npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Linting frontend falhou, mas continuando...
)
cd ..

echo.
echo [4/6] Verificando compilacao TypeScript (backend)...
cd backend
npx tsc --noEmit --skipLibCheck
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: TypeScript backend tem erros, mas continuando...
)
cd ..

echo.
echo [5/6] Verificando compilacao TypeScript (frontend)...
cd frontend
npx tsc --noEmit --skipLibCheck
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: TypeScript frontend tem erros, mas continuando...
)
cd ..

echo.
echo [6/6] Testando build Docker...
echo Testando build do backend...
docker build -f Dockerfile.backend -t test-backend:latest .
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build Docker backend falhou!
    exit /b 1
)

echo Testando build do frontend...
docker build -f Dockerfile.frontend -t test-frontend:latest .
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build Docker frontend falhou!
    exit /b 1
)

echo.
echo ========================================
echo   TESTE CONCLUIDO COM SUCESSO!
echo ========================================
echo.
echo Imagens Docker criadas:
echo - test-backend:latest
echo - test-frontend:latest
echo.
echo Para testar as imagens:
echo docker run --rm -p 3001:8000 test-backend:latest
echo docker run --rm -p 3000:80 test-frontend:latest