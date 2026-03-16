-- THE TOWER — Sealed Entry Support
-- Adds tier system (open/sealed/vault/tomb) and inscription column

-- Tier: open = plaque on the wall, sealed = encrypted vault, vault = M-of-N, tomb = time-locked
ALTER TABLE entries ADD COLUMN IF NOT EXISTS tier VARCHAR(10) DEFAULT 'open'
  CHECK (tier IN ('open', 'sealed', 'vault', 'tomb'));

-- Public inscription visible on sealed entries (the vault door label)
ALTER TABLE entries ADD COLUMN IF NOT EXISTS inscription TEXT;

-- Encrypted ciphertext (sealed/vault/tomb only). NULL for open entries.
-- For sealed: AES-256-GCM encrypted text. Server never sees plaintext.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS ciphertext TEXT;

-- Salt used for key derivation (PBKDF2). Stored so verification can recreate.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS encryption_salt VARCHAR(64);

-- IV (initialization vector) for AES-GCM. Unique per entry.
ALTER TABLE entries ADD COLUMN IF NOT EXISTS encryption_iv VARCHAR(64);

-- For tomb tier: the date after which the entry can be unsealed
ALTER TABLE entries ADD COLUMN IF NOT EXISTS unlock_at TIMESTAMPTZ;

-- Index for browsing inscriptions
CREATE INDEX IF NOT EXISTS idx_entries_tier ON entries(tier);
CREATE INDEX IF NOT EXISTS idx_entries_inscription ON entries(inscription) WHERE inscription IS NOT NULL;
