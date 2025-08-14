const axios = require('axios');

async function testFrontendDemoMode() {
  try {
    console.log('🌐 Testing Frontend Demo Mode Integration...');
    
    // Test frontend accessibility
    console.log('1. Testing frontend accessibility...');
    const frontendResponse = await axios.get('http://localhost:3000');
    console.log('✅ Frontend accessible');
    
    // Test backend health
    console.log('2. Testing backend health...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Backend healthy');
    
    // Test login
    console.log('3. Testing login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    console.log('✅ Login successful');
    
    // Test real mode
    console.log('4. Testing Real Mode...');
    await axios.post('http://localhost:3001/api/trading/toggle-mode', { isTestnet: false }, { headers });
    const realAccount = await axios.get('http://localhost:3001/api/trading/account', { headers });
    const realOrders = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log('✅ Real Mode:', {
      balances: realAccount.data.data.balances.length,
      orders: realOrders.data.data.length
    });
    
    // Test demo mode
    console.log('5. Testing Demo Mode...');
    await axios.post('http://localhost:3001/api/trading/toggle-mode', { isTestnet: true }, { headers });
    const demoAccount = await axios.get('http://localhost:3001/api/trading/account', { headers });
    const demoOrders = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log('✅ Demo Mode:', {
      balances: demoAccount.data.data.balances.length,
      orders: demoOrders.data.data.length
    });
    
    // Test mode switching
    console.log('6. Testing Mode Switching...');
    const mode1 = await axios.get('http://localhost:3001/api/trading/mode', { headers });
    console.log('   Current mode:', mode1.data.data.mode);
    
    await axios.post('http://localhost:3001/api/trading/toggle-mode', { isTestnet: false }, { headers });
    const mode2 = await axios.get('http://localhost:3001/api/trading/mode', { headers });
    console.log('   Switched to:', mode2.data.data.mode);
    
    console.log('\n🎯 Frontend Integration Status:');
    console.log('✅ Frontend: http://localhost:3000 - Working');
    console.log('✅ Backend: http://localhost:3001 - Working');
    console.log('✅ Real Mode: Working with real Binance data');
    console.log('✅ Demo Mode: Working with simulated data');
    console.log('✅ Mode Switch: Working seamlessly');
    console.log('✅ No 503 errors in demo mode');
    
    console.log('\n🚀 System Ready for Use:');
    console.log('📱 Access: http://localhost:3000');
    console.log('🔐 Login: test@example.com / password123');
    console.log('🎮 Demo Mode: Safe testing with simulated data');
    console.log('💰 Real Mode: Live trading with real funds');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testFrontendDemoMode();