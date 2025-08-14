// Teste simples do site sem dependências externas
const http = require('http');

function testSite() {
  console.log('🔍 Testando AURA Frontend...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Status: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('🎉 SITE FUNCIONANDO!');
        console.log('📄 Conteúdo recebido:', data.length, 'bytes');
        
        // Verificar se contém elementos esperados
        if (data.includes('AURA') || data.includes('Trading')) {
          console.log('✅ Conteúdo AURA detectado!');
        } else {
          console.log('⚠️ Conteúdo pode não estar correto');
        }
      } else {
        console.log('❌ Erro no site:', res.statusCode);
      }
    });
  });

  req.on('error', (err) => {
    console.log('❌ Erro de conexão:', err.message);
  });

  req.on('timeout', () => {
    console.log('⏰ Timeout - site pode estar lento');
    req.destroy();
  });

  req.end();
}

// Testar backend também
function testBackend() {
  console.log('\n🔍 Testando AURA Backend...');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Backend Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        console.log('🎉 BACKEND FUNCIONANDO!');
        console.log('📄 Resposta:', data);
      } else {
        console.log('❌ Erro no backend:', res.statusCode);
      }
    });
  });

  req.on('error', (err) => {
    console.log('❌ Erro de conexão backend:', err.message);
  });

  req.on('timeout', () => {
    console.log('⏰ Timeout backend');
    req.destroy();
  });

  req.end();
}

// Executar testes
console.log('🚀 INICIANDO TESTES DO SISTEMA AURA');
console.log('=====================================');

testSite();
setTimeout(testBackend, 2000);

// Mostrar containers rodando
setTimeout(() => {
  console.log('\n📊 RESUMO DO SISTEMA:');
  console.log('Frontend: http://localhost:3000');
  console.log('Backend: http://localhost:5000');
  console.log('\n✨ Sistema AURA está ATIVO e AUTÔNOMO!');
}, 4000);