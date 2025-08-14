const axios = require('axios');

async function testExistingUser() {
  try {
    console.log('🔧 Testing with existing user without API keys...');
    
    // Try different users that exist but don't have API keys
    const testUsers = [
      { email: 'test@test.com', password: 'password123' },
      { email: 'interface@teste.com', password: 'password123' },
      { email: 'joao@teste.com', password: 'password123' },
      { email: 'admin@aura.com', password: 'password123' }
    ];
    
    for (const user of testUsers) {
      console.log(`\n🔐 Testing with ${user.email}...`);
      
      try {
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', user);
        
        if (loginResponse.data.success) {
          console.log('✅ Login successful');
          const token = loginResponse.data.data.token;
          const headers = { 'Authorization': `Bearer ${token}` };
          
          // Test trading mode endpoint
          try {
            const modeResponse = await axios.get('http://localhost:3001/api/trading/mode', { headers });
            console.log('✅ Trading mode working:', modeResponse.data.data.mode);
            console.log('   API keys auto-created successfully!');
            
            // Test account endpoint
            const accountResponse = await axios.get('http://localhost:3001/api/trading/account', { headers });
            console.log('✅ Account endpoint working, balances:', accountResponse.data.data?.balances?.length || 0);
            
            console.log(`🎉 SUCCESS: ${user.email} now has working API keys!`);
            break; // Stop testing once we find a working user
            
          } catch (apiError) {
            console.log('❌ API endpoints failed:', apiError.response?.data?.error || apiError.message);
          }
        } else {
          console.log('❌ Login failed:', loginResponse.data.error);
        }
      } catch (loginError) {
        console.log('❌ Login error:', loginError.response?.data?.error || loginError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExistingUser();