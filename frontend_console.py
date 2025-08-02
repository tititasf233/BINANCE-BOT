#!/usr/bin/env python3
"""
Captura e exibe todo o console do frontend
"""

import subprocess
import sys
import os

def main():
    print("=" * 60)
    print("    CONSOLE DO FRONTEND - SISTEMA AURA")
    print("=" * 60)
    print("Iniciando frontend e exibindo todo o console...")
    print("Pressione Ctrl+C para parar")
    print("=" * 60)
    
    try:
        # Mudar para o diretório do frontend
        frontend_dir = os.path.join(os.getcwd(), 'frontend')
        
        if not os.path.exists(frontend_dir):
            print("ERRO: Diretório 'frontend' não encontrado!")
            return
        
        # Executar npm run dev no frontend
        process = subprocess.Popen(
            ['npm.cmd', 'run', 'dev'],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Ler e imprimir cada linha em tempo real
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                print(output.strip())
                sys.stdout.flush()
                
    except KeyboardInterrupt:
        print("\nParando frontend...")
        if 'process' in locals():
            process.terminate()
            process.wait()
    except Exception as e:
        print(f"Erro: {str(e)}")

if __name__ == "__main__":
    main()