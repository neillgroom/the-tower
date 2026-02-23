const twilio = require('twilio');
const db = require('./db');
const { sha256 } = require('./hasher');

const MessagingResponse = twilio.twiml.MessagingResponse;

const BASE_URL = process.env.BASE_URL || 'https://thetower.app';

async function findOrCreateUser(phone) {
    const phoneHash = sha256(phone);
    let result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);

    if (result.rows.length === 0) {
        result = await db.query(
            'INSERT INTO users (phone, phone_hash) VALUES ($1, $2) RETURNING *',
            [phone, phoneHash]
        );
    }

    return result.rows[0];
}

async function handleSms(req, res) {
    const { From: phone, Body: body } = req.body;
    const twiml = new MessagingResponse();
    const text = body.trim();
    const command = text.toUpperCase();

    try {
        const user = await findOrCreateUser(phone);

        // Handle commands
        if (command === 'BALANCE') {
            twiml.message(`▲ You have ${user.credits} credits.`);
            return res.type('text/xml').send(twiml.toString());
        }

        if (command === 'ENTRIES') {
            const countResult = await db.query(
                "SELECT COUNT(*) FROM entries WHERE user_id = $1 AND status = 'carved'",
                [user.id]
            );
            const count = countResult.rows[0].count;
            twiml.message(`▲ ${count} entries carved. View: ${BASE_URL}/dashboard.html?u=${user.phone_hash}`);
            return res.type('text/xml').send(twiml.toString());
        }

        if (command === 'HELP') {
            twiml.message(`▲ Text any idea to carve it (50¢). Commands: BALANCE, ENTRIES, PROVE [id], VERIFY [hash]`);
            return res.type('text/xml').send(twiml.toString());
        }

        if (command.startsWith('PROVE ')) {
            const entryId = command.split(' ')[1];
            twiml.message(`▲ Pull proof for Entry #${entryId}? Tap: ${BASE_URL}/prove.html?entry=${entryId}&u=${user.phone_hash} ($5)`);
            return res.type('text/xml').send(twiml.toString());
        }

        if (command.startsWith('VERIFY ')) {
            const hash = text.split(' ')[1];
            const entry = await db.query(
                'SELECT * FROM entries WHERE hash_text = $1 OR hash_bound = $1 LIMIT 1',
                [hash]
            );
            if (entry.rows.length > 0) {
                const e = entry.rows[0];
                twiml.message(`▲ VERIFIED: Entry #${e.id}, ${new Date(e.created_at).toISOString()}`);
            } else {
                twiml.message('▲ NO MATCH');
            }
            return res.type('text/xml').send(twiml.toString());
        }

        // Not a command — it's an idea to carve
        const now = new Date().toISOString();
        const hashText = sha256(text);

        if (user.credits > 0) {
            // Carve it
            const hashBound = sha256(text + '|' + now + '|' + user.phone_hash);

            const entry = await db.query(
                `INSERT INTO entries (user_id, text, hash_text, hash_bound, status, created_at)
                 VALUES ($1, $2, $3, $4, 'carved', $5) RETURNING id`,
                [user.id, text, hashText, hashBound, now]
            );

            await db.query('UPDATE users SET credits = credits - 1, updated_at = NOW() WHERE id = $1', [user.id]);

            await db.query(
                "INSERT INTO credit_transactions (user_id, amount, type) VALUES ($1, -1, 'entry')",
                [user.id]
            );

            const remaining = user.credits - 1;
            twiml.message(`▲ CARVED. Entry #${entry.rows[0].id}. ${now}. Hash: ${hashText.substring(0, 16)}... ${remaining} credits left.`);
        } else {
            // Save as pending
            await db.query(
                `INSERT INTO entries (user_id, text, hash_text, status, created_at)
                 VALUES ($1, $2, $3, 'pending', $4)`,
                [user.id, text, hashText, now]
            );

            if (!user.stripe_customer) {
                // New user
                twiml.message(`▲ THE TOWER — Welcome. Your idea is saved and waiting. Tap to activate: ${BASE_URL}/pay.html?u=${user.phone_hash}. 10 entries = $5.`);
            } else {
                // Existing user, no credits
                twiml.message(`▲ Out of credits. Tap to reload: ${BASE_URL}/pay.html?u=${user.phone_hash}. Your idea is saved and waiting.`);
            }
        }

        res.type('text/xml').send(twiml.toString());
    } catch (err) {
        console.error('SMS handler error:', err);
        twiml.message('▲ Something went wrong. Try again.');
        res.type('text/xml').send(twiml.toString());
    }
}

module.exports = { handleSms, findOrCreateUser };
