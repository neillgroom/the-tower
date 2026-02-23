const db = require('./db');
const { sha256, getMerkleProof } = require('./hasher');

async function generateProof(req, res) {
    const { entryId } = req.params;
    const { phoneHash } = req.query;

    // Verify user owns this entry
    const entryResult = await db.query(
        `SELECT e.*, u.phone_hash, u.alias
         FROM entries e JOIN users u ON e.user_id = u.id
         WHERE e.id = $1`,
        [entryId]
    );

    if (entryResult.rows.length === 0) {
        return res.status(404).json({ error: 'Entry not found' });
    }

    const entry = entryResult.rows[0];

    if (entry.phone_hash !== phoneHash) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if proof was paid for
    const paidResult = await db.query(
        'SELECT * FROM proof_pulls WHERE entry_id = $1 AND user_id = $2',
        [entryId, entry.user_id]
    );

    // Build Merkle proof if entry is batched
    let merkleProof = null;
    let merkleRoot = null;
    let batchInfo = null;

    if (entry.merkle_batch_id) {
        const batchResult = await db.query(
            'SELECT * FROM merkle_batches WHERE id = $1',
            [entry.merkle_batch_id]
        );
        batchInfo = batchResult.rows[0] || null;
        merkleRoot = batchInfo ? batchInfo.merkle_root : null;

        // Get all entries in this batch to rebuild the tree and get the proof
        const batchEntries = await db.query(
            'SELECT hash_bound FROM entries WHERE merkle_batch_id = $1 ORDER BY id ASC',
            [entry.merkle_batch_id]
        );

        const hashes = batchEntries.rows.map(e => e.hash_bound);
        const { buildMerkleTree } = require('./hasher');
        const { tree } = buildMerkleTree(hashes);

        const entryIndex = hashes.indexOf(entry.hash_bound);
        if (entryIndex >= 0) {
            merkleProof = getMerkleProof(tree, entryIndex);
        }
    }

    const receipt = {
        tower: 'THE TOWER — Proof Receipt',
        version: '1.0',
        entry: {
            id: entry.id,
            text: entry.text,
            category: entry.category,
            tags: entry.tags,
            created_at: entry.created_at,
            source: entry.source
        },
        identity: {
            alias: entry.alias || null,
            phone_hash: entry.phone_hash
        },
        hashes: {
            hash_text: entry.hash_text,
            hash_bound: entry.hash_bound,
            hash_text_algorithm: 'SHA-256(text)',
            hash_bound_algorithm: 'SHA-256(text|timestamp|phone_hash)'
        },
        merkle: {
            batch_id: entry.merkle_batch_id,
            merkle_root: merkleRoot,
            proof: merkleProof
        },
        bitcoin: {
            anchored: !!entry.btc_block,
            btc_block: entry.btc_block || null,
            anchored_at: entry.anchored_at || null,
            status: batchInfo ? batchInfo.status : 'not_batched'
        },
        verification: {
            instructions: [
                '1. Compute SHA-256 of the entry text. It should match hash_text.',
                '2. Compute SHA-256 of (text + "|" + created_at + "|" + phone_hash). It should match hash_bound.',
                '3. Follow the Merkle proof path from hash_bound to the Merkle root.',
                '4. Verify the Merkle root is anchored in the Bitcoin block using any block explorer.',
                '5. The Tower records. The math verifies.'
            ]
        },
        generated_at: new Date().toISOString()
    };

    receipt.receipt_hash = sha256(JSON.stringify(receipt));

    // Log the proof pull
    if (paidResult.rows.length === 0) {
        await db.query(
            'INSERT INTO proof_pulls (entry_id, user_id, receipt_hash) VALUES ($1, $2, $3)',
            [entryId, entry.user_id, receipt.receipt_hash]
        );
    }

    res.json(receipt);
}

function receiptToText(receipt) {
    return `
════════════════════════════════════════
  ▲ THE TOWER — PROOF RECEIPT
════════════════════════════════════════

Entry #${receipt.entry.id}
Created: ${receipt.entry.created_at}
Category: ${receipt.entry.category}
Source: ${receipt.entry.source}

────────────────────────────────────────
TEXT:
${receipt.entry.text}
────────────────────────────────────────

IDENTITY:
  Alias: ${receipt.identity.alias || 'N/A'}
  Phone Hash: ${receipt.identity.phone_hash}

HASHES:
  Text Hash (SHA-256):  ${receipt.hashes.hash_text}
  Bound Hash (SHA-256): ${receipt.hashes.hash_bound}

MERKLE:
  Batch ID: ${receipt.merkle.batch_id || 'Pending'}
  Root: ${receipt.merkle.merkle_root || 'Pending'}

BITCOIN:
  Status: ${receipt.bitcoin.status}
  Block: ${receipt.bitcoin.btc_block || 'Pending'}
  Anchored: ${receipt.bitcoin.anchored_at || 'Pending'}

VERIFICATION:
${receipt.verification.instructions.map(i => '  ' + i).join('\n')}

Receipt Hash: ${receipt.receipt_hash}
Generated: ${receipt.generated_at}

════════════════════════════════════════
  "If it's not in The Tower, you didn't say it."
════════════════════════════════════════
`.trim();
}

module.exports = { generateProof, receiptToText };
