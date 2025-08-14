const axios = require('axios');

async function testApiEndpoints() {
  try {
    console.log('🧪 Testing API endpoints after API key fix...');
    
    // First, let's try to login to get a token
    console.log('1. Testing login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful, token obtained');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test account endpoint
    console.log('2. Testing account endpoint...');
    try {
      const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
      console.log('✅ Account endpoint working:', accountResponse.data.success);
      console.log('   Balances found:', accountResponse.data.data?.balances?.length || 0);
    } catch (error) {
      console.log('❌ Account endpoint failed:', error.response?.data?.error || error.message);
    }
    
    // Test open orders endpoint
    console.log('3. Testing open orders endpoint...');
    try {
      const ordersResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
      console.log('✅ Open orders endpoint working:', ordersResponse.data.success);
      console.log('   Open orders found:', ordersResponse.data.data?.length || 0);
    } catch (error) {
      console.log('❌ Open orders endpoint failed:', error.response?.data?.error || error.message);
    }
    
    // Test connection endpoint
    console.log('4. Testing connection endpoint...');
    try {
      const connectionResponse = await axios.get('http://localhost:3001/api/trading/test-connection', { headers });
      console.log('✅ Connection test working:', connectionResponse.data.success);
      console.log('   Connected:', connectionResponse.data.data?.connected);
    } catch (error) {
      console.log('❌ Connection test failed:', error.response?.data?.error || error.message);
    }
    
    console.log('\n🎉 API testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testApiEndpoints();