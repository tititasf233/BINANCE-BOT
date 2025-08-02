#!/usr/bin/env python3
"""
Leitor de console para processos Node.js em execução
"""

import subprocess
import psutil
import time
import sys
import os
import threading
from datetime import datetime

class ConsoleReader:
    def __init__(self):
        self.running = True
        
    def find_node_processes(self):
        """Encontra todos os processos Node.js"""
        processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
            try:
                if proc.info['name'] == 'node.exe':
                    cmdline = ' '.join(proc.info['cmdline']) if proc.info['cmdline'] else ''
                    create_time = datetime.fromtimestamp(proc.info['create_time']).strftime('%H:%M:%S')
                    
                    service_type = "DESCONHECIDO"
                    if 'vite' in cmdline.lower():
                        service_type = "FRONTEND (Vite)"
                    elif 'test-server' in cmdline or 'nodemon' in cmdline:
                        service_type = "BACKEND (Nodemon)"
                    elif 'ts-node' in cmdline:
                        service_type = "BACKEND (TS-Node)"
                    
                    processes.append({
                        'pid': proc.info['pid'],
                        'cmdline': cmdline,
                        'type': service_type,
                        'start_time': create_time
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        return processes
    
    def monitor_process_logs(self, pid, service_type):
        """Monitora logs do processo usando netstat e outras ferramentas"""
        try:
            process = psutil.Process(pid)
            print(f"=" * 80)
            print(f"    CONSOLE {service_type.upper()} - PID: {pid}")
            print(f"=" * 80)
            print(f"Comando: {' '.join(process.cmdline())}")
            print(f"Diretório: {process.cwd()}")
            print(f"Status: {process.status()}")
            print(f"Iniciado em: {datetime.fromtimestamp(process.create_time()).strftime('%H:%M:%S')}")
            print("=" * 80)
            
            # Se for frontend (Vite), mostrar informações da porta
            if 'vite' in service_type.lower():
                self.show_vite_info()
            elif 'backend' in service_type.lower():
                self.show_backend_info()
            
            print("\nMonitorando processo em tempo real...")
            print("Pressione Ctrl+C para parar")
            print("-" * 80)
            
            # Loop de monitoramento
            last_cpu = 0
            while self.running and process.is_running():
                try:
                    # Informações do processo
                    cpu = process.cpu_percent()
                    memory = process.memory_info().rss / 1024 / 1024
                    
                    # Mostrar apenas se houver mudança significativa
                    if abs(cpu - last_cpu) > 5 or cpu > 50:
                        timestamp = datetime.now().strftime('%H:%M:%S')
                        print(f"[{timestamp}] CPU: {cpu:.1f}% | RAM: {memory:.1f}MB")
                        last_cpu = cpu
                    
                    # Verificar conexões de rede (para web servers)
                    connections = process.connections()
                    active_connections = [c for c in connections if c.status == 'LISTEN']
                    
                    if active_connections:
                        for conn in active_connections:
                            if hasattr(conn, 'laddr') and conn.laddr:
                                port = conn.laddr.port
                                if port in [3000, 3001, 3002, 5173, 8000]:
                                    print(f"[{timestamp}] Servidor ativo na porta {port}")
                    
                    time.sleep(2)
                    
                except psutil.NoSuchProcess:
                    print(f"\n{service_type} parou de executar")
                    break
                except KeyboardInterrupt:
                    print(f"\nParando monitoramento...")
                    break
                    
        except Exception as e:
            print(f"Erro ao monitorar processo: {e}")
    
    def show_vite_info(self):
        """Mostra informações específicas do Vite"""
        print("\n📱 FRONTEND (Vite) - Informações:")
        try:
            # Verificar se o servidor está respondendo
            import requests
            response = requests.get('http://localhost:3000', timeout=2)
            print(f"✅ Servidor respondendo: {response.status_code}")
        except:
            print("⚠️  Servidor não está respondendo em localhost:3000")
        
        # Verificar porta 5173 (padrão do Vite)
        try:
            import requests
            response = requests.get('http://localhost:5173', timeout=2)
            print(f"✅ Vite dev server: {response.status_code}")
        except:
            print("ℹ️  Vite não está na porta padrão 5173")
    
    def show_backend_info(self):
        """Mostra informações específicas do Backend"""
        print("\n🔧 BACKEND - Informações:")
        try:
            import requests
            response = requests.get('http://localhost:3002/health', timeout=2)
            print(f"✅ Health check: {response.status_code}")
            if response.status_code == 200:
                print(f"📊 Resposta: {response.json()}")
        except:
            print("⚠️  Backend não está respondendo em localhost:3002")
    
    def run(self):
        """Executa o leitor de console"""
        print("🔍 Procurando processos Node.js...")
        
        processes = self.find_node_processes()
        
        if not processes:
            print("❌ Nenhum processo Node.js encontrado!")
            print("💡 Certifique-se de que o sistema AURA está rodando com 'npm run dev'")
            return
        
        print(f"\n📋 Processos Node.js encontrados ({len(processes)}):")
        print("-" * 80)
        
        for i, proc in enumerate(processes):
            print(f"{i+1}. PID: {proc['pid']} | {proc['type']} | Iniciado: {proc['start_time']}")
            print(f"   📝 {proc['cmdline'][:70]}...")
            print()
        
        try:
            choice = input("🎯 Escolha o processo para monitorar (número): ")
            index = int(choice) - 1
            
            if 0 <= index < len(processes):
                selected = processes[index]
                self.monitor_process_logs(selected['pid'], selected['type'])
            else:
                print("❌ Escolha inválida!")
                
        except (ValueError, KeyboardInterrupt):
            print("\n👋 Saindo...")
            self.running = False

if __name__ == "__main__":
    try:
        reader = ConsoleReader()
        reader.run()
    except KeyboardInterrupt:
        print("\n👋 Programa interrompido pelo usuário")