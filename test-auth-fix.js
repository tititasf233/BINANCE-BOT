// Script para testar se os erros 403 foram corrigidos
const puppeteer = require('puppeteer');

async function testAuthFix() {
  console.log('🔐 Testando correção dos erros 403...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Interceptar requisições de rede para monitorar erros
    const networkRequests = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        networkRequests.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // 1. Fazer login
    console.log('🔐 Fazendo login...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', 'interface@teste.com');
    await page.type('input[name="password"]', 'senha123');
    await page.click('button[type="submit"]');
    
    // 2. Aguardar dashboard carregar
    console.log('📊 Aguardando dashboard carregar...');
    await page.waitForSelector('.bg-white\\/10', { timeout: 15000 });
    
    // 3. Aguardar um tempo para as requisições serem feitas
    console.log('⏳ Aguardando requisições automáticas...');
    await page.waitForTimeout(10000);
    
    // 4. Analisar requisições
    console.log('📊 Analisando requisições de rede...');
    
    const tradingRequests = networkRequests.filter(req => 
      req.url.includes('/api/trading/')
    );
    
    const authRequests = networkRequests.filter(req => 
      req.url.includes('/api/auth/')
    );
    
    const marketRequests = networkRequests.filter(req => 
      req.url.includes('/api/market/')
    );
    
    console.log(`\n📈 Requisições de Trading: ${tradingRequests.length}`);
    tradingRequests.forEach(req => {
      const status = req.status === 200 ? '✅' : req.status === 403 ? '❌' : '⚠️';
      console.log(`  ${status} ${req.status} - ${req.url}`);
    });
    
    console.log(`\n🔐 Requisições de Auth: ${authRequests.length}`);
    authRequests.forEach(req => {
      const status = req.status === 200 ? '✅' : '❌';
      console.log(`  ${status} ${req.status} - ${req.url}`);
    });
    
    console.log(`\n💹 Requisições de Market: ${marketRequests.length}`);
    marketRequests.forEach(req => {
      const status = req.status === 200 ? '✅' : '❌';
      console.log(`  ${status} ${req.status} - ${req.url}`);
    });
    
    // 5. Verificar se há erros 403
    const errors403 = networkRequests.filter(req => req.status === 403);
    const errors400 = networkRequests.filter(req => req.status === 400);
    const success200 = networkRequests.filter(req => req.status === 200);
    
    console.log(`\n📊 Resumo dos Status:`);
    console.log(`  ✅ Status 200 (Sucesso): ${success200.length}`);
    console.log(`  ❌ Status 403 (Forbidden): ${errors403.length}`);
    console.log(`  ❌ Status 400 (Bad Request): ${errors400.length}`);
    
    if (errors403.length === 0 && errors400.length === 0) {
      console.log('\n🎉 SUCESSO! Nenhum erro 403 ou 400 encontrado!');
      console.log('✅ Sistema de autenticação funcionando corretamente');
    } else {
      console.log('\n⚠️ Ainda há erros:');
      if (errors403.length > 0) {
        console.log('❌ Erros 403 (Token inválido/expirado):');
        errors403.forEach(req => console.log(`  - ${req.url}`));
      }
      if (errors400.length > 0) {
        console.log('❌ Erros 400 (Bad Request):');
        errors400.forEach(req => console.log(`  - ${req.url}`));
      }
    }
    
    // 6. Testar botão de atualizar manualmente
    console.log('\n🔄 Testando atualização manual...');
    const refreshButton = await page.$('button:has-text("Atualizar")');
    if (refreshButton) {
      await refreshButton.click();
      await page.waitForTimeout(3000);
      console.log('✅ Botão de atualização testado');
    }
    
    // 7. Verificar se dados estão sendo exibidos
    console.log('\n📋 Verificando dados na interface...');
    
    const dollarValues = await page.$$eval('*', elements => 
      Array.from(elements)
        .map(el => el.textContent)
        .filter(text => text && text.includes('$'))
        .slice(0, 5)
    );
    
    console.log(`✅ Valores monetários encontrados: ${dollarValues.length}`);
    if (dollarValues.length > 0) {
      console.log('  Exemplos:', dollarValues.slice(0, 3));
    }
    
    console.log('\n🎯 Teste finalizado!');
    console.log('🔍 Navegador mantido aberto para inspeção...');
    console.log('Pressione Ctrl+C para fechar');
    
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testAuthFix().catch(console.error);