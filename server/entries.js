const db = require('./db');
const { sha256 } = require('./hasher');

/**
 * POST /api/entries/create
 * Create an entry via web/API (not SMS).
 *
 * For OPEN entries:
 *   { phone_hash, text, category, tags, inscription }
 *   Server hashes the plaintext.
 *
 * For SEALED entries:
 *   { phone_hash, hash_text, ciphertext, encryption_salt, encryption_iv, category, tags, inscription }
 *   Client encrypts the plaintext, sends ciphertext + hash of the PLAINTEXT.
 *   Server NEVER sees the plaintext.
 */
async function createEntry(req, res) {
    try {
        const {
            phone_hash,
            text,           // open entries only
            hash_text,      // sealed entries: client provides hash of plaintext
            ciphertext,     // sealed entries: AES-256-GCM encrypted text
            encryption_salt,
            encryption_iv,
            category = 'record',
            tags = [],
            tier = 'open',
            inscription,
        } = req.body;

        if (!phone_hash) {
            return res.status(400).json({ error: 'phone_hash is required' });
        }

        // Validate tier
        const validTiers = ['open', 'sealed', 'vault', 'tomb'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier. Must be: open, sealed, vault, tomb' });
        }

        // Validate category
        const validCategories = ['prediction', 'idea', 'claim', 'disclosure', 'creative', 'record', 'itoldyouso'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        // Find user
        const userResult = await db.query('SELECT * FROM users WHERE phone_hash = $1', [phone_hash]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];

        // Check credits
        if (user.credits <= 0) {
            return res.status(402).json({
                error: 'No credits remaining',
                buy_url: `${process.env.BASE_URL || 'https://thetower.one'}/pay.html?u=${phone_hash}`
            });
        }

        const now = new Date().toISOString();
        let entryHashText;
        let entryText;
        let entryCiphertext = null;
        let entrySalt = null;
        let entryIv = null;

        if (tier === 'open') {
            // Open entry: server sees plaintext
            if (!text) {
                return res.status(400).json({ error: 'text is required for open entries' });
            }
            entryHashText = sha256(text);
            entryText = text;
        } else {
            // Sealed/vault/tomb: server gets ciphertext + plaintext hash
            if (!hash_text || !ciphertext || !encryption_salt || !encryption_iv) {
                return res.status(400).json({
                    error: 'Sealed entries require: hash_text, ciphertext, encryption_salt, encryption_iv'
                });
            }
            entryHashText = hash_text;
            entryText = '[SEALED]';  // Placeholder — real text is in ciphertext
            entryCiphertext = ciphertext;
            entrySalt = encryption_salt;
            entryIv = encryption_iv;

            if (tier !== 'open' && !inscription) {
                return res.status(400).json({ error: 'Sealed entries require an inscription (the vault door label)' });
            }
        }

        const hashBound = sha256(entryHashText + '|' + now + '|' + phone_hash);

        // Insert entry
        const entry = await db.query(
            `INSERT INTO entries
                (user_id, text, hash_text, hash_bound, category, tags, source, status,
                 tier, inscription, ciphertext, encryption_salt, encryption_iv, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'web', 'carved',
                     $7, $8, $9, $10, $11, $12)
             RETURNING id, hash_text, hash_bound, tier, inscription, created_at`,
            [user.id, entryText, entryHashText, hashBound, category, tags,
             tier, inscription || null, entryCiphertext, entrySalt, entryIv, now]
        );

        // Deduct credit
        await db.query('UPDATE users SET credits = credits - 1, updated_at = NOW() WHERE id = $1', [user.id]);
        await db.query(
            "INSERT INTO credit_transactions (user_id, amount, type) VALUES ($1, -1, 'entry')",
            [user.id]
        );

        const created = entry.rows[0];
        res.json({
            carved: true,
            entry: {
                id: created.id,
                hash_text: created.hash_text,
                hash_bound: created.hash_bound,
                tier: created.tier,
                inscription: created.inscription,
                created_at: created.created_at,
            },
            credits_remaining: user.credits - 1,
        });

    } catch (err) {
        console.error('Create entry error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
}

/**
 * POST /api/entries/create-batch
 * Create multiple entries at once (for stamping the founding docs).
 * Same format as create, but body is { phone_hash, entries: [...] }
 */
async function createBatch(req, res) {
    try {
        const { phone_hash, entries } = req.body;

        if (!phone_hash || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'phone_hash and entries array required' });
        }

        const userResult = await db.query('SELECT * FROM users WHERE phone_hash = $1', [phone_hash]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const user = userResult.rows[0];

        if (user.credits < entries.length) {
            return res.status(402).json({
                error: `Need ${entries.length} credits, have ${user.credits}`,
                buy_url: `${process.env.BASE_URL || 'https://thetower.one'}/pay.html?u=${phone_hash}`
            });
        }

        const results = [];
        const now = new Date().toISOString();

        for (const e of entries) {
            const tier = e.tier || 'open';
            const category = e.category || 'record';
            let entryHashText, entryText, ciphertext = null, salt = null, iv = null;

            if (tier === 'open') {
                if (!e.text) continue;
                entryHashText = sha256(e.text);
                entryText = e.text;
            } else {
                if (!e.hash_text || !e.ciphertext) continue;
                entryHashText = e.hash_text;
                entryText = '[SEALED]';
                ciphertext = e.ciphertext;
                salt = e.encryption_salt;
                iv = e.encryption_iv;
            }

            const hashBound = sha256(entryHashText + '|' + now + '|' + phone_hash);

            const result = await db.query(
                `INSERT INTO entries
                    (user_id, text, hash_text, hash_bound, category, tags, source, status,
                     tier, inscription, ciphertext, encryption_salt, encryption_iv, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, 'web', 'carved',
                         $7, $8, $9, $10, $11, $12)
                 RETURNING id, hash_text, tier, inscription`,
                [user.id, entryText, entryHashText, hashBound, category, e.tags || [],
                 tier, e.inscription || null, ciphertext, salt, iv, now]
            );

            results.push(result.rows[0]);

            await db.query('UPDATE users SET credits = credits - 1, updated_at = NOW() WHERE id = $1', [user.id]);
            await db.query(
                "INSERT INTO credit_transactions (user_id, amount, type) VALUES ($1, -1, 'entry')",
                [user.id]
            );
        }

        res.json({
            carved: results.length,
            entries: results,
            credits_remaining: user.credits - results.length,
        });

    } catch (err) {
        console.error('Create batch error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
}

/**
 * POST /api/entries/reveal
 * Reveal a sealed entry by providing the decryption key.
 * Client decrypts locally, sends plaintext for verification.
 * Server checks: SHA-256(plaintext) === stored hash_text
 * If match: entry text is updated with plaintext, tier stays 'sealed' (but revealed flag could be added)
 */
async function revealEntry(req, res) {
    try {
        const { entry_id, plaintext } = req.body;

        if (!entry_id || !plaintext) {
            return res.status(400).json({ error: 'entry_id and plaintext required' });
        }

        const result = await db.query(
            'SELECT * FROM entries WHERE id = $1',
            [entry_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        const entry = result.rows[0];

        if (entry.tier === 'open') {
            return res.status(400).json({ error: 'Entry is already open' });
        }

        // Verify: SHA-256 of provided plaintext must match stored hash_text
        const computedHash = sha256(plaintext);
        if (computedHash !== entry.hash_text) {
            return res.json({
                verified: false,
                message: 'Hash mismatch — the provided text does not match the original entry'
            });
        }

        // Match! Update the entry with revealed plaintext
        await db.query(
            'UPDATE entries SET text = $1 WHERE id = $2',
            [plaintext, entry_id]
        );

        res.json({
            verified: true,
            entry_id: entry.id,
            hash_text: entry.hash_text,
            created_at: entry.created_at,
            message: 'Entry revealed and verified. SHA-256(plaintext) matches anchored hash.'
        });

    } catch (err) {
        console.error('Reveal entry error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
}

module.exports = { createEntry, createBatch, revealEntry };
