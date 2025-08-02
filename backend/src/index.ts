import 'dotenv/config';
import App from './app';
import { ConfigLoader } from './config/ConfigLoader';
import db from './database/connection';
import { RedisService } from './services/RedisService';
import { MessageBrokerService } from './services/MessageBrokerService';
import { DataIngestorService } from './services/DataIngestorService';
import { StrategyEngineService } from './services/StrategyEngineService';
import { ExecutionEngineService } from './services/ExecutionEngineService';
import { SystemMonitor } from './monitoring/SystemMonitor';
import { logger } from './utils/logger';

class AuraSystem {
  private config: ConfigLoader;
  private dbConnection!: typeof db;
  private redisService!: RedisService;
  private messageBroker!: MessageBrokerService;
  private dataIngestor!: DataIngestorService;
  private strategyEngine!: StrategyEngineService;
  private executionEngine!: ExecutionEngineService;
  private systemMonitor!: SystemMonitor;
  private server: any;

  constructor() {
    this.config = ConfigLoader.getInstance();
  }

  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Iniciando Sistema AURA...');

      // 1. Carregar configuração
      logger.info('📋 Carregando configuração...');
      const appConfig = this.config.loadConfig();
      logger.info(`Ambiente: ${appConfig.environment}`);
      logger.info(`Versão: ${appConfig.version}`);

      // 2. Conectar ao banco de dados
      logger.info('🗄️  Conectando ao banco de dados...');
      this.dbConnection = db;
      await this.dbConnection.connect();
      logger.info('✅ Banco de dados conectado');

      // 3. Conectar ao Redis
      logger.info('🔴 Conectando ao Redis...');
      this.redisService = new RedisService();
      await this.redisService.connect();
      logger.info('✅ Redis conectado');

      // 4. Inicializar Message Broker
      logger.info('📨 Inicializando Message Broker...');
      this.messageBroker = new MessageBrokerService();
      await this.messageBroker.initialize();
      logger.info('✅ Message Broker inicializado');

      // 5. Inicializar Data Ingestor
      logger.info('📊 Inicializando Data Ingestor...');
      this.dataIngestor = new DataIngestorService();
      logger.info('✅ Data Ingestor inicializado');

      // 6. Inicializar Strategy Engine
      logger.info('🧠 Inicializando Strategy Engine...');
      this.strategyEngine = new StrategyEngineService();
      await this.strategyEngine.initialize();
      logger.info('✅ Strategy Engine inicializado');

      // 7. Inicializar Execution Engine
      logger.info('⚡ Inicializando Execution Engine...');
      this.executionEngine = new ExecutionEngineService();
      await this.executionEngine.initialize();
      logger.info('✅ Execution Engine inicializado');

      // 8. Inicializar System Monitor
      logger.info('📈 Inicializando System Monitor...');
      this.systemMonitor = new SystemMonitor();
      await this.systemMonitor.start();
      logger.info('✅ System Monitor inicializado');

      // 9. Estratégias ativas já foram carregadas no initialize
      logger.info('✅ Estratégias ativas carregadas');

      // 10. Sistema pronto para operar
      logger.info('✅ Sistema pronto para operar');

      // 11. Iniciar servidor HTTP
      logger.info('🌐 Iniciando servidor HTTP...');
      const serverConfig = this.config.getServerConfig();
      const appInstance = new App();
      this.server = appInstance.app.listen(serverConfig.port, serverConfig.host, () => {
        logger.info(`✅ Servidor rodando em http://${serverConfig.host}:${serverConfig.port}`);
        logger.info('🎉 Sistema AURA inicializado com sucesso!');
        this.logSystemStatus();
      });

      // Configurar graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('❌ Falha ao inicializar Sistema AURA:', error as any);
      await this.shutdown();
      process.exit(1);
    }
  }

  private logSystemStatus(): void {
    const config = this.config.getConfig();
    
    logger.info('📊 Status do Sistema:');
    logger.info(`  • Ambiente: ${config.environment}`);
    logger.info(`  • Versão: ${config.version}`);
    logger.info(`  • Banco: ${config.database.host}:${config.database.port}/${config.database.database}`);
    logger.info(`  • Redis: ${config.redis.host}:${config.redis.port}/${config.redis.database}`);
    logger.info(`  • Binance: ${config.binance.useTestnet ? 'Testnet' : 'Mainnet'}`);
    logger.info(`  • Servidor: ${config.server.host}:${config.server.port}`);
    logger.info(`  • Logs: ${config.logging.level}`);
    logger.info(`  • Monitoramento: ${config.monitoring.enabled ? 'Ativo' : 'Inativo'}`);
  }

  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`🛑 Recebido sinal ${signal}, iniciando shutdown graceful...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      logger.error('💥 Uncaught Exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', { promise, reason });
      await this.shutdown();
      process.exit(1);
    });
  }

  async shutdown(): Promise<void> {
    logger.info('🛑 Iniciando shutdown do Sistema AURA...');

    try {
      // 1. Parar de aceitar novas conexões
      if (this.server) {
        logger.info('🌐 Fechando servidor HTTP...');
        this.server.close();
      }

      // 2. Parar System Monitor
      if (this.systemMonitor) {
        logger.info('📈 Parando System Monitor...');
        await this.systemMonitor.stop();
      }

      // 3. Parar Strategy Engine
      if (this.strategyEngine) {
        logger.info('🧠 Parando Strategy Engine...');
        await this.strategyEngine.shutdown();
      }

      // 4. Parar Execution Engine
      if (this.executionEngine) {
        logger.info('⚡ Parando Execution Engine...');
        await this.executionEngine.shutdown();
      }

      // 5. Parar Data Ingestor
      if (this.dataIngestor) {
        logger.info('📊 Parando Data Ingestor...');
        await this.dataIngestor.disconnect();
      }

      // 6. Desconectar Message Broker
      if (this.messageBroker) {
        logger.info('📨 Desconectando Message Broker...');
        await this.messageBroker.shutdown();
      }

      // 7. Desconectar Redis
      if (this.redisService) {
        logger.info('🔴 Desconectando Redis...');
        await this.redisService.disconnect();
      }

      // 8. Desconectar banco de dados
      if (this.dbConnection) {
        logger.info('🗄️  Desconectando banco de dados...');
        await this.dbConnection.close();
      }

      logger.info('✅ Sistema AURA finalizado com sucesso');

    } catch (error) {
      logger.error('❌ Erro durante shutdown:', error as any);
    }
  }
}

// Inicializar sistema
const auraSystem = new AuraSystem();

// Função principal
async function main() {
  try {
    await auraSystem.initialize();
  } catch (error) {
    logger.error('❌ Falha crítica na inicialização:', error as any);
    process.exit(1);
  }
}

// Executar apenas se este arquivo for executado diretamente
if (require.main === module) {
  main();
}

export { AuraSystem };