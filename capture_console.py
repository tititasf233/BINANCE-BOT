#!/usr/bin/env python3
"""
Captura o console de processos Node.js já em execução
"""

import psutil
import time
import sys

def find_frontend_process():
    """Encontra o processo do frontend (Vite)"""
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] == 'node.exe':
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                if 'vite' in cmdline.lower() or 'frontend' in cmdline.lower():
                    return proc.info['pid']
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None

def find_backend_process():
    """Encontra o processo do backend"""
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] == 'node.exe':
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                if 'test-server' in cmdline or 'backend' in cmdline:
                    return proc.info['pid']
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return None

def monitor_process_output(pid, service_name):
    """Monitora a saída de um processo específico"""
    try:
        process = psutil.Process(pid)
        print(f"=" * 60)
        print(f"    CONSOLE {service_name.upper()} - PID: {pid}")
        print(f"=" * 60)
        print(f"Comando: {' '.join(process.cmdline())}")
        print(f"Status: {process.status()}")
        print(f"CPU: {process.cpu_percent()}%")
        print(f"Memória: {process.memory_info().rss / 1024 / 1024:.1f} MB")
        print("=" * 60)
        
        # Monitorar o processo
        while process.is_running():
            try:
                # Mostrar informações do processo periodicamente
                cpu = process.cpu_percent()
                memory = process.memory_info().rss / 1024 / 1024
                print(f"[{time.strftime('%H:%M:%S')}] {service_name} - CPU: {cpu:.1f}% | RAM: {memory:.1f}MB")
                time.sleep(5)
            except psutil.NoSuchProcess:
                print(f"{service_name} parou de executar")
                break
            except KeyboardInterrupt:
                print(f"\nParando monitoramento do {service_name}...")
                break
                
    except psutil.NoSuchProcess:
        print(f"Processo {pid} não encontrado")
    except Exception as e:
        print(f"Erro ao monitorar processo: {e}")

def main():
    print("Procurando processos Node.js...")
    
    # Listar todos os processos Node.js
    node_processes = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['name'] == 'node.exe':
                cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                node_processes.append((proc.info['pid'], cmdline))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if not node_processes:
        print("Nenhum processo Node.js encontrado!")
        return
    
    print(f"\nProcessos Node.js encontrados:")
    for i, (pid, cmdline) in enumerate(node_processes):
        service_type = "DESCONHECIDO"
        if 'vite' in cmdline.lower():
            service_type = "FRONTEND (Vite)"
        elif 'test-server' in cmdline or 'nodemon' in cmdline:
            service_type = "BACKEND"
        
        print(f"{i+1}. PID: {pid} - {service_type}")
        print(f"   Comando: {cmdline[:80]}...")
        print()
    
    try:
        choice = input("Escolha o processo para monitorar (número): ")
        index = int(choice) - 1
        
        if 0 <= index < len(node_processes):
            pid, cmdline = node_processes[index]
            service_name = "FRONTEND" if 'vite' in cmdline.lower() else "BACKEND"
            monitor_process_output(pid, service_name)
        else:
            print("Escolha inválida!")
            
    except (ValueError, KeyboardInterrupt):
        print("Saindo...")

if __name__ == "__main__":
    main()