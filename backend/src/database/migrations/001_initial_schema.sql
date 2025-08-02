-- Migration: 001_initial_schema
-- Description: Create initial database schema for AURA trading system
-- Created: 2024-01-01

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_api_keys table for encrypted Binance API keys
CREATE TABLE user_api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    binance_api_key VARCHAR(255) NOT NULL,
    binance_secret_key_encrypted TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_testnet BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create strategies table
CREATE TABLE strategies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    symbol VARCHAR(20) NOT NULL,
    interval VARCHAR(5) NOT NULL,
    entry_conditions JSONB NOT NULL,
    exit_conditions JSONB NOT NULL,
    risk_params JSONB NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique strategy names per user
    CONSTRAINT unique_user_strategy_name UNIQUE (user_id, name)
);

-- Create trades table
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    binance_order_id_entry BIGINT UNIQUE NOT NULL,
    binance_order_id_oco BIGINT,
    symbol VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'CLOSED_TP', 'CLOSED_SL', 'CLOSED_MANUAL', 'FAILED')),
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    entry_price DECIMAL(20, 10) NOT NULL,
    exit_price DECIMAL(20, 10),
    quantity DECIMAL(20, 10) NOT NULL,
    entry_timestamp TIMESTAMPTZ NOT NULL,
    exit_timestamp TIMESTAMPTZ,
    pnl DECIMAL(20, 10),
    fees DECIMAL(20, 10) DEFAULT 0,
    take_profit_price DECIMAL(20, 10),
    stop_loss_price DECIMAL(20, 10),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create backtest_results table
CREATE TABLE backtest_results (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    initial_balance DECIMAL(20, 10) NOT NULL,
    final_balance DECIMAL(20, 10) NOT NULL,
    total_trades INTEGER NOT NULL,
    winning_trades INTEGER NOT NULL,
    losing_trades INTEGER NOT NULL,
    total_pnl DECIMAL(20, 10) NOT NULL,
    max_drawdown DECIMAL(10, 4) NOT NULL,
    max_drawdown_percent DECIMAL(5, 4) NOT NULL,
    sharpe_ratio DECIMAL(10, 4),
    win_rate DECIMAL(5, 4) NOT NULL,
    avg_win DECIMAL(20, 10),
    avg_loss DECIMAL(20, 10),
    profit_factor DECIMAL(10, 4),
    trades_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_logs table
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    service VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    user_id INTEGER REFERENCES users(id),
    strategy_id INTEGER REFERENCES strategies(id),
    trade_id INTEGER REFERENCES trades(id)
);

-- Create migrations table to track applied migrations
CREATE TABLE migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX idx_user_api_keys_is_active ON user_api_keys(is_active);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);
CREATE INDEX idx_strategies_symbol ON strategies(symbol);
CREATE INDEX idx_strategies_is_active ON strategies(is_active);
CREATE INDEX idx_strategies_created_at ON strategies(created_at);

CREATE INDEX idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_entry_timestamp ON trades(entry_timestamp);
CREATE INDEX idx_trades_exit_timestamp ON trades(exit_timestamp);
CREATE INDEX idx_trades_binance_order_id_entry ON trades(binance_order_id_entry);

CREATE INDEX idx_backtest_results_strategy_id ON backtest_results(strategy_id);
CREATE INDEX idx_backtest_results_created_at ON backtest_results(created_at);

CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_service ON system_logs(service);
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON user_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial migration record
INSERT INTO migrations (version, name) VALUES ('001', 'initial_schema');