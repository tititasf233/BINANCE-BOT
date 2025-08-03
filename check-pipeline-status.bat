@echo off
echo 🚀 BINANCE-BOT Pipeline Status Checker
echo ======================================
echo.

echo 📊 Último Commit:
git log --oneline -1
echo.

echo 📋 Status do Git:
git status --porcelain > temp_status.txt
if %errorlevel% equ 0 (
    for /f %%i in (temp_status.txt) do set HAS_CHANGES=1
    if not defined HAS_CHANGES (
        echo ✅ Repositório limpo - sem mudanças pendentes
    ) else (
        echo ⚠️  Há mudanças não commitadas
    )
) else (
    echo ❌ Erro ao verificar status do git
)
if exist temp_status.txt del temp_status.txt
echo.

echo 🐳 Verificação dos Dockerfiles:
if exist "Dockerfile.backend" (
    echo ✅ Dockerfile.backend existe
) else (
    echo ❌ Dockerfile.backend não encontrado
)

if exist "Dockerfile.frontend" (
    echo ✅ Dockerfile.frontend existe
) else (
    echo ❌ Dockerfile.frontend não encontrado
)
echo.

echo ⚙️  Workflows GitHub Actions:
if exist ".github\workflows\ci-cd.yml" (
    echo ✅ CI/CD workflow configurado
) else (
    echo ❌ CI/CD workflow não encontrado
)

if exist ".github\workflows\release.yml" (
    echo ✅ Release workflow configurado
) else (
    echo ❌ Release workflow não encontrado
)
echo.

echo 🔗 Links para Monitoramento:
echo GitHub Actions: https://github.com/tititasf/BINANCE-BOT/actions
echo Packages: https://github.com/tititasf/BINANCE-BOT/pkgs
echo.

echo 📋 Para acompanhar o progresso:
echo 1. Acesse: https://github.com/tititasf/BINANCE-BOT/actions
echo 2. Clique no workflow mais recente
echo 3. Monitore cada job em tempo real
echo.

echo 🧪 Teste de Conectividade (Opcional):
echo Para testar se as imagens estão prontas:
echo docker pull ghcr.io/tititasf/binance-bot/backend:latest
echo docker pull ghcr.io/tititasf/binance-bot/frontend:latest
echo.

echo ✅ Verificação local concluída!
echo Para status em tempo real, acesse o GitHub Actions no navegador.

pause