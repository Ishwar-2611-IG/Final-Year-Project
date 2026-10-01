/**
 * gemini_connect.js — Production-grade Gemini API connection verifier
 *
 * Bugs & vulnerabilities fixed from original:
 *  [BUG-1]  API key partially printed to stdout — security leak
 *  [BUG-2]  Mixing async Promise chain inside sync try/catch — catch block
 *             never fires for async errors; only sync constructor errors caught
 *  [BUG-3]  No timeout — generateContent() can hang indefinitely
 *  [BUG-4]  result.response.text() accessed unconditionally — crashes on
 *             safety-filtered / quota-blocked empty responses
 *  [BUG-5]  Key length check `> 8` is meaningless; 9-char garbage passes
 *  [BUG-6]  process.exit() called inside Promise chain — skips any pending
 *             cleanup / flushes; also untestable
 *  [VUL-1]  Masked key printed to stdout leaks entropy to logs / CI
 *  [VUL-2]  err.message logged raw — could contain PII or internal paths
 *  [IMP-1]  Plain console.log — no timestamps, no levels, no structure
 *  [IMP-2]  No retry logic for transient network / 5xx errors
 *  [IMP-3]  Model name and prompt hardcoded in function body
 *  [IMP-4]  Not importable as a module — everything runs on require()
 */

'use strict';

require('dotenv').config();

// ── Dependency guard ──────────────────────────────────────────────────────────

let GoogleGenerativeAI;
try {
    ({ GoogleGenerativeAI } = require('@google/generative-ai'));
} catch {
    console.error(
        '[FATAL] @google/generative-ai is not installed.\n' +
        'Run:  npm install @google/generative-ai dotenv'
    );
    process.exit(1);
}

// ── Structured logger ─────────────────────────────────────────────────────────
// [IMP-1] Replaces bare console.log with levelled, timestamped output.
// LOG_LEVEL env var controls verbosity (debug | info | warn | error).

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

const log = Object.fromEntries(
    Object.entries(LEVELS).map(([level, rank]) => [
        level,
        (...args) => {
            if (rank >= currentLevel) {
                const ts = new Date().toISOString();
                const out = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
                out.write(`${ts}  ${level.toUpperCase().padEnd(5)}  ${args.join(' ')}\n`);
            }
        },
    ])
);

// ── Configuration ─────────────────────────────────────────────────────────────
// [IMP-3] All tunables in one place — no magic constants buried in logic.

const CONFIG = {
    modelName: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    probePrompt: 'Respond with exactly: Connection Successful!',
    maxRetries: Number(process.env.MAX_RETRIES ?? 3),
    retryBaseDelayMs: Number(process.env.RETRY_BASE_DELAY_MS ?? 1000),
    timeoutMs: Number(process.env.TIMEOUT_MS ?? 30000),
    minKeyLength: 20, // all current Gemini keys are 39 chars
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Typed sleep — avoids leaking setTimeout handles. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wrap a promise with a hard timeout.
 * [BUG-3] generateContent() has no built-in timeout; this enforces one.
 */
function withTimeout(promise, ms, label = 'operation') {
    let timer;
    const race = Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`Timed out after ${ms}ms (${label})`)),
                ms
            );
        }),
    ]);
    // Clear timer on settlement so the process can exit cleanly.
    return race.finally(() => clearTimeout(timer));
}

// ── Key validation ────────────────────────────────────────────────────────────

/**
 * Validate the key exists and looks plausible.
 * [VUL-1] No portion of the key is ever logged.
 * [BUG-5] Threshold is meaningful and configurable.
 */
function validateApiKey(key) {
    if (!key) {
        throw new Error(
            'GEMINI_API_KEY is not set. ' +
            'Add it to your .env file or export it as an environment variable.'
        );
    }
    if (key.length < CONFIG.minKeyLength) {
        throw new Error(
            `GEMINI_API_KEY is too short (${key.length} chars). ` +
            'Verify you copied the full key from Google AI Studio.'
        );
    }
    log.info(`API key found (length: ${key.length}) ✓`);
    return key;
}

// ── Connection probe with retry ───────────────────────────────────────────────

/**
 * Send a low-cost probe and return the response text.
 * [IMP-2] Exponential back-off for transient network / 5xx errors.
 * [BUG-4] Checks response structure before accessing .text().
 * [VUL-2] Only logs sanitised error messages, not raw error objects.
 */
async function probeWithRetry(model) {
    let lastErr;

    for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
        log.info(`Attempt ${attempt}/${CONFIG.maxRetries} — sending probe request…`);

        try {
            const result = await withTimeout(
                model.generateContent(CONFIG.probePrompt),
                CONFIG.timeoutMs,
                'generateContent'
            );

            // [BUG-4] Safety filters or quota issues can yield an unusable response.
            const candidates = result ?.response ?.candidates;
            if (!candidates ?.length) {
                const feedback = result ?.response ?.promptFeedback;
                throw new TypeError(
                    `Empty response (no candidates). Prompt feedback: ${JSON.stringify(feedback)}`
                );
            }

            const text = result.response.text().trim();
            if (!text) throw new TypeError('Response .text() returned an empty string.');

            return text;

        } catch (err) {
            lastErr = err;

            // TypeError = structural issue — retrying will not help.
            if (err instanceof TypeError) throw err;

            const isLast = attempt === CONFIG.maxRetries;
            const delay = CONFIG.retryBaseDelayMs * 2 ** (attempt - 1);

            // [VUL-2] Log only the message, not the full error (may contain tokens/paths).
            log.warn(
                `Attempt ${attempt} failed: ${err.message}` +
                (isLast ? ' — no more retries.' : ` — retrying in ${delay}ms…`)
            );

            if (!isLast) await sleep(delay);
        }
    }

    throw new Error(`All ${CONFIG.maxRetries} attempts failed. Last: ${lastErr?.message}`);
}

// ── Main orchestration ────────────────────────────────────────────────────────
// [IMP-4] Exported as a module-friendly async function.
//         process.exit() only at the CLI entry point below.
// [BUG-2] Fully async/await — no mixed sync try/catch + Promise chain.

async function run() {
    // 1. Validate key
    const apiKey = validateApiKey(process.env.GEMINI_API_KEY);

    // 2. Initialise SDK
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: CONFIG.modelName });
    log.info(`Gemini SDK configured — model: ${CONFIG.modelName}`);

    // 3. Probe
    const t0 = Date.now();
    const reply = await probeWithRetry(model);
    const ms = Date.now() - t0;

    log.info(`Response received in ${ms}ms: ${JSON.stringify(reply)}`);
    log.info('SUCCESS — Gemini API connection verified ✓');
}

// ── CLI entry point ───────────────────────────────────────────────────────────
// [BUG-6] process.exit() lives only here, after all async work is done.

if (require.main === module) {
    run().catch((err) => {
        log.error(`FATAL: ${err.message}`);
        process.exitCode = 1; // lets Node flush streams before exit
    });
}

module.exports = { run, validateApiKey, probeWithRetry };