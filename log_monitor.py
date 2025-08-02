#!/usr/bin/env python3
"""
Monitor de Logs do Sistema AURA
Monitora logs do console do backend e frontend em tempo real
"""

import subprocess
import threading
import time
import sys
import os
from datetime import datetime
import signal
import queue
import re

class LogMonitor:
    def __init__(self):
        self.processes = {}
        self.log_queue = queue.Queue()
        self.running = True
        
        # Cores para diferentes tipos de log
        self.colors = {
            'backend': '\033[94m',    # Azul
            'frontend': '\033[92m',   # Verde
            'error': '\033[91m',      # Vermelho
            'warning': '\033[93m',    # Amarelo
            'info': '\033[96m',       # Ciano
            'reset': '\033[0m'        # Reset
        }
        
    def print_colored(self, text, color_key='reset'):
        """Imprime texto colorido no console"""
        color = self.colors.get(color_key, self.colors['reset'])
        print(f"{color}{text}{self.colors['reset']}")
        
    def get_log_level(self, line):
        """Identifica o nível do log baseado no conteúdo"""
        line_lower = line.lower()
        if any(word in line_lower for word in ['error', 'erro', 'exception', 'failed', 'falhou']):
            return 'error'
        elif any(word in line_lower for word in ['warning', 'warn', 'aviso']):
            return 'warning'
        elif any(word in line_lower for word in ['info', 'log', 'started', 'iniciado']):
            return 'info'
        return 'reset'
        
    def format_timestamp(self):
        """Retorna timestamp formatado"""
        return datetime.now().strftime("%H:%M:%S")
        
    def monitor_process(self, process, service_name):
        """Monitora um processo específico"""
        try:
            while self.running and process.poll() is None:
                line = process.stdout.readline()
                if line:
                    line = line.decode('utf-8', errors='ignore').strip()
                    if line:
                        timestamp = self.format_timestamp()
                        log_level = self.get_log_level(line)
                        
                        # Formatar a linha de log
                        formatted_line = f"[{timestamp}] [{service_name.upper()}] {line}"
                        
                        # Adicionar à fila de logs
                        self.log_queue.put((formatted_line, service_name, log_level))
                        
        except Exception as e:
            error_msg = f"Erro ao monitorar {service_name}: {str(e)}"
            self.log_queue.put((error_msg, service_name, 'error'))
            
    def start_backend_monitor(self):
        """Inicia monitoramento do backend"""
        try:
            # Comando para iniciar o backend em modo dev
            cmd = ['npm.cmd', 'run', 'dev']
            cwd = os.path.join(os.getcwd(), 'backend')
            
            process = subprocess.Popen(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=False,
                bufsize=1
            )
            
            self.processes['backend'] = process
            
            # Thread para monitorar o processo
            thread = threading.Thread(
                target=self.monitor_process,
                args=(process, 'backend'),
                daemon=True
            )
            thread.start()
            
            return True
            
        except Exception as e:
            self.print_colored(f"Erro ao iniciar backend: {str(e)}", 'error')
            return False
            
    def start_frontend_monitor(self):
        """Inicia monitoramento do frontend"""
        try:
            # Comando para iniciar o frontend em modo dev
            cmd = ['npm.cmd', 'run', 'dev']
            cwd = os.path.join(os.getcwd(), 'frontend')
            
            process = subprocess.Popen(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=False,
                bufsize=1
            )
            
            self.processes['frontend'] = process
            
            # Thread para monitorar o processo
            thread = threading.Thread(
                target=self.monitor_process,
                args=(process, 'frontend'),
                daemon=True
            )
            thread.start()
            
            return True
            
        except Exception as e:
            self.print_colored(f"Erro ao iniciar frontend: {str(e)}", 'error')
            return False
            
    def display_logs(self):
        """Exibe os logs em tempo real"""
        while self.running:
            try:
                # Timeout para permitir verificação do self.running
                log_entry = self.log_queue.get(timeout=1)
                formatted_line, service_name, log_level = log_entry
                
                # Escolher cor baseada no serviço e nível do log
                if log_level == 'error':
                    color = 'error'
                elif log_level == 'warning':
                    color = 'warning'
                elif log_level == 'info':
                    color = 'info'
                else:
                    color = service_name
                    
                self.print_colored(formatted_line, color)
                
            except queue.Empty:
                continue
            except Exception as e:
                self.print_colored(f"Erro ao exibir log: {str(e)}", 'error')
                
    def stop_all_processes(self):
        """Para todos os processos monitorados"""
        self.running = False
        
        for service_name, process in self.processes.items():
            try:
                if process.poll() is None:  # Processo ainda está rodando
                    self.print_colored(f"Parando {service_name}...", 'warning')
                    process.terminate()
                    
                    # Aguardar um pouco para o processo terminar graciosamente
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        # Se não terminar graciosamente, forçar
                        process.kill()
                        process.wait()
                        
            except Exception as e:
                self.print_colored(f"Erro ao parar {service_name}: {str(e)}", 'error')
                
    def signal_handler(self, signum, frame):
        """Handler para sinais do sistema (Ctrl+C)"""
        self.print_colored("\nRecebido sinal de interrupção. Parando processos...", 'warning')
        self.stop_all_processes()
        sys.exit(0)
        
    def run(self):
        """Executa o monitor de logs"""
        # Configurar handler para Ctrl+C
        signal.signal(signal.SIGINT, self.signal_handler)
        
        self.print_colored("=" * 60, 'info')
        self.print_colored("    MONITOR DE LOGS - SISTEMA AURA", 'info')
        self.print_colored("=" * 60, 'info')
        self.print_colored("Iniciando monitoramento dos serviços...", 'info')
        self.print_colored("Pressione Ctrl+C para parar", 'warning')
        self.print_colored("=" * 60, 'info')
        
        # Verificar se os diretórios existem
        if not os.path.exists('backend'):
            self.print_colored("Diretório 'backend' não encontrado!", 'error')
            return
            
        if not os.path.exists('frontend'):
            self.print_colored("Diretório 'frontend' não encontrado!", 'error')
            return
            
        # Iniciar monitoramento do backend
        if self.start_backend_monitor():
            self.print_colored("✓ Backend monitor iniciado", 'backend')
        else:
            self.print_colored("✗ Falha ao iniciar backend monitor", 'error')
            
        # Aguardar um pouco antes de iniciar o frontend
        time.sleep(2)
        
        # Iniciar monitoramento do frontend
        if self.start_frontend_monitor():
            self.print_colored("✓ Frontend monitor iniciado", 'frontend')
        else:
            self.print_colored("✗ Falha ao iniciar frontend monitor", 'error')
            
        self.print_colored("-" * 60, 'info')
        self.print_colored("Logs em tempo real:", 'info')
        self.print_colored("-" * 60, 'info')
        
        # Iniciar thread para exibir logs
        display_thread = threading.Thread(target=self.display_logs, daemon=True)
        display_thread.start()
        
        try:
            # Manter o programa rodando
            while self.running:
                time.sleep(1)
                
                # Verificar se os processos ainda estão rodando
                for service_name, process in list(self.processes.items()):
                    if process.poll() is not None:
                        self.print_colored(f"Processo {service_name} terminou", 'warning')
                        
        except KeyboardInterrupt:
            self.signal_handler(signal.SIGINT, None)

if __name__ == "__main__":
    monitor = LogMonitor()
    monitor.run()