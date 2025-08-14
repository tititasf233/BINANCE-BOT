# MCP-Bridge 🐳

**MCP-Bridge** é um micro-componente de aplicação (MCP) que funciona como uma ponte de gerenciamento centralizada para containers Docker. Através de uma API REST simples e poderosa, permite que sistemas externos (como IDEs ou ferramentas de automação) gerenciem containers Docker de forma remota e segura.

## 🚀 Características

- **API REST completa** para gerenciamento de containers Docker
- **Containerizado** e pronto para deploy
- **CI/CD automatizado** com GitHub Actions
- **Seguro** - acesso controlado ao socket Docker
- **Leve** - baseado em Python Flask

## 📋 Endpoints da API

### Containers
- `GET /health` - Health check da aplicação
- `GET /containers` - Lista containers em execução
- `GET /containers/all` - Lista todos os containers (incluindo parados)
- `POST /containers/<id>/start` - Inicia um container
- `POST /containers/<id>/stop` - Para um container
- `GET /containers/<id>/logs` - Obtém logs do container (últimas 100 linhas)
- `DELETE /containers/<id>/remove` - Remove um container (use `?force=true` para forçar)
- `POST /containers/<id>/exec` - Executa comando no container

## 🛠️ Configuração e Execução

### Pré-requisitos
- Docker e Docker Compose instalados
- Git (para clonagem do repositório)

### Execução Local

1. **Clone o repositório:**
```bash
git clone <seu-repositorio>
cd mcp-bridge
```

2. **Execute com Docker Compose:**
```bash
docker-compose up -d
```

3. **Teste a API:**
```bash
# Health check
curl http://localhost:5000/health

# Listar containers
curl http://localhost:5000/containers
```

### Execução Manual (Desenvolvimento)

1. **Instale as dependências:**
```bash
pip install -r requirements.txt
```

2. **Execute a aplicação:**
```bash
python app.py
```

## 📖 Exemplos de Uso

### Listar containers em execução
```bash
curl -X GET http://localhost:5000/containers
```

### Iniciar um container
```bash
curl -X POST http://localhost:5000/containers/container_id/start
```

### Parar um container
```bash
curl -X POST http://localhost:5000/containers/container_id/stop
```

### Obter logs de um container
```bash
curl -X GET http://localhost:5000/containers/container_id/logs
```

### Executar comando em um container
```bash
curl -X POST http://localhost:5000/containers/container_id/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

### Remover um container
```bash
# Container parado
curl -X DELETE http://localhost:5000/containers/container_id/remove

# Forçar remoção (container em execução)
curl -X DELETE http://localhost:5000/containers/container_id/remove?force=true
```

## 🔧 CI/CD Automatizado (GitHub Actions)

O projeto inclui automação completa de CI/CD com GitHub Actions que:

1. **Testa** o código automaticamente
2. **Constrói** a imagem Docker localmente
3. **Valida** a estrutura do projeto

### Workflow Atual

O workflow atual (`/.github/workflows/main.yml`) executa:

- **Job de Testes**: Verifica importações, estrutura de arquivos e dependências
- **Job de Build**: Constrói e testa a imagem Docker localmente

### Testes Automatizados

O projeto inclui testes automatizados que verificam:
- ✅ Importação do módulo `app`
- ✅ Existência do Flask app
- ✅ Validade do Dockerfile
- ✅ Dependências no requirements.txt

### Teste Local

Antes de fazer push, execute o teste local:

```bash
python test_local.py
```

### Para Adicionar Deploy Automático

Se quiser adicionar deploy automático para Docker Hub:

1. Configure os secrets no GitHub:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

2. Modifique o workflow para incluir push para Docker Hub

Veja `GITHUB_ACTIONS.md` para detalhes completos.

## 🐳 Build Local da Imagem Docker

Para construir e usar a imagem localmente:

```bash
# Construir a imagem
docker build -t mcp-bridge:latest .

# Executar o container
docker run -d \
  --name mcp-bridge \
  -p 5000:5000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  mcp-bridge:latest
```

## ⚠️ Considerações de Segurança

- **Socket Docker**: O container precisa acessar `/var/run/docker.sock` para gerenciar outros containers
- **Rede**: Por padrão, a API roda na porta 5000. Configure firewall adequadamente
- **Autenticação**: Esta versão não inclui autenticação. Considere adicionar para ambientes de produção

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Se encontrar problemas ou tiver dúvidas:

1. Verifique os logs: `docker-compose logs mcp-bridge`
2. Teste o health check: `curl http://localhost:5000/health`
3. Abra uma issue no repositório

---

**MCP-Bridge** - Simplificando o gerenciamento de containers Docker! 🚀