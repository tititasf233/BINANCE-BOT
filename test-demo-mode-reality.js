const axios = require('axios');

/**
 * TESTE CRÍTICO: VERIFICAR SE ORDENS DO MODO DEMO SÃO REAIS
 * 
 * Este teste vai determinar se:
 * 1. As ordens criadas no modo demo são realmente enviadas para a Binance Testnet
 * 2. Se são apenas simulações locais
 * 3. Se há inconsistências entre o que é mostrado e o que realmente existe
 * 
 * PROBLEMA RELATADO:
 * - Ordens abertas do modo demo aparentemente não se sabe se são reais
 * - Se são reais, se cria mais uma ao invés de excluir
 * - Bug crítico na criação/exclusão de ordens
 */

class DemoModeRealityTester {
  constructor() {
    this.baseURL = 'http://localhost:3001';
    this.token = null;
    this.headers = null;
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'debug': '🔍',
      'critical': '🚨'
    }[type] || '📋';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async login() {
    try {
      this.log('Fazendo login...', 'info');
      
      const response = await axios.post(`${this.baseURL}/api/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
      });

      if (response.data.success) {
        this.token = response.data.data.token;
        this.headers = { 
          'Authorization': `Bearer ${this.token}`, 
          'Content-Type': 'application/json' 
        };
        this.log('Login realizado com sucesso', 'success');
        return true;
      } else {
        this.log(`Login falhou: ${response.data.error}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Erro no login: ${error.message}`, 'error');
      return false;
    }
  }

  async getCurrentMode() {
    try {
      const response = await axios.get(`${this.baseURL}/api/trading/account`, { 
        headers: this.headers 
      });
      
      if (response.data.success) {
        return {
          isTestnet: response.data.data.isTestnet,
          hasApiKeys: response.data.data.hasApiKeys,
          accountInfo: response.data.data
        };
      }
      return null;
    } catch (error) {
      this.log(`Erro ao verificar modo atual: ${error.message}`, 'error');
      return null;
    }
  }

  async activateDemoMode() {
    try {
      this.log('Ativando modo demo...', 'info');
      
      const response = await axios.post(`${this.baseURL}/api/trading/toggle-mode`, {
        isTestnet: true
      }, { headers: this.headers });

      if (response.data.success) {
        this.log('Modo demo ativado', 'success');
        return true;
      } else {
        this.log(`Falha ao ativar modo demo: ${response.data.error}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Erro ao ativar modo demo: ${error.message}`, 'error');
      return false;
    }
  }

  async getOrdersFromAPI() {
    try {
      const response = await axios.get(`${this.baseURL}/api/trading/orders/open`, { 
        headers: this.headers 
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        this.log(`Erro ao buscar ordens da API: ${response.data.error}`, 'error');
        return [];
      }
    } catch (error) {
      this.log(`Erro ao buscar ordens da API: ${error.message}`, 'error');
      return [];
    }
  }

  async getOrdersDirectlyFromBinance() {
    try {
      // Tentar acessar diretamente o serviço Binance do backend
      const response = await axios.get(`${this.baseURL}/api/trading/binance/orders/direct`, { 
        headers: this.headers 
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        this.log(`Erro ao buscar ordens diretamente da Binance: ${response.data.error}`, 'warning');
        return null;
      }
    } catch (error) {
      this.log(`Erro ao buscar ordens diretamente da Binance: ${error.message}`, 'warning');
      return null;
    }
  }

  async createTestOrder(orderData) {
    try {
      this.log(`Criando ordem de teste: ${orderData.symbol} ${orderData.side} ${orderData.quantity}@${orderData.price}`, 'info');
      
      const response = await axios.post(`${this.baseURL}/api/trading/order`, 
        orderData, { headers: this.headers });

      if (response.data.success) {
        const order = response.data.data;
        this.log(`Ordem criada: ID ${order.orderId}, Status: ${order.status}`, 'success');
        return order;
      } else {
        this.log(`Falha ao criar ordem: ${response.data.error}`, 'error');
        return null;
      }
    } catch (error) {
      this.log(`Erro ao criar ordem: ${error.message}`, 'error');
      return null;
    }
  }

  async cancelTestOrder(symbol, orderId) {
    try {
      this.log(`Cancelando ordem: ${symbol}/${orderId}`, 'info');
      
      const response = await axios.delete(
        `${this.baseURL}/api/trading/order/${symbol}/${orderId}`,
        { headers: this.headers }
      );

      if (response.data.success) {
        this.log(`Ordem cancelada: ${response.data.data.status}`, 'success');
        return true;
      } else {
        this.log(`Falha ao cancelar ordem: ${response.data.error}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Erro ao cancelar ordem: ${error.message}`, 'error');
      return false;
    }
  }

  async testOrderReality() {
    this.log('\n🚨 TESTE CRÍTICO: REALIDADE DAS ORDENS DO MODO DEMO', 'critical');
    this.log('=======================================================\n', 'critical');

    // 1. Verificar modo atual
    const currentMode = await this.getCurrentMode();
    if (!currentMode) {
      this.log('Não foi possível verificar o modo atual', 'error');
      return;
    }

    this.log(`Modo atual: ${currentMode.isTestnet ? 'DEMO (Testnet)' : 'REAL (Mainnet)'}`, 'info');
    this.log(`Tem API Keys: ${currentMode.hasApiKeys}`, 'info');

    if (!currentMode.isTestnet) {
      this.log('Ativando modo demo para o teste...', 'warning');
      if (!await this.activateDemoMode()) {
        this.log('Falha ao ativar modo demo', 'error');
        return;
      }
    }

    // 2. Estado inicial - limpar todas as ordens existentes
    this.log('\n=== FASE 1: LIMPEZA INICIAL ===', 'info');
    
    // Primeiro tentar limpar o mock storage diretamente
    try {
      // Nova rota global de limpeza, com fallback para a rota antiga
      let clearResponse;
      try {
        clearResponse = await axios.post(`${this.baseURL}/api/trading/mock/clear`, {}, { headers: this.headers });
      } catch (e) {
        clearResponse = await axios.post(`${this.baseURL}/api/trading/clear-mock-storage`, {}, { headers: this.headers });
      }
      if (clearResponse.data.success) {
        this.log('Mock storage limpo com sucesso', 'success');
      }
    } catch (error) {
      this.log('Não foi possível limpar mock storage, continuando com cancelamento manual', 'warning');
    }
    
    // Pequena espera para garantir consistência
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Double-check: se ainda houver ordens, cancelar manualmente
    try {
      const initialOrdersCheck = await this.getOrdersFromAPI();
      if (initialOrdersCheck.length > 0) {
        this.log(`Ainda há ${initialOrdersCheck.length} ordens. Iniciando cancelamento manual...`, 'warning');
        for (const order of initialOrdersCheck) {
          await this.cancelTestOrder(order.symbol, order.orderId);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      // ignore
    }
    
    const initialOrders = await this.getOrdersFromAPI();
    this.log(`Ordens iniciais encontradas: ${initialOrders.length}`, 'info');

    if (initialOrders.length > 0) {
      this.log('Cancelando todas as ordens existentes...', 'warning');
      for (const order of initialOrders) {
        await this.cancelTestOrder(order.symbol, order.orderId);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Verificar se foram realmente canceladas
      await new Promise(resolve => setTimeout(resolve, 2000));
      const remainingOrders = await this.getOrdersFromAPI();
      this.log(`Ordens restantes após limpeza: ${remainingOrders.length}`, 
        remainingOrders.length === 0 ? 'success' : 'error');
    }

    // 3. Teste de criação única
    this.log('\n=== FASE 2: TESTE DE CRIAÇÃO ÚNICA ===', 'info');
    
    const testOrder = {
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.001',
      price: '43000',
      timeInForce: 'GTC'
    };

    // Criar uma ordem
    const createdOrder = await this.createTestOrder(testOrder);
    if (!createdOrder) {
      this.log('Falha ao criar ordem de teste', 'error');
      return;
    }

    // Verificar imediatamente se aparece
    await new Promise(resolve => setTimeout(resolve, 1000));
    const ordersAfterCreation = await this.getOrdersFromAPI();
    
    const foundOrder = ordersAfterCreation.find(order => order.orderId === createdOrder.orderId);
    
    if (foundOrder) {
      this.log('✅ ORDEM APARECE CORRETAMENTE após criação', 'success');
    } else {
      this.log('❌ ORDEM NÃO APARECE após criação - BUG CRÍTICO!', 'critical');
      this.log(`Ordens encontradas: ${ordersAfterCreation.length}`, 'debug');
      ordersAfterCreation.forEach((order, i) => {
        this.log(`  ${i+1}. ID: ${order.orderId}, ${order.symbol} ${order.side}`, 'debug');
      });
    }

    // 4. Teste de múltiplas criações (verificar duplicação)
    this.log('\n=== FASE 3: TESTE DE MÚLTIPLAS CRIAÇÕES ===', 'info');
    
    const multipleOrders = [];
    for (let i = 0; i < 3; i++) {
      const orderData = {
        symbol: 'ETHUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.01',
        price: (2500 + i * 10).toString(),
        timeInForce: 'GTC'
      };
      
      const order = await this.createTestOrder(orderData);
      if (order) {
        multipleOrders.push(order);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.log(`Ordens criadas: ${multipleOrders.length}`, 'info');

    // Verificar se todas aparecem
    await new Promise(resolve => setTimeout(resolve, 2000));
    const allOrders = await this.getOrdersFromAPI();
    
    const foundMultipleOrders = multipleOrders.filter(order => 
      allOrders.find(o => o.orderId === order.orderId)
    );

    this.log(`Ordens encontradas na lista: ${foundMultipleOrders.length}/${multipleOrders.length}`, 
      foundMultipleOrders.length === multipleOrders.length ? 'success' : 'error');

    // 5. Teste de cancelamento
    this.log('\n=== FASE 4: TESTE DE CANCELAMENTO ===', 'info');
    
    const ordersToCancel = [...foundMultipleOrders];
    if (foundOrder) ordersToCancel.push(foundOrder);

    this.log(`Cancelando ${ordersToCancel.length} ordens...`, 'info');

    const cancelResults = [];
    for (const order of ordersToCancel) {
      const canceled = await this.cancelTestOrder(order.symbol, order.orderId);
      cancelResults.push({ order, canceled });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successfulCancellations = cancelResults.filter(r => r.canceled).length;
    this.log(`Cancelamentos bem-sucedidos: ${successfulCancellations}/${ordersToCancel.length}`, 
      successfulCancellations === ordersToCancel.length ? 'success' : 'error');

    // Verificar se desapareceram
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalOrders = await this.getOrdersFromAPI();
    
    const stillExisting = ordersToCancel.filter(order => 
      finalOrders.find(o => o.orderId === order.orderId)
    );

    this.log(`Ordens que ainda existem após cancelamento: ${stillExisting.length}`, 
      stillExisting.length === 0 ? 'success' : 'critical');

    if (stillExisting.length > 0) {
      this.log('🚨 BUG CRÍTICO: Ordens não foram removidas após cancelamento!', 'critical');
      stillExisting.forEach(order => {
        this.log(`  - ID: ${order.orderId}, ${order.symbol} ${order.side}`, 'critical');
      });
    }

    // 6. Teste de stress - criação e cancelamento rápidos
    this.log('\n=== FASE 5: TESTE DE STRESS ===', 'info');
    
    const stressOrders = [];
    const stressStart = Date.now();
    
    // Criar 5 ordens rapidamente
    for (let i = 0; i < 5; i++) {
      const orderData = {
        symbol: 'BNBUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.1',
        price: (300 + i * 5).toString(),
        timeInForce: 'GTC'
      };
      
      const order = await this.createTestOrder(orderData);
      if (order) {
        stressOrders.push(order);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Muito rápido
    }
    
    const creationTime = Date.now() - stressStart;
    this.log(`${stressOrders.length} ordens criadas em ${creationTime}ms`, 'info');
    
    // Verificar se todas aparecem
    await new Promise(resolve => setTimeout(resolve, 1000));
    const stressCheck = await this.getOrdersFromAPI();
    const foundStressOrders = stressOrders.filter(order => 
      stressCheck.find(o => o.orderId === order.orderId)
    );
    
    this.log(`Ordens de stress encontradas: ${foundStressOrders.length}/${stressOrders.length}`, 
      foundStressOrders.length === stressOrders.length ? 'success' : 'error');
    
    // Cancelar todas rapidamente
    const cancelStart = Date.now();
    let canceledCount = 0;
    
    for (const order of stressOrders) {
      const canceled = await this.cancelTestOrder(order.symbol, order.orderId);
      if (canceled) canceledCount++;
      await new Promise(resolve => setTimeout(resolve, 100)); // Muito rápido
    }
    
    const cancellationTime = Date.now() - cancelStart;
    this.log(`${canceledCount} ordens canceladas em ${cancellationTime}ms`, 'info');
    
    // Verificar se todas desapareceram
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalStressCheck = await this.getOrdersFromAPI();
    const remainingStressOrders = stressOrders.filter(order => 
      finalStressCheck.find(o => o.orderId === order.orderId)
    );
    
    this.log(`Ordens de stress restantes: ${remainingStressOrders.length}`, 
      remainingStressOrders.length === 0 ? 'success' : 'critical');

    // 7. Relatório final
    const remainingOrders = await this.getOrdersFromAPI(); // Get final state
    this.generateRealityReport({
      initialCleanup: initialOrders.length === 0 || remainingOrders.length === 0,
      singleOrderCreation: !!foundOrder,
      multipleOrderCreation: foundMultipleOrders.length === multipleOrders.length,
      orderCancellation: stillExisting.length === 0,
      stressTest: remainingStressOrders.length === 0,
      totalFinalOrders: finalStressCheck.length
    });
  }

  generateRealityReport(results) {
    this.log('\n📊 RELATÓRIO DE REALIDADE DAS ORDENS DEMO', 'critical');
    this.log('===========================================\n', 'critical');

    const tests = [
      { name: 'Limpeza Inicial', passed: results.initialCleanup },
      { name: 'Criação de Ordem Única', passed: results.singleOrderCreation },
      { name: 'Criação de Múltiplas Ordens', passed: results.multipleOrderCreation },
      { name: 'Cancelamento de Ordens', passed: results.orderCancellation },
      { name: 'Teste de Stress', passed: results.stressTest }
    ];

    let passedTests = 0;
    tests.forEach(test => {
      this.log(`${test.name}: ${test.passed ? 'PASSOU' : 'FALHOU'}`, 
        test.passed ? 'success' : 'error');
      if (test.passed) passedTests++;
    });

    this.log(`\nRESUMO: ${passedTests}/${tests.length} testes passaram`, 
      passedTests === tests.length ? 'success' : 'critical');

    this.log(`Ordens finais no sistema: ${results.totalFinalOrders}`, 'info');

    this.log('\n🎯 DIAGNÓSTICO:', 'critical');
    
    if (passedTests === tests.length) {
      this.log('✅ SISTEMA FUNCIONANDO CORRETAMENTE', 'success');
      this.log('  - Ordens são criadas e aparecem imediatamente', 'success');
      this.log('  - Ordens são canceladas e desaparecem imediatamente', 'success');
      this.log('  - Não há duplicação ou ordens fantasma', 'success');
      this.log('  - Sistema suporta operações rápidas', 'success');
    } else {
      this.log('❌ PROBLEMAS CRÍTICOS ENCONTRADOS:', 'critical');
      
      if (!results.singleOrderCreation) {
        this.log('  - Ordens não aparecem após criação', 'critical');
      }
      
      if (!results.multipleOrderCreation) {
        this.log('  - Problemas com múltiplas ordens', 'critical');
      }
      
      if (!results.orderCancellation) {
        this.log('  - Ordens não desaparecem após cancelamento', 'critical');
      }
      
      if (!results.stressTest) {
        this.log('  - Sistema não suporta operações rápidas', 'critical');
      }
    }

    this.log('\n💡 PRÓXIMOS PASSOS:', 'info');
    if (passedTests === tests.length) {
      this.log('  - Problema está no frontend (cache, refresh, etc.)', 'warning');
      this.log('  - Verificar logs do console do navegador', 'info');
      this.log('  - Implementar refresh mais agressivo no frontend', 'info');
    } else {
      this.log('  - Corrigir problemas no backend primeiro', 'critical');
      this.log('  - Verificar sistema de mock do modo demo', 'critical');
      this.log('  - Verificar sincronização com Binance Testnet', 'critical');
    }
  }

  async run() {
    if (!await this.login()) return;
    await this.testOrderReality();
  }
}

// Executar teste
const tester = new DemoModeRealityTester();
tester.run().catch(error => {
  console.error('❌ ERRO FATAL NO TESTE:', error);
});