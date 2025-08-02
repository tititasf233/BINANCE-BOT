# Testes de Integração End-to-End - Sistema AURA

Este diretório contém testes de integração end-to-end para o Sistema AURA, cobrindo fluxos completos de trading, backtesting, performance e recuperação de falhas.

## Estrutura dos Testes

### 1. TradingFlow.integration.test.ts
Testa o fluxo completo de trading:
- Ciclo completo de compra-venda
- Cenários de stop loss e take profit
- Múltiplas estratégias simultâneas
- Tratamento de erros da API Binance
- Reconciliação de posições órfãs

### 2. Backtesting.integration.test.ts
Testa o sistema de backtesting:
- Execução completa de backtest com dados históricos
- Diferentes configurações de estratégia
- Cálculo preciso de métricas de performance
- Otimização para grandes datasets
- Backtests concorrentes
- Tratamento de erros

### 3. Performance.integration.test.ts
Testa performance e latência:
- Tempos de resposta da API
- Latência de processamento de dados de mercado
- Performance do banco de dados
- Uso de memória e recursos
- Testes de carga sustentada

### 4. FailureRecovery.integration.test.ts
Testa recuperação após falhas:
- Falhas de conexão com banco de dados
- Desconexões do Redis
- Falhas da API Binance
- Recuperação de posições órfãs
- Circuit breaker e retry logic

## Configuração do Ambiente

### Pré-requisitos
- PostgreSQL rodando (para banco de teste)
- Redis rodando (para cache de teste)
- Node.js e npm instalados

### Variáveis de Ambiente
Crie um arquivo `.env.test` no diretório backend com:

```bash
# Database Test Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aura_trading_test
DB_USER=postgres
DB_PASSWORD=password

# Redis Test Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=15

# JWT Configuration
JWT_SECRET=test-secret-key-for-integration-tests

# Binance Test Configuration (Mock Server)
BINANCE_API_KEY=test_api_key
BINANCE_SECRET_KEY=test_secret_key
BINANCE_USE_TESTNET=true
BINANCE_BASE_URL=http://localhost:3001

# Logging
LOG_LEVEL=error
```

### Preparação do Banco de Dados
```bash
# Criar banco de teste
createdb aura_trading_test

# Executar migrações
npm run migrate
```

## Executando os Testes

### Todos os Testes de Integração
```bash
npm run test:integration
```

### Testes Específicos
```bash
# Apenas testes de trading flow
npm run test:integration -- --testNamePattern="Trading Flow"

# Apenas testes de backtesting
npm run test:integration -- --testNamePattern="Backtesting"

# Apenas testes de performance
npm run test:integration -- --testNamePattern="Performance"

# Apenas testes de recuperação
npm run test:integration -- --testNamePattern="Failure Recovery"
```

### Com Coverage
```bash
npm run test:integration:coverage
```

### Watch Mode
```bash
npm run test:integration:watch
```

## Helpers e Utilitários

### TestDataFactory
Classe para criar dados de teste:
- `createTestUser()`: Cria usuário de teste
- `createTestApiKey()`: Cria chaves API de teste
- `createTestStrategy()`: Cria estratégia de teste
- `createTestTrade()`: Cria trade de teste
- `createCompleteTestScenario()`: Cria cenário completo

### BinanceMockServer
Servidor mock da API Binance:
- Simula endpoints da Binance
- Suporte a ordens, OCO, dados históricos
- Controle de falhas para testes
- Validação de assinatura mock

### IntegrationTestSetup
Configuração do ambiente de teste:
- Setup/teardown de banco e Redis
- Limpeza entre testes
- Pools de conexão de teste

## Métricas e Benchmarks

### Tempos de Resposta Esperados
- Autenticação: < 500ms
- Portfolio overview: < 1000ms
- Processamento de kline: < 500ms
- Execução de ordem: < 2000ms

### Throughput Esperado
- Processamento de dados: > 50 mensagens/segundo
- Requisições concorrentes: > 5 req/segundo
- Inserção de trades: > 100 trades/segundo

### Limites de Recursos
- Aumento de memória: < 50% durante operação
- Após GC: < 30% de aumento
- Tempo de backtest (90 dias): < 60 segundos

## Troubleshooting

### Problemas Comuns

#### Timeout nos Testes
- Aumentar `testTimeout` no jest.config
- Verificar se serviços externos estão rodando
- Verificar logs para gargalos

#### Falhas de Conexão
- Verificar se PostgreSQL está rodando
- Verificar se Redis está rodando
- Verificar configurações de rede

#### Falhas Intermitentes
- Executar testes sequencialmente (`maxWorkers: 1`)
- Aumentar timeouts para operações assíncronas
- Verificar limpeza entre testes

#### Mock Server Issues
- Verificar se porta 3001 está disponível
- Verificar logs do BinanceMockServer
- Reiniciar mock server entre testes

### Debugging

#### Logs Detalhados
```bash
LOG_LEVEL=debug npm run test:integration
```

#### Executar Teste Específico
```bash
npm run test:integration -- --testNamePattern="should execute a complete buy-sell cycle"
```

#### Modo Verbose
```bash
npm run test:integration -- --verbose
```

## Contribuindo

### Adicionando Novos Testes
1. Seguir padrão de nomenclatura: `*.integration.test.ts`
2. Usar helpers existentes quando possível
3. Limpar estado entre testes
4. Documentar cenários complexos
5. Incluir assertions de performance quando relevante

### Boas Práticas
- Testes devem ser independentes
- Usar dados de teste realistas
- Verificar tanto sucesso quanto falha
- Incluir timeouts apropriados
- Documentar comportamentos esperados

### Performance dos Testes
- Evitar sleeps desnecessários
- Usar polling eficiente para verificações
- Reutilizar conexões quando possível
- Limpar apenas dados necessários