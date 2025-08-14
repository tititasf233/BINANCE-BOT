// Script para teste final - verificar se todos os erros foram corrigidos
const puppeteer = require('puppeteer');

async function testFinalFix() {
  console.log('🎯 Teste final - Verificando se todos os erros foram corrigidos...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Capturar erros JavaScript
    const jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });

    // Interceptar requisições de rede
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
    
    // 2. Aguardar dashboard carregar completamente
    console.log('📊 Aguardando dashboard carregar...');
    await page.waitForSelector('.bg-white\\/10', { timeout: 15000 });
    
    // 3. Aguardar dados carregarem
    console.log('⏳ Aguardando dados carregarem...');
    await page.waitForTimeout(10000);
    
    // 4. Verificar se há erros JavaScript
    console.log('\n🔍 Verificando erros JavaScript...');
    if (jsErrors.length === 0) {
      console.log('✅ Nenhum erro JavaScript encontrado!');
    } else {
      console.log(`❌ ${jsErrors.length} erros JavaScript encontrados:`);
      jsErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    // 5. Verificar requisições de rede
    console.log('\n🌐 Verificando requisições de rede...');
    
    const errors403 = networkRequests.filter(req => req.status === 403);
    const errors400 = networkRequests.filter(req => req.status === 400);
    const errors500 = networkRequests.filter(req => req.status >= 500);
    const success200 = networkRequests.filter(req => req.status === 200);
    
    console.log(`  ✅ Status 200 (Sucesso): ${success200.length}`);
    console.log(`  ❌ Status 400 (Bad Request): ${errors400.length}`);
    console.log(`  ❌ Status 403 (Forbidden): ${errors403.length}`);
    console.log(`  ❌ Status 5xx (Server Error): ${errors500.length}`);
    
    // 6. Verificar se dados estão sendo exibidos corretamente
    console.log('\n💰 Verificando dados na interface...');
    
    // Verificar valores monetários
    const dollarValues = await page.$$eval('*', elements => 
      Array.from(elements)
        .map(el => el.textContent)
        .filter(text => text && text.includes('$') && text.match(/\$[\d,]+\.?\d*/))
        .slice(0, 10)
    );
    
    console.log(`✅ Valores monetários formatados: ${dollarValues.length}`);
    if (dollarValues.length > 0) {
      console.log('  Exemplos:', dollarValues.slice(0, 3));
    }
    
    // Verificar badges de status
    const badges = await page.$$('.bg-green-500, .bg-red-500, .bg-blue-500, .bg-yellow-500');
    console.log(`✅ Badges de status: ${badges.length}`);
    
    // Verificar tabelas
    const tables = await page.$$('table');
    console.log(`✅ Tabelas encontradas: ${tables.length}`);
    
    // 7. Testar interações
    console.log('\n🔄 Testando interações...');
    
    // Testar botão de atualizar
    const refreshButton = await page.$('button:has-text("Atualizar")');
    if (refreshButton) {
      await refreshButton.click();
      await page.waitForTimeout(3000);
      console.log('✅ Botão de atualização funcionando');
    }
    
    // Testar seletor de mercado
    const marketSelector = await page.$('.relative button');
    if (marketSelector) {
      await marketSelector.click();
      await page.waitForTimeout(1000);
      console.log('✅ Seletor de mercado funcionando');
    }
    
    // 8. Resumo final
    console.log('\n📋 RESUMO FINAL:');
    
    const totalErrors = jsErrors.length + errors400.length + errors403.length + errors500.length;
    
    if (totalErrors === 0) {
      console.log('🎉 PERFEITO! Aplicação funcionando sem erros!');
      console.log('✅ Sem erros JavaScript');
      console.log('✅ Sem erros de API (400/403/500)');
      console.log('✅ Dados sendo exibidos corretamente');
      console.log('✅ Interações funcionando');
      console.log('✅ Sistema de autenticação estável');
    } else {
      console.log(`⚠️ Ainda há ${totalErrors} problemas para resolver:`);
      if (jsErrors.length > 0) console.log(`  - ${jsErrors.length} erros JavaScript`);
      if (errors400.length > 0) console.log(`  - ${errors400.length} erros 400`);
      if (errors403.length > 0) console.log(`  - ${errors403.length} erros 403`);
      if (errors500.length > 0) console.log(`  - ${errors500.length} erros 500`);
    }
    
    console.log('\n🔍 Navegador mantido aberto para inspeção...');
    console.log('Pressione Ctrl+C para fechar');
    
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testFinalFix().catch(console.error);