const stripe = process.env.STRIPE_SECRET ? require('stripe')(process.env.STRIPE_SECRET) : null;
const db = require('./db');

const BASE_URL = process.env.BASE_URL || 'https://thetower.one';

const CREDIT_PACKS = {
    '10': { credits: 10, price: 500, label: '10 entries — $5 (50¢ each)' },
    '25': { credits: 25, price: 1000, label: '25 entries — $10 (40¢ each)' },
    '100': { credits: 100, price: 3500, label: '100 entries — $35 (35¢ each)' }
};

async function createCheckout(req, res) {
    if (!stripe) return res.status(503).json({ error: 'Billing not configured' });
    const { phoneHash, pack } = req.body;

    const packInfo = CREDIT_PACKS[pack];
    if (!packInfo) {
        return res.status(400).json({ error: 'Invalid pack' });
    }

    const userResult = await db.query('SELECT * FROM users WHERE phone_hash = $1', [phoneHash]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Create or reuse Stripe customer
    let customerId = user.stripe_customer;
    if (!customerId) {
        const customer = await stripe.customers.create({
            metadata: { phone_hash: phoneHash, tower_user_id: user.id.toString() }
        });
        customerId = customer.id;
        await db.query('UPDATE users SET stripe_customer = $1, updated_at = NOW() WHERE id = $2', [customerId, user.id]);
    }

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: { name: `Tower Credits — ${packInfo.label}` },
                unit_amount: packInfo.price
            },
            quantity: 1
        }],
        mode: 'payment',
        metadata: {
            phone_hash: phoneHash,
            credits: packInfo.credits.toString(),
            pack,
            type: 'credits'
        },
        success_url: `${BASE_URL}/dashboard.html?u=${phoneHash}&purchased=true`,
        cancel_url: `${BASE_URL}/pay.html?u=${phoneHash}`
    });

    res.json({ url: session.url });
}

async function createProofCheckout(req, res) {
    if (!stripe) return res.status(503).json({ error: 'Billing not configured' });
    const { phoneHash, entryId } = req.body;

    const userResult = await db.query('SELECT * FROM users WHERE phone_hash = $1', [phoneHash]);
    if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    let customerId = user.stripe_customer;
    if (!customerId) {
        const customer = await stripe.customers.create({
            metadata: { phone_hash: phoneHash, tower_user_id: user.id.toString() }
        });
        customerId = customer.id;
        await db.query('UPDATE users SET stripe_customer = $1, updated_at = NOW() WHERE id = $2', [customerId, user.id]);
    }

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: { name: `Tower Proof Receipt — Entry #${entryId}` },
                unit_amount: 500
            },
            quantity: 1
        }],
        mode: 'payment',
        metadata: {
            phone_hash: phoneHash,
            entry_id: entryId.toString(),
            type: 'proof'
        },
        success_url: `${BASE_URL}/prove.html?entry=${entryId}&u=${phoneHash}&paid=true`,
        cancel_url: `${BASE_URL}/prove.html?entry=${entryId}&u=${phoneHash}`
    });

    res.json({ url: session.url });
}

async function handleWebhook(req, res) {
    if (!stripe) return res.status(503).json({ error: 'Billing not configured' });
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { phone_hash, type } = session.metadata;

        const userResult = await db.query('SELECT * FROM users WHERE phone_hash = $1', [phone_hash]);
        if (userResult.rows.length === 0) {
            console.error('Webhook: user not found for phone_hash', phone_hash);
            return res.json({ received: true });
        }

        const user = userResult.rows[0];

        if (type === 'credits') {
            const credits = parseInt(session.metadata.credits);

            // Add credits
            await db.query(
                'UPDATE users SET credits = credits + $1, updated_at = NOW() WHERE id = $2',
                [credits, user.id]
            );

            // Log transaction
            await db.query(
                "INSERT INTO credit_transactions (user_id, amount, type, stripe_payment) VALUES ($1, $2, 'purchase', $3)",
                [user.id, credits, session.payment_intent]
            );

            // Activate pending entries
            await activatePendingEntries(user);
        } else if (type === 'proof') {
            // Proof pull payment handled — proof generated on the prove page when paid=true
            const entryId = parseInt(session.metadata.entry_id);
            await db.query(
                "INSERT INTO credit_transactions (user_id, amount, type, stripe_payment) VALUES ($1, -1, 'proof', $2)",
                [user.id, session.payment_intent]
            );

            // proof_pulls record created when the proof is actually generated
        }
    }

    res.json({ received: true });
}

async function activatePendingEntries(user) {
    const pending = await db.query(
        "SELECT * FROM entries WHERE user_id = $1 AND status = 'pending' ORDER BY created_at ASC",
        [user.id]
    );

    const { sha256 } = require('./hasher');

    for (const entry of pending.rows) {
        // Refresh credit count
        const userResult = await db.query('SELECT credits FROM users WHERE id = $1', [user.id]);
        const currentCredits = userResult.rows[0].credits;

        if (currentCredits <= 0) break;

        const now = new Date().toISOString();
        const hashBound = sha256(entry.text + '|' + entry.created_at.toISOString() + '|' + user.phone_hash);

        await db.query(
            "UPDATE entries SET status = 'carved', hash_bound = $1 WHERE id = $2",
            [hashBound, entry.id]
        );

        await db.query('UPDATE users SET credits = credits - 1, updated_at = NOW() WHERE id = $1', [user.id]);

        await db.query(
            "INSERT INTO credit_transactions (user_id, amount, type) VALUES ($1, -1, 'entry')",
            [user.id]
        );
    }
}

module.exports = { createCheckout, createProofCheckout, handleWebhook, CREDIT_PACKS };
