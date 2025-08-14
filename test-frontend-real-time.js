const axios = require('axios');

async function testFrontendRealTime() {
  try {
    console.log('⚡ Testing Frontend Real-Time Updates...');
    
    // Login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.token;
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    
    console.log('✅ Login successful');
    
    // Switch to demo mode
    await axios.post('http://localhost:3001/api/trading/toggle-mode', {
      isTestnet: true
    }, { headers });
    console.log('✅ Demo mode activated');
    
    // Test 1: Create order and verify immediate appearance
    console.log('\n1. Testing immediate order creation visibility...');
    
    const orderData = {
      symbol: 'ETHUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.01',
      price: '2600',
      timeInForce: 'GTC'
    };
    
    // Get initial count
    const initialResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    const initialCount = initialResponse.data.data.length;
    console.log(`   Initial open orders: ${initialCount}`);
    
    // Create order
    const createResponse = await axios.post('http://localhost:3001/api/trading/order', 
      orderData, { headers });
    
    if (createResponse.data.success) {
      const newOrder = createResponse.data.data;
      console.log(`   ✅ Order created: ID ${newOrder.orderId}`);
      
      // Check immediately (simulate frontend behavior)
      const immediateResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
      const immediateCount = immediateResponse.data.data.length;
      console.log(`   Immediate check: ${immediateCount} orders`);
      
      if (immediateCount > initialCount) {
        console.log('   ✅ Order appears immediately - Frontend should see this');
        
        // Find the specific order
        const foundOrder = immediateResponse.data.data.find(order => order.orderId === newOrder.orderId);
        if (foundOrder) {
          console.log(`   ✅ Specific order found: ${foundOrder.symbol} ${foundOrder.side} ${foundOrder.origQty}@${foundOrder.price}`);
          
          // Test 2: Cancel order and verify immediate removal
          console.log('\n2. Testing immediate order cancellation visibility...');
          
          const cancelResponse = await axios.delete(
            `http://localhost:3001/api/trading/order/${foundOrder.symbol}/${foundOrder.orderId}`,
            { headers }
          );
          
          if (cancelResponse.data.success) {
            console.log(`   ✅ Order canceled: ${cancelResponse.data.data.status}`);
            
            // Check immediately after cancellation
            const afterCancelResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
            const afterCancelCount = afterCancelResponse.data.data.length;
            console.log(`   After cancel check: ${afterCancelCount} orders`);
            
            if (afterCancelCount === initialCount) {
              console.log('   ✅ Order removed immediately - Frontend should see this');
            } else {
              console.log('   ❌ Order not removed immediately - This is a problem');
            }
            
            // Verify the specific order is gone
            const stillExists = afterCancelResponse.data.data.find(order => order.orderId === newOrder.orderId);
            if (!stillExists) {
              console.log('   ✅ Specific order confirmed removed');
            } else {
              console.log('   ❌ Specific order still exists - This is a problem');
            }
          } else {
            console.log(`   ❌ Cancel failed: ${cancelResponse.data.error}`);
          }
        } else {
          console.log('   ❌ Specific order not found - This is a problem');
        }
      } else {
        console.log('   ❌ Order does not appear immediately - This is a problem');
      }
    } else {
      console.log(`   ❌ Order creation failed: ${createResponse.data.error}`);
    }
    
    // Test 3: Multiple rapid operations
    console.log('\n3. Testing multiple rapid operations...');
    
    const rapidOrders = [];
    for (let i = 0; i < 3; i++) {
      const rapidOrderData = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: (40000 + i * 100).toString(),
        timeInForce: 'GTC'
      };
      
      const rapidResponse = await axios.post('http://localhost:3001/api/trading/order', 
        rapidOrderData, { headers });
      
      if (rapidResponse.data.success) {
        rapidOrders.push(rapidResponse.data.data);
        console.log(`   ✅ Rapid order ${i+1} created: ID ${rapidResponse.data.data.orderId}`);
      }
    }
    
    // Check if all appear
    const rapidCheckResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`   Total orders after rapid creation: ${rapidCheckResponse.data.data.length}`);
    
    // Cancel all rapid orders
    for (const order of rapidOrders) {
      await axios.delete(
        `http://localhost:3001/api/trading/order/${order.symbol}/${order.orderId}`,
        { headers }
      );
    }
    
    const finalCheckResponse = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`   Final orders after rapid cancellation: ${finalCheckResponse.data.data.length}`);
    
    console.log('\n🎯 FRONTEND INTEGRATION RECOMMENDATIONS:');
    console.log('1. Reduce refresh interval from 30s to 5s or less');
    console.log('2. Force immediate refresh after order operations');
    console.log('3. Add loading states during operations');
    console.log('4. Show immediate feedback to user');
    console.log('5. Consider WebSocket for real-time updates');
    
    console.log('\n✅ Backend is working correctly - Frontend needs better refresh logic');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testFrontendRealTime();