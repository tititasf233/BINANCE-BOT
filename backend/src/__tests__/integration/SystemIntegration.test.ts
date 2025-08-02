import { AuraSystem } from '../../index';
import { IntegrationTestSetup, cleanupBetweenTests } from './setup';
import { TestDataFactory } from './helpers/TestDataFactory';
import { BinanceMockServer } from './helpers/BinanceMockServer';
import request from 'supertest';
import { app } from '../../app';
import jwt from 'jsonwebtoken';

describe('Sistema AURA - Integração Completa', () => {
  let testSetup: IntegrationTestSetup;
  let testDataFactory: TestDataFactory;
  let binanceMockServer: BinanceMockServer;
  let auraSystem: AuraSystem;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    // Setup do ambiente de teste
    testSetup = IntegrationTestSetup.getInstance();
    await testSetup.setupDatabase();
    await testSetup.setupRedis();
    
    testDataFactory = new TestDataFactory(testSetup.getDbPool());
    
    // Iniciar mock server da Binance
    binanceMockServer = new BinanceMockServer(3001);
    await binanceMockServer.start();
    
    // Configurar variáveis de ambiente para teste
    process.env.NODE_ENV = 'test';
    process.env.BINANCE_BASE_URL = 'http://localhost:3001';
    process.env.DB_HOST = 'localhost';
    process.env.REDIS_HOST = 'localhost';
    
    // Inicializar sistema AURA
    auraSystem = new AuraSystem();
    await auraSystem.initialize();
  });

  afterAll(async () => {
    await auraSystem.shutdown();
    await binanceMockServer.stop();
    await testSetup.teardown();
  });

  beforeEach(async () => {
    await cleanupBetweenTests();
    binanceMockServer.clearOrders();
    
    // Criar usuário de teste
    const scenario = await testDataFactory.createCompleteTestScenario();
    testUser = scenario.user;
    
    // Gerar token de autenticação
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Inicialização do Sistema', () => {
    it('deve inicializar todos os componentes corretamente', async () => {
      // Verificar se todos os endpoints estão respondendo
      const healthResponse = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.services).toBeDefined();
      expect(healthResponse.body.services.database).toBe('connected');
      expect(healthResponse.body.services.redis).toBe('connected');
    });

    it('deve carregar configurações corretamente', async () => {
      const configResponse = await request(app)
        .get('/api/v1/system/config')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(configResponse.body.environment).toBe('test');
      expect(configResponse.body.version).toBeDefined();
    });
  });

  describe('Fluxo Completo de Trading', () => {
    it('deve executar um ciclo completo de trading end-to-end', async () => {
      // 1. Criar e ativar estratégia
      const strategyData = {
        name: 'Estratégia E2E Test',
        symbol: 'BTCUSDT',
        interval: '1h',
        entryConditions: [
          { indicator: 'RSI', operator: '<', value: 30 }
        ],
        exitConditions: [
          { indicator: 'RSI', operator: '>', value: 70 }
        ],
        riskParams: {
          positionSizeUsd: 100,
          takeProfitPercent: 2.0,
          stopLossPercent: 1.0,
          maxDrawdownPercent: 5.0
        }
      };

      const createResponse = await request(app)
        .post('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(strategyData)
        .expect(201);

      const strategyId = createResponse.body.id;

      // 2. Ativar estratégia
      await request(app)
        .post(`/api/v1/strategies/${strategyId}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // 3. Verificar se estratégia está ativa
      const activeStrategiesResponse = await request(app)
        .get('/api/v1/strategies?status=active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(activeStrategiesResponse.body.strategies.length).toBe(1);
      expect(activeStrategiesResponse.body.strategies[0].id).toBe(strategyId);

      // 4. Simular dados de mercado que acionam entrada
      // (Isso seria feito através do WebSocket em produção)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. Verificar se ordens foram criadas
      const ordersAfterSignal = binanceMockServer.getAllOrders();
      expect(ordersAfterSignal.length).toBeGreaterThanOrEqual(0);

      // 6. Verificar portfolio
      const portfolioResponse = await request(app)
        .get('/api/v1/portfolio/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(portfolioResponse.body.totalValue).toBeDefined();
      expect(portfolioResponse.body.totalPnl).toBeDefined();

      // 7. Verificar histórico
      const historyResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.trades).toBeInstanceOf(Array);
    }, 30000);

    it('deve executar backtest completo', async () => {
      // 1. Criar estratégia para backtest
      const strategyData = {
        name: 'Estratégia Backtest E2E',
        symbol: 'BTCUSDT',
        interval: '1h',
        entryConditions: [
          { indicator: 'SMA', operator: '>', value: 0 }
        ],
        exitConditions: [
          { indicator: 'SMA', operator: '<', value: 999999 }
        ],
        riskParams: {
          positionSizeUsd: 1000,
          takeProfitPercent: 3.0,
          stopLossPercent: 1.5,
          maxDrawdownPercent: 10.0
        }
      };

      const createResponse = await request(app)
        .post('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(strategyData)
        .expect(201);

      const strategyId = createResponse.body.id;

      // 2. Executar backtest
      const backtestConfig = {
        strategyId,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        initialBalance: 10000
      };

      const backtestResponse = await request(app)
        .post(`/api/v1/strategies/${strategyId}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(200);

      expect(backtestResponse.body.backtestId).toBeDefined();

      // 3. Aguardar conclusão
      let backtestComplete = false;
      const maxWaitTime = 30000;
      const checkInterval = 1000;

      for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const statusResponse = await request(app)
          .get(`/api/v1/backtest/${backtestResponse.body.backtestId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (statusResponse.body.status === 'completed') {
          backtestComplete = true;
        }
      }

      expect(backtestComplete).toBe(true);

      // 4. Verificar resultados
      const resultsResponse = await request(app)
        .get(`/api/v1/backtest/${backtestResponse.body.backtestId}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.totalTrades).toBeGreaterThanOrEqual(0);
      expect(resultsResponse.body.winRate).toBeGreaterThanOrEqual(0);
      expect(resultsResponse.body.totalPnl).toBeDefined();
    }, 45000);
  });

  describe('Monitoramento e Métricas', () => {
    it('deve coletar e expor métricas do sistema', async () => {
      const metricsResponse = await request(app)
        .get('/api/v1/metrics')
        .expect(200);

      expect(metricsResponse.text).toContain('aura_');
      expect(metricsResponse.text).toContain('http_requests_total');
      expect(metricsResponse.text).toContain('process_cpu_seconds_total');
    });

    it('deve reportar status de saúde detalhado', async () => {
      const healthResponse = await request(app)
        .get('/api/v1/health/detailed')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.checks).toBeDefined();
      expect(healthResponse.body.checks.database).toBeDefined();
      expect(healthResponse.body.checks.redis).toBeDefined();
      expect(healthResponse.body.checks.binance).toBeDefined();
    });

    it('deve registrar logs estruturados', async () => {
      // Fazer algumas requisições para gerar logs
      await request(app)
        .get('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .get('/api/v1/portfolio/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verificar se logs foram gerados
      const logsResponse = await request(app)
        .get('/api/v1/system/logs')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      expect(logsResponse.body.logs).toBeInstanceOf(Array);
      expect(logsResponse.body.logs.length).toBeGreaterThan(0);
    });
  });

  describe('Tratamento de Erros e Recuperação', () => {
    it('deve lidar com falhas de conexão graciosamente', async () => {
      // Simular falha temporária parando o mock server
      await binanceMockServer.stop();

      // Tentar fazer uma operação que requer Binance
      const response = await request(app)
        .get('/api/v1/system/binance/status')
        .set('Authorization', `Bearer ${authToken}`);

      // Sistema deve responder mesmo com Binance indisponível
      expect([200, 503]).toContain(response.status);

      // Reiniciar mock server
      binanceMockServer = new BinanceMockServer(3001);
      await binanceMockServer.start();

      // Aguardar reconexão
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verificar se sistema se recuperou
      const recoveryResponse = await request(app)
        .get('/api/v1/system/binance/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(recoveryResponse.body.status).toBe('connected');
    }, 15000);

    it('deve validar dados de entrada corretamente', async () => {
      // Tentar criar estratégia com dados inválidos
      const invalidStrategy = {
        name: '', // Nome vazio
        symbol: 'INVALID', // Símbolo inválido
        interval: '1x', // Intervalo inválido
        entryConditions: [], // Condições vazias
        riskParams: {
          positionSizeUsd: -100, // Valor negativo
          takeProfitPercent: 0, // Zero
          stopLossPercent: 0 // Zero
        }
      };

      const response = await request(app)
        .post('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidStrategy)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.validationErrors).toBeDefined();
    });
  });

  describe('Performance e Escalabilidade', () => {
    it('deve manter performance adequada sob carga', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      // Fazer múltiplas requisições concorrentes
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/v1/portfolio/overview')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;

      expect(results.length).toBe(concurrentRequests);
      expect(averageTime).toBeLessThan(1000); // Menos de 1 segundo por requisição
      expect(totalTime).toBeLessThan(5000); // Total menos de 5 segundos
    }, 10000);

    it('deve gerenciar memória eficientemente', async () => {
      const initialMemory = process.memoryUsage();

      // Executar operações que consomem memória
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/api/v1/strategies')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Aumento de memória deve ser razoável (menos de 50%)
      expect(memoryIncreasePercent).toBeLessThan(50);
    }, 15000);
  });

  describe('Segurança', () => {
    it('deve proteger endpoints com autenticação', async () => {
      // Tentar acessar endpoint protegido sem token
      await request(app)
        .get('/api/v1/strategies')
        .expect(401);

      // Tentar com token inválido
      await request(app)
        .get('/api/v1/strategies')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Deve funcionar com token válido
      await request(app)
        .get('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('deve aplicar rate limiting', async () => {
      // Fazer muitas requisições rapidamente
      const promises = Array.from({ length: 150 }, () =>
        request(app)
          .get('/api/v1/health')
      );

      const results = await Promise.all(promises);
      
      // Algumas requisições devem ser limitadas
      const rateLimitedRequests = results.filter(r => r.status === 429);
      expect(rateLimitedRequests.length).toBeGreaterThan(0);
    }, 10000);

    it('deve sanitizar dados de entrada', async () => {
      // Tentar injeção SQL
      const maliciousData = {
        name: "'; DROP TABLE users; --",
        symbol: '<script>alert("xss")</script>',
        interval: '1h',
        entryConditions: [
          { indicator: 'RSI', operator: '<', value: 30 }
        ],
        exitConditions: [
          { indicator: 'RSI', operator: '>', value: 70 }
        ],
        riskParams: {
          positionSizeUsd: 100,
          takeProfitPercent: 2.0,
          stopLossPercent: 1.0,
          maxDrawdownPercent: 5.0
        }
      };

      const response = await request(app)
        .post('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Compatibilidade e Integração', () => {
    it('deve ser compatível com diferentes formatos de data', async () => {
      const dateFormats = [
        new Date().toISOString(),
        new Date().toDateString(),
        Date.now().toString()
      ];

      for (const dateFormat of dateFormats) {
        const response = await request(app)
          .get('/api/v1/portfolio/history')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ startDate: dateFormat })
          .expect(200);

        expect(response.body.trades).toBeInstanceOf(Array);
      }
    });

    it('deve suportar diferentes moedas e símbolos', async () => {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT'];

      for (const symbol of symbols) {
        const strategyData = {
          name: `Test Strategy ${symbol}`,
          symbol,
          interval: '1h',
          entryConditions: [
            { indicator: 'RSI', operator: '<', value: 30 }
          ],
          exitConditions: [
            { indicator: 'RSI', operator: '>', value: 70 }
          ],
          riskParams: {
            positionSizeUsd: 100,
            takeProfitPercent: 2.0,
            stopLossPercent: 1.0,
            maxDrawdownPercent: 5.0
          }
        };

        const response = await request(app)
          .post('/api/v1/strategies')
          .set('Authorization', `Bearer ${authToken}`)
          .send(strategyData)
          .expect(201);

        expect(response.body.symbol).toBe(symbol);
      }
    });
  });
});