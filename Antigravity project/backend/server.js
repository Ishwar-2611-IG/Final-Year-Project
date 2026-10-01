require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const PinataSDK = require('@pinata/sdk');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'medblock_dev_secret_2024';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const PINATA_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET = process.env.PINATA_SECRET_KEY || '';
const IPFS_API_URL = process.env.IPFS_API_URL || 'http://127.0.0.1:5002';

// ─── Gemini AI helper ──────────────────────────────────────────────────────────────────
async function summarizeWithGemini(transcript, prescriptionText) {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = `You are a medical AI assistant. A doctor has recorded the following clinical notes for a patient visit.

Clinical Transcript:
${transcript}

${prescriptionText ? `Prescription Notes:\n${prescriptionText}` : ''}

Based on the above, generate a structured medical report. Return ONLY a valid JSON object (no markdown) with exactly these fields:
{
  "summary": "2-3 sentence plain-English summary of the diagnosis and treatment plan",
  "medicines": ["medicine 1 with dosage and frequency", "medicine 2", ...],
  "precautions": ["precaution 1", "precaution 2", ...],
  "followUp": "follow-up instruction or timeline"
}

If medicines or precautions are not mentioned, return empty arrays. Keep it concise and medically accurate.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        // Strip markdown code fences if present
        const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
        const parsed = JSON.parse(clean);
        return {
            geminiUsed: true,
            summary: parsed.summary || '',
            medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
            precautions: Array.isArray(parsed.precautions) ? parsed.precautions : [],
            followUp: parsed.followUp || 'As advised by the attending doctor.',
        };
    } catch (err) {
        const isQuota = err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('RESOURCE_EXHAUSTED');
        console.warn(`[Gemini] ${isQuota ? '⚠️  Quota exceeded — using local smart extractor.' : 'Error: ' + err.message}`);

        // ── Smart local extractor ─────────────────────────────────────────────
        const fullText = ((transcript || '') + ' ' + (prescriptionText || '')).trim();
        // Split on sentence boundaries but keep full sentences intact
        const sentences = fullText
            .split(/(?<=[.!?])\s+|\n+/)
            .map(s => s.trim())
            .filter(Boolean);

        // 1️⃣ Medicine extraction — captures "Drug DoseUnit [frequency]" patterns
        //    e.g. "Amoxicillin 500mg twice daily", "Paracetamol 500mg", "Cetrizine 10mg at night"
        const dosePattern = /([A-Za-z][\w\s-]{1,28}?)\s+(\d+(?:\.\d+)?\s?(?:mg|ml|mcg|g|iu|units?)(?:\s*\/\s*\d+\s?(?:mg|ml))?)(?:\s+(?:once|twice|thrice|\d+\s?times?|\d+x)(?:\s+(?:daily|a\s+day|per\s+day|at\s+night|in\s+the\s+morning|bd|tid|od|hs))?)?/gi;
        const medicines = [];
        let match;
        const seenMeds = new Set();
        while ((match = dosePattern.exec(fullText)) !== null) {
            const med = match[0].replace(/^(?:and|also|with|plus|,|prescribed)\s+/i, '').trim();
            const key = med.toLowerCase().replace(/\s+/g, ' ');
            if (!seenMeds.has(key) && med.length > 3) {
                seenMeds.add(key);
                medicines.push(med);
            }
        }
        // Fallback: grab from prescriptionText lines if regex found nothing
        if (medicines.length === 0 && prescriptionText) {
            prescriptionText.split('\n').forEach(l => {
                const t = l.trim();
                if (t.length > 2) medicines.push(t);
            });
        }

        // 2️⃣ Precaution extraction: sentences with safety/lifestyle keywords
        const precautionRx = /\b(avoid|restrict|don[''t]+|do not|no alcohol|rest|drink (?:water|fluid|plenty)|bed rest|light (?:meal|diet)|low (?:fat|salt)|stay hydrated|keep wound dry|no heavy lifting|limit activity)\b/i;
        let precautions = sentences.filter(s => precautionRx.test(s)).slice(0, 4);
        if (precautions.length === 0) {
            precautions = ["Follow doctor's instructions carefully.", 'Return if symptoms worsen or persist.'];
        }

        // 3️⃣ Follow-up extraction — scan ALL sentences and the raw text for follow-up mentions
        const followRx = /\b(follow[ -]?up|review|return|revisit|come back|next visit|appointment in|see (?:me|us) in|in \d+\s*(?:day|week|month))\b/i;
        let followLine = sentences.find(s => followRx.test(s));
        // If sentence split swallowed it, try a direct regex on the full text
        if (!followLine) {
            const followMatch = fullText.match(/[^.!?\n]*\b(?:follow[ -]?up|in \d+\s*(?:day|week|month)|return in|come back in)[^.!?\n]*/i);
            followLine = followMatch ? followMatch[0].trim() : null;
        }

        // 4️⃣ Summary: first 2 meaningful sentences (diagnosis-like)
        const diagnosisRx = /\b(presents? with|diagnosis|diagnosed|suffering|complain|fever|pain|prescribed|impression|assessment)\b/i;
        const keySentences = sentences.filter(s => diagnosisRx.test(s)).slice(0, 2);
        const summary = keySentences.length > 0
            ? keySentences.join(' ')
            : fullText.slice(0, 250) + (fullText.length > 250 ? '…' : '');

        return {
            geminiUsed: false,
            summary,
            medicines,
            precautions,
            followUp: followLine || 'Schedule a follow-up as advised by the attending doctor.',
        };
    }
}

// ─── Gemini Vision: Extract prescription text from image ──────────────────────
async function extractTextFromImage(base64Data, mimeType) {
    try {
        if (!GEMINI_KEY) throw new Error('No Gemini API key');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType || 'image/jpeg',
                }
            },
            'This is a prescription or medical note image. Extract ALL text exactly as written. Include medicine names, dosages, frequencies, instructions, and any other text visible. Return only the extracted text, no commentary.'
        ]);
        const text = result.response.text().trim();
        console.log('[Gemini Vision] OCR completed — extracted', text.length, 'characters');
        return text;
    } catch (err) {
        console.warn('[Gemini Vision] OCR failed:', err.message);
        return null; // Non-fatal — fall back to typed prescription text
    }
}

// ─── IPFS Upload Helper (3-tier: Local Kubo Node → Pinata Cloud → SHA-256 Fallback) ───
async function uploadToIPFS(data, name) {
    const jsonStr = JSON.stringify(data, null, 2);

    // ─── Tier 1: Local IPFS node via HTTP RPC API (no ESM issues) ────────────────────────
    try {
        const form = new FormData();
        form.append('file', Buffer.from(jsonStr), { filename: `${name}.json`, contentType: 'application/json' });
        const addResp = await axios.post(`${IPFS_API_URL}/api/v0/add?pin=true&quieter=true`, form, {
            headers: form.getHeaders(),
            timeout: 10000,
        });
        const cidStr = addResp.data.Hash;
        console.log(`[IPFS★] Local node  CID: ${cidStr}`);

        // Cross-pin to Pinata for global persistence (non-blocking)
        if (PINATA_KEY && PINATA_SECRET && PINATA_KEY !== 'placeholder') {
            new PinataSDK(PINATA_KEY, PINATA_SECRET).pinJSONToIPFS(data, { pinataMetadata: { name } })
                .then(() => console.log('[IPFS★] Cross-pinned to Pinata ✔️'))
                .catch(e => console.warn('[IPFS] Pinata cross-pin failed:', e.message));
        }
        return { cid: cidStr, source: 'local', real: true };
    } catch (localErr) {
        console.warn('[IPFS] Local node unavailable:', (localErr.response?.data || localErr.message || '').toString().split('\n')[0]);
    }

    // ─── Tier 2: Pinata cloud only ────────────────────────────────────────────────
    if (PINATA_KEY && PINATA_SECRET && PINATA_KEY !== 'placeholder') {
        try {
            const result = await new PinataSDK(PINATA_KEY, PINATA_SECRET)
                .pinJSONToIPFS(data, { pinataMetadata: { name } });
            console.log(`[IPFS★] Pinata CID: ${result.IpfsHash}`);
            return { cid: result.IpfsHash, source: 'pinata', real: true };
        } catch (err) {
            console.error('[IPFS] Pinata cloud error:', err.message);
        }
    }

    // ─── Tier 3: Deterministic SHA-256 simulated CID ────────────────────────────────
    const hash = require('crypto').createHash('sha256').update(jsonStr).digest('hex');
    const simCid = 'Qm' + hash.slice(0, 44);
    console.warn(`[IPFS] Simulated CID (no real IPFS): ${simCid}`);
    return { cid: simCid, source: 'simulated', real: false };
}

// ─── Security & Parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: (origin, cb) => {
        // Allow any localhost origin (handles dynamic Vite ports)
        if (!origin || origin.startsWith('http://localhost')) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// ─── In-memory auth rate limiter (no extra deps) ──────────────────────────────
// Allow 10 login failures per IP in a 15-minute window before blocking
const loginAttempts = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX       = 10;

function authRateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (entry) {
        if (now < entry.resetAt) {
            if (entry.count >= RATE_MAX) {
                const retrySec = Math.ceil((entry.resetAt - now) / 1000);
                return res.status(429).json({ error: `Too many login attempts. Retry after ${retrySec}s.` });
            }
        } else {
            loginAttempts.delete(ip); // window expired
        }
    }
    next();
}

function recordLoginFailure(req) {
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (entry && now < entry.resetAt) {
        entry.count++;
    } else {
        loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    }
}

// Periodically clean up expired entries to avoid memory leak
setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of loginAttempts.entries()) {
        if (now >= e.resetAt) loginAttempts.delete(ip);
    }
}, RATE_WINDOW_MS);

// ─── Demo In-Memory Store ────────────────────────────────────────────────────
// All demo passwords = Admin@1234  (use bcrypt in production!)
const DEMO_PASSWORD = 'Admin@1234';

// ── Hospitals ─────────────────────────────────────────────────────────────────
let demoHospitals = [
    { id: 1, name: 'City General Hospital', address: '12 Rajpath, Connaught Place', city: 'New Delhi', state: 'Delhi', phone: '+91-11-23456789', email: 'admin@citygeneral.com', is_active: true, created_at: new Date(Date.now() - 90 * 86400000).toISOString() },
    { id: 2, name: 'Oakwood Medical Centre', address: '45 Bandra West, Linking Rd', city: 'Mumbai', state: 'Maharashtra', phone: '+91-22-98765432', email: 'admin@oakwood.com', is_active: true, created_at: new Date(Date.now() - 60 * 86400000).toISOString() },
    { id: 3, name: 'Apollo Sunrise Hospital', address: '8 MG Road, Brigade Gateway', city: 'Bengaluru', state: 'Karnataka', phone: '+91-80-11223344', email: 'admin@apollosunrise.com', is_active: true, created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
];

// ── Users ──────────────────────────────────────────────────────────────────────
// Hardhat test wallet addresses (accounts 0-3)
const demoUsersBase = [
    // ── Admin ──
    { id: 1, role: 'admin', email: 'admin@medblock.io', plain_password: DEMO_PASSWORD, first_name: 'System', last_name: 'Admin', hospital_id: null, is_active: true, created_at: new Date(Date.now() - 120 * 86400000).toISOString() },

    // ── Hospital Admins ──
    { id: 2, role: 'hospital', email: 'admin@citygeneral.com', plain_password: DEMO_PASSWORD, first_name: 'City General', last_name: 'Hospital', hospital_id: 1, is_active: true, created_at: new Date(Date.now() - 90 * 86400000).toISOString() },
    { id: 3, role: 'hospital', email: 'admin@oakwood.com', plain_password: DEMO_PASSWORD, first_name: 'Oakwood', last_name: 'Medical', hospital_id: 2, is_active: true, created_at: new Date(Date.now() - 60 * 86400000).toISOString() },
    { id: 4, role: 'hospital', email: 'admin@apollosunrise.com', plain_password: DEMO_PASSWORD, first_name: 'Apollo', last_name: 'Sunrise', hospital_id: 3, is_active: true, created_at: new Date(Date.now() - 30 * 86400000).toISOString() },

    // ── Doctors (email + password AND MetaMask wallet) ──
    { id: 5, role: 'doctor', email: 'dr.sarah.connor@citygeneral.com', plain_password: DEMO_PASSWORD, wallet_address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', first_name: 'Dr. Sarah', last_name: 'Connor', hospital_id: 1, is_active: true, specialization: 'General Practice', phone: '+91-98100-11111', created_at: new Date(Date.now() - 80 * 86400000).toISOString() },
    { id: 6, role: 'doctor', email: 'dr.rahul.verma@citygeneral.com', plain_password: DEMO_PASSWORD, wallet_address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', first_name: 'Dr. Rahul', last_name: 'Verma', hospital_id: 1, is_active: true, specialization: 'Cardiologist', phone: '+91-98100-22222', created_at: new Date(Date.now() - 75 * 86400000).toISOString() },
    { id: 7, role: 'doctor', email: 'dr.priya.sharma@oakwood.com', plain_password: DEMO_PASSWORD, wallet_address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc', first_name: 'Dr. Priya', last_name: 'Sharma', hospital_id: 2, is_active: true, specialization: 'Dermatologist', phone: '+91-98100-33333', created_at: new Date(Date.now() - 50 * 86400000).toISOString() },
    { id: 8, role: 'doctor', email: 'dr.aditya.nair@apollosunrise.com', plain_password: DEMO_PASSWORD, wallet_address: '0x90f79bf6eb2c4f870365e785982e1f101e93b906', first_name: 'Dr. Aditya', last_name: 'Nair', hospital_id: 3, is_active: true, specialization: 'Orthopaedic Surgeon', phone: '+91-98100-44444', created_at: new Date(Date.now() - 20 * 86400000).toISOString() },

    // ── Patients ──
    { id: 9, role: 'patient', email: 'john.doe@example.com', plain_password: DEMO_PASSWORD, first_name: 'John', last_name: 'Doe', hospital_id: 1, is_active: true, phone: '+91-99001-10001', date_of_birth: '1990-05-14', created_at: new Date(Date.now() - 70 * 86400000).toISOString() },
    { id: 10, role: 'patient', email: 'priya.patel@example.com', plain_password: DEMO_PASSWORD, first_name: 'Priya', last_name: 'Patel', hospital_id: 1, is_active: true, phone: '+91-99001-10002', date_of_birth: '1985-11-22', created_at: new Date(Date.now() - 65 * 86400000).toISOString() },
    { id: 11, role: 'patient', email: 'arjun.singh@example.com', plain_password: DEMO_PASSWORD, first_name: 'Arjun', last_name: 'Singh', hospital_id: 2, is_active: true, phone: '+91-99001-10003', date_of_birth: '1978-03-09', created_at: new Date(Date.now() - 45 * 86400000).toISOString() },
    { id: 12, role: 'patient', email: 'aisha.khan@example.com', plain_password: DEMO_PASSWORD, first_name: 'Aisha', last_name: 'Khan', hospital_id: 3, is_active: true, phone: '+91-99001-10004', date_of_birth: '1995-07-30', created_at: new Date(Date.now() - 15 * 86400000).toISOString() },
];
let demoUsers = [...demoUsersBase];

// ── Reports / Visits ──────────────────────────────────────────────────────────
let demoReports = [
    {
        id: 1, cid: 'QmRv8xJpLmNcY2aWZkBqEsPdFgH3tKuC7oI1nVsAzRe9X', tx_hash: '0x4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
        patient_id: 9, doctor_id: 5, hospital_id: 1, source: 'simulated',
        created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        patient_first: 'John', patient_last: 'Doe', doctor_first: 'Dr. Sarah', doctor_last: 'Connor', hospital_name: 'City General Hospital',
        summary: 'Patient presented with acute upper respiratory tract infection. Mild fever (100.4°F), sore throat, and congestion. No signs of pneumonia.',
        medicines: ['Amoxicillin 500mg — twice daily for 7 days', 'Paracetamol 650mg — as needed for fever', 'Cetirizine 10mg — once daily at night'],
        precautions: ['Stay hydrated — drink 3L of water daily', 'Avoid cold or iced beverages', 'Rest for at least 3 days', 'Wear a mask in public spaces'],
        followUp: 'Return in 7 days if symptoms persist or worsen.'
    },
    {
        id: 2, cid: 'QmTw9kMrSdCe4nXvLpAyBzRf6gHuI8jK2oP5qWsNtYeZa', tx_hash: '0x67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
        patient_id: 10, doctor_id: 6, hospital_id: 1, source: 'simulated',
        created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        patient_first: 'Priya', patient_last: 'Patel', doctor_first: 'Dr. Rahul', doctor_last: 'Verma', hospital_name: 'City General Hospital',
        summary: 'Patient presents with intermittent chest discomfort and shortness of breath on exertion over the past 2 weeks. ECG shows mild ST depression. Referred for stress test.',
        medicines: ['Aspirin 75mg — once daily after breakfast', 'Atorvastatin 20mg — once at bedtime', 'Metoprolol 25mg — once daily'],
        precautions: ['Avoid strenuous physical activity until stress test results', 'Low-sodium, low-fat diet', 'Monitor blood pressure daily', 'Avoid smoking and alcohol'],
        followUp: 'Stress test scheduled in 5 days. Follow up with results immediately.'
    },
    {
        id: 3, cid: 'QmUx7lNqReAf5oYwMpBzDgCk1hJvK3nP9sQtWuLiBcVdE', tx_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        patient_id: 11, doctor_id: 7, hospital_id: 2, source: 'simulated',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        patient_first: 'Arjun', patient_last: 'Singh', doctor_first: 'Dr. Priya', doctor_last: 'Sharma', hospital_name: 'Oakwood Medical Centre',
        summary: 'Recurring eczema flare-up on forearms and neck. Itching has worsened over 10 days. No secondary infection noted. Skin patch test ordered to identify triggers.',
        medicines: ['Betamethasone 0.1% cream — apply twice daily to affected areas', 'Levocetirizine 5mg — once daily', 'Vaseline Intensive Care — moisturise 3x daily'],
        precautions: ['Avoid hot showers; use lukewarm water', 'Use fragrance-free detergents', 'Wear loose, cotton clothing', 'Avoid known allergens (dust, pet dander)'],
        followUp: 'Patch test results in 72 hours. Return for review.'
    },
];

// ── Appointments ──────────────────────────────────────────────────────────────
let demoAppointments = [
    { id: 1, patient_id: 9, doctor_id: 5, hospital_id: 1, appointment_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], reason: 'Follow-up for throat infection', status: 'scheduled', doctor_first: 'Dr. Sarah', doctor_last: 'Connor', specialization: 'General Practice', hospital_name: 'City General Hospital' },
    { id: 2, patient_id: 10, doctor_id: 6, hospital_id: 1, appointment_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0], reason: 'Stress test review and ECG follow-up', status: 'scheduled', doctor_first: 'Dr. Rahul', doctor_last: 'Verma', specialization: 'Cardiologist', hospital_name: 'City General Hospital' },
    { id: 3, patient_id: 12, doctor_id: 8, hospital_id: 3, appointment_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], reason: 'Knee pain assessment and X-ray review', status: 'scheduled', doctor_first: 'Dr. Aditya', doctor_last: 'Nair', specialization: 'Orthopaedic Surgeon', hospital_name: 'Apollo Sunrise Hospital' },
];

// ── Audit Logs ────────────────────────────────────────────────────────────────
let demoAuditLogs = [
    { id: 1, actor_id: 1, action: 'SYSTEM_INIT', target: 'demo mode', email: 'admin@medblock.io', role: 'admin', created_at: new Date(Date.now() - 120 * 86400000).toISOString() },
    { id: 2, actor_id: 1, action: 'CREATE_HOSPITAL', target: 'City General Hospital', email: 'admin@medblock.io', role: 'admin', created_at: new Date(Date.now() - 90 * 86400000).toISOString() },
    { id: 3, actor_id: 1, action: 'CREATE_HOSPITAL', target: 'Oakwood Medical Centre', email: 'admin@medblock.io', role: 'admin', created_at: new Date(Date.now() - 60 * 86400000).toISOString() },
    { id: 4, actor_id: 1, action: 'CREATE_HOSPITAL', target: 'Apollo Sunrise Hospital', email: 'admin@medblock.io', role: 'admin', created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
    { id: 5, actor_id: 2, action: 'REGISTER_DOCTOR', target: 'Dr. Sarah Connor', email: 'admin@citygeneral.com', role: 'hospital', created_at: new Date(Date.now() - 80 * 86400000).toISOString() },
    { id: 6, actor_id: 2, action: 'REGISTER_DOCTOR', target: 'Dr. Rahul Verma', email: 'admin@citygeneral.com', role: 'hospital', created_at: new Date(Date.now() - 75 * 86400000).toISOString() },
    { id: 7, actor_id: 2, action: 'REGISTER_PATIENT', target: 'John Doe', email: 'admin@citygeneral.com', role: 'hospital', created_at: new Date(Date.now() - 70 * 86400000).toISOString() },
    { id: 8, actor_id: 2, action: 'REGISTER_PATIENT', target: 'Priya Patel', email: 'admin@citygeneral.com', role: 'hospital', created_at: new Date(Date.now() - 65 * 86400000).toISOString() },
    { id: 9, actor_id: 3, action: 'REGISTER_DOCTOR', target: 'Dr. Priya Sharma', email: 'admin@oakwood.com', role: 'hospital', created_at: new Date(Date.now() - 50 * 86400000).toISOString() },
    { id: 10, actor_id: 3, action: 'REGISTER_PATIENT', target: 'Arjun Singh', email: 'admin@oakwood.com', role: 'hospital', created_at: new Date(Date.now() - 45 * 86400000).toISOString() },
    { id: 11, actor_id: 5, action: 'CREATE_REPORT', target: 'QmRv8xJpLmNcY2aWZkBq...', email: 'dr.sarah@citygeneral.com', role: 'doctor', created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
    { id: 12, actor_id: 6, action: 'CREATE_REPORT', target: 'QmTw9kMrSdCe4nXvLp...', email: 'dr.rahul@citygeneral.com', role: 'doctor', created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
    { id: 13, actor_id: 7, action: 'CREATE_REPORT', target: 'QmUx7lNqReAf5oYwMp...', email: 'dr.priya@oakwood.com', role: 'doctor', created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
];
let nextId = 20;

function init() {
    const PORT = process.env.PORT || 5001;
    app.listen(PORT, () => {
        console.log(`[MedBlock API] Running on http://localhost:${PORT}`);
        console.log(`[MedBlock API] 🟡 DEMO MODE — in-memory store (no PostgreSQL required)`);
        console.log(`[MedBlock API] Default logins — Admin@1234 for all email accounts`);
    });
}
init();

function makeToken(user) {
    return jwt.sign({ id: user.id, role: user.role, email: user.email || null, hospitalId: user.hospital_id }, JWT_SECRET, { expiresIn: '24h' });
}
function requireAuth(req, res, next) {
    const h = req.headers.authorization;
    if (!h) return res.status(401).json({ error: 'No token' });
    try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
    catch { res.status(401).json({ error: 'Invalid token' }); }
}
function requireRole(...roles) {
    return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });
}

// ─── Auth ───────────────────────────────────────────────────────────────────
// Email + password login — role MUST match the tab the user logged in from
app.post('/api/auth/login', authRateLimiter, (req, res) => {
    const { email, password, role } = req.body;

    // Role field is mandatory for security
    if (!role) return res.status(400).json({ error: 'Role is required.' });

    const user = demoUsers.find(u => u.email === email);
    // Use a generic "Invalid credentials" for email/password mismatches to prevent email enumeration
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = (password === (user.plain_password || DEMO_PASSWORD));
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // ── RBAC: Enforce role match ─────────────────────────────────────────────
    if (user.role !== role.toLowerCase()) {
        return res.status(401).json({ error: 'Invalid credentials for this role.' });
    }

    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });

    demoAuditLogs.unshift({ id: nextId++, actor_id: user.id, action: 'LOGIN', target: email, email, role: user.role, created_at: new Date().toISOString() });
    res.json({ token: makeToken(user), user: { id: user.id, role: user.role, email: user.email, firstName: user.first_name, lastName: user.last_name, hospitalId: user.hospital_id } });
});

// MetaMask wallet login — role is optional but if provided must match
app.post('/api/auth/login/wallet', (req, res) => {
    const { address, role } = req.body;
    if (!address) return res.status(400).json({ error: 'Wallet address required.' });
    const user = demoUsers.find(u => u.wallet_address?.toLowerCase() === address.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Wallet not registered. Ask your administrator to link your wallet.' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated.' });
    // ── RBAC: Enforce role match if role was provided by the frontend ────────
    if (role && user.role !== role.toLowerCase()) {
        return res.status(401).json({ error: 'Invalid credentials for this role.' });
    }
    demoAuditLogs.unshift({ id: nextId++, actor_id: user.id, action: 'WALLET_LOGIN', target: address, email: user.email || address, role: user.role, created_at: new Date().toISOString() });
    res.json({ token: makeToken(user), user: { id: user.id, role: user.role, email: user.email || null, firstName: user.first_name, lastName: user.last_name, hospitalId: user.hospital_id } });
});
// Legacy doctor wallet route — strictly enforces doctor role
app.post('/api/auth/login/doctor', (req, res) => {
    const { address } = req.body;
    const user = demoUsers.find(u => u.wallet_address?.toLowerCase() === address?.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Doctor not registered. Ask your Hospital Admin.' });
    // Strict doctor-only enforcement on this legacy route
    if (user.role !== 'doctor') return res.status(401).json({ error: 'Invalid credentials for this role.' });
    res.json({ token: makeToken(user), user: { id: user.id, role: 'doctor', email: user.email || null, firstName: user.first_name, lastName: user.last_name, hospitalId: user.hospital_id } });
});

// Link MetaMask wallet to an authenticated account
app.post('/api/auth/link-wallet', requireAuth, (req, res) => {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Wallet address required.' });
    // Check if another user already has this wallet
    const conflict = demoUsers.find(u => u.wallet_address?.toLowerCase() === address.toLowerCase() && u.id !== req.user.id);
    if (conflict) return res.status(409).json({ error: 'This wallet is already linked to another account.' });
    const user = demoUsers.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.wallet_address = address.toLowerCase();
    demoAuditLogs.unshift({ id: nextId++, actor_id: user.id, action: 'LINK_WALLET', target: address, email: user.email || address, role: user.role, created_at: new Date().toISOString() });
    res.json({ success: true, walletAddress: user.wallet_address });
});

// Hospital self-registration (pending admin approval in production)
app.post('/api/auth/register-hospital', (req, res) => {
    const { hospitalName, email, password, phone, address, city, state, registrationId } = req.body;
    if (!hospitalName || !email || !password) return res.status(400).json({ error: 'Hospital name, email, and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (demoUsers.find(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    // Create hospital entry
    const hosp = { id: nextId++, name: hospitalName, address: address || '', city: city || '', state: state || '', phone: phone || '', email, registration_id: registrationId || '', is_active: true, created_at: new Date().toISOString() };
    demoHospitals.push(hosp);
    // Create hospital admin user
    const admin = { id: nextId++, role: 'hospital', email, plain_password: password, first_name: hospitalName, last_name: 'Admin', phone: phone || null, hospital_id: hosp.id, is_active: true, created_at: new Date().toISOString() };
    demoUsers.push(admin);
    demoAuditLogs.unshift({ id: nextId++, actor_id: admin.id, action: 'HOSPITAL_SIGNUP', target: hospitalName, email, role: 'hospital', created_at: new Date().toISOString() });
    res.status(201).json({ token: makeToken(admin), user: { id: admin.id, role: 'hospital', email, firstName: hospitalName, lastName: 'Admin', hospitalId: hosp.id } });
});

// Patient self-registration
app.post('/api/auth/register', (req, res) => {
    const { firstName, lastName, email, password, phone, dateOfBirth } = req.body;
    if (!firstName || !email || !password) return res.status(400).json({ error: 'First name, email, and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (demoUsers.find(u => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    // Assign to the first active hospital (in production, patient chooses)
    const defaultHospital = demoHospitals.find(h => h.is_active) || demoHospitals[0];
    const newUser = {
        id: nextId++, role: 'patient',
        email, plain_password: password,
        first_name: firstName, last_name: lastName || '',
        phone: phone || null, date_of_birth: dateOfBirth || null,
        hospital_id: defaultHospital?.id || 1,
        is_active: true, created_at: new Date().toISOString(),
    };
    demoUsers.push(newUser);
    demoAuditLogs.unshift({ id: nextId++, actor_id: newUser.id, action: 'SELF_REGISTER', target: email, email, role: 'patient', created_at: new Date().toISOString() });
    res.status(201).json({ token: makeToken(newUser), user: { id: newUser.id, role: 'patient', email, firstName: newUser.first_name, lastName: newUser.last_name, hospitalId: newUser.hospital_id } });
});

// ─── Admin ────────────────────────────────────────────────────────────────────
app.get('/api/admin/stats', requireAuth, requireRole('admin'), (req, res) => {
    res.json({
        hospitals: demoHospitals.filter(h => h.is_active).length,
        doctors: demoUsers.filter(u => u.role === 'doctor' && u.is_active).length,
        patients: demoUsers.filter(u => u.role === 'patient' && u.is_active).length,
        reports: demoReports.length,
    });
});
app.get('/api/admin/hospitals', requireAuth, requireRole('admin'), (req, res) => {
    res.json({ hospitals: demoHospitals });
});
app.post('/api/admin/hospitals', requireAuth, requireRole('admin'), (req, res) => {
    const { name, address, city, state, phone, email, password } = req.body;
    const h = { id: nextId++, name, address, city, state, phone, email, is_active: true, created_at: new Date().toISOString() };
    demoHospitals.push(h);
    demoUsers.push({ id: nextId++, role: 'hospital', email, plain_password: password || DEMO_PASSWORD, first_name: name, last_name: 'Admin', hospital_id: h.id, is_active: true });
    demoAuditLogs.unshift({ id: nextId++, actor_id: req.user.id, action: 'CREATE_HOSPITAL', target: h.id, email: req.user.email, role: 'admin', created_at: new Date().toISOString() });
    res.status(201).json({ hospital: h });
});
app.put('/api/admin/hospitals/:id', requireAuth, requireRole('admin'), (req, res) => {
    const h = demoHospitals.find(x => x.id == req.params.id);
    if (h) Object.assign(h, req.body);
    res.json({ hospital: h });
});
app.delete('/api/admin/hospitals/:id', requireAuth, requireRole('admin'), (req, res) => {
    const h = demoHospitals.find(x => x.id == req.params.id);
    if (h) h.is_active = false;
    res.json({ success: true });
});
app.get('/api/admin/users', requireAuth, requireRole('admin'), (req, res) => {
    const { role } = req.query;
    let users = demoUsers.map(u => ({ id: u.id, role: u.role, email: u.email, wallet_address: u.wallet_address, first_name: u.first_name, last_name: u.last_name, hospital_id: u.hospital_id, is_active: u.is_active, created_at: u.created_at || new Date().toISOString() }));
    if (role) users = users.filter(u => u.role === role);
    res.json({ users });
});
app.patch('/api/admin/users/:id/status', requireAuth, requireRole('admin'), (req, res) => {
    const u = demoUsers.find(x => x.id == req.params.id);
    if (u) u.is_active = req.body.is_active;
    res.json({ user: u });
});
app.get('/api/admin/audit-logs', requireAuth, requireRole('admin'), (req, res) => {
    res.json({ logs: demoAuditLogs });
});

// ─── Hospital ─────────────────────────────────────────────────────────────────
app.get('/api/hospital/stats', requireAuth, requireRole('hospital'), (req, res) => {
    const hid = req.user.hospitalId || demoUsers.find(u => u.id === req.user.id)?.hospital_id;
    res.json({
        doctors: demoUsers.filter(u => u.role === 'doctor' && u.hospital_id == hid && u.is_active).length,
        patients: demoUsers.filter(u => u.role === 'patient' && u.hospital_id == hid && u.is_active).length,
        reports: demoReports.filter(r => r.hospital_id == hid).length,
        pendingAppointments: demoAppointments.filter(a => a.hospital_id == hid && a.status === 'scheduled').length,
    });
});
app.get('/api/hospital/doctors', requireAuth, requireRole('hospital'), (req, res) => {
    const hid = demoUsers.find(u => u.id === req.user.id)?.hospital_id;
    res.json({ doctors: demoUsers.filter(u => u.role === 'doctor' && u.hospital_id == hid) });
});
app.post('/api/hospital/doctors', requireAuth, requireRole('hospital'), async (req, res) => {
    const { firstName, lastName, walletAddress, specialization, phone, email, password } = req.body;
    const hid = demoUsers.find(u => u.id === req.user.id)?.hospital_id;
    const doc = {
        id: nextId++, role: 'doctor',
        wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
        email: email || null,
        plain_password: password || 'Admin@1234',
        first_name: firstName, last_name: lastName,
        specialization, phone, hospital_id: hid, is_active: true,
    };
    demoUsers.push(doc);
    demoAuditLogs.unshift({ id: nextId++, actor_id: req.user.id, action: 'REGISTER_DOCTOR', target: doc.id, email: req.user.email, role: 'hospital', created_at: new Date().toISOString() });
    res.status(201).json({ doctor: doc });
});
app.get('/api/hospital/patients', requireAuth, requireRole('hospital', 'doctor'), (req, res) => {
    const hid = demoUsers.find(u => u.id === req.user.id)?.hospital_id;
    res.json({ patients: demoUsers.filter(u => u.role === 'patient' && u.hospital_id == hid).map(u => ({ id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone, date_of_birth: u.date_of_birth, created_at: u.created_at || new Date().toISOString() })) });
});
app.post('/api/hospital/patients', requireAuth, requireRole('hospital'), (req, res) => {
    const { firstName, lastName, email, password, phone, dateOfBirth } = req.body;
    const hid = demoUsers.find(u => u.id === req.user.id)?.hospital_id;
    const pat = { id: nextId++, role: 'patient', email, plain_password: password || DEMO_PASSWORD, first_name: firstName, last_name: lastName, phone, date_of_birth: dateOfBirth, hospital_id: hid, is_active: true, created_at: new Date().toISOString() };
    demoUsers.push(pat);
    demoAuditLogs.unshift({ id: nextId++, actor_id: req.user.id, action: 'REGISTER_PATIENT', target: pat.id, email: req.user.email, role: 'hospital', created_at: new Date().toISOString() });
    res.status(201).json({ patient: pat });
});
app.get('/api/hospital/reports', requireAuth, requireRole('hospital'), (req, res) => {
    const hid = demoUsers.find(u => u.id === req.user.id)?.hospital_id;
    res.json({ reports: demoReports.filter(r => r.hospital_id == hid) });
});
app.get('/api/hospital/appointments', requireAuth, requireRole('hospital'), (req, res) => {
    const hid = demoUsers.find(u => u.id === req.user.id)?.hospital_id;
    res.json({ appointments: demoAppointments.filter(a => a.hospital_id == hid) });
});

// ─── Doctor ───────────────────────────────────────────────────────────────────
// Reports created by the logged-in doctor
app.get('/api/doctor/reports', requireAuth, requireRole('doctor'), (req, res) => {
    res.json({ reports: demoReports.filter(r => r.doctor_id === req.user.id) });
});

// ─── Visits / Reports ─────────────────────────────────────────────────────────
app.post('/api/visits/record', requireAuth, requireRole('doctor'), async (req, res) => {
    const { patientId, hospitalId, transcript, prescriptionText, imageData, imageMimeType } = req.body;
    const hasTranscript = transcript && transcript.trim().length >= 5;
    const hasImage = imageData && typeof imageData === 'string' && imageData.length > 100;

    if (!hasTranscript && !hasImage) {
        return res.status(400).json({ error: 'Clinical notes or a prescription image is required.' });
    }

    try {
        const txHash = '0x' + require('crypto').randomBytes(20).toString('hex');

        // 📷 Step 1 (optional): OCR prescription image with Gemini Vision
        let ocrText = null;
        if (hasImage) {
            console.log('[Gemini Vision] Extracting text from prescription image…');
            // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,")
            const base64 = imageData.includes(',') ? imageData.split(',')[1] : imageData;
            ocrText = await extractTextFromImage(base64, imageMimeType || 'image/jpeg');
            if (ocrText) {
                console.log('[Gemini Vision] OCR success.');
            } else {
                console.warn('[Gemini Vision] OCR returned no text — report will use transcript only.');
            }
        }

        // 🧩 Step 2: Merge all text sources for AI summarization
        // Priority: voice transcript > typed prescription > OCR extracted text
        const combinedPrescription = [
            prescriptionText || '',
            ocrText ? `\n[Prescription Image OCR]:\n${ocrText}` : ''
        ].join(' ').trim();

        const effectiveTranscript = hasTranscript
            ? transcript
            : `Patient visit notes extracted from prescription image. ${combinedPrescription}`;

        // 🤖 Step 3: Gemini AI summarization
        console.log('[Gemini] Summarizing clinical data…');
        let ai;
        try {
            ai = await summarizeWithGemini(effectiveTranscript, combinedPrescription);
            console.log('[Gemini] Summary generated successfully.');
        } catch (aiErr) {
            console.error('[Gemini] Summarization failed:', aiErr.message);
            return res.status(500).json({ error: 'AI summarization failed: ' + aiErr.message });
        }

        // 📦 Step 4: Build IPFS payload
        const doctor = demoUsers.find(u => u.id === req.user.id);
        const patient = demoUsers.find(u => u.id == patientId);
        const hospital = demoHospitals.find(h => h.id == hospitalId);
        const ipfsPayload = {
            version: '1.0',
            createdAt: new Date().toISOString(),
            patient: { id: patientId, name: `${patient?.first_name || '?'} ${patient?.last_name || ''}`.trim() },
            doctor: { id: req.user.id, name: `${doctor?.first_name || 'Dr.'} ${doctor?.last_name || '?'}`.trim(), specialization: doctor?.specialization || 'General Practice' },
            hospital: { id: hospitalId, name: hospital?.name || '?' },
            transcript: effectiveTranscript,
            ocrText: ocrText || null,
            aiSummary: ai,
            txHash,
        };

        // 🌐 Step 5: Upload to IPFS
        console.log('[IPFS] Uploading report to IPFS…');
        const ipfsResult = await uploadToIPFS(ipfsPayload, `MedBlock-Report-P${patientId}-${Date.now()}`);
        const cid = ipfsResult.cid;
        console.log(`[IPFS] CID: ${cid} (real=${ipfsResult.real})`);

        // 🔗 Step 6: Save report in-memory
        const report = {
            id: nextId++, cid, tx_hash: txHash, ipfs_real: ipfsResult.real,
            patient_id: parseInt(patientId), doctor_id: req.user.id, hospital_id: parseInt(hospitalId),
            created_at: new Date().toISOString(),
            patient_first: patient?.first_name || '?',
            patient_last: patient?.last_name || '',
            doctor_first: doctor?.first_name || 'Dr.',
            doctor_last: doctor?.last_name || '?',
            specialization: doctor?.specialization || 'General Practice',
            hospital_name: hospital?.name || '?',
            summary: ai.summary,
            medicines: ai.medicines,
            precautions: ai.precautions,
            followUp: ai.followUp,
            hasImage: hasImage,
            ocrText: ocrText || null,
            source: ipfsResult.source || 'simulated',
        };
        demoReports.unshift(report);
        demoAuditLogs.unshift({ id: nextId++, actor_id: req.user.id, action: 'CREATE_REPORT', target: cid, email: req.user.email, role: 'doctor', created_at: new Date().toISOString() });
        res.status(201).json({
            success: true, cid, txHash, ipfsReal: ipfsResult.real, source: ipfsResult.source || 'simulated',
            geminiUsed: ai.geminiUsed === true,
            summary: ai.summary, medicines: ai.medicines, precautions: ai.precautions, followUp: ai.followUp,
            ocrText: ocrText || null, hasImage,
        });
    } catch (err) {
        console.error('[visits/record] Unexpected error:', err);
        res.status(500).json({ error: 'Failed to process report: ' + err.message });
    }
});
app.get('/api/visits/my-records', requireAuth, requireRole('patient'), (req, res) => {
    res.json({ records: demoReports.filter(r => r.patient_id === req.user.id) });
});
app.get('/api/visits/patient/:patientId', requireAuth, requireRole('doctor'), (req, res) => {
    res.json({ records: demoReports.filter(r => r.patient_id == req.params.patientId) });
});
app.post('/api/visits/appointments', requireAuth, requireRole('patient'), (req, res) => {
    const { doctorId, hospitalId, appointmentDate, reason } = req.body;
    const doc = demoUsers.find(u => u.id == doctorId);
    const hosp = demoHospitals.find(h => h.id == hospitalId);
    const pat = demoUsers.find(u => u.id === req.user.id);
    const appt = {
        id: nextId++, patient_id: req.user.id,
        doctor_id: parseInt(doctorId), hospital_id: parseInt(hospitalId),
        appointment_date: appointmentDate, reason, status: 'scheduled',
        patient_first: pat?.first_name || '?', patient_last: pat?.last_name || '?',
        doctor_first: doc?.first_name || '?', doctor_last: doc?.last_name || '?',
        specialization: doc?.specialization || '', hospital_name: hosp?.name || '?',
    };
    demoAppointments.unshift(appt);
    res.status(201).json({ appointment: appt });
});
app.get('/api/visits/appointments', requireAuth, requireRole('patient'), (req, res) => {
    res.json({ appointments: demoAppointments.filter(a => a.patient_id === req.user.id) });
});

// ─── Health & Status Endpoints ───────────────────────────────────────────────

// Full system health
app.get('/api/health', (req, res) => {
    const pinataOk  = !!(PINATA_KEY && PINATA_SECRET && PINATA_KEY !== 'placeholder');
    const geminiOk  = !!GEMINI_KEY;
    res.json({
        status:    'ok',
        mode:      'demo',
        timestamp: new Date().toISOString(),
        uptime:    Math.floor(process.uptime()),
        ai: {
            keyPresent: geminiOk,
            model:      'gemini-2.0-flash',
            status:     geminiOk ? 'configured' : 'no-key',
        },
        ipfs: {
            localConfigured:   !!IPFS_API_URL,
            pinataConfigured:  pinataOk,
            tier: pinataOk ? 'pinata' : 'simulated',
        },
        counts: {
            reports:      demoReports.length,
            users:        demoUsers.length,
            hospitals:    demoHospitals.length,
            appointments: demoAppointments.length,
        },
    });
});

// AI (Gemini) specific status
app.get('/api/health/ai', (req, res) => {
    const keyPresent = !!GEMINI_KEY;
    res.json({
        geminiKeyPresent: keyPresent,
        model:            'gemini-2.0-flash',
        status:           keyPresent ? 'ok' : 'no-key',
        message:          keyPresent
            ? 'Gemini API key is configured. Model ready.'
            : 'No GEMINI_API_KEY set — local smart extractor will be used as fallback.',
    });
});

// Blockchain / IPFS status + last CIDs
app.get('/api/blockchain/status', (req, res) => {
    const pinataOk = !!(PINATA_KEY && PINATA_SECRET && PINATA_KEY !== 'placeholder');
    const tier = demoReports.some(r => r.source === 'pinata') ? 'pinata'
               : demoReports.some(r => r.source === 'local')  ? 'local'
               : pinataOk ? 'pinata' : 'simulated';
    const lastCids = demoReports
        .slice(0, 5)
        .map(r => ({ cid: r.cid, source: r.source, date: r.created_at }));
    res.json({
        ipfsTier:    tier,
        reportCount: demoReports.length,
        uptime:      Math.floor(process.uptime()),
        lastCids,
    });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
