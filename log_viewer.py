#!/usr/bin/env python3
"""
Visualizador de Logs do Sistema AURA
Monitora apenas os logs de processos já em execução
"""

import requests
import time
import sys
from datetime import datetime
import threading
import queue

class LogViewer:
    def __init__(self):
        self.running = True
        self.log_queue = queue.Queue()
        
        # URLs dos serviços
        self.backend_url = "http://localhost:8000"
        self.frontend_url = "http://localhost:3000"
        
        # Cores para output
        self.colors = {
            'backend': '\033[94m',    # Azul
            'frontend': '\033[92m',   # Verde
            'error': '\033[91m',      # Vermelho
            'warning': '\033[93m',    # Amarelo
            'info': '\033[96m',       # Ciano
            'success': '\033[92m',    # Verde
            'reset': '\033[0m'        # Reset
        }
        
    def print_colored(self, text, color_key='reset'):
        """Imprime texto colorido no console"""
        color = self.colors.get(color_key, self.colors['reset'])
        print(f"{color}{text}{self.colors['reset']}")
        
    def format_timestamp(self):
        """Retorna timestamp formatado"""
        return datetime.now().strftime("%H:%M:%S.%f")[:-3]
        
    def check_service_status(self, url, service_name):
        """Verifica o status de um serviço"""
        try:
            if service_name == 'backend':
                # Tentar endpoint de health check
                health_url = f"{url}/api/v1/health"
                response = requests.get(health_url, timeout=2)
                if response.status_code == 200:
                    return True, "Online"
                else:
                    return False, f"HTTP {response.status_code}"
            else:
                # Para o frontend, apenas verificar se responde
                response = requests.get(url, timeout=2)
                if response.status_code == 200:
                    return True, "Online"
                else:
                    return False, f"HTTP {response.status_code}"
                    
        except requests.exceptions.ConnectionError:
            return False, "Conexão recusada"
        except requests.exceptions.Timeout:
            return False, "Timeout"
        except Exception as e:
            return False, str(e)
            
    def monitor_services(self):
        """Monitora o status dos serviços continuamente"""
        last_backend_status = None
        last_frontend_status = None
        
        while self.running:
            try:
                timestamp = self.format_timestamp()
                
                # Verificar backend
                backend_online, backend_msg = self.check_service_status(self.backend_url, 'backend')
                if backend_online != last_backend_status:
                    status_text = "ONLINE" if backend_online else "OFFLINE"
                    color = 'success' if backend_online else 'error'
                    log_msg = f"[{timestamp}] [BACKEND] Status: {status_text} - {backend_msg}"
                    self.log_queue.put((log_msg, color))
                    last_backend_status = backend_online
                    
                # Verificar frontend
                frontend_online, frontend_msg = self.check_service_status(self.frontend_url, 'frontend')
                if frontend_online != last_frontend_status:
                    status_text = "ONLINE" if frontend_online else "OFFLINE"
                    color = 'success' if frontend_online else 'error'
                    log_msg = f"[{timestamp}] [FRONTEND] Status: {status_text} - {frontend_msg}"
                    self.log_queue.put((log_msg, color))
                    last_frontend_status = frontend_online
                    
                # Log de atividade a cada 30 segundos se ambos estiverem online
                if backend_online and frontend_online:
                    activity_msg = f"[{timestamp}] [SYSTEM] Serviços ativos - Backend: {self.backend_url} | Frontend: {self.frontend_url}"
                    self.log_queue.put((activity_msg, 'info'))
                    
                time.sleep(5)  # Verificar a cada 5 segundos
                
            except Exception as e:
                error_msg = f"[{self.format_timestamp()}] [ERROR] Erro no monitoramento: {str(e)}"
                self.log_queue.put((error_msg, 'error'))
                time.sleep(5)
                
    def display_logs(self):
        """Exibe os logs em tempo real"""
        while self.running:
            try:
                log_entry = self.log_queue.get(timeout=1)
                log_msg, color = log_entry
                self.print_colored(log_msg, color)
                
            except queue.Empty:
                continue
            except Exception as e:
                self.print_colored(f"Erro ao exibir log: {str(e)}", 'error')
                
    def show_service_info(self):
        """Mostra informações dos serviços"""
        self.print_colored("=" * 70, 'info')
        self.print_colored("    VISUALIZADOR DE LOGS - SISTEMA AURA", 'info')
        self.print_colored("=" * 70, 'info')
        self.print_colored(f"Backend URL: {self.backend_url}", 'backend')
        self.print_colored(f"Frontend URL: {self.frontend_url}", 'frontend')
        self.print_colored("=" * 70, 'info')
        self.print_colored("Verificando status inicial dos serviços...", 'info')
        
        # Verificação inicial
        backend_online, backend_msg = self.check_service_status(self.backend_url, 'backend')
        frontend_online, frontend_msg = self.check_service_status(self.frontend_url, 'frontend')
        
        backend_status = "✓ ONLINE" if backend_online else "✗ OFFLINE"
        frontend_status = "✓ ONLINE" if frontend_online else "✗ OFFLINE"
        
        backend_color = 'success' if backend_online else 'error'
        frontend_color = 'success' if frontend_online else 'error'
        
        self.print_colored(f"Backend:  {backend_status} - {backend_msg}", backend_color)
        self.print_colored(f"Frontend: {frontend_status} - {frontend_msg}", frontend_color)
        
        if not backend_online and not frontend_online:
            self.print_colored("\n⚠️  Nenhum serviço está rodando!", 'warning')
            self.print_colored("Execute 'npm run dev' ou 'python log_monitor.py' para iniciar os serviços", 'warning')
        elif not backend_online:
            self.print_colored("\n⚠️  Backend não está rodando!", 'warning')
            self.print_colored("Execute 'cd backend && npm run dev' para iniciar o backend", 'warning')
        elif not frontend_online:
            self.print_colored("\n⚠️  Frontend não está rodando!", 'warning')
            self.print_colored("Execute 'cd frontend && npm run dev' para iniciar o frontend", 'warning')
        else:
            self.print_colored("\n✅ Todos os serviços estão online!", 'success')
            
        self.print_colored("-" * 70, 'info')
        self.print_colored("Monitoramento em tempo real (Ctrl+C para sair):", 'info')
        self.print_colored("-" * 70, 'info')
        
    def run(self):
        """Executa o visualizador de logs"""
        try:
            self.show_service_info()
            
            # Iniciar thread de monitoramento
            monitor_thread = threading.Thread(target=self.monitor_services, daemon=True)
            monitor_thread.start()
            
            # Iniciar thread de exibição
            display_thread = threading.Thread(target=self.display_logs, daemon=True)
            display_thread.start()
            
            # Manter o programa rodando
            while self.running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            self.print_colored("\nParando monitoramento...", 'warning')
            self.running = False
            sys.exit(0)

if __name__ == "__main__":
    viewer = LogViewer()
    viewer.run()