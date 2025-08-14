# GitHub Actions - MCP-Bridge

## Visão Geral

Este repositório utiliza GitHub Actions para automatizar testes e builds do projeto MCP-Bridge.

## Workflow

O workflow está configurado em `.github/workflows/main.yml` e executa:

### 1. Job de Testes (`test`)
- **Trigger**: Push para `main` ou Pull Requests
- **Ambiente**: Ubuntu Latest
- **Passos**:
  - Checkout do código
  - Setup do Python 3.9
  - Instalação das dependências (`requirements.txt`)
  - Execução dos testes (`test_api.py`)

### 2. Job de Build (`build`)
- **Dependência**: Executa apenas após o job `test` passar
- **Ambiente**: Ubuntu Latest
- **Passos**:
  - Checkout do código
  - Setup do Docker Buildx
  - Build da imagem Docker
  - Teste da imagem Docker

## Arquivos de Teste

### `test_api.py`
Testa:
- ✅ Importação do módulo `app`
- ✅ Existência do Flask app
- ✅ Validade do Dockerfile
- ✅ Existência do requirements.txt
- ✅ Presença do Flask nas dependências

## Configuração

### Secrets Necessários
Atualmente o workflow não requer secrets, pois:
- Não faz push para Docker Hub
- Foca apenas em testes e build local

### Para Adicionar Push para Docker Hub
Se quiser adicionar push para Docker Hub, adicione estes secrets:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

E modifique o workflow para incluir:
```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}
```

## Troubleshooting

### Erro: "Username and password required"
- **Causa**: Tentativa de login no Docker Hub sem credenciais
- **Solução**: Removido login do Docker Hub do workflow atual

### Erro: "Docker client não conectado"
- **Causa**: Docker não disponível no ambiente de CI
- **Solução**: Testes focam apenas na estrutura do código, não na execução real

## Logs

Os logs do workflow podem ser encontrados em:
1. GitHub → Repositório → Actions
2. Clique no workflow executado
3. Clique no job específico
4. Clique em "Run tests" ou "Build Docker image"

## Melhorias Futuras

1. **Testes de Integração**: Adicionar testes que executam a API real
2. **Cobertura de Código**: Adicionar relatórios de cobertura
3. **Linting**: Adicionar verificação de estilo de código
4. **Security Scanning**: Adicionar verificação de vulnerabilidades
5. **Deploy Automático**: Configurar deploy automático após merge 