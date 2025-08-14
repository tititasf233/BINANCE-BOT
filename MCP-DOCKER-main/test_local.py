#!/usr/bin/env python3
"""
Script de teste local para verificar se tudo está funcionando
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Executa um comando e retorna o resultado"""
    print(f"🧪 {description}...")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {description} - Sucesso")
            return True
        else:
            print(f"❌ {description} - Falhou")
            print(f"Erro: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ {description} - Erro: {e}")
        return False

def test_python_imports():
    """Testa se as importações Python funcionam"""
    print("🧪 Testando importações Python...")
    try:
        import app
        print("✅ app.py importado com sucesso")
        
        if hasattr(app, 'app'):
            print("✅ Flask app encontrado")
            return True
        else:
            print("❌ Flask app não encontrado")
            return False
    except Exception as e:
        print(f"❌ Erro ao importar app: {e}")
        return False

def test_docker_build():
    """Testa se o Docker build funciona"""
    return run_command(
        "docker build -t mcp-bridge:test .",
        "Docker build"
    )

def test_docker_run():
    """Testa se o Docker run funciona"""
    return run_command(
        "docker run --rm mcp-bridge:test python -c 'import app; print(\"✅ Docker test successful\")'",
        "Docker run test"
    )

def test_requirements():
    """Testa se requirements.txt está correto"""
    print("🧪 Testando requirements.txt...")
    if os.path.exists("requirements.txt"):
        with open("requirements.txt", "r") as f:
            content = f.read()
        
        required_packages = ["flask", "docker"]
        missing = []
        
        for package in required_packages:
            if package.lower() not in content.lower():
                missing.append(package)
        
        if not missing:
            print("✅ requirements.txt contém todas as dependências necessárias")
            return True
        else:
            print(f"❌ requirements.txt está faltando: {', '.join(missing)}")
            return False
    else:
        print("❌ requirements.txt não encontrado")
        return False

def cleanup():
    """Limpa imagens Docker de teste"""
    run_command("docker rmi mcp-bridge:test 2>/dev/null || true", "Limpeza Docker")

def main():
    """Executa todos os testes locais"""
    print("🧪 Teste Local - MCP-Bridge")
    print("=" * 50)
    
    tests = [
        test_python_imports,
        test_requirements,
        test_docker_build,
        test_docker_run
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print(f"\n📊 Resultado: {passed}/{total} testes passaram")
    
    if passed == total:
        print("🎉 Todos os testes passaram! Pronto para push.")
        cleanup()
        return 0
    else:
        print("❌ Alguns testes falharam. Corrija antes de fazer push.")
        cleanup()
        return 1

if __name__ == "__main__":
    sys.exit(main()) 