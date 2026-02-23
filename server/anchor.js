const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const db = require('./db');
const { buildMerkleTree } = require('./hasher');

const execFileAsync = promisify(execFile);

async function runMerkleBatch() {
    console.log('[Anchor] Running Merkle batch...');

    try {
        // Get all unmatched carved entries
        const result = await db.query(
            "SELECT id, hash_bound FROM entries WHERE merkle_batch_id IS NULL AND status = 'carved' ORDER BY id ASC"
        );

        if (result.rows.length === 0) {
            console.log('[Anchor] No entries to batch.');
            return;
        }

        const hashes = result.rows.map(r => r.hash_bound);
        const entryIds = result.rows.map(r => r.id);

        // Build Merkle tree
        const { root } = buildMerkleTree(hashes);
        console.log(`[Anchor] Merkle root for ${hashes.length} entries: ${root}`);

        // Create batch record
        const batch = await db.query(
            "INSERT INTO merkle_batches (merkle_root, entry_count, status) VALUES ($1, $2, 'pending') RETURNING id",
            [root, hashes.length]
        );
        const batchId = batch.rows[0].id;

        // Update entries with batch ID
        await db.query(
            'UPDATE entries SET merkle_batch_id = $1 WHERE id = ANY($2)',
            [batchId, entryIds]
        );

        // Stamp with OpenTimestamps
        const tmpDir = path.join(os.tmpdir(), 'tower-ots');
        await fs.mkdir(tmpDir, { recursive: true });

        const rootFile = path.join(tmpDir, `batch-${batchId}.txt`);
        await fs.writeFile(rootFile, root);

        try {
            await execFileAsync('ots', ['stamp', rootFile], { timeout: 30000 });

            const otsFile = rootFile + '.ots';
            const otsProof = await fs.readFile(otsFile);

            await db.query(
                "UPDATE merkle_batches SET ots_proof = $1, status = 'submitted' WHERE id = $2",
                [otsProof, batchId]
            );

            console.log(`[Anchor] Batch #${batchId} submitted to OpenTimestamps.`);

            // Cleanup
            await fs.unlink(rootFile).catch(() => {});
            await fs.unlink(otsFile).catch(() => {});
        } catch (otsErr) {
            console.error('[Anchor] OpenTimestamps stamp failed:', otsErr.message);
            console.log('[Anchor] Batch created but not yet stamped. Will retry on next run.');
        }
    } catch (err) {
        console.error('[Anchor] Batch error:', err);
    }
}

async function checkAnchors() {
    console.log('[Anchor] Checking pending anchors...');

    try {
        const batches = await db.query(
            "SELECT * FROM merkle_batches WHERE status = 'submitted'"
        );

        const tmpDir = path.join(os.tmpdir(), 'tower-ots');
        await fs.mkdir(tmpDir, { recursive: true });

        for (const batch of batches.rows) {
            try {
                const rootFile = path.join(tmpDir, `verify-${batch.id}.txt`);
                const otsFile = rootFile + '.ots';

                await fs.writeFile(rootFile, batch.merkle_root);
                await fs.writeFile(otsFile, batch.ots_proof);

                const { stdout } = await execFileAsync('ots', ['verify', otsFile], { timeout: 30000 });

                if (stdout.includes('Bitcoin block')) {
                    // Extract block info
                    const blockMatch = stdout.match(/Bitcoin block (\d+)/);
                    const btcBlock = blockMatch ? blockMatch[1] : 'confirmed';

                    await db.query(
                        "UPDATE merkle_batches SET status = 'confirmed', btc_block = $1, confirmed_at = NOW() WHERE id = $2",
                        [btcBlock, batch.id]
                    );

                    await db.query(
                        'UPDATE entries SET btc_block = $1, anchored_at = NOW() WHERE merkle_batch_id = $2',
                        [btcBlock, batch.id]
                    );

                    console.log(`[Anchor] Batch #${batch.id} confirmed in Bitcoin block ${btcBlock}.`);
                } else {
                    console.log(`[Anchor] Batch #${batch.id} not yet confirmed.`);
                }

                // Cleanup
                await fs.unlink(rootFile).catch(() => {});
                await fs.unlink(otsFile).catch(() => {});
            } catch (verifyErr) {
                console.error(`[Anchor] Verify error for batch #${batch.id}:`, verifyErr.message);
            }
        }
    } catch (err) {
        console.error('[Anchor] Check anchors error:', err);
    }
}

// Also attempt to stamp any batches stuck in 'pending' (ots stamp failed previously)
async function retryPendingStamps() {
    const batches = await db.query(
        "SELECT * FROM merkle_batches WHERE status = 'pending' AND ots_proof IS NULL"
    );

    for (const batch of batches.rows) {
        console.log(`[Anchor] Retrying stamp for batch #${batch.id}...`);
        const tmpDir = path.join(os.tmpdir(), 'tower-ots');
        await fs.mkdir(tmpDir, { recursive: true });

        const rootFile = path.join(tmpDir, `retry-${batch.id}.txt`);
        await fs.writeFile(rootFile, batch.merkle_root);

        try {
            await execFileAsync('ots', ['stamp', rootFile], { timeout: 30000 });

            const otsFile = rootFile + '.ots';
            const otsProof = await fs.readFile(otsFile);

            await db.query(
                "UPDATE merkle_batches SET ots_proof = $1, status = 'submitted' WHERE id = $2",
                [otsProof, batch.id]
            );

            await fs.unlink(rootFile).catch(() => {});
            await fs.unlink(otsFile).catch(() => {});
            console.log(`[Anchor] Batch #${batch.id} retry successful.`);
        } catch (err) {
            console.error(`[Anchor] Retry failed for batch #${batch.id}:`, err.message);
            await fs.unlink(rootFile).catch(() => {});
        }
    }
}

module.exports = { runMerkleBatch, checkAnchors, retryPendingStamps };
