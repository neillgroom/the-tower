# The Tower

Immutable idea timestamping platform that records original claims, predictions, and ideas with cryptographic proof anchored to Bitcoin.

**Live:** https://thetower.one

> "If it's not in The Tower, you didn't say it."

## What It Does

Users register ideas via SMS or web. The Tower provides mathematical proof of when the idea was first recorded — SHA-256 hashing, Merkle tree batching, and Bitcoin blockchain anchoring via OpenTimestamps.

**Use cases:**
- **Predictions** — Sports forecasts, market calls with timestamped verification
- **Idea registration** — Claim intellectual originality without formal patents
- **Prior art defense** — Legal timestamp verification for IP disputes
- **"I called it" proof** — Public figures, analysts, forecasters proving foresight

## Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **SMS:** Twilio (inbound/outbound, primary UX)
- **Payments:** Stripe (credits + proof receipts)
- **Cryptography:** SHA-256, Merkle trees, AES-256-GCM (sealed entries), OpenTimestamps (Bitcoin anchor)
- **Frontend:** Vanilla HTML/CSS/JS (static pages for onboarding, verification, proofs, dashboard)

## Declaration Tiers

| Tier | Visibility | How It Works |
|------|-----------|-------------|
| **Open** | Public | Plaintext on the blockchain. Server sees full text. |
| **Sealed** | Private | Client encrypts locally, sends ciphertext + hash. Server never sees plaintext. Reveal later by providing the key. |
| **Vault** | Multi-party | M-of-N threshold decryption (designed, not yet implemented) |
| **Tomb** | Time-locked | Encrypted with `unlock_at` timestamp. Auto-reveals on specified date. |

## Entry Categories

`prediction` · `idea` · `claim` · `disclosure` · `creative` · `record` · `itoldyouso`

## How It Works

1. **User texts an idea** (SMS) or submits via web
2. **Hash:** `hash_text` = SHA-256(plaintext), `hash_bound` = SHA-256(hash_text | timestamp | phone_hash)
3. **Credit deducted** from user account
4. **Hourly Merkle batch:** All unbatched entries collected, Merkle tree built, root computed
5. **Bitcoin anchor:** Merkle root stamped via OpenTimestamps CLI → Bitcoin blockchain
6. **Verification:** User can generate certified proof receipt ($5) showing full cryptographic chain from entry → Merkle root → Bitcoin block

## Pricing

- **Entries:** ~50¢ each (credit packs: 10/$5, 25/$10, 100/$35)
- **Proof receipts:** $5 per certified PDF with Bitcoin anchor
- **Planned enterprise:** Data API access for VC firms, hedge funds, pharma, media, legal, intelligence — tracking ideation trends, prediction track records, prior art

## Hash Binding

Every entry is cryptographically bound to three things simultaneously:
- **Content** (hash_text) — proves what was said
- **Timestamp** (created_at) — proves when
- **Identity** (phone_hash) — proves who

This prevents backdating, misattribution, and post-hoc modification.

## Development

```bash
npm install
cp .env.example .env  # Add Postgres, Twilio, Stripe, OpenTimestamps config
npm start             # Express server
```

## Built With

Built entirely through AI-assisted development. Cryptographic architecture, Bitcoin anchoring, and sealed-entry verification designed for zero-trust proof of existence.
