const axios = require('axios');

async function testDemoModeIssue() {
  try {
    console.log('🧪 Testing Demo Mode Issue...');
    
    // Login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    console.log('✅ Login successful');
    
    // Check current mode
    console.log('1. Checking current mode...');
    const currentMode = await axios.get('http://localhost:3001/api/trading/mode', { headers });
    console.log('   Current mode:', currentMode.data.data.mode);
    
    // Test account in current mode
    console.log('2. Testing account in current mode...');
    try {
      const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
      console.log('✅ Account working in current mode');
      console.log('   Balances:', accountResponse.data.data?.balances?.length || 0);
    } catch (error) {
      console.log('❌ Account failed in current mode:', error.response?.data?.error || error.message);
    }
    
    // Switch to demo mode
    console.log('3. Switching to demo mode...');
    try {
      const switchResponse = await axios.post('http://localhost:3001/api/trading/toggle-mode', {
        isTestnet: true
      }, { headers });
      console.log('✅ Switched to demo mode:', switchResponse.data.data.mode);
    } catch (error) {
      console.log('❌ Failed to switch to demo mode:', error.response?.data?.error || error.message);
      return;
    }
    
    // Test account in demo mode
    console.log('4. Testing account in demo mode...');
    try {
      const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
      console.log('✅ Account working in demo mode');
      console.log('   Balances:', accountResponse.data.data?.balances?.length || 0);
    } catch (error) {
      console.log('❌ Account failed in demo mode:', error.response?.data?.error || error.message);
      console.log('   This is the problem! Real API keys don\'t work with testnet');
    }
    
    // Test orders in demo mode
    console.log('5. Testing orders in demo mode...');
    try {
      const ordersResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
      console.log('✅ Orders working in demo mode');
      console.log('   Orders:', ordersResponse.data.data?.length || 0);
    } catch (error) {
      console.log('❌ Orders failed in demo mode:', error.response?.data?.error || error.message);
    }
    
    // Switch back to real mode
    console.log('6. Switching back to real mode...');
    try {
      const switchBackResponse = await axios.post('http://localhost:3001/api/trading/toggle-mode', {
        isTestnet: false
      }, { headers });
      console.log('✅ Switched back to real mode:', switchBackResponse.data.data.mode);
      
      // Test account in real mode again
      const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
      console.log('✅ Account working in real mode again');
      console.log('   Balances:', accountResponse.data.data?.balances?.length || 0);
      
    } catch (error) {
      console.log('❌ Failed to switch back:', error.response?.data?.error || error.message);
    }
    
    console.log('\n🎯 Problem Analysis:');
    console.log('❌ Real API keys don\'t work with Binance testnet');
    console.log('💡 Solution: Implement mock data for demo mode');
    console.log('🔧 Or: Get separate testnet API keys from https://testnet.binance.vision/');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testDemoModeIssue();