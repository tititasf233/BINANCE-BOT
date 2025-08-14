const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('postgres:', 'localhost:') || 'postgresql://aura_user:aura_password@localhost:5432/aura_db',
});

async function debugUserSession() {
  try {
    console.log('🔍 Debugging user session and API keys...');
    
    // Check all users
    const users = await pool.query('SELECT id, email, name FROM users ORDER BY created_at DESC');
    console.log('\n👥 All users in database:');
    users.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name}`);
      console.log('   ---');
    });
    
    // Check API keys for each user
    console.log('\n🔑 API keys by user:');
    for (const user of users.rows) {
      const apiKeys = await pool.query(
        'SELECT id, name, api_key_encrypted, is_testnet, is_active FROM api_keys WHERE user_id = $1',
        [user.id]
      );
      
      console.log(`\n📧 ${user.email} (${user.id}):`);
      if (apiKeys.rows.length === 0) {
        console.log('   ❌ No API keys found');
      } else {
        apiKeys.rows.forEach((key, index) => {
          console.log(`   ${index + 1}. ${key.name}`);
          console.log(`      API Key: ${key.api_key_encrypted?.substring(0, 20)}...`);
          console.log(`      Is Testnet: ${key.is_testnet}`);
          console.log(`      Is Active: ${key.is_active}`);
        });
      }
    }
    
    // Check which user should have the real API keys
    const realApiKeyUser = await pool.query(
      'SELECT user_id FROM api_keys WHERE api_key_encrypted = $1 AND is_active = true',
      [process.env.BINANCE_API_KEY]
    );
    
    if (realApiKeyUser.rows.length > 0) {
      const userId = realApiKeyUser.rows[0].user_id;
      const userInfo = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
      
      console.log('\n✅ User with real API keys:');
      console.log(`   Email: ${userInfo.rows[0].email}`);
      console.log(`   Name: ${userInfo.rows[0].name}`);
      console.log(`   User ID: ${userId}`);
    } else {
      console.log('\n❌ No user found with real API keys');
    }
    
  } catch (error) {
    console.error('❌ Error debugging user session:', error.message);
  } finally {
    await pool.end();
  }
}

debugUserSession();