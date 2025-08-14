#!/usr/bin/env python3
"""
Script de teste para a API MCP-Bridge
"""

import sys
import os

def test_imports():
    """Testa se todas as importações funcionam"""
    print("🧪 Testando importações...")
    
    try:
        import app
        print("✅ app.py importado com sucesso")
        
        # Testa se as funções principais existem
        if hasattr(app, 'app'):
            print("✅ Flask app encontrado")
        else:
            print("❌ Flask app não encontrado")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Erro ao importar app: {e}")
        return False

def test_dockerfile():
    """Testa se o Dockerfile existe e é válido"""
    print("🧪 Testando Dockerfile...")
    
    if os.path.exists("Dockerfile"):
        print("✅ Dockerfile encontrado")
        
        with open("Dockerfile", "r") as f:
            content = f.read()
            
        if "FROM" in content:
            print("✅ Dockerfile parece válido")
            return True
        else:
            print("❌ Dockerfile parece inválido")
            return False
    else:
        print("❌ Dockerfile não encontrado")
        return False

def test_requirements():
    """Testa se requirements.txt existe"""
    print("🧪 Testando requirements.txt...")
    
    if os.path.exists("requirements.txt"):
        print("✅ requirements.txt encontrado")
        
        with open("requirements.txt", "r") as f:
            content = f.read()
            
        if "flask" in content.lower():
            print("✅ Flask encontrado em requirements.txt")
            return True
        else:
            print("❌ Flask não encontrado em requirements.txt")
            return False
    else:
        print("❌ requirements.txt não encontrado")
        return False

def main():
    """Executa todos os testes"""
    print("🧪 Testando MCP-Bridge")
    print("=" * 50)
    
    tests = [
        test_imports,
        test_dockerfile,
        test_requirements
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print(f"✅ Testes passaram: {passed}/{total}")
    
    if passed == total:
        print("🎉 Todos os testes passaram!")
        return 0
    else:
        print("❌ Alguns testes falharam!")
        return 1

if __name__ == "__main__":
    sys.exit(main())