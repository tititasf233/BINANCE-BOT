const axios = require('axios');

async function debugRealFunctionality() {
  try {
    console.log('🔍 Debugging Real Functionality Issues...');
    
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
    
    // Step 1: Check initial state
    console.log('\n1. Checking initial state...');
    const initialOrders = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`   Initial open orders: ${initialOrders.data.data.length}`);
    initialOrders.data.data.forEach((order, i) => {
      console.log(`     ${i+1}. ${order.symbol} ${order.side} ${order.origQty}@${order.price} (ID: ${order.orderId})`);
    });
    
    // Step 2: Create a new order
    console.log('\n2. Creating a new order...');
    const newOrderData = {
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.001',
      price: '41000',
      timeInForce: 'GTC'
    };
    
    const createResponse = await axios.post('http://localhost:3001/api/trading/order', 
      newOrderData, { headers });
    
    if (createResponse.data.success) {
      const newOrder = createResponse.data.data;
      console.log(`   ✅ Order created: ID ${newOrder.orderId}, Status: ${newOrder.status}`);
      
      // Step 3: Immediately check if it appears in open orders
      console.log('\n3. Checking if order appears in open orders...');
      const afterCreateOrders = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
      console.log(`   Open orders after creation: ${afterCreateOrders.data.data.length}`);
      
      const foundOrder = afterCreateOrders.data.data.find(order => order.orderId === newOrder.orderId);
      if (foundOrder) {
        console.log(`   ✅ Order found: ${foundOrder.symbol} ${foundOrder.side} ${foundOrder.origQty}@${foundOrder.price}`);
        
        // Step 4: Try to cancel the order
        console.log('\n4. Attempting to cancel the order...');
        const cancelResponse = await axios.delete(
          `http://localhost:3001/api/trading/order/${foundOrder.symbol}/${foundOrder.orderId}`,
          { headers }
        );
        
        if (cancelResponse.data.success) {
          console.log(`   ✅ Cancel response: ${cancelResponse.data.data.status}`);
          
          // Step 5: Check if order is removed from open orders
          console.log('\n5. Checking if order is removed from open orders...');
          const afterCancelOrders = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
          console.log(`   Open orders after cancellation: ${afterCancelOrders.data.data.length}`);
          
          const stillExists = afterCancelOrders.data.data.find(order => order.orderId === newOrder.orderId);
          if (stillExists) {
            console.log(`   ❌ PROBLEM: Order still exists in open orders!`);
            console.log(`       This is the bug - canceled orders should be removed`);
          } else {
            console.log(`   ✅ Order correctly removed from open orders`);
          }
        } else {
          console.log(`   ❌ Cancel failed: ${cancelResponse.data.error}`);
        }
      } else {
        console.log(`   ❌ PROBLEM: Order not found in open orders!`);
        console.log(`       This is the bug - created orders should appear immediately`);
      }
      
      // Step 6: Check trade history
      console.log('\n6. Checking trade history...');
      const historyResponse = await axios.get('http://localhost:3001/api/trading/trades/history?limit=5', { headers });
      console.log(`   Trade history entries: ${historyResponse.data.data.length}`);
      const recentTrade = historyResponse.data.data.find(trade => 
        trade.binance_order_id === newOrder.orderId.toString()
      );
      if (recentTrade) {
        console.log(`   ✅ Trade found in history: ${recentTrade.symbol} ${recentTrade.side} ${recentTrade.status}`);
      } else {
        console.log(`   ❌ Trade not found in history`);
      }
    } else {
      console.log(`   ❌ Order creation failed: ${createResponse.data.error}`);
    }
    
    console.log('\n🎯 DIAGNOSIS:');
    console.log('The issue is that the mock system is not properly synchronized.');
    console.log('Orders are saved to database but mock data is not updated accordingly.');
    console.log('Need to fix the mock system to reflect real database state.');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.response?.data || error.message);
  }
}

debugRealFunctionality();