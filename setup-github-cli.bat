@echo off
echo 🚀 Configuração do GitHub CLI
echo ============================
echo.

echo ✅ GitHub CLI instalado com sucesso!
echo Versão:
"C:\Program Files\GitHub CLI\gh.exe" --version
echo.

echo 📋 Próximos passos para monitorar GitHub Actions:
echo.
echo 1. AUTENTICAR com GitHub:
echo    "C:\Program Files\GitHub CLI\gh.exe" auth login --web
echo.
echo 2. Verificar autenticação:
echo    "C:\Program Files\GitHub CLI\gh.exe" auth status
echo.
echo 3. Listar workflows em execução:
echo    "C:\Program Files\GitHub CLI\gh.exe" run list --repo tititasf/BINANCE-BOT
echo.
echo 4. Ver detalhes de um workflow:
echo    "C:\Program Files\GitHub CLI\gh.exe" run view [RUN_ID] --repo tititasf/BINANCE-BOT
echo.
echo 5. Acompanhar logs em tempo real:
echo    "C:\Program Files\GitHub CLI\gh.exe" run watch [RUN_ID] --repo tititasf/BINANCE-BOT
echo.

echo 🔧 Comandos úteis após autenticação:
echo.
echo # Ver status do repositório
echo "C:\Program Files\GitHub CLI\gh.exe" repo view tititasf/BINANCE-BOT
echo.
echo # Listar todas as execuções
echo "C:\Program Files\GitHub CLI\gh.exe" run list --repo tititasf/BINANCE-BOT --limit 10
echo.
echo # Ver logs de uma execução específica
echo "C:\Program Files\GitHub CLI\gh.exe" run view --log --repo tititasf/BINANCE-BOT
echo.

echo ⚠️  IMPORTANTE:
echo Para usar estes comandos, você precisa:
echo 1. Executar a autenticação manualmente
echo 2. Ter acesso ao repositório tititasf/BINANCE-BOT
echo.

echo 🌐 Alternativamente, acesse diretamente:
echo https://github.com/tititasf/BINANCE-BOT/actions
echo.

pause