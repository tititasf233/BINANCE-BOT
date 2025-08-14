const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL?.replace('postgres:', 'localhost:') || 'postgresql://aura_user:aura_password@localhost:5432/aura_db',
});

async function fixTestnetSetting() {
  try {
    console.log('🔧 Updating API keys to use mainnet (real Binance)...');
    
    const result = await pool.query(`
      UPDATE api_keys 
      SET is_testnet = false, 
          updated_at = NOW()
      WHERE is_active = true
    `);
    
    console.log('✅ Updated', result.rowCount, 'API key records');
    console.log('⚠️  WARNING: Your system is now using REAL Binance API with REAL funds!');
    console.log('💰 Make sure you understand the risks before placing any trades.');
    
  } catch (error) {
    console.error('❌ Error updating testnet setting:', error.message);
  } finally {
    await pool.end();
  }
}

fixTestnetSetting();