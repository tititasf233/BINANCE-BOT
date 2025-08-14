/**
 * DEPURADOR DE CONSOLE DO FRONTEND
 * 
 * Este script adiciona logs detalhados no console do navegador
 * para rastrear todas as operações do frontend em tempo real.
 * 
 * INSTRUÇÕES DE USO:
 * 1. Abra o navegador e vá para o frontend (http://localhost:3000)
 * 2. Abra o DevTools (F12)
 * 3. Cole este script no console
 * 4. Execute as operações (criar/cancelar ordens)
 * 5. Observe os logs detalhados
 */

(function() {
  'use strict';
  
  console.log('🔧 DEPURADOR DE FRONTEND ATIVADO');
  console.log('================================');
  
  // Estilo para logs
  const styles = {
    header: 'background: #2196F3; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
    success: 'background: #4CAF50; color: white; padding: 2px 5px; border-radius: 3px;',
    error: 'background: #F44336; color: white; padding: 2px 5px; border-radius: 3px;',
    warning: 'background: #FF9800; color: white; padding: 2px 5px; border-radius: 3px;',
    info: 'background: #607D8B; color: white; padding: 2px 5px; border-radius: 3px;',
    debug: 'background: #9C27B0; color: white; padding: 2px 5px; border-radius: 3px;'
  };
  
  function debugLog(message, type = 'info', data = null) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    const style = styles[type] || styles.info;
    
    console.log(`%c[${timestamp}] ${message}`, style);
    if (data) {
      console.log(data);
    }
  }
  
  // Interceptar fetch requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options = {}] = args;
    const method = options.method || 'GET';
    const requestId = Math.random().toString(36).substr(2, 9);
    
    debugLog(`🌐 [${requestId}] FETCH REQUEST: ${method} ${url}`, 'header');
    
    if (options.body) {
      try {
        const body = JSON.parse(options.body);
        debugLog(`📤 [${requestId}] Request Body:`, 'info', body);
      } catch (e) {
        debugLog(`📤 [${requestId}] Request Body (raw):`, 'info', options.body);
      }
    }
    
    const startTime = Date.now();
    
    return originalFetch.apply(this, args)
      .then(response => {
        const duration = Date.now() - startTime;
        const status = response.status;
        const statusType = status >= 200 && status < 300 ? 'success' : 'error';
        
        debugLog(`📥 [${requestId}] FETCH RESPONSE: ${status} (${duration}ms)`, statusType);
        
        // Clone response para poder ler o body
        const responseClone = response.clone();
        
        // Tentar ler o JSON da resposta
        responseClone.json()
          .then(data => {
            debugLog(`📋 [${requestId}] Response Data:`, statusType, data);
            
            // Análise específica para endpoints de trading
            if (url.includes('/api/trading/orders/open')) {
              debugLog(`📊 [${requestId}] ORDENS ABERTAS RECEBIDAS:`, 'debug', {
                count: data.data?.length || 0,
                orders: data.data?.map(o => ({
                  id: o.orderId,
                  symbol: o.symbol,
                  side: o.side,
                  status: o.status
                })) || []
              });
            }
            
            if (url.includes('/api/trading/order') && method === 'POST') {
              debugLog(`✅ [${requestId}] ORDEM CRIADA:`, 'success', {
                success: data.success,
                orderId: data.data?.orderId,
                symbol: data.data?.symbol,
                side: data.data?.side,
                status: data.data?.status
              });
            }
            
            if (url.includes('/api/trading/order') && method === 'DELETE') {
              debugLog(`🗑️ [${requestId}] ORDEM CANCELADA:`, 'warning', {
                success: data.success,
                status: data.data?.status,
                error: data.error
              });
            }
          })
          .catch(err => {
            debugLog(`⚠️ [${requestId}] Não foi possível ler response JSON`, 'warning', err.message);
          });
        
        return response;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        debugLog(`❌ [${requestId}] FETCH ERROR (${duration}ms):`, 'error', error);
        throw error;
      });
  };
  
  // Interceptar localStorage changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    debugLog(`💾 LOCALSTORAGE SET: ${key}`, 'debug', value);
    return originalSetItem.apply(this, arguments);
  };
  
  const originalGetItem = localStorage.getItem;
  localStorage.getItem = function(key) {
    const value = originalGetItem.apply(this, arguments);
    if (key.includes('token') || key.includes('auth')) {
      debugLog(`🔑 LOCALSTORAGE GET: ${key}`, 'debug', value ? 'Token presente' : 'Token ausente');
    }
    return value;
  };
  
  // Monitorar mudanças no DOM (para detectar atualizações de componentes)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        // Detectar quando listas de ordens são atualizadas
        const addedNodes = Array.from(mutation.addedNodes);
        const removedNodes = Array.from(mutation.removedNodes);
        
        addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.textContent && node.textContent.includes('ID:')) {
              debugLog('➕ DOM: Nova ordem adicionada à lista', 'success', node.textContent.trim());
            }
          }
        });
        
        removedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            if (node.textContent && node.textContent.includes('ID:')) {
              debugLog('➖ DOM: Ordem removida da lista', 'warning', node.textContent.trim());
            }
          }
        });
      }
    });
  });
  
  // Observar mudanças no body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Interceptar clicks em botões
  document.addEventListener('click', function(event) {
    const target = event.target;
    const buttonText = target.textContent?.trim();
    
    if (buttonText) {
      if (buttonText.includes('Criar') || buttonText.includes('Comprar') || buttonText.includes('Vender')) {
        debugLog(`🖱️ CLICK: Botão de criação de ordem`, 'header', buttonText);
      } else if (buttonText.includes('Cancelar') && !buttonText.includes('Nova')) {
        debugLog(`🖱️ CLICK: Botão de cancelamento`, 'warning', buttonText);
      } else if (buttonText.includes('Atualizar') || buttonText.includes('Refresh')) {
        debugLog(`🖱️ CLICK: Botão de atualização`, 'info', buttonText);
      }
    }
  });
  
  // Monitorar erros JavaScript
  window.addEventListener('error', function(event) {
    debugLog(`💥 JAVASCRIPT ERROR:`, 'error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  });
  
  // Monitorar promises rejeitadas
  window.addEventListener('unhandledrejection', function(event) {
    debugLog(`💥 UNHANDLED PROMISE REJECTION:`, 'error', event.reason);
  });
  
  // Função para inspecionar estado atual
  window.debugFrontend = {
    getOrdersFromDOM: function() {
      const orderElements = document.querySelectorAll('[class*="order"], [class*="Order"]');
      const orders = Array.from(orderElements).map(el => ({
        text: el.textContent?.trim(),
        classes: el.className,
        id: el.id
      }));
      
      debugLog('🔍 ORDENS NO DOM:', 'debug', orders);
      return orders;
    },
    
    checkLocalStorage: function() {
      const keys = Object.keys(localStorage);
      const storage = {};
      keys.forEach(key => {
        storage[key] = localStorage.getItem(key);
      });
      
      debugLog('🔍 LOCALSTORAGE ATUAL:', 'debug', storage);
      return storage;
    },
    
    simulateRefresh: function() {
      debugLog('🔄 SIMULANDO REFRESH MANUAL', 'header');
      
      // Tentar encontrar e clicar no botão de refresh
      const refreshButtons = document.querySelectorAll('button');
      for (const button of refreshButtons) {
        if (button.textContent?.includes('Atualizar') || button.textContent?.includes('Refresh')) {
          debugLog('🖱️ Clicando no botão de refresh', 'info');
          button.click();
          return;
        }
      }
      
      debugLog('⚠️ Botão de refresh não encontrado', 'warning');
    },
    
    getNetworkRequests: function() {
      debugLog('🌐 Para ver requisições de rede, use a aba Network do DevTools', 'info');
    },
    
    help: function() {
      console.log(`
%c🔧 COMANDOS DISPONÍVEIS:
%c
debugFrontend.getOrdersFromDOM()     - Inspecionar ordens no DOM
debugFrontend.checkLocalStorage()    - Verificar localStorage
debugFrontend.simulateRefresh()      - Simular clique no refresh
debugFrontend.getNetworkRequests()   - Info sobre requisições
debugFrontend.help()                 - Mostrar esta ajuda

%c💡 DICAS:
%c
- Abra a aba Network para ver todas as requisições
- Abra a aba Console para ver os logs detalhados
- Use Ctrl+Shift+R para hard refresh
- Verifique se o backend está rodando na porta 3001
      `, styles.header, '', styles.info, '');
    }
  };
  
  // Mostrar ajuda inicial
  debugLog('✅ Depurador ativado! Digite debugFrontend.help() para ver comandos', 'success');
  
  // Log inicial do estado
  setTimeout(() => {
    debugLog('📊 ESTADO INICIAL:', 'header');
    window.debugFrontend.checkLocalStorage();
    window.debugFrontend.getOrdersFromDOM();
  }, 1000);
  
})();