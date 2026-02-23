-- THE TOWER — Initial Database Schema
-- "If it's not in The Tower, you didn't say it."

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    phone_hash VARCHAR(64) NOT NULL,
    alias VARCHAR(100),
    credits INTEGER DEFAULT 0,
    stripe_customer VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merkle_batches (
    id SERIAL PRIMARY KEY,
    merkle_root VARCHAR(64) NOT NULL,
    entry_count INTEGER NOT NULL,
    ots_proof BYTEA,
    btc_block VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    text TEXT NOT NULL,
    hash_text VARCHAR(64) NOT NULL,
    hash_bound VARCHAR(64),
    category VARCHAR(20) DEFAULT 'record' CHECK (category IN ('prediction', 'idea', 'claim', 'disclosure', 'creative', 'record', 'itoldyouso')),
    tags TEXT[],
    source VARCHAR(20) DEFAULT 'sms' CHECK (source IN ('sms', 'web', 'api', 'extension')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'carved')),
    merkle_batch_id INTEGER REFERENCES merkle_batches(id),
    btc_block VARCHAR(255),
    anchored_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entries_hash_text ON entries(hash_text);
CREATE INDEX idx_entries_hash_bound ON entries(hash_bound);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_created_at ON entries(created_at);
CREATE INDEX idx_entries_category ON entries(category);
CREATE INDEX idx_entries_status ON entries(status);

CREATE TABLE IF NOT EXISTS proof_pulls (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES entries(id) NOT NULL,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    receipt_hash VARCHAR(64) NOT NULL,
    amount_cents INTEGER DEFAULT 500,
    stripe_charge VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    amount INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'entry', 'refund', 'proof')),
    stripe_payment VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS witnesses (
    id SERIAL PRIMARY KEY,
    entry_id INTEGER REFERENCES entries(id) NOT NULL,
    witness_user_id INTEGER REFERENCES users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entry_id, witness_user_id)
);

CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    entry_id_1 INTEGER REFERENCES entries(id) NOT NULL,
    entry_id_2 INTEGER REFERENCES entries(id) NOT NULL,
    topic VARCHAR(500),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    winner_entry_id INTEGER REFERENCES entries(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
