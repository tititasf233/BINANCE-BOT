const axios = require('axios');

async function debugDeepFrontendIssue() {
  try {
    console.log('🔍 DEEP DEBUG: Frontend Issue Investigation');
    console.log('==========================================\n');
    
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
    console.log('✅ Demo mode activated\n');
    
    // STEP 1: Check what the user sees initially
    console.log('STEP 1: Initial State (What user sees when opening app)');
    console.log('-----------------------------------------------------');
    
    const initialOrders = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`Initial open orders: ${initialOrders.data.data.length}`);
    
    if (initialOrders.data.data.length > 0) {
      console.log('Existing orders:');
      initialOrders.data.data.forEach((order, i) => {
        console.log(`  ${i+1}. ID: ${order.orderId}, ${order.symbol} ${order.side} ${order.origQty}@${order.price} (${order.status})`);
      });
    } else {
      console.log('No existing orders');
    }
    
    // STEP 2: User creates a new order
    console.log('\nSTEP 2: User Creates New Order');
    console.log('------------------------------');
    
    const newOrderData = {
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.001',
      price: '43000',
      timeInForce: 'GTC'
    };
    
    console.log('Creating order with data:', newOrderData);
    
    const createResponse = await axios.post('http://localhost:3001/api/trading/order', 
      newOrderData, { headers });
    
    console.log('Create response status:', createResponse.status);
    console.log('Create response data:', JSON.stringify(createResponse.data, null, 2));
    
    if (!createResponse.data.success) {
      console.log('❌ ORDER CREATION FAILED!');
      console.log('Error:', createResponse.data.error);
      return;
    }
    
    const createdOrder = createResponse.data.data;
    console.log(`✅ Order created: ID ${createdOrder.orderId}, Status: ${createdOrder.status}`);
    
    // STEP 3: Check if order appears immediately (what frontend should see)
    console.log('\nSTEP 3: Immediate Check (What frontend should see right after creation)');
    console.log('-----------------------------------------------------------------------');
    
    const immediateCheck = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`Orders after creation: ${immediateCheck.data.data.length}`);
    
    const foundOrder = immediateCheck.data.data.find(order => order.orderId === createdOrder.orderId);
    
    if (foundOrder) {
      console.log('✅ NEW ORDER FOUND in open orders:');
      console.log(`   ID: ${foundOrder.orderId}`);
      console.log(`   Symbol: ${foundOrder.symbol}`);
      console.log(`   Side: ${foundOrder.side}`);
      console.log(`   Quantity: ${foundOrder.origQty}`);
      console.log(`   Price: ${foundOrder.price}`);
      console.log(`   Status: ${foundOrder.status}`);
      console.log(`   Time: ${new Date(foundOrder.time).toLocaleString()}`);
    } else {
      console.log('❌ NEW ORDER NOT FOUND in open orders!');
      console.log('This is the problem - order was created but not appearing in list');
      
      // Debug: Check all orders
      console.log('\nAll orders in response:');
      immediateCheck.data.data.forEach((order, i) => {
        console.log(`  ${i+1}. ID: ${order.orderId}, ${order.symbol} ${order.side} ${order.origQty}@${order.price}`);
      });
      
      return;
    }
    
    // STEP 4: User tries to cancel the order
    console.log('\nSTEP 4: User Tries to Cancel Order');
    console.log('----------------------------------');
    
    console.log(`Attempting to cancel order ID ${foundOrder.orderId}...`);
    
    const cancelResponse = await axios.delete(
      `http://localhost:3001/api/trading/order/${foundOrder.symbol}/${foundOrder.orderId}`,
      { headers }
    );
    
    console.log('Cancel response status:', cancelResponse.status);
    console.log('Cancel response data:', JSON.stringify(cancelResponse.data, null, 2));
    
    if (!cancelResponse.data.success) {
      console.log('❌ ORDER CANCELLATION FAILED!');
      console.log('Error:', cancelResponse.data.error);
      return;
    }
    
    console.log(`✅ Order canceled: ${cancelResponse.data.data.status}`);
    
    // STEP 5: Check if order is removed (what frontend should see)
    console.log('\nSTEP 5: Check After Cancellation (What frontend should see)');
    console.log('-----------------------------------------------------------');
    
    const afterCancelCheck = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`Orders after cancellation: ${afterCancelCheck.data.data.length}`);
    
    const stillExists = afterCancelCheck.data.data.find(order => order.orderId === createdOrder.orderId);
    
    if (stillExists) {
      console.log('❌ ORDER STILL EXISTS after cancellation!');
      console.log('This is the problem - order was canceled but still appearing in list');
      console.log(`   Still showing: ID ${stillExists.orderId}, Status: ${stillExists.status}`);
      return;
    } else {
      console.log('✅ ORDER CORRECTLY REMOVED from open orders');
    }
    
    // STEP 6: Check trade history
    console.log('\nSTEP 6: Check Trade History');
    console.log('---------------------------');
    
    const historyResponse = await axios.get('http://localhost:3001/api/trading/trades/history?limit=5', { headers });
    console.log(`Trade history entries: ${historyResponse.data.data.length}`);
    
    const ourTrades = historyResponse.data.data.filter(trade => 
      trade.binance_order_id === createdOrder.orderId.toString()
    );
    
    console.log(`Our trades in history: ${ourTrades.length}`);
    ourTrades.forEach((trade, i) => {
      console.log(`  ${i+1}. ${trade.symbol} ${trade.side} ${trade.quantity} @ ${trade.status}`);
    });
    
    // STEP 7: Test rapid operations (what might break frontend)
    console.log('\nSTEP 7: Test Rapid Operations (Stress Test)');
    console.log('-------------------------------------------');
    
    console.log('Creating 3 orders rapidly...');
    const rapidOrders = [];
    
    for (let i = 0; i < 3; i++) {
      const rapidOrderData = {
        symbol: 'ETHUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.01',
        price: (2500 + i * 10).toString(),
        timeInForce: 'GTC'
      };
      
      const rapidResponse = await axios.post('http://localhost:3001/api/trading/order', 
        rapidOrderData, { headers });
      
      if (rapidResponse.data.success) {
        rapidOrders.push(rapidResponse.data.data);
        console.log(`  Order ${i+1} created: ID ${rapidResponse.data.data.orderId}`);
      } else {
        console.log(`  Order ${i+1} failed: ${rapidResponse.data.error}`);
      }
      
      // Small delay to simulate user actions
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check if all appear
    const rapidCheck = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`Total orders after rapid creation: ${rapidCheck.data.data.length}`);
    
    // Cancel all rapidly
    console.log('Canceling all rapid orders...');
    for (let i = 0; i < rapidOrders.length; i++) {
      const order = rapidOrders[i];
      try {
        await axios.delete(
          `http://localhost:3001/api/trading/order/${order.symbol}/${order.orderId}`,
          { headers }
        );
        console.log(`  Order ${i+1} canceled: ID ${order.orderId}`);
      } catch (error) {
        console.log(`  Order ${i+1} cancel failed: ${error.response?.data?.error || error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const finalCheck = await axios.get('http://localhost:3001/api/trading/orders/open', { headers });
    console.log(`Final orders after rapid cancellation: ${finalCheck.data.data.length}`);
    
    console.log('\n🎯 DIAGNOSIS SUMMARY');
    console.log('===================');
    
    if (foundOrder && !stillExists) {
      console.log('✅ BACKEND IS WORKING CORRECTLY');
      console.log('✅ Orders appear immediately after creation');
      console.log('✅ Orders are removed immediately after cancellation');
      console.log('✅ All operations are working as expected');
      console.log('');
      console.log('🔍 FRONTEND ISSUE LIKELY CAUSES:');
      console.log('1. Frontend not refreshing data after operations');
      console.log('2. Frontend caching old data');
      console.log('3. Frontend not calling the correct API endpoints');
      console.log('4. Frontend not handling responses correctly');
      console.log('5. Frontend refresh interval too long (30s vs 3s needed)');
      console.log('');
      console.log('💡 SOLUTIONS:');
      console.log('1. Use the RealTimeOrderManager component');
      console.log('2. Force refresh after each operation');
      console.log('3. Reduce refresh interval to 3-5 seconds');
      console.log('4. Add immediate feedback to user');
    } else {
      console.log('❌ BACKEND HAS ISSUES');
      console.log('Need to investigate backend mock system');
    }
    
  } catch (error) {
    console.error('\n❌ DEBUG FAILED:', error.message);
    console.error('Response data:', error.response?.data);
    console.error('Stack:', error.stack);
  }
}

debugDeepFrontendIssue();