require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { handleSms } = require('./sms');
const { createCheckout, createProofCheckout, handleWebhook } = require('./billing');
const { generateProof } = require('./proof');
const { verifyByTextHash, verifyByBoundHash, verifyText, getStats } = require('./verify');
const { runMerkleBatch, checkAnchors, retryPendingStamps } = require('./anchor');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe webhook needs raw body
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'web')));

// SMS webhook (Twilio)
app.post('/sms', handleSms);

// Billing
app.post('/api/checkout', createCheckout);
app.post('/api/proof-checkout', createProofCheckout);

// Entries
app.get('/api/entries/:phoneHash', async (req, res) => {
    try {
        const { phoneHash } = req.params;
        const user = await db.query('SELECT * FROM users WHERE phone_hash = $1', [phoneHash]);
        if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const entries = await db.query(
            `SELECT id, hash_text, hash_bound, category, tags, source, status,
                    btc_block, anchored_at, created_at
             FROM entries WHERE user_id = $1 ORDER BY created_at DESC`,
            [user.rows[0].id]
        );

        res.json({
            credits: user.rows[0].credits,
            alias: user.rows[0].alias,
            entries: entries.rows
        });
    } catch (err) {
        console.error('Entries error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Proof
app.get('/api/proof/:entryId', generateProof);

// Verification
app.get('/api/verify/text/:hash', verifyByTextHash);
app.get('/api/verify/bound/:hash', verifyByBoundHash);
app.post('/api/verify/text', verifyText);

// Stats
app.get('/api/stats', getStats);

// Legal verification (free access)
app.post('/api/legal/verify', async (req, res) => {
    const { hash, case_reference, requestor } = req.body;
    if (!hash || !case_reference || !requestor) {
        return res.status(400).json({ error: 'hash, case_reference, and requestor are required' });
    }

    const result = await db.query(
        `SELECT e.*, mb.merkle_root, mb.status as anchor_status, mb.btc_block as batch_btc_block
         FROM entries e
         LEFT JOIN merkle_batches mb ON e.merkle_batch_id = mb.id
         WHERE (e.hash_text = $1 OR e.hash_bound = $1) AND e.status = 'carved'`,
        [hash]
    );

    if (result.rows.length === 0) {
        return res.json({ verified: false, message: 'NO MATCH' });
    }

    const entry = result.rows[0];
    res.json({
        legal_verification: true,
        case_reference,
        requestor,
        entry: {
            id: entry.id,
            text: entry.text,
            hash_text: entry.hash_text,
            hash_bound: entry.hash_bound,
            created_at: entry.created_at,
            anchor_status: entry.anchor_status,
            btc_block: entry.btc_block,
            merkle_root: entry.merkle_root
        },
        notice: 'This verification is provided free of charge for legal proceedings per Tower policy.'
    });
});

// Scheduled tasks
setInterval(runMerkleBatch, 3600000);       // Every hour
setInterval(checkAnchors, 21600000);        // Every 6 hours
setInterval(retryPendingStamps, 7200000);   // Every 2 hours

app.listen(PORT, () => {
    console.log(`▲ THE TOWER is running on port ${PORT}`);
    console.log(`  "If it's not in The Tower, you didn't say it."`);
});
