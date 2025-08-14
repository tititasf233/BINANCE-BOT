const axios = require('axios');

async function testCorrectUserLogin() {
  try {
    console.log('🔐 Testing login with correct user (test@example.com)...');
    
    // Login with the user that has API keys
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.error);
      return;
    }
    
    console.log('✅ Login successful with test@example.com');
    const token = loginResponse.data.data.token;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test trading mode endpoint
    console.log('1. Testing trading mode endpoint...');
    try {
      const modeResponse = await axios.get('http://localhost:3001/api/trading/mode', { headers });
      console.log('✅ Trading mode:', modeResponse.data.data.mode);
      console.log('   Is Testnet:', modeResponse.data.data.isTestnet);
    } catch (error) {
      console.log('❌ Mode endpoint failed:', error.response?.data?.error || error.message);
    }
    
    // Test account endpoint
    console.log('2. Testing account endpoint...');
    try {
      const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
      console.log('✅ Account endpoint working');
      console.log('   Balances found:', accountResponse.data.data?.balances?.length || 0);
    } catch (error) {
      console.log('❌ Account endpoint failed:', error.response?.data?.error || error.message);
    }
    
    // Test open orders endpoint
    console.log('3. Testing open orders endpoint...');
    try {
      const ordersResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
      console.log('✅ Open orders endpoint working');
      console.log('   Open orders found:', ordersResponse.data.data?.length || 0);
    } catch (error) {
      console.log('❌ Open orders endpoint failed:', error.response?.data?.error || error.message);
    }
    
    console.log('\n🎯 Summary:');
    console.log('✅ Use email: test@example.com');
    console.log('✅ Use password: password123');
    console.log('✅ This user has the real Binance API keys configured');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testCorrectUserLogin();