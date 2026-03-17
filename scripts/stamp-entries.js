#!/usr/bin/env node
/**
 * Stamp all founding entries into The Tower.
 *
 * - Open entries: plaintext sent directly
 * - Sealed entries: AES-256-GCM encrypted client-side, only ciphertext + hash sent
 * - Keys saved to local JSON file for later retrieval
 *
 * Usage: node scripts/stamp-entries.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOWER_URL = process.env.TOWER_URL || 'https://thetower.one';
const PHONE_HASH = '59458508a0827cff5f80ed091ebd8808fbe67c97357b58ca00a278e7359dec20';
const KEY_FILE = path.join(__dirname, '..', 'founding-keys.json');

// ─── AES-256-GCM Encryption ─────────────────────────────────────

function encrypt(plaintext, password) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
        ciphertext: encrypted + ':' + authTag,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
    };
}

function sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

// ─── Entry Definitions ───────────────────────────────────────────

const ENTRIES = [
    // FOUNDING DOCUMENTS — Open (plaques on the wall)
    { id: 'F-1', tier: 'open', category: 'disclosure', inscription: 'Tower Founding Docs',
      text: fs.readFileSync(path.join(__dirname, '..', 'founding-docs', 'THE_TOWER_Founding_Document.md'), 'utf8') },

    // F-2 and F-3 from the stamp entries file — we'll extract inline
    { id: 'F-2', tier: 'open', category: 'disclosure', inscription: 'Tower Founding Docs',
      text: `ENTRY F-2: Synthetic Dialectic — New Scholarly Discipline. I, Neill Groom, conceived and defined "Synthetic Dialectic" — a formal methodology for recorded human-AI investigative discourse where the raw conversation transcript IS the scholarly artifact. The methodology features fluid role exchange: the human provides domain expertise, conviction, and directional intuition; the AI provides systematic research, synthesis, and verification. Conceived February 7-8, 2026.` },

    { id: 'F-3', tier: 'sealed', category: 'disclosure', inscription: 'Tower Founding Docs — Financial Architecture',
      text: `ENTRY F-3: TOWER Token — Revenue-Participation Digital Security. I, Neill Groom (CFA, EA), designed the TOWER token financial architecture — a revenue-participation digital security with 1 billion fixed supply, 30% of gross platform revenue distributed quarterly to token holders. Three-series fundraising: Seed $0.01/token, Growth $0.10/token, Infrastructure $1.00/token. Treated as securities from day one with full KYC/AML. Designed February 8, 2026.` },

    // PATENT CLAIMS — All Sealed (vault doors with inscriptions)
    { id: 'P-1', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-1: Weakness-Aware Content Generation for Incidental Learning. System that dynamically generates reading passages embedding linguistic structures corresponding to learner's identified weaknesses without explicitly identifying target structures. Validated at ~92% pattern match rate. First implemented February 2026.` },

    { id: 'P-2', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-2: Pre-Deployment Mathematical Verification of LLM-Generated Educational Content. Two-stage verification pipeline: Stage 1 validates structural correctness, Stage 2 uses second LLM to independently solve and compare. Cards deploy only upon solution agreement. First implemented February 2026.` },

    { id: 'P-3', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-3: Source-Tagged LLM Responses with Knowledge Gap Detection. Every LLM response internally tagged with source confidence level, stripped before display but logged for analytics. When model falls back to training data, system logs knowledge gap. Deployed across Quincy, Audrey, and Ledger. First implemented 2025.` },

    { id: 'P-4', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-4: Dual-Layer Progress Tracking with Spaced Repetition. Declarative knowledge (concepts) and procedural knowledge (skills) tracked independently with mastery levels 1-5 and spaced repetition intervals. Consolidation via separate LLM call merges duplicates. Deployed in Newton, Euclid, Cicero, Lengua. First implemented 2025.` },

    { id: 'P-5', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-5: Multi-Framework Comparative Reasoning with Convergence Tracking. System simultaneously considers PCAOB, AICPA SAS/SSARS/SSAE, and ISA frameworks with curated cross-reference map covering 16 audit topic areas. Implemented in Audrey. First implemented 2025.` },

    { id: 'P-6', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-6: Fire-and-Forget Dual-Model Extraction Pipeline. After every chat exchange, two asynchronous non-blocking LLM calls extract structured data. Sonnet handles teaching, Haiku handles extraction of memories and progress data. Non-blocking, runs after response streams. First implemented 2025.` },

    { id: 'P-7', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-7: Semantic Memory System with Per-Category Capping and Consolidation. 8 semantic categories with per-category caps totaling ~125 max in system prompt. explicit_preference category overrides all other signals. Session model: messages deleted but memories persist. First implemented 2025.` },

    { id: 'P-8', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-8: Anti-Hallucination Guardrails for Regulated Domains. Never invent IRC sections, never fabricate tax rates, four-level sourcing hierarchy: KB Cited > IRC/Statute > "Generally" Hedge > Silence. Anti-sycophancy rules maintain correct positions with citations. 98.7-100% accuracy across products. First implemented 2025.` },

    { id: 'P-9', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-9: Interactive Exercise Card System with Structured Resolution. 10 exercise types, 6 interactive block types, 5 visual transitions, two-stage resolution (reaction + followup). Both signals feed into tutor's next action and progress tracking. First implemented 2025.` },

    { id: 'P-10', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-10: Profile-Aware Knowledge Adaptation for Professional Domains. User profile (business_type, accounting_basis, industry) injected into system prompt enabling same knowledge base to provide different guidance based on entity type. First implemented 2025.` },

    { id: 'P-11', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-11: Boundary Violation Testing Framework for Constrained AI Agents. 89 boundary tests across 10 categories, 35 evasion tests, 75 numerical accuracy tests. Anti-sanctimony testing: AI cites criminal statutes without lecturing. First implemented February 2026.` },

    { id: 'P-12', tier: 'sealed', category: 'claim', inscription: 'JNG — Patent Claims',
      text: `ENTRY P-12: Automated Tax Planning from Unstructured IRS Transcripts. Parses unstructured IRS transcripts using regex to extract 50+ fields across 12 forms, runs 30+ deterministic detection rules, generates PDF Report Card. No ML/LLM for parsing — purely rule-based. PII lifecycle: verify -> 30-min session -> 48-hr download -> auto-delete. First implemented 2025-2026.` },

    // PRODUCT DESCRIPTIONS — Open (plaques)
    { id: 'PROD-1', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Newton — AI Math & Physics Tutor. Next.js 16, React 19, Supabase, Claude Sonnet 4.5/Haiku 4.5. Socratic tutor with 5 curriculum tracks, KaTeX rendering, 10 exercise types, dual-layer progress tracking, persistent semantic memory. Built for my sons. First implemented 2025.` },

    { id: 'PROD-2', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Euclid — AI Geometry Tutor. Geometry-focused variant of Newton sharing same monorepo architecture. First implemented 2025-2026.` },

    { id: 'PROD-3', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Cicero — AI SAT Reading & Writing Tutor. Implements weakness-aware content generation. Dynamically generates reading passages embedding linguistic structures corresponding to student weaknesses. First implemented 2025-2026.` },

    { id: 'PROD-4', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Lengua — AI Language Learning Coach. Dialect-first teaching, 100 scenario templates, progressive immersion, vocabulary/grammar tracking with spaced repetition. Voice integration architecturally ready. First implemented 2025-2026.` },

    { id: 'PROD-5', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Quincy — AI Tax Information Concierge. Cloudflare Workers, Claude Haiku 4.5. 7 curated KB files (225KB), strict 4-level sourcing hierarchy, NJ-specific awareness, embeddable widget, source tagging for knowledge gap detection. 98.7% accuracy. First implemented 2025.` },

    { id: 'PROD-6', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Audrey — AI Audit Standards Research Assistant. Covers PCAOB, AICPA SAS/SSARS/SSAE, and ISA simultaneously. 2,400+ line curated knowledge base, cross-reference map covering 16 audit topic areas. 100% accuracy on 68 tests. First implemented 2025.` },

    { id: 'PROD-7', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Ledger — AI Accounting Standards Research Assistant. Covers GAAP (ASC), IFRS, and FRF for SMEs. 321KB knowledge base across 4 files. 100% accuracy on 68 tests. First implemented 2025.` },

    { id: 'PROD-8', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Ledger Essentials — AI Bookkeeping Assistant. For non-CPAs. 96KB knowledge base, profile-aware guidance, Stripe billing, iOS via Capacitor. First implemented 2025.` },

    { id: 'PROD-9', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Tax Scanner — Automated IRS Transcript Planning Engine. Flask-based, parses unstructured IRS transcripts, 30+ detection rules, PDF Report Card, email verification security chain, PII never stored persistently. First implemented 2025-2026.` },

    { id: 'PROD-10', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `WeVest Planners — Financial Goal Optimization Calculators. Serverless Netlify Functions. FV/PV/PMT, Social Security PIA, college funding, retirement drawdown, binary search optimizer for competing goals. First implemented 2025.` },

    { id: 'PROD-11', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `JNG Redactor — IRS Transcript PII Scrubber. Standalone desktop application (Python/tkinter, .exe via PyInstaller). All processing local, no network. First implemented 2025.` },

    { id: 'PROD-12', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `My Day — AI Personal Coach with Tracker System. Chat-based AI coach with tool calls for planning cards, trackers, reminders. Stoic framing, no ghosts, everything divisible. First implemented 2025-2026.` },

    // DATA ASSETS — Open
    { id: 'DATA-1', tier: 'open', category: 'record', inscription: 'JNG',
      text: `IRC Title 26 — Structured XML Repository. Complete Internal Revenue Code organized by subtitle. Source: official government XML. Repository created February 2026.` },

    { id: 'DATA-2', tier: 'open', category: 'record', inscription: 'JNG',
      text: `CFR 2025 Title 26 — Treasury Regulations XML. Complete 2025 Code of Federal Regulations Title 26 across 21 volumes, ~115MB. Source: official government XML. Repository created February 2026.` },

    // ARCHITECTURE — Sealed
    { id: 'ARCH-1', tier: 'sealed', category: 'claim', inscription: 'JNG — Architecture',
      text: `ENTRY ARCH-1: Multi-Product AI Platform Architecture. Shared architecture across 7+ products: user intake with parallel DB context loading, persistent semantic memory (~125 entries, 8 categories), cached domain knowledge bases in system prompts, primary Sonnet + secondary Haiku fire-and-forget extraction, source tagging, prompt caching. Domain-agnostic generalizability proven. First implemented 2025.` },

    // INTELLECTUAL CONTRIBUTIONS — Open
    { id: 'IC-1', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Synthetic Dialectic — Formal Discipline Definition. Conceived February 7-8, 2026. Raw conversation transcript IS the scholarly artifact. Roles fluid and non-hierarchical. Published for community analysis. Discovery emerges from the dialectic itself.` },

    { id: 'IC-2', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `Performative Proof — Self-Instantiating Origin as Design Principle. The Tower's first entry is The Tower itself. The system that proves ideas are original is proven necessary by being original. Conceived February 8, 2026.` },

    { id: 'IC-3', tier: 'open', category: 'disclosure', inscription: 'JNG',
      text: `The FASB Paywall Discovery. Discovered February 7-8, 2026 that FASB removed its paywall on ASC in February 2023, making all U.S. GAAP standards freely accessible for the first time. Previously $850-1,500/year. Directly enabled creation of Quincy, Audrey, Ledger, and Ledger Essentials.` },

    // ORIGIN STORY — Open
    { id: 'ORIGIN-1', tier: 'open', category: 'record', inscription: 'JNG',
      text: `The Most Productive Month. Neill Groom, tax/accounting professional (CFA, EA) with no prior software development background, created 20+ software repositories containing 200+ commits across TypeScript, Python, and JavaScript in 27 days (January 26 to February 22, 2026). No publicly documented comparable example exists at this scale.` },

    { id: 'ORIGIN-2', tier: 'open', category: 'itoldyouso', inscription: 'JNG',
      text: `The Builder's Thesis. The most potent AI-assisted development scenario is a domain expert with genuine problems to solve using AI to express solutions they already understand architecturally. The "70% wall" was broken through sustained iteration. Documented February 23, 2026.` },

    { id: 'ORIGIN-3', tier: 'open', category: 'record', inscription: 'JNG',
      text: `The Sprint Timeline. 20+ repositories in 27 days starting January 26, 2026. One new repository every 1.3 days, accelerating. TypeScript, Python, JavaScript. Next.js, React 19, Supabase, Claude API, Vercel, Netlify, Render, Cloudflare Workers, Capacitor, Flask, PyInstaller.` },

    // TRUST ARCHITECTURE — Mixed
    { id: 'TRUST-1', tier: 'open', category: 'claim', inscription: 'JNG Tax Advisory Trust Proof of Intent',
      text: `Two-Stage Firewalled Data Architecture for Tax Document Processing. Stage 1 (Client-Side Redactor) runs in browser — PDF text extraction via pdf.js, regex PII stripping. Stage 2 (Server-Side Scanner) receives ONLY redacted text. Three access paths: in-browser, Chrome extension, desktop .exe. Declaration of intent timestamped prior to implementation. Designed March 14, 2026.` },

    { id: 'TRUST-2', tier: 'open', category: 'disclosure', inscription: 'JNG Tax Advisory Trust Proof of Intent',
      text: `JNG Tax Product Suite — Unified Commercial Architecture. Three products (Quincy, Ledger Plugin, Tax Scanner) sold as embeddable widgets. Common model: firms embed widget, visitors get value, firms pay per interaction and per conversion. Metered billing via Stripe. Multi-tenant. Designed March 14, 2026.` },

    { id: 'TRUST-3', tier: 'sealed', category: 'claim', inscription: 'JNG Tax Advisory Trust Proof of Intent — Architecture',
      text: `Sealed Entry Architecture — Dual-Key Encrypted Timestamping. Entries encrypted client-side, Tower stores ciphertext + plaintext hash, anchors hash to Bitcoin. Two-key model: Tower proves WHEN, owner proves WHAT. Three tiers: password-based AES-256-GCM, asymmetric keypair, Shamir's Secret Sharing M-of-N. Designed March 14, 2026.` },

    { id: 'TRUST-4', tier: 'sealed', category: 'claim', inscription: 'JNG Tax Advisory Trust Proof of Intent — Architecture',
      text: `Tiered Security Model with Per-Entry User Choice. Four tiers: Open (plaintext), Sealed (AES-256-GCM), Vault (Shamir M-of-N), Tomb (time-locked, cannot open until set date). Higher tiers command higher pricing. Designed March 14, 2026.` },

    { id: 'TRUST-5', tier: 'sealed', category: 'claim', inscription: 'JNG Tax Advisory Trust Proof of Intent — Architecture',
      text: `Public Inscriptions on Sealed Entries — The Vault Door Model. Every sealed entry carries unencrypted, immutable inscription visible to all. Visual metaphor: dwarven tower with vault doors bearing inscriptions. Open entries are plaques on the wall (no door). Conceived March 14, 2026.` },

    // META — Open
    { id: 'META-1', tier: 'open', category: 'itoldyouso', inscription: 'JNG',
      text: `The Tower Is a Legacy Project — in both senses of the word. Legacy as in: built weeks ago and already half-forgotten. And legacy as in: something you leave behind. The dual meaning was intentional. Noted March 14, 2026.` },

    { id: 'META-2', tier: 'open', category: 'record', inscription: 'JNG',
      text: `"Imagine if Tesla Had The Tower." Tesla died in 1943 with 300+ patents but countless unrecorded ideas. Rosalind Franklin's Photo 51 shown without consent. Leibniz vs Newton calculus war. Meucci lost telephone priority for $10. Farnsworth sketched electronic TV at 14. Katherine Johnson's calculations attributed to the team. Every whistleblower ever. The Tower is for anyone who said something true before the world was ready. Conceived March 14, 2026.` },
];

// ─── Stamping Logic ──────────────────────────────────────────────

async function stampEntries() {
    const masterPassword = 'TowerFounder2026!' + crypto.randomBytes(8).toString('hex');
    const keys = { master_password: masterPassword, entries: {} };

    console.log(`\n▲ THE TOWER — Stamping ${ENTRIES.length} founding entries`);
    console.log(`  Master password saved to: ${KEY_FILE}`);
    console.log(`  API: ${TOWER_URL}`);
    console.log();

    let openCount = 0;
    let sealedCount = 0;
    let errors = [];

    for (const entry of ENTRIES) {
        let body;

        if (entry.tier === 'open') {
            body = {
                phone_hash: PHONE_HASH,
                text: entry.text,
                category: entry.category,
                tier: 'open',
                inscription: entry.inscription,
                tags: [entry.id],
            };
            openCount++;
        } else {
            // Sealed: encrypt client-side
            const hashText = sha256(entry.text);
            const encrypted = encrypt(entry.text, masterPassword);

            body = {
                phone_hash: PHONE_HASH,
                hash_text: hashText,
                ciphertext: encrypted.ciphertext,
                encryption_salt: encrypted.salt,
                encryption_iv: encrypted.iv,
                category: entry.category,
                tier: 'sealed',
                inscription: entry.inscription,
                tags: [entry.id],
            };

            // Save key info for later retrieval
            keys.entries[entry.id] = {
                hash_text: hashText,
                salt: encrypted.salt,
                iv: encrypted.iv,
                inscription: entry.inscription,
            };
            sealedCount++;
        }

        try {
            const resp = await fetch(`${TOWER_URL}/api/entries/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await resp.json();

            if (data.carved) {
                const symbol = entry.tier === 'open' ? '📜' : '🔒';
                console.log(`  ${symbol} ${entry.id}: Entry #${data.entry.id} — ${entry.tier} — ${entry.inscription}`);

                // Save entry ID to keys
                if (keys.entries[entry.id]) {
                    keys.entries[entry.id].tower_entry_id = data.entry.id;
                }
            } else {
                console.log(`  ❌ ${entry.id}: ${JSON.stringify(data)}`);
                errors.push(entry.id);
            }
        } catch (err) {
            console.log(`  ❌ ${entry.id}: ${err.message}`);
            errors.push(entry.id);
        }
    }

    // Save keys
    fs.writeFileSync(KEY_FILE, JSON.stringify(keys, null, 2));

    console.log();
    console.log(`▲ STAMPING COMPLETE`);
    console.log(`  Open (plaques):  ${openCount}`);
    console.log(`  Sealed (vaults): ${sealedCount}`);
    console.log(`  Errors:          ${errors.length}`);
    console.log(`  Keys saved to:   ${KEY_FILE}`);
    console.log();

    if (errors.length > 0) {
        console.log(`  Failed entries: ${errors.join(', ')}`);
    }

    // Check stats
    try {
        const statsResp = await fetch(`${TOWER_URL}/api/stats`);
        const stats = await statsResp.json();
        console.log(`  Tower stats: ${stats.total_entries} entries, ${stats.anchored_entries} anchored`);
    } catch (e) {
        // ignore
    }
}

stampEntries().catch(console.error);
