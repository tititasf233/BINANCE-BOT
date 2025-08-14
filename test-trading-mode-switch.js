const axios = require('axios');

async function testTradingModeSwitch() {
  try {
    console.log('🧪 Testing Trading Mode Switch functionality...');
    
    // Login first
    console.log('1. Logging in...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // Test getting current mode
    console.log('2. Getting current trading mode...');
    try {
      const modeResponse = await axios.get('http://localhost:3001/api/trading/mode', { headers });
      console.log('✅ Current mode:', modeResponse.data.data.mode);
      console.log('   Is Testnet:', modeResponse.data.data.isTestnet);
      
      const currentMode = modeResponse.data.data.isTestnet;
      
      // Test switching mode
      console.log('3. Switching trading mode...');
      const toggleResponse = await axios.post('http://localhost:3001/api/trading/toggle-mode', {
        isTestnet: !currentMode
      }, { headers });
      
      console.log('✅ Mode switched:', toggleResponse.data.data.mode);
      console.log('   Message:', toggleResponse.data.data.message);
      
      // Verify the change
      console.log('4. Verifying mode change...');
      const verifyResponse = await axios.get('http://localhost:3001/api/trading/mode', { headers });
      console.log('✅ New mode:', verifyResponse.data.data.mode);
      
      // Switch back to original mode
      console.log('5. Switching back to original mode...');
      const switchBackResponse = await axios.post('http://localhost:3001/api/trading/toggle-mode', {
        isTestnet: currentMode
      }, { headers });
      
      console.log('✅ Switched back:', switchBackResponse.data.data.mode);
      
    } catch (error) {
      console.log('❌ Mode operations failed:', error.response?.data?.error || error.message);
    }
    
    // Test API endpoints with current mode
    console.log('6. Testing API endpoints...');
    try {
      const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
      console.log('✅ Account endpoint working:', accountResponse.data.success);
      console.log('   Balances found:', accountResponse.data.data?.balances?.length || 0);
    } catch (error) {
      console.log('❌ Account endpoint failed:', error.response?.data?.error || error.message);
    }
    
    try {
      const ordersResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
      console.log('✅ Open orders endpoint working:', ordersResponse.data.success);
      console.log('   Open orders found:', ordersResponse.data.data?.length || 0);
    } catch (error) {
      console.log('❌ Open orders endpoint failed:', error.response?.data?.error || error.message);
    }
    
    console.log('\n🎉 Trading Mode Switch testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Wait for services to be ready
setTimeout(() => {
  testTradingModeSwitch();
}, 5000);