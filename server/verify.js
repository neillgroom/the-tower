const db = require('./db');
const { sha256 } = require('./hasher');

async function verifyByTextHash(req, res) {
    const { hash } = req.params;

    const result = await db.query(
        `SELECT e.id, e.hash_text, e.hash_bound, e.category, e.source, e.btc_block,
                e.anchored_at, e.created_at, e.merkle_batch_id,
                mb.merkle_root, mb.status as anchor_status
         FROM entries e
         LEFT JOIN merkle_batches mb ON e.merkle_batch_id = mb.id
         WHERE e.hash_text = $1 AND e.status = 'carved'`,
        [hash]
    );

    if (result.rows.length === 0) {
        return res.json({ verified: false, message: 'NO MATCH' });
    }

    const entry = result.rows[0];
    res.json({
        verified: true,
        entry_id: entry.id,
        hash_text: entry.hash_text,
        hash_bound: entry.hash_bound,
        category: entry.category,
        source: entry.source,
        created_at: entry.created_at,
        anchor: {
            status: entry.anchor_status || 'not_batched',
            merkle_root: entry.merkle_root,
            btc_block: entry.btc_block,
            anchored_at: entry.anchored_at
        }
    });
}

async function verifyByBoundHash(req, res) {
    const { hash } = req.params;

    const result = await db.query(
        `SELECT e.id, e.hash_text, e.hash_bound, e.category, e.source, e.btc_block,
                e.anchored_at, e.created_at, e.merkle_batch_id,
                mb.merkle_root, mb.status as anchor_status
         FROM entries e
         LEFT JOIN merkle_batches mb ON e.merkle_batch_id = mb.id
         WHERE e.hash_bound = $1 AND e.status = 'carved'`,
        [hash]
    );

    if (result.rows.length === 0) {
        return res.json({ verified: false, message: 'NO MATCH' });
    }

    const entry = result.rows[0];
    res.json({
        verified: true,
        entry_id: entry.id,
        hash_text: entry.hash_text,
        hash_bound: entry.hash_bound,
        category: entry.category,
        source: entry.source,
        created_at: entry.created_at,
        anchor: {
            status: entry.anchor_status || 'not_batched',
            merkle_root: entry.merkle_root,
            btc_block: entry.btc_block,
            anchored_at: entry.anchored_at
        }
    });
}

async function verifyText(req, res) {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const hash = sha256(text.trim());
    req.params = { hash };
    return verifyByTextHash(req, res);
}

async function getStats(req, res) {
    const totalResult = await db.query("SELECT COUNT(*) FROM entries WHERE status = 'carved'");
    const anchoredResult = await db.query("SELECT COUNT(*) FROM entries WHERE btc_block IS NOT NULL");
    const batchResult = await db.query("SELECT COUNT(*) FROM merkle_batches");
    const confirmedResult = await db.query("SELECT COUNT(*) FROM merkle_batches WHERE status = 'confirmed'");

    res.json({
        total_entries: parseInt(totalResult.rows[0].count),
        anchored_entries: parseInt(anchoredResult.rows[0].count),
        total_batches: parseInt(batchResult.rows[0].count),
        confirmed_batches: parseInt(confirmedResult.rows[0].count)
    });
}

module.exports = { verifyByTextHash, verifyByBoundHash, verifyText, getStats };
