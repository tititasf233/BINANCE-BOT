const axios = require('axios');

async function createTestUser() {
  try {
    console.log('👤 Creating new test user...');
    
    // Create a new user
    const newUser = {
      name: 'Frontend Test User',
      email: 'frontend@test.com',
      password: 'password123'
    };
    
    try {
      const registerResponse = await axios.post('http://localhost:3001/api/auth/register', newUser);
      console.log('✅ User created successfully:', registerResponse.data.data?.user?.email);
    } catch (regError) {
      if (regError.response?.data?.error?.includes('already exists')) {
        console.log('ℹ️ User already exists, proceeding with login test...');
      } else {
        console.log('❌ Registration failed:', regError.response?.data?.error || regError.message);
        return;
      }
    }
    
    // Now test login and auto API key creation
    console.log('🔐 Testing login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: newUser.email,
      password: newUser.password
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.error);
      return;
    }
    
    console.log('✅ Login successful');
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}` };
    
    // Test auto API key creation
    console.log('🔧 Testing auto API key creation...');
    
    try {
      const modeResponse = await axios.get('http://localhost:3001/api/trading/mode', { headers });
      console.log('✅ Trading mode endpoint working:', modeResponse.data.data.mode);
      console.log('   API keys were auto-created!');
      
      const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
      console.log('✅ Account endpoint working');
      console.log('   Balances found:', accountResponse.data.data?.balances?.length || 0);
      
      const ordersResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
      console.log('✅ Open orders endpoint working');
      console.log('   Open orders found:', ordersResponse.data.data?.length || 0);
      
      console.log('\n🎉 SUCCESS! Auto API key creation is working!');
      console.log('📧 Test user: frontend@test.com');
      console.log('🔑 Password: password123');
      console.log('✅ This user now has working Binance API keys');
      
    } catch (apiError) {
      console.log('❌ API endpoints failed:', apiError.response?.data?.error || apiError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

createTestUser();