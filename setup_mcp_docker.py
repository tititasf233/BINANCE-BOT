#!/usr/bin/env python3
"""
Script de configuração e integração do MCP-DOCKER
Configura o MCP-DOCKER no projeto BINANCE-BOT
"""

import os
import sys
import subprocess
import json
import time
from pathlib import Path

class MCPDockerSetup:
    def __init__(self):
        self.project_root = Path.cwd()
        self.mcp_dir = self.project_root / "MCP-DOCKER-main"
        self.docker_compose_file = self.mcp_dir / "docker-compose.yml"
        
    def check_prerequisites(self):
        """Verifica se os pré-requisitos estão instalados"""
        print("🔍 Verificando pré-requisitos...")
        
        # Verifica se Docker está instalado
        try:
            result = subprocess.run(['docker', '--version'], 
                                  capture_output=True, text=True, check=True)
            print(f"✅ Docker encontrado: {result.stdout.strip()}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ Docker não encontrado. Instale o Docker primeiro.")
            return False
            
        # Verifica se Docker Compose está disponível
        try:
            result = subprocess.run(['docker-compose', '--version'], 
                                  capture_output=True, text=True, check=True)
            print(f"✅ Docker Compose encontrado: {result.stdout.strip()}")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ Docker Compose não encontrado. Instale o Docker Compose primeiro.")
            return False
            
        return True
    
    def build_mcp_image(self):
        """Constrói a imagem Docker do MCP"""
        print("🔨 Construindo imagem Docker do MCP...")
        
        try:
            subprocess.run(['docker-compose', '-f', str(self.docker_compose_file), 'build'], 
                         check=True, cwd=self.mcp_dir)
            print("✅ Imagem Docker construída com sucesso!")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Erro ao construir imagem: {e}")
            return False
    
    def start_mcp_service(self):
        """Inicia o serviço MCP"""
        print("🚀 Iniciando serviço MCP-DOCKER...")
        
        try:
            subprocess.run(['docker-compose', '-f', str(self.docker_compose_file), 'up', '-d'], 
                         check=True, cwd=self.mcp_dir)
            print("✅ Serviço MCP-DOCKER iniciado com sucesso!")
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ Erro ao iniciar serviço: {e}")
            return False
    
    def test_mcp_api(self):
        """Testa a API do MCP"""
        print("🧪 Testando API do MCP...")
        
        # Aguarda um pouco para o serviço inicializar
        time.sleep(3)
        
        try:
            # Testa o health check
            result = subprocess.run(['curl', '-s', 'http://localhost:5000/health'], 
                                  capture_output=True, text=True, check=True)
            health_data = json.loads(result.stdout)
            print(f"✅ Health check: {health_data}")
            
            # Testa listar containers
            result = subprocess.run(['curl', '-s', 'http://localhost:5000/containers'], 
                                  capture_output=True, text=True, check=True)
            containers_data = json.loads(result.stdout)
            print(f"✅ Containers encontrados: {len(containers_data)}")
            
            return True
        except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
            print(f"❌ Erro ao testar API: {e}")
            return False
    
    def create_integration_script(self):
        """Cria script de integração para o projeto principal"""
        print("📝 Criando script de integração...")
        
        integration_script = """
#!/usr/bin/env python3
\"\"\"
Script de integração com MCP-DOCKER
Permite gerenciar containers Docker através da API do MCP
\"\"\"

import requests
import json
import sys
from typing import Dict, List, Optional

class MCPDockerClient:
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        
    def health_check(self) -> Dict:
        \"\"\"Verifica o status do MCP\"\"\"
        try:
            response = requests.get(f"{self.base_url}/health")
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def list_containers(self, all_containers: bool = False) -> List[Dict]:
        \"\"\"Lista containers Docker\"\"\"
        try:
            endpoint = "/containers/all" if all_containers else "/containers"
            response = requests.get(f"{self.base_url}{endpoint}")
            return response.json()
        except Exception as e:
            return [{"error": str(e)}]
    
    def start_container(self, container_id: str) -> Dict:
        \"\"\"Inicia um container\"\"\"
        try:
            response = requests.post(f"{self.base_url}/containers/{container_id}/start")
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def stop_container(self, container_id: str) -> Dict:
        \"\"\"Para um container\"\"\"
        try:
            response = requests.post(f"{self.base_url}/containers/{container_id}/stop")
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def get_container_logs(self, container_id: str) -> Dict:
        \"\"\"Obtém logs de um container\"\"\"
        try:
            response = requests.get(f"{self.base_url}/containers/{container_id}/logs")
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def exec_command(self, container_id: str, command: str) -> Dict:
        \"\"\"Executa comando em um container\"\"\"
        try:
            data = {"command": command}
            response = requests.post(f"{self.base_url}/containers/{container_id}/exec", 
                                  json=data)
            return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    def remove_container(self, container_id: str, force: bool = False) -> Dict:
        \"\"\"Remove um container\"\"\"
        try:
            params = {"force": "true"} if force else {}
            response = requests.delete(f"{self.base_url}/containers/{container_id}/remove", 
                                    params=params)
            return response.json()
        except Exception as e:
            return {"error": str(e)}

def main():
    \"\"\"Função principal para demonstração\"\"\"
    client = MCPDockerClient()
    
    print("🐳 MCP-DOCKER Client")
    print("=" * 30)
    
    # Health check
    health = client.health_check()
    print(f"Status: {health}")
    
    # Lista containers
    containers = client.list_containers()
    print(f"\\nContainers em execução: {len(containers)}")
    for container in containers:
        print(f"  - {container.get('name', 'N/A')} ({container.get('id', 'N/A')}) - {container.get('status', 'N/A')}")

if __name__ == "__main__":
    main()
"""
        
        script_path = self.project_root / "mcp_docker_client.py"
        with open(script_path, 'w', encoding='utf-8') as f:
            f.write(integration_script)
        
        print(f"✅ Script de integração criado: {script_path}")
        return True
    
    def create_docker_integration(self):
        """Cria integração com o docker-compose principal"""
        print("🔗 Criando integração com docker-compose principal...")
        
        # Lê o docker-compose principal
        main_compose_file = self.project_root / "docker-compose.yml"
        if main_compose_file.exists():
            with open(main_compose_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Verifica se o MCP já está integrado
            if "mcp-bridge" not in content:
                # Adiciona o serviço MCP ao docker-compose principal
                mcp_service = """
  mcp-bridge:
    build: ./MCP-DOCKER-main
    container_name: mcp-bridge
    ports:
      - "5000:5000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
    environment:
      - FLASK_ENV=production
    networks:
      - default
"""
                
                # Insere o serviço MCP antes da seção networks
                if "networks:" in content:
                    content = content.replace("networks:", mcp_service + "\nnetworks:")
                else:
                    content += mcp_service
                
                # Salva o arquivo atualizado
                with open(main_compose_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                print("✅ MCP-DOCKER integrado ao docker-compose principal!")
            else:
                print("ℹ️ MCP-DOCKER já está integrado ao docker-compose principal")
        else:
            print("⚠️ docker-compose.yml principal não encontrado")
    
    def create_quick_start_guide(self):
        """Cria guia de início rápido"""
        print("📖 Criando guia de início rápido...")
        
        guide = """# 🐳 MCP-DOCKER - Guia de Início Rápido

## O que é o MCP-DOCKER?

O MCP-DOCKER é um micro-componente que fornece uma API REST para gerenciar containers Docker de forma remota e segura.

## 🚀 Como usar

### 1. Iniciar o MCP-DOCKER
```bash
# Opção 1: Usando docker-compose do MCP
cd MCP-DOCKER-main
docker-compose up -d

# Opção 2: Usando docker-compose principal (se integrado)
docker-compose up -d mcp-bridge
```

### 2. Testar a API
```bash
# Health check
curl http://localhost:5000/health

# Listar containers
curl http://localhost:5000/containers

# Listar todos os containers (incluindo parados)
curl http://localhost:5000/containers/all
```

### 3. Usar o cliente Python
```bash
python mcp_docker_client.py
```

## 📋 Endpoints da API

- `GET /health` - Status do serviço
- `GET /containers` - Containers em execução
- `GET /containers/all` - Todos os containers
- `POST /containers/<id>/start` - Iniciar container
- `POST /containers/<id>/stop` - Parar container
- `GET /containers/<id>/logs` - Logs do container
- `POST /containers/<id>/exec` - Executar comando
- `DELETE /containers/<id>/remove` - Remover container

## 🔧 Exemplos de uso

### Iniciar um container
```bash
curl -X POST http://localhost:5000/containers/container_id/start
```

### Parar um container
```bash
curl -X POST http://localhost:5000/containers/container_id/stop
```

### Executar comando em container
```bash
curl -X POST http://localhost:5000/containers/container_id/exec \\
  -H "Content-Type: application/json" \\
  -d '{"command": "ls -la"}'
```

### Obter logs
```bash
curl http://localhost:5000/containers/container_id/logs
```

## 🛠️ Troubleshooting

### Verificar se o serviço está rodando
```bash
docker ps | grep mcp-bridge
```

### Ver logs do MCP
```bash
docker logs mcp-bridge
```

### Reiniciar o serviço
```bash
docker-compose restart mcp-bridge
```

## 🔒 Segurança

- O MCP precisa acessar `/var/run/docker.sock` para funcionar
- A API roda na porta 5000 por padrão
- Configure firewall adequadamente para ambientes de produção
"""
        
        guide_path = self.project_root / "MCP_DOCKER_GUIDE.md"
        with open(guide_path, 'w', encoding='utf-8') as f:
            f.write(guide)
        
        print(f"✅ Guia criado: {guide_path}")
        return True
    
    def run_setup(self):
        """Executa o setup completo"""
        print("🚀 Iniciando configuração do MCP-DOCKER...")
        print("=" * 50)
        
        # Verifica pré-requisitos
        if not self.check_prerequisites():
            print("❌ Pré-requisitos não atendidos. Abortando setup.")
            return False
        
        # Constrói imagem
        if not self.build_mcp_image():
            print("❌ Falha ao construir imagem. Abortando setup.")
            return False
        
        # Inicia serviço
        if not self.start_mcp_service():
            print("❌ Falha ao iniciar serviço. Abortando setup.")
            return False
        
        # Testa API
        if not self.test_mcp_api():
            print("⚠️ API não respondeu corretamente, mas o serviço pode estar funcionando.")
        
        # Cria integrações
        self.create_integration_script()
        self.create_docker_integration()
        self.create_quick_start_guide()
        
        print("=" * 50)
        print("✅ Setup do MCP-DOCKER concluído com sucesso!")
        print("📖 Consulte o arquivo MCP_DOCKER_GUIDE.md para mais informações")
        print("🐳 O MCP está rodando em: http://localhost:5000")
        
        return True

def main():
    """Função principal"""
    setup = MCPDockerSetup()
    setup.run_setup()

if __name__ == "__main__":
    main() 