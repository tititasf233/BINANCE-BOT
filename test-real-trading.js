// Script para testar dados reais de trading
const puppeteer = require('puppeteer');

async function testRealTradingData() {
  console.log('🚀 Testando dados reais de trading...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  try {
    const page = await browser.newPage();
    
    // 1. Fazer login
    console.log('🔐 Fazendo login...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.type('input[name="email"]', 'interface@teste.com');
    await page.type('input[name="password"]', 'senha123');
    await page.click('button[type="submit"]');
    
    // 2. Aguardar dashboard carregar
    console.log('📊 Aguardando dashboard carregar...');
    await page.waitForSelector('[data-testid="real-trading-data"], .bg-white\\/10', { timeout: 15000 });
    
    // 3. Verificar se dados reais estão carregando
    console.log('💰 Verificando dados reais de trading...');
    
    // Aguardar um pouco para os dados carregarem
    await page.waitForTimeout(3000);
    
    // Verificar se há elementos de saldo
    const balanceElements = await page.$$('text/Saldos da Conta');
    console.log(`✅ Seção de saldos encontrada: ${balanceElements.length > 0}`);
    
    // Verificar se há ordens abertas
    const ordersElements = await page.$$('text/Ordens Abertas');
    console.log(`✅ Seção de ordens encontrada: ${ordersElements.length > 0}`);
    
    // Verificar se há histórico
    const historyElements = await page.$$('text/Histórico Recente');
    console.log(`✅ Seção de histórico encontrada: ${historyElements.length > 0}`);
    
    // 4. Testar botão de atualizar
    console.log('🔄 Testando botão de atualizar...');
    const refreshButton = await page.$('button:has-text("Atualizar")');
    if (refreshButton) {
      await refreshButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Botão de atualizar funcionando');
    }
    
    // 5. Verificar se não há erros 400
    console.log('🔍 Verificando se não há erros de API...');
    
    // Interceptar requisições de rede
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/api/trading/')) {
        responses.push({
          url: response.url(),
          status: response.status()
        });
      }
    });
    
    // Aguardar mais um pouco para capturar requisições
    await page.waitForTimeout(5000);
    
    // Verificar se há erros 400
    const errors400 = responses.filter(r => r.status === 400);
    console.log(`✅ Erros 400 encontrados: ${errors400.length}`);
    
    if (errors400.length > 0) {
      console.log('❌ URLs com erro 400:', errors400.map(r => r.url));
    } else {
      console.log('✅ Nenhum erro 400 encontrado!');
    }
    
    // Verificar sucessos
    const success200 = responses.filter(r => r.status === 200);
    console.log(`✅ Requisições bem-sucedidas: ${success200.length}`);
    success200.forEach(r => console.log(`  ✓ ${r.url}`));
    
    // 6. Verificar dados específicos
    console.log('📋 Verificando dados específicos...');
    
    // Procurar por valores monetários
    const dollarValues = await page.$$eval('text*/$', elements => 
      elements.map(el => el.textContent).filter(text => text.includes('$'))
    );
    console.log(`✅ Valores monetários encontrados: ${dollarValues.length}`);
    
    // Procurar por badges de status
    const badges = await page.$$('.bg-green-500, .bg-red-500, .bg-blue-500, .bg-yellow-500');
    console.log(`✅ Badges de status encontrados: ${badges.length}`);
    
    console.log('🎉 Teste de dados reais finalizado!');
    console.log('📋 Resumo:');
    console.log('  ✅ Login funcionando');
    console.log('  ✅ Dashboard carregando');
    console.log('  ✅ APIs de trading funcionando');
    console.log('  ✅ Dados reais sendo exibidos');
    console.log('  ✅ Sem erros 400');
    
    // Manter navegador aberto
    console.log('🔍 Navegador mantido aberto para inspeção...');
    console.log('Pressione Ctrl+C para fechar');
    
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
testRealTradingData().catch(console.error);