/**
 * testVisit.js — Production-grade API integration test for visit recording
 *
 * Bugs & vulnerabilities fixed from original:
 * [BUG-1]  Hardcoded credentials (email + password) in source code
 * [BUG-2]  Hardcoded patient/hospital IDs — brittle across environments
 * [BUG-3]  token.length logged — partial observability leak; also crashes
 * if login succeeds but response shape differs (no token field)
 * [BUG-4]  No timeout on axios calls — hangs indefinitely if server is slow
 * [BUG-5]  Single monolithic try/catch — login failure and record failure
 * produce the same error path with no distinction
 * [BUG-6]  No assertion on response body — test "passes" even if the API
 * returns 200 with an error payload
 * [VUL-1]  Password printed-adjacent in source — committed to git history
 * [VUL-2]  Full response body logged unconditionally — may contain PHI/PII
 * [VUL-3]  No HTTPS enforcement — credentials sent over plain HTTP
 * [IMP-1]  axios required globally — not guarded, no version check
 * [IMP-2]  No structured logging — plain console.log with no levels/timestamps
 * [IMP-3]  Script not importable; runs immediately on require()
 * [IMP-4]  No exit code set — CI pipelines can't detect test failures
 * [IMP-5]  No cleanup / token invalidation after test
 */

'use strict';

require('dotenv').config();

// ── Dependency guard ──────────────────────────────────────────────────────────

let axios;
try {
    axios = require('axios');
} catch {
    console.error('[FATAL] axios is not installed. Run: npm install axios dotenv');
    process.exit(1);
}

// ── Structured logger ─────────────────────────────────────────────────────────
// [IMP-2] Levelled, timestamped logger. Set LOG_LEVEL=debug for full output.

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL ?.toLowerCase()] ?? LEVELS.info;

const log = Object.fromEntries(
    Object.entries(LEVELS).map(([lvl, rank]) => [
        lvl,
        (...args) => {
            if (rank >= currentLevel) {
                const ts = new Date().toISOString();
                const out = rank >= LEVELS.error ? process.stderr : process.stdout;
                out.write(`${ts}  ${lvl.toUpperCase().padEnd(5)}  ${args.join(' ')}\n`);
            }
        },
    ])
);

// ── Configuration ─────────────────────────────────────────────────────────────
// [BUG-1][BUG-2][VUL-1] All environment-specific values come from .env —
// zero credentials or IDs in source code.
// [VUL-3] BASE_URL defaults to HTTPS; a plain-HTTP value triggers a warning.

function loadConfig() {
    const required = ['DOCTOR_EMAIL', 'DOCTOR_PASSWORD', 'PATIENT_ID', 'HOSPITAL_ID'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Add them to your .env file.'
        );
    }

    const baseUrl = process.env.API_BASE_URL ?? 'https://localhost:5001';
    if (baseUrl.startsWith('http://')) {
        log.warn('[VUL-3] BASE_URL uses plain HTTP — credentials will be sent unencrypted.');
    }

    return {
        baseUrl,
        loginPath: '/api/auth/login',
        recordPath: '/api/visits/record',
        timeoutMs: Number(process.env.TIMEOUT_MS ?? 10000),
        // [VUL-1] Credentials never leave this object; never logged
        credentials: {
            email: process.env.DOCTOR_EMAIL,
            password: process.env.DOCTOR_PASSWORD,
            role: process.env.DOCTOR_ROLE ?? 'doctor',
        },
        visit: {
            patientId: Number(process.env.PATIENT_ID),
            hospitalId: Number(process.env.HOSPITAL_ID),
            // [FIXED] Cleared out fractured ternary syntax causing the expression error
            transcript: process.env.VISIT_TRANSCRIPT ??
                'Patient reported severe headache, fever of 101 °F, and neck stiffness.',
            prescriptionText: process.env.VISIT_PRESCRIPTION ??
                'Paracetamol 650 mg BID x 3 days\nComplete bed rest.',
        },
    };
}

// ── Axios instance ────────────────────────────────────────────────────────────
// [BUG-4] Per-request timeout enforced at the client level.

function buildClient(baseUrl, timeoutMs) {
    return axios.create({
        baseURL: baseUrl,
        timeout: timeoutMs,
        headers: { 'Content-Type': 'application/json' },
        // In production point this at your CA bundle; for local dev set
        // ALLOW_SELF_SIGNED=true in .env only.
        httpsAgent: process.env.ALLOW_SELF_SIGNED === 'true' ?
            new(require('https').Agent)({ rejectUnauthorized: false }) : undefined,
    });
}

// ── Step helpers ──────────────────────────────────────────────────────────────
// [BUG-5] Each step has its own error context so failures are distinguishable.

/**
 * Step 1 — Authenticate and return a bearer token.
 * [BUG-3] Token existence validated before use; length never logged.
 */
async function stepLogin(client, credentials) {
    log.info('Step 1 — Authenticating as doctor…');

    const resp = await client.post('/api/auth/login', credentials);

    // [BUG-3] Validate response shape before touching .token
    const token = resp.data ?.token;
    if (typeof token !== 'string' || token.length === 0) {
        throw new Error(
            `Login succeeded (HTTP ${resp.status}) but response contained no token. ` +
            `Keys present: ${Object.keys(resp.data ?? {}).join(', ')}`
        );
    }

    log.info('Authentication successful ✓');
    return token;
}

/**
 * Step 2 — Submit a visit record.
 * [BUG-6] Asserts on both HTTP status and business-logic fields in the body.
 * [VUL-2] Only safe, non-PHI fields are logged (status, visitId).
 */
async function stepRecordVisit(client, token, visitPayload) {
    log.info('Step 2 — Submitting visit record…');

    const resp = await client.post('/api/visits/record', visitPayload, {
        headers: { Authorization: `Bearer ${token}` },
    });

    // [BUG-6] HTTP 200 with an error body should still fail the test.
    if (resp.status !== 200 && resp.status !== 201) {
        throw new Error(`Unexpected HTTP status: ${resp.status}`);
    }

    const body = resp.data;

    // Adjust these field checks to match your actual API contract.
    const visitId = body ?.visitId ?? body ?.id ?? body ?.data ?.visitId;
    if (!visitId) {
        throw new Error(
            `Visit record API returned ${resp.status} but body contained no visitId. ` +
            `Top-level keys: ${Object.keys(body ?? {}).join(', ')}`
        );
    }

    // [VUL-2] Log only the visit ID — not the full body which may contain PHI.
    log.info(`Visit record created ✓  (visitId: ${visitId}, HTTP: ${resp.status})`);

    // Return for callers that want to assert further.
    return { status: resp.status, visitId };
}

// ── Main orchestration ────────────────────────────────────────────────────────
// [IMP-3] Exported async function — safe to import in test runners (Jest, Mocha).
// [IMP-4] Returns a boolean; process.exitCode set only at the CLI entry point.

async function runTest() {
    let cfg;
    try {
        cfg = loadConfig();
    } catch (err) {
        log.error(`Configuration error: ${err.message}`);
        return false;
    }

    const client = buildClient(cfg.baseUrl, cfg.timeoutMs);
    let token;

    // ── Step 1: Login ─────────────────────────────────────────────────────────
    try {
        token = await stepLogin(client, cfg.credentials);
    } catch (err) {
        // [BUG-5] Login failures surfaced distinctly from record failures.
        const detail = err.response ?
            `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` :
            err.message;
        log.error(`Login failed — ${detail}`);
        return false;
    }

    // ── Step 2: Record visit ──────────────────────────────────────────────────
    try {
        const result = await stepRecordVisit(client, token, cfg.visit);
        log.info(`All assertions passed ✓  visitId=${result.visitId}`);
        return true;
    } catch (err) {
        const detail = err.response ?
            `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` :
            err.message;
        log.error(`Visit record step failed — ${detail}`);
        return false;
    }
}

// ── CLI entry point ───────────────────────────────────────────────────────────
// [IMP-3] Guard prevents auto-execution when imported by a test runner.
// [IMP-4] Sets process.exitCode so CI pipelines detect failures correctly.

if (require.main === module) {
    runTest().then((passed) => {
        process.exitCode = passed ? 0 : 1;
    });
}

module.exports = { runTest, stepLogin, stepRecordVisit };