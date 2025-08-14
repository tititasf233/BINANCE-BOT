const axios = require('axios');

/**
 * TESTE REAL DE OPERAÇÕES DO FRONTEND
 * 
 * Este teste simula exatamente o que o usuário faz no frontend:
 * 1. Login
 * 2. Ativar modo demo
 * 3. Criar ordens
 * 4. Verificar se aparecem
 * 5. Cancelar ordens
 * 6. Verificar se desaparecem
 * 
 * NADA DE SIMULAÇÃO - TUDO REAL
 */

class RealFrontendTester {
  constructor() {
    this.baseURL = 'http://localhost:3001';
    this.token = null;
    this.headers = null;
    this.testResults = {
      login: false,
      demoMode: false,
      orderCreation: [],
      orderCancellation: [],
      dataConsistency: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'debug': '🔍'
    }[type] || '📋';
    
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async login() {
    try {
      this.log('Iniciando login...', 'info');
      
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
        this.testResults.login = true;
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

  async activateDemoMode() {
    try {
      this.log('Ativando modo demo...', 'info');
      
      const response = await axios.post(`${this.baseURL}/api/trading/toggle-mode`, {
        isTestnet: true
      }, { headers: this.headers });

      if (response.data.success) {
        this.testResults.demoMode = true;
        this.log('Modo demo ativado com sucesso', 'success');
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

  async getOpenOrders() {
    try {
      const response = await axios.get(`${this.baseURL}/api/trading/orders/open`, { 
        headers: this.headers 
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        this.log(`Erro ao buscar ordens: ${response.data.error}`, 'error');
        return [];
      }
    } catch (error) {
      this.log(`Erro ao buscar ordens: ${error.message}`, 'error');
      return [];
    }
  }

  async createOrder(orderData) {
    try {
      this.log(`Criando ordem: ${orderData.symbol} ${orderData.side} ${orderData.quantity}@${orderData.price}`, 'info');
      
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

  async cancelOrder(symbol, orderId) {
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

  async testOrderLifecycle(orderData, testName) {
    this.log(`\n=== TESTE: ${testName} ===`, 'info');
    
    const result = {
      name: testName,
      orderData,
      created: false,
      appearsInList: false,
      canceled: false,
      removedFromList: false,
      timings: {}
    };

    // 1. Estado inicial
    const startTime = Date.now();
    const initialOrders = await this.getOpenOrders();
    result.timings.initialCheck = Date.now() - startTime;
    
    this.log(`Estado inicial: ${initialOrders.length} ordens abertas`, 'debug');

    // 2. Criar ordem
    const createStart = Date.now();
    const createdOrder = await this.createOrder(orderData);
    result.timings.creation = Date.now() - createStart;
    
    if (!createdOrder) {
      this.log('FALHA: Não foi possível criar a ordem', 'error');
      return result;
    }
    
    result.created = true;
    result.orderId = createdOrder.orderId;

    // 3. Verificar se aparece na lista (IMEDIATAMENTE)
    const checkStart = Date.now();
    const ordersAfterCreation = await this.getOpenOrders();
    result.timings.immediateCheck = Date.now() - checkStart;
    
    const foundOrder = ordersAfterCreation.find(order => order.orderId === createdOrder.orderId);
    
    if (foundOrder) {
      result.appearsInList = true;
      this.log('✅ SUCESSO: Ordem aparece na lista imediatamente', 'success');
    } else {
      this.log('❌ FALHA CRÍTICA: Ordem NÃO aparece na lista após criação', 'error');
      this.log(`Ordens encontradas: ${ordersAfterCreation.length}`, 'debug');
      ordersAfterCreation.forEach((order, i) => {
        this.log(`  ${i+1}. ID: ${order.orderId}, ${order.symbol} ${order.side}`, 'debug');
      });
    }

    // 4. Aguardar um pouco (simular tempo de reação do usuário)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Cancelar ordem
    const cancelStart = Date.now();
    const canceled = await this.cancelOrder(createdOrder.symbol, createdOrder.orderId);
    result.timings.cancellation = Date.now() - cancelStart;
    
    if (!canceled) {
      this.log('FALHA: Não foi possível cancelar a ordem', 'error');
      return result;
    }
    
    result.canceled = true;

    // 6. Verificar se desaparece da lista (IMEDIATAMENTE)
    const finalCheckStart = Date.now();
    const ordersAfterCancellation = await this.getOpenOrders();
    result.timings.finalCheck = Date.now() - finalCheckStart;
    
    const stillExists = ordersAfterCancellation.find(order => order.orderId === createdOrder.orderId);
    
    if (!stillExists) {
      result.removedFromList = true;
      this.log('✅ SUCESSO: Ordem removida da lista imediatamente', 'success');
    } else {
      this.log('❌ FALHA CRÍTICA: Ordem AINDA aparece na lista após cancelamento', 'error');
      this.log(`Status da ordem: ${stillExists.status}`, 'debug');
    }

    // 7. Resultado final
    const success = result.created && result.appearsInList && result.canceled && result.removedFromList;
    this.log(`RESULTADO: ${success ? 'SUCESSO TOTAL' : 'FALHA'}`, success ? 'success' : 'error');
    
    return result;
  }

  async runBatteryTests() {
    this.log('\n🚀 INICIANDO BATERIA DE TESTES REAIS', 'info');
    this.log('=====================================\n', 'info');

    // Setup
    if (!await this.login()) return;
    if (!await this.activateDemoMode()) return;

    const testCases = [
      {
        name: 'Ordem BTC Limite Compra',
        data: {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '43000',
          timeInForce: 'GTC'
        }
      },
      {
        name: 'Ordem ETH Limite Venda',
        data: {
          symbol: 'ETHUSDT',
          side: 'SELL',
          type: 'LIMIT',
          quantity: '0.01',
          price: '2600',
          timeInForce: 'GTC'
        }
      },
      {
        name: 'Ordem ADA Limite Compra',
        data: {
          symbol: 'ADAUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '100',
          price: '0.45',
          timeInForce: 'GTC'
        }
      }
    ];

    const results = [];
    
    for (const testCase of testCases) {
      const result = await this.testOrderLifecycle(testCase.data, testCase.name);
      results.push(result);
      
      // Pausa entre testes
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Teste de stress - múltiplas ordens rapidamente
    this.log('\n=== TESTE DE STRESS: MÚLTIPLAS ORDENS ===', 'info');
    
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
      
      const order = await this.createOrder(orderData);
      if (order) {
        stressOrders.push(order);
      }
      
      // Pequena pausa para simular cliques rápidos do usuário
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.log(`Criadas ${stressOrders.length} ordens em ${Date.now() - stressStart}ms`, 'info');
    
    // Verificar se todas aparecem
    const allOrders = await this.getOpenOrders();
    const foundStressOrders = stressOrders.filter(order => 
      allOrders.find(o => o.orderId === order.orderId)
    );
    
    this.log(`${foundStressOrders.length}/${stressOrders.length} ordens aparecem na lista`, 
      foundStressOrders.length === stressOrders.length ? 'success' : 'error');
    
    // Cancelar todas rapidamente
    const cancelStart = Date.now();
    let canceledCount = 0;
    
    for (const order of stressOrders) {
      const canceled = await this.cancelOrder(order.symbol, order.orderId);
      if (canceled) canceledCount++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    this.log(`Canceladas ${canceledCount}/${stressOrders.length} ordens em ${Date.now() - cancelStart}ms`, 'info');
    
    // Verificar se todas desapareceram
    const finalOrders = await this.getOpenOrders();
    const remainingStressOrders = stressOrders.filter(order => 
      finalOrders.find(o => o.orderId === order.orderId)
    );
    
    this.log(`${remainingStressOrders.length} ordens ainda aparecem na lista (deveria ser 0)`, 
      remainingStressOrders.length === 0 ? 'success' : 'error');

    // Relatório final
    this.generateReport(results);
  }

  generateReport(results) {
    this.log('\n📊 RELATÓRIO FINAL DOS TESTES', 'info');
    this.log('==============================\n', 'info');

    let totalTests = results.length;
    let passedTests = 0;
    let criticalIssues = [];

    results.forEach(result => {
      const success = result.created && result.appearsInList && result.canceled && result.removedFromList;
      if (success) passedTests++;

      this.log(`${result.name}: ${success ? 'PASSOU' : 'FALHOU'}`, success ? 'success' : 'error');
      
      if (!result.appearsInList) {
        criticalIssues.push(`${result.name}: Ordem não aparece após criação`);
      }
      
      if (!result.removedFromList && result.canceled) {
        criticalIssues.push(`${result.name}: Ordem não desaparece após cancelamento`);
      }

      // Timings
      this.log(`  Tempos: Criação ${result.timings.creation}ms, Verificação ${result.timings.immediateCheck}ms, Cancelamento ${result.timings.cancellation}ms`, 'debug');
    });

    this.log(`\nRESUMO: ${passedTests}/${totalTests} testes passaram`, 
      passedTests === totalTests ? 'success' : 'error');

    if (criticalIssues.length > 0) {
      this.log('\n🚨 PROBLEMAS CRÍTICOS ENCONTRADOS:', 'error');
      criticalIssues.forEach(issue => {
        this.log(`  - ${issue}`, 'error');
      });
    }

    this.log('\n💡 PRÓXIMOS PASSOS:', 'info');
    if (passedTests === totalTests) {
      this.log('  - Backend está funcionando corretamente', 'success');
      this.log('  - Problema está no frontend (cache, refresh, etc.)', 'warning');
      this.log('  - Implementar logs detalhados no frontend', 'info');
    } else {
      this.log('  - Corrigir problemas no backend primeiro', 'warning');
      this.log('  - Verificar sistema de mock do modo demo', 'info');
      this.log('  - Testar com API real da Binance', 'info');
    }
  }
}

// Executar testes
const tester = new RealFrontendTester();
tester.runBatteryTests().catch(error => {
  console.error('❌ ERRO FATAL NOS TESTES:', error);
});