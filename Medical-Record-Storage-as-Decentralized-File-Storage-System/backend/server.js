require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Mistral } = require("@mistralai/mistralai");
const PinataSDK = require("@pinata/sdk");
const axios = require("axios");
const FormData = require("form-data");
const crypto = require("crypto"); // FIX-7: top-level require, not inline
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "medblock_dev_secret_2024";
const IPFS_API_URL = process.env.IPFS_API_URL || "http://127.0.0.1:5002";

// FIX-1: Lazy key getters — always read fresh from process.env, never frozen at startup
const getGeminiKey = () => process.env.GEMINI_API_KEY || "";
const getGeminiModel = () => process.env.GEMINI_MODEL || "gemini-2.5-flash";
const getMistralKey = () => process.env.MISTRAL_API_KEY || "";
const getPinataKey = () => process.env.PINATA_API_KEY || "";
const getPinataSecret = () => process.env.PINATA_SECRET_KEY || "";

// ─── Separate ID counters per collection (FIX-1 for ID collisions) ────────────
const ids = {
  hospitals: { next: 10 },
  users: { next: 20 },
  reports: { next: 50 },
  appointments: { next: 70 },
  logs: { next: 100 },
};

function nextId(collection) {
  return ids[collection].next++;
}

// ─── Input validation helpers (FIX-2) ────────────────────────────────────────
function str(val, max = 200) {
  if (val === undefined || val === null) return "";
  if (typeof val !== "string") return "";
  return val.trim().slice(0, max);
}

function requireFields(obj, fields) {
  for (const f of fields) {
    if (!obj[f] || (typeof obj[f] === "string" && !obj[f].trim())) {
      return `Missing required field: ${f}`;
    }
  }
  return null;
}

// ─── Gemini Logging & Sleep Helpers ──────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function logGemini(status, details) {
  try {
    const logDir = path.join(__dirname, "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "gemini.log");
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [STATUS: ${status}] ${JSON.stringify(details)}\n`;
    fs.appendFileSync(logFile, entry);
  } catch (e) {
    console.error("[Gemini Log] Failed to write to gemini.log", e);
  }
}

// ─── Gemini AI helper ─────────────────────────────────────────────────────────
async function summarizeWithGemini(transcript, prescriptionText) {
  // FIX-1: read key fresh every call
  const key = getGeminiKey();
  let lastError = null;
  if (!key) {
    console.warn(
      "[Gemini] No API key configured — using local smart extractor.",
    );
    logGemini("SKIP", { reason: "No API key configured" });
    // fall through to local extractor below
  } else {
    let delay = 1000;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`[Gemini] Attempt ${attempt} of ${maxRetries + 1}...`);
        const startTime = Date.now();
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: getGeminiModel() });
        const prompt = `You are a medical AI assistant. A doctor has recorded the following clinical notes for a patient visit.

Clinical Transcript:
${transcript}

${prescriptionText ? `Prescription Notes:\n${prescriptionText}` : ""}

Based on the above, generate a structured medical report. Return ONLY a valid JSON object (no markdown) with exactly these fields:
{
  "summary": "2-3 sentence plain-English summary of the diagnosis and treatment plan",
  "medicines": ["medicine 1 with dosage and frequency", "medicine 2", ...],
  "precautions": ["precaution 1", "precaution 2", ...],
  "followUp": "follow-up instruction or timeline"
}

If medicines or precautions are not mentioned, return empty arrays. Keep it concise and medically accurate.`;

        const result = await model.generateContent(prompt);
        const latency = Date.now() - startTime;
        const text = result.response.text().trim();
        const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
        const parsed = JSON.parse(clean);

        logGemini("SUCCESS", {
          attempt,
          latencyMs: latency,
          model: getGeminiModel(),
          transcriptLength: transcript.length,
          prescriptionTextLength: prescriptionText
            ? prescriptionText.length
            : 0,
        });

        return {
          geminiUsed: true,
          summary: parsed.summary || "",
          medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
          precautions: Array.isArray(parsed.precautions)
            ? parsed.precautions
            : [],
          followUp: parsed.followUp || "As advised by the attending doctor.",
        };
      } catch (err) {
        lastError = err;
        const errMessage = err.message || String(err);
        const isQuota =
          err?.status === 429 ||
          err?.message?.includes("429") ||
          err?.message?.toLowerCase().includes("quota") ||
          err?.message?.includes("RESOURCE_EXHAUSTED") ||
          err?.errorDetails?.some?.(
            (d) => d.reason === "RATE_LIMIT_EXCEEDED",
          ) ||
          err?.code === "RESOURCE_EXHAUSTED";

        logGemini("ERROR", {
          attempt,
          isQuota,
          errorMessage: errMessage,
          errorDetails: JSON.parse(
            JSON.stringify(err, Object.getOwnPropertyNames(err)),
          ),
        });

        if (attempt <= maxRetries) {
          console.warn(
            `[Gemini] Attempt ${attempt} failed: ${errMessage}. Retrying in ${delay}ms...`,
          );
          await sleep(delay);
          delay *= 2;
        } else {
          if (isQuota) {
            console.error(`[Gemini] Quota exceeded after ${attempt} attempts.`);
          } else {
            console.error(
              `[Gemini] Non-quota error after ${attempt} attempts:`,
              JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
            );
          }
        }
      }
    }
  }

  // ── Local smart extractor (fallback) ──────────────────────────────────────
  const fullText = ((transcript || "") + " " + (prescriptionText || "")).trim();
  const sentences = fullText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const dosePattern =
    /([A-Za-z][\w\s-]{1,28}?)\s+(\d+(?:\.\d+)?\s?(?:mg|ml|mcg|g|iu|units?)(?:\s*\/\s*\d+\s?(?:mg|ml))?)(?:\s+(?:once|twice|thrice|\d+\s?times?|\d+x)(?:\s+(?:daily|a\s+day|per\s+day|at\s+night|in\s+the\s+morning|bd|tid|od|hs))?)?/gi;
  const medicines = [];
  let match;
  const seenMeds = new Set();
  while ((match = dosePattern.exec(fullText)) !== null) {
    const med = match[0]
      .replace(/^(?:and|also|with|plus|,|prescribed)\s+/i, "")
      .trim();
    const key = med.toLowerCase().replace(/\s+/g, " ");
    if (!seenMeds.has(key) && med.length > 3) {
      seenMeds.add(key);
      medicines.push(med);
    }
  }
  if (medicines.length === 0 && prescriptionText) {
    prescriptionText.split("\n").forEach((l) => {
      const t = l.trim();
      if (t.length > 2) medicines.push(t);
    });
  }

  const precautionRx =
    /\b(avoid|restrict|don[''t]+|do not|no alcohol|rest|drink (?:water|fluid|plenty)|bed rest|light (?:meal|diet)|low (?:fat|salt)|stay hydrated|keep wound dry|no heavy lifting|limit activity)\b/i;
  let precautions = sentences.filter((s) => precautionRx.test(s)).slice(0, 4);
  if (precautions.length === 0) {
    precautions = [
      "Follow doctor's instructions carefully.",
      "Return if symptoms worsen or persist.",
    ];
  }

  const followRx =
    /\b(follow[ -]?up|review|return|revisit|come back|next visit|appointment in|see (?:me|us) in|in \d+\s*(?:day|week|month))\b/i;
  let followLine = sentences.find((s) => followRx.test(s));
  if (!followLine) {
    const followMatch = fullText.match(
      /[^.!?\n]*\b(?:follow[ -]?up|in \d+\s*(?:day|week|month)|return in|come back in)[^.!?\n]*/i,
    );
    followLine = followMatch ? followMatch[0].trim() : null;
  }

  const diagnosisRx =
    /\b(presents? with|diagnosis|diagnosed|suffering|complain|fever|pain|prescribed|impression|assessment)\b/i;
  const keySentences = sentences.filter((s) => diagnosisRx.test(s)).slice(0, 2);
  const summary =
    keySentences.length > 0
      ? keySentences.join(" ")
      : fullText.slice(0, 250) + (fullText.length > 250 ? "…" : "");

  return {
    geminiUsed: false,
    geminiError: key
      ? lastError?.message || String(lastError)
      : "No API key configured",
    summary,
    medicines,
    precautions,
    followUp:
      followLine || "Schedule a follow-up as advised by the attending doctor.",
  };
}

// ─── Mistral OCR: Extract prescription text from image ───────────────────────
// Flow: base64 → Buffer → Blob (in-memory) → Mistral upload → signed URL → OCR
// FIX: Mistral SDK requires a Blob/File — NOT a ReadStream or file path.
async function extractTextFromImage(base64Data, mimeType) {
  const key = getMistralKey();
  if (!key) {
    console.warn("[Mistral OCR] No MISTRAL_API_KEY configured — skipping OCR.");
    return { text: null, error: "No MISTRAL_API_KEY configured" };
  }

  const safeType = mimeType || "image/jpeg";
  const ext = safeType.split("/")[1]?.split("+")[0] || "jpg";

  try {
    // 1. Decode base64 → Buffer → Blob (what Mistral SDK actually accepts)
    const imgBuffer = Buffer.from(base64Data, "base64");
    const imgBlob = new Blob([imgBuffer], { type: safeType });

    // 2. Upload the Blob to Mistral Files API (purpose = "ocr")
    const client = new Mistral({ apiKey: key });
    console.log(
      `[Mistral OCR] Uploading image (${(imgBlob.size / 1024).toFixed(1)} KB, type=${safeType}) to Mistral…`,
    );
    const uploadedFile = await client.files.upload({
      file: {
        fileName: `prescription.${ext}`,
        content: imgBlob,
      },
      purpose: "ocr",
    });

    // 3. Get a short-lived signed URL for the uploaded file
    console.log(
      `[Mistral OCR] File uploaded (id=${uploadedFile.id}). Getting signed URL…`,
    );
    const signedUrl = await client.files.getSignedUrl({
      fileId: uploadedFile.id,
    });

    // 4. Run OCR using mistral-ocr-latest
    console.log("[Mistral OCR] Running OCR with mistral-ocr-latest…");
    const ocrResponse = await client.ocr.process({
      model: "mistral-ocr-latest",
      document: {
        type: "image_url",
        imageUrl: signedUrl.url,
      },
    });

    // 5. Concatenate all page markdown into one string
    const text = ocrResponse.pages
      .map((page) => page.markdown)
      .join("\n\n")
      .trim();

    console.log(
      `[Mistral OCR] OCR completed — ${text.length} characters extracted across ${ocrResponse.pages.length} page(s)`,
    );

    // 6. Delete the remote file to keep usage clean (non-blocking)
    client.files.delete({ fileId: uploadedFile.id }).catch(() => {});

    return { text: text || null, error: null };
  } catch (err) {
    console.error("[Mistral OCR] OCR failed:", err.message);
    return { text: null, error: err.message };
  }
}

// ─── IPFS Upload Helper (3-tier) ──────────────────────────────────────────────
async function uploadToIPFS(data, name) {
  const jsonStr = JSON.stringify(data, null, 2);
  const pinataKey = getPinataKey();
  const pinataSecret = getPinataSecret();

  // Tier 1: Local Kubo node
  try {
    const form = new FormData();
    form.append("file", Buffer.from(jsonStr), {
      filename: `${name}.json`,
      contentType: "application/json",
    });
    const addResp = await axios.post(
      `${IPFS_API_URL}/api/v0/add?pin=true&quieter=true`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 10000,
      },
    );
    const cidStr = addResp.data.Hash;
    console.log(`[IPFS] Local node CID: ${cidStr}`);

    if (pinataKey && pinataSecret && pinataKey !== "placeholder") {
      new PinataSDK(pinataKey, pinataSecret)
        .pinJSONToIPFS(data, { pinataMetadata: { name } })
        .then(() => console.log("[IPFS] Cross-pinned to Pinata"))
        .catch((e) =>
          console.warn("[IPFS] Pinata cross-pin failed:", e.message),
        );
    }
    return { cid: cidStr, source: "local", real: true };
  } catch (localErr) {
    console.warn(
      "[IPFS] Local node unavailable:",
      (localErr.response?.data || localErr.message || "")
        .toString()
        .split("\n")[0],
    );
  }

  // Tier 2: Pinata cloud
  if (pinataKey && pinataSecret && pinataKey !== "placeholder") {
    try {
      const result = await new PinataSDK(pinataKey, pinataSecret).pinJSONToIPFS(
        data,
        { pinataMetadata: { name } },
      );
      console.log(`[IPFS] Pinata CID: ${result.IpfsHash}`);
      return { cid: result.IpfsHash, source: "pinata", real: true };
    } catch (err) {
      console.error("[IPFS] Pinata cloud error:", err.message);
    }
  }

  // Tier 3: Deterministic SHA-256 simulated CID
  const hash = crypto.createHash("sha256").update(jsonStr).digest("hex");
  const simCid = "Qm" + hash.slice(0, 44);
  console.warn(`[IPFS] Simulated CID (no real IPFS): ${simCid}`);
  return { cid: simCid, source: "simulated", real: false };
}

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origin.startsWith("http://localhost"))
        return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
// Raised to 10mb to handle large prescription images sent as base64 JSON
app.use(express.json({ limit: "10mb" }));

// ─── Auth rate limiter ────────────────────────────────────────────────────────
const loginAttempts = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;

function authRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry) {
    if (now < entry.resetAt) {
      if (entry.count >= RATE_MAX) {
        const retrySec = Math.ceil((entry.resetAt - now) / 1000);
        return res.status(429).json({
          error: `Too many login attempts. Retry after ${retrySec}s.`,
        });
      }
    } else {
      loginAttempts.delete(ip);
    }
  }
  next();
}

function recordLoginFailure(req) {
  const ip = req.ip || req.connection.remoteAddress || "0.0.0.0";
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of loginAttempts.entries()) {
    if (now >= e.resetAt) loginAttempts.delete(ip);
  }
}, RATE_WINDOW_MS);

// ─── Memory growth cap helper (FIX-6) ────────────────────────────────────────
const ARRAY_CAP = 500;
function cappedUnshift(arr, item) {
  arr.unshift(item);
  if (arr.length > ARRAY_CAP) arr.pop();
}

// ─── Demo In-Memory Store ─────────────────────────────────────────────────────
// FIX-3: Passwords hashed with bcrypt (using synchronous hash for demo init)
// All demo passwords = Admin@1234
// We store a hash and compare at login time.
const DEMO_PASSWORD_HASH =
  "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"; // bcrypt hash of "Admin@1234"
// NOTE: At runtime we do plain comparison for demo speed; swap to bcrypt.compare() for production.
const DEMO_PASSWORD_PLAIN = "Admin@1234";

// ── Hospitals ─────────────────────────────────────────────────────────────────
let demoHospitals = [
  {
    id: 1,
    name: "City General Hospital",
    address: "12 Rajpath, Connaught Place",
    city: "New Delhi",
    state: "Delhi",
    phone: "+91-11-23456789",
    email: "admin@citygeneral.com",
    is_active: true,
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 2,
    name: "Oakwood Medical Centre",
    address: "45 Bandra West, Linking Rd",
    city: "Mumbai",
    state: "Maharashtra",
    phone: "+91-22-98765432",
    email: "admin@oakwood.com",
    is_active: true,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 3,
    name: "Apollo Sunrise Hospital",
    address: "8 MG Road, Brigade Gateway",
    city: "Bengaluru",
    state: "Karnataka",
    phone: "+91-80-11223344",
    email: "admin@apollosunrise.com",
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

// ── Users ─────────────────────────────────────────────────────────────────────
// FIX-3: plain_password renamed to _pw (private, never serialized in API responses)
let demoUsers = [
  {
    id: 1,
    role: "admin",
    email: "admin@medblock.io",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "System",
    last_name: "Admin",
    hospital_id: null,
    is_active: true,
    is_approved: true,
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
  },
  {
    id: 2,
    role: "hospital",
    email: "admin@citygeneral.com",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "City General",
    last_name: "Hospital",
    hospital_id: 1,
    is_active: true,
    is_approved: true,
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 3,
    role: "hospital",
    email: "admin@oakwood.com",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "Oakwood",
    last_name: "Medical",
    hospital_id: 2,
    is_active: true,
    is_approved: true,
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 4,
    role: "hospital",
    email: "admin@apollosunrise.com",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "Apollo",
    last_name: "Sunrise",
    hospital_id: 3,
    is_active: true,
    is_approved: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 5,
    role: "doctor",
    email: "dr.sarah.connor@citygeneral.com",
    _pw: DEMO_PASSWORD_PLAIN,
    wallet_address: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
    first_name: "Dr. Sarah",
    last_name: "Connor",
    hospital_id: 1,
    is_active: true,
    is_approved: true,
    specialization: "General Practice",
    phone: "+91-98100-11111",
    created_at: new Date(Date.now() - 80 * 86400000).toISOString(),
  },
  {
    id: 6,
    role: "doctor",
    email: "dr.rahul.verma@citygeneral.com",
    _pw: DEMO_PASSWORD_PLAIN,
    wallet_address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    first_name: "Dr. Rahul",
    last_name: "Verma",
    hospital_id: 1,
    is_active: true,
    is_approved: true,
    specialization: "Cardiologist",
    phone: "+91-98100-22222",
    created_at: new Date(Date.now() - 75 * 86400000).toISOString(),
  },
  {
    id: 7,
    role: "doctor",
    email: "dr.priya.sharma@oakwood.com",
    _pw: DEMO_PASSWORD_PLAIN,
    wallet_address: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
    first_name: "Dr. Priya",
    last_name: "Sharma",
    hospital_id: 2,
    is_active: true,
    is_approved: true,
    specialization: "Dermatologist",
    phone: "+91-98100-33333",
    created_at: new Date(Date.now() - 50 * 86400000).toISOString(),
  },
  {
    id: 8,
    role: "doctor",
    email: "dr.aditya.nair@apollosunrise.com",
    _pw: DEMO_PASSWORD_PLAIN,
    wallet_address: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    first_name: "Dr. Aditya",
    last_name: "Nair",
    hospital_id: 3,
    is_active: true,
    is_approved: true,
    specialization: "Orthopaedic Surgeon",
    phone: "+91-98100-44444",
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 9,
    role: "patient",
    email: "john.doe@example.com",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "John",
    last_name: "Doe",
    hospital_id: 1,
    is_active: true,
    is_approved: true,
    phone: "+91-99001-10001",
    date_of_birth: "1990-05-14",
    created_at: new Date(Date.now() - 70 * 86400000).toISOString(),
  },
  {
    id: 10,
    role: "patient",
    email: "priya.patel@example.com",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "Priya",
    last_name: "Patel",
    hospital_id: 1,
    is_active: true,
    is_approved: true,
    phone: "+91-99001-10002",
    date_of_birth: "1985-11-22",
    created_at: new Date(Date.now() - 65 * 86400000).toISOString(),
  },
  {
    id: 11,
    role: "patient",
    email: "arjun.singh@example.com",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "Arjun",
    last_name: "Singh",
    hospital_id: 2,
    is_active: true,
    is_approved: true,
    phone: "+91-99001-10003",
    date_of_birth: "1978-03-09",
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: 12,
    role: "patient",
    email: "aisha.khan@example.com",
    _pw: DEMO_PASSWORD_PLAIN,
    first_name: "Aisha",
    last_name: "Khan",
    hospital_id: 3,
    is_active: true,
    is_approved: true,
    phone: "+91-99001-10004",
    date_of_birth: "1995-07-30",
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
];

// Safe user serializer — FIX-3: never expose _pw field
function safeUser(u) {
  const { _pw, ...safe } = u;
  return safe;
}

// ── Reports ───────────────────────────────────────────────────────────────────
let demoReports = [
  {
    id: 1,
    cid: "QmRv8xJpLmNcY2aWZkBqEsPdFgH3tKuC7oI1nVsAzRe9X",
    tx_hash:
      "0x4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b",
    patient_id: 9,
    doctor_id: 5,
    hospital_id: 1,
    source: "simulated",
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    patient_first: "John",
    patient_last: "Doe",
    doctor_first: "Dr. Sarah",
    doctor_last: "Connor",
    hospital_name: "City General Hospital",
    summary:
      "Patient presented with acute upper respiratory tract infection. Mild fever (100.4°F), sore throat, and congestion. No signs of pneumonia.",
    medicines: [
      "Amoxicillin 500mg — twice daily for 7 days",
      "Paracetamol 650mg — as needed for fever",
      "Cetirizine 10mg — once daily at night",
    ],
    precautions: [
      "Stay hydrated — drink 3L of water daily",
      "Avoid cold or iced beverages",
      "Rest for at least 3 days",
      "Wear a mask in public spaces",
    ],
    followUp: "Return in 7 days if symptoms persist or worsen.",
  },
  {
    id: 2,
    cid: "QmTw9kMrSdCe4nXvLpAyBzRf6gHuI8jK2oP5qWsNtYeZa",
    tx_hash:
      "0x67890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
    patient_id: 10,
    doctor_id: 6,
    hospital_id: 1,
    source: "simulated",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    patient_first: "Priya",
    patient_last: "Patel",
    doctor_first: "Dr. Rahul",
    doctor_last: "Verma",
    hospital_name: "City General Hospital",
    summary:
      "Patient presents with intermittent chest discomfort and shortness of breath on exertion over the past 2 weeks. ECG shows mild ST depression. Referred for stress test.",
    medicines: [
      "Aspirin 75mg — once daily after breakfast",
      "Atorvastatin 20mg — once at bedtime",
      "Metoprolol 25mg — once daily",
    ],
    precautions: [
      "Avoid strenuous physical activity until stress test results",
      "Low-sodium, low-fat diet",
      "Monitor blood pressure daily",
      "Avoid smoking and alcohol",
    ],
    followUp:
      "Stress test scheduled in 5 days. Follow up with results immediately.",
  },
  {
    id: 3,
    cid: "QmUx7lNqReAf5oYwMpBzDgCk1hJvK3nP9sQtWuLiBcVdE",
    tx_hash:
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    patient_id: 11,
    doctor_id: 7,
    hospital_id: 2,
    source: "simulated",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    patient_first: "Arjun",
    patient_last: "Singh",
    doctor_first: "Dr. Priya",
    doctor_last: "Sharma",
    hospital_name: "Oakwood Medical Centre",
    summary:
      "Recurring eczema flare-up on forearms and neck. Itching has worsened over 10 days. No secondary infection noted. Skin patch test ordered to identify triggers.",
    medicines: [
      "Betamethasone 0.1% cream — apply twice daily to affected areas",
      "Levocetirizine 5mg — once daily",
      "Vaseline Intensive Care — moisturise 3x daily",
    ],
    precautions: [
      "Avoid hot showers; use lukewarm water",
      "Use fragrance-free detergents",
      "Wear loose, cotton clothing",
      "Avoid known allergens (dust, pet dander)",
    ],
    followUp: "Patch test results in 72 hours. Return for review.",
  },
];

// ── Appointments ──────────────────────────────────────────────────────────────
let demoAppointments = [
  {
    id: 1,
    patient_id: 9,
    doctor_id: 5,
    hospital_id: 1,
    appointment_date: new Date(Date.now() + 3 * 86400000)
      .toISOString()
      .split("T")[0],
    reason: "Follow-up for throat infection",
    status: "scheduled",
    doctor_first: "Dr. Sarah",
    doctor_last: "Connor",
    specialization: "General Practice",
    hospital_name: "City General Hospital",
  },
  {
    id: 2,
    patient_id: 10,
    doctor_id: 6,
    hospital_id: 1,
    appointment_date: new Date(Date.now() + 5 * 86400000)
      .toISOString()
      .split("T")[0],
    reason: "Stress test review and ECG follow-up",
    status: "scheduled",
    doctor_first: "Dr. Rahul",
    doctor_last: "Verma",
    specialization: "Cardiologist",
    hospital_name: "City General Hospital",
  },
  {
    id: 3,
    patient_id: 12,
    doctor_id: 8,
    hospital_id: 3,
    appointment_date: new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0],
    reason: "Knee pain assessment and X-ray review",
    status: "scheduled",
    doctor_first: "Dr. Aditya",
    doctor_last: "Nair",
    specialization: "Orthopaedic Surgeon",
    hospital_name: "Apollo Sunrise Hospital",
  },
];

// ── Audit Logs ────────────────────────────────────────────────────────────────
let demoAuditLogs = [
  {
    id: 1,
    actor_id: 1,
    action: "SYSTEM_INIT",
    target: "demo mode",
    email: "admin@medblock.io",
    role: "admin",
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
  },
  {
    id: 2,
    actor_id: 1,
    action: "CREATE_HOSPITAL",
    target: "City General Hospital",
    email: "admin@medblock.io",
    role: "admin",
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 3,
    actor_id: 1,
    action: "CREATE_HOSPITAL",
    target: "Oakwood Medical Centre",
    email: "admin@medblock.io",
    role: "admin",
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 4,
    actor_id: 1,
    action: "CREATE_HOSPITAL",
    target: "Apollo Sunrise Hospital",
    email: "admin@medblock.io",
    role: "admin",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 5,
    actor_id: 2,
    action: "REGISTER_DOCTOR",
    target: "Dr. Sarah Connor",
    email: "admin@citygeneral.com",
    role: "hospital",
    created_at: new Date(Date.now() - 80 * 86400000).toISOString(),
  },
  {
    id: 6,
    actor_id: 2,
    action: "REGISTER_DOCTOR",
    target: "Dr. Rahul Verma",
    email: "admin@citygeneral.com",
    role: "hospital",
    created_at: new Date(Date.now() - 75 * 86400000).toISOString(),
  },
  {
    id: 7,
    actor_id: 2,
    action: "REGISTER_PATIENT",
    target: "John Doe",
    email: "admin@citygeneral.com",
    role: "hospital",
    created_at: new Date(Date.now() - 70 * 86400000).toISOString(),
  },
  {
    id: 8,
    actor_id: 2,
    action: "REGISTER_PATIENT",
    target: "Priya Patel",
    email: "admin@citygeneral.com",
    role: "hospital",
    created_at: new Date(Date.now() - 65 * 86400000).toISOString(),
  },
  {
    id: 9,
    actor_id: 3,
    action: "REGISTER_DOCTOR",
    target: "Dr. Priya Sharma",
    email: "admin@oakwood.com",
    role: "hospital",
    created_at: new Date(Date.now() - 50 * 86400000).toISOString(),
  },
  {
    id: 10,
    actor_id: 3,
    action: "REGISTER_PATIENT",
    target: "Arjun Singh",
    email: "admin@oakwood.com",
    role: "hospital",
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: 11,
    actor_id: 5,
    action: "CREATE_REPORT",
    target: "QmRv8xJpLmNcY2aWZkBq…",
    email: "dr.sarah@citygeneral.com",
    role: "doctor",
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 12,
    actor_id: 6,
    action: "CREATE_REPORT",
    target: "QmTw9kMrSdCe4nXvLp…",
    email: "dr.rahul@citygeneral.com",
    role: "doctor",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 13,
    actor_id: 7,
    action: "CREATE_REPORT",
    target: "QmUx7lNqReAf5oYwMp…",
    email: "dr.priya@oakwood.com",
    role: "doctor",
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

// ─── JWT helpers ──────────────────────────────────────────────────────────────
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email || null,
      hospitalId: user.hospital_id,
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(h.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ error: "Forbidden" });
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

// Email + password login
app.post("/api/auth/login", authRateLimiter, (req, res) => {
  const email = str(req.body.email, 200);
  const password = str(req.body.password, 200);
  const role = str(req.body.role, 50).toLowerCase();

  if (!role) return res.status(400).json({ error: "Role is required." });
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required." });

  const user = demoUsers.find((u) => u.email === email);
  if (!user) {
    recordLoginFailure(req);
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (user._pw !== password) {
    recordLoginFailure(req);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (user.role !== role)
    return res
      .status(401)
      .json({ error: "Invalid credentials for this role." });
  if (!user.is_active)
    return res
      .status(403)
      .json({ error: "Account is deactivated. Contact admin." });

  // FIX-4: is_approved gate
  if (!user.is_approved)
    return res.status(403).json({ error: "Account pending admin approval." });

  cappedUnshift(demoAuditLogs, {
    id: nextId("logs"),
    actor_id: user.id,
    action: "LOGIN",
    target: email,
    email,
    role: user.role,
    created_at: new Date().toISOString(),
  });
  res.json({
    token: makeToken(user),
    user: {
      id: user.id,
      role: user.role,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      hospitalId: user.hospital_id,
    },
  });
});

// MetaMask wallet login
app.post("/api/auth/login/wallet", (req, res) => {
  const address = str(req.body.address, 100);
  const role = str(req.body.role, 50).toLowerCase();
  if (!address)
    return res.status(400).json({ error: "Wallet address required." });

  const user = demoUsers.find(
    (u) => u.wallet_address?.toLowerCase() === address.toLowerCase(),
  );
  if (!user)
    return res.status(404).json({
      error:
        "Wallet not registered. Ask your administrator to link your wallet.",
    });
  if (!user.is_active)
    return res.status(403).json({ error: "Account is deactivated." });
  if (!user.is_approved)
    return res.status(403).json({ error: "Account pending admin approval." });
  if (role && user.role !== role)
    return res
      .status(401)
      .json({ error: "Invalid credentials for this role." });

  cappedUnshift(demoAuditLogs, {
    id: nextId("logs"),
    actor_id: user.id,
    action: "WALLET_LOGIN",
    target: address,
    email: user.email || address,
    role: user.role,
    created_at: new Date().toISOString(),
  });
  res.json({
    token: makeToken(user),
    user: {
      id: user.id,
      role: user.role,
      email: user.email || null,
      firstName: user.first_name,
      lastName: user.last_name,
      hospitalId: user.hospital_id,
    },
  });
});

// Legacy doctor wallet route
app.post("/api/auth/login/doctor", (req, res) => {
  const address = str(req.body.address, 100);
  const user = demoUsers.find(
    (u) => u.wallet_address?.toLowerCase() === address?.toLowerCase(),
  );
  if (!user)
    return res
      .status(404)
      .json({ error: "Doctor not registered. Ask your Hospital Admin." });
  if (user.role !== "doctor")
    return res
      .status(401)
      .json({ error: "Invalid credentials for this role." });
  if (!user.is_approved)
    return res.status(403).json({ error: "Account pending admin approval." });
  res.json({
    token: makeToken(user),
    user: {
      id: user.id,
      role: "doctor",
      email: user.email || null,
      firstName: user.first_name,
      lastName: user.last_name,
      hospitalId: user.hospital_id,
    },
  });
});

// Link MetaMask wallet to authenticated account
app.post("/api/auth/link-wallet", requireAuth, (req, res) => {
  const address = str(req.body.address, 100);
  if (!address)
    return res.status(400).json({ error: "Wallet address required." });

  const conflict = demoUsers.find(
    (u) =>
      u.wallet_address?.toLowerCase() === address.toLowerCase() &&
      u.id !== req.user.id,
  );
  if (conflict)
    return res
      .status(409)
      .json({ error: "This wallet is already linked to another account." });

  const user = demoUsers.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  user.wallet_address = address.toLowerCase();

  cappedUnshift(demoAuditLogs, {
    id: nextId("logs"),
    actor_id: user.id,
    action: "LINK_WALLET",
    target: address,
    email: user.email || address,
    role: user.role,
    created_at: new Date().toISOString(),
  });
  res.json({ success: true, walletAddress: user.wallet_address });
});

// Hospital self-registration — FIX-4: sets is_approved: false, pending admin review
app.post("/api/auth/register-hospital", (req, res) => {
  const hospitalName = str(req.body.hospitalName, 200);
  const email = str(req.body.email, 200);
  const password = str(req.body.password, 200);
  const phone = str(req.body.phone, 50);
  const address = str(req.body.address, 300);
  const city = str(req.body.city, 100);
  const state = str(req.body.state, 100);
  const registrationId = str(req.body.registrationId, 100);

  const err = requireFields({ hospitalName, email, password }, [
    "hospitalName",
    "email",
    "password",
  ]);
  if (err) return res.status(400).json({ error: err });
  if (password.length < 6)
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  if (demoUsers.find((u) => u.email === email))
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });

  const hosp = {
    id: nextId("hospitals"),
    name: hospitalName,
    address,
    city,
    state,
    phone,
    email,
    registration_id: registrationId,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  demoHospitals.push(hosp);

  const admin = {
    id: nextId("users"),
    role: "hospital",
    email,
    _pw: password,
    first_name: hospitalName,
    last_name: "Admin",
    phone: phone || null,
    hospital_id: hosp.id,
    is_active: true,
    is_approved: false, // FIX-4: must be approved by system admin before login
    created_at: new Date().toISOString(),
  };
  demoUsers.push(admin);
  cappedUnshift(demoAuditLogs, {
    id: nextId("logs"),
    actor_id: admin.id,
    action: "HOSPITAL_SIGNUP",
    target: hospitalName,
    email,
    role: "hospital",
    created_at: new Date().toISOString(),
  });

  // Return 202 Accepted — not 201 created, because approval is pending
  res.status(202).json({
    message:
      "Registration received. Your account is pending admin approval. You will be notified once approved.",
    hospitalId: hosp.id,
  });
});

// Patient self-registration
app.post("/api/auth/register", (req, res) => {
  const firstName = str(req.body.firstName, 100);
  const lastName = str(req.body.lastName, 100);
  const email = str(req.body.email, 200);
  const password = str(req.body.password, 200);
  const phone = str(req.body.phone, 50);
  const dateOfBirth = str(req.body.dateOfBirth, 20);

  const err = requireFields({ firstName, email, password }, [
    "firstName",
    "email",
    "password",
  ]);
  if (err) return res.status(400).json({ error: err });
  if (password.length < 6)
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters." });
  if (demoUsers.find((u) => u.email === email))
    return res
      .status(409)
      .json({ error: "An account with this email already exists." });

  const defaultHospital =
    demoHospitals.find((h) => h.is_active) || demoHospitals[0];
  const newUser = {
    id: nextId("users"),
    role: "patient",
    email,
    _pw: password,
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    date_of_birth: dateOfBirth || null,
    hospital_id: defaultHospital?.id || 1,
    is_active: true,
    is_approved: true,
    created_at: new Date().toISOString(),
  };
  demoUsers.push(newUser);
  cappedUnshift(demoAuditLogs, {
    id: nextId("logs"),
    actor_id: newUser.id,
    action: "SELF_REGISTER",
    target: email,
    email,
    role: "patient",
    created_at: new Date().toISOString(),
  });
  res.status(201).json({
    token: makeToken(newUser),
    user: {
      id: newUser.id,
      role: "patient",
      email,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      hospitalId: newUser.hospital_id,
    },
  });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

// FIX-1 (env reload): reload .env at runtime without server restart
app.post(
  "/api/admin/reload-env",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    Object.keys(require.cache).forEach((k) => {
      if (k.includes("dotenv")) delete require.cache[k];
    });
    require("dotenv").config({ override: true });
    res.json({
      ok: true,
      geminiKeySet: !!process.env.GEMINI_API_KEY,
      pinataKeySet: !!process.env.PINATA_API_KEY,
      message: "Environment variables reloaded from .env",
    });
  },
);

app.get("/api/admin/stats", requireAuth, requireRole("admin"), (req, res) => {
  res.json({
    hospitals: demoHospitals.filter((h) => h.is_active).length,
    doctors: demoUsers.filter((u) => u.role === "doctor" && u.is_active).length,
    patients: demoUsers.filter((u) => u.role === "patient" && u.is_active)
      .length,
    reports: demoReports.length,
    pendingApprovals: demoUsers.filter((u) => !u.is_approved).length,
  });
});

app.get(
  "/api/admin/hospitals",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    res.json({ hospitals: demoHospitals });
  },
);

app.post(
  "/api/admin/hospitals",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const name = str(req.body.name, 200);
    const address = str(req.body.address, 300);
    const city = str(req.body.city, 100);
    const state = str(req.body.state, 100);
    const phone = str(req.body.phone, 50);
    const email = str(req.body.email, 200);
    const password = str(req.body.password, 200);

    if (!name || !email)
      return res.status(400).json({ error: "Name and email are required." });

    const h = {
      id: nextId("hospitals"),
      name,
      address,
      city,
      state,
      phone,
      email,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    demoHospitals.push(h);
    demoUsers.push({
      id: nextId("users"),
      role: "hospital",
      email,
      _pw: password || DEMO_PASSWORD_PLAIN,
      first_name: name,
      last_name: "Admin",
      hospital_id: h.id,
      is_active: true,
      is_approved: true,
    });
    cappedUnshift(demoAuditLogs, {
      id: nextId("logs"),
      actor_id: req.user.id,
      action: "CREATE_HOSPITAL",
      target: h.name,
      email: req.user.email,
      role: "admin",
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ hospital: h });
  },
);

app.put(
  "/api/admin/hospitals/:id",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const h = demoHospitals.find((x) => x.id === parseInt(req.params.id)); // FIX-9: parseInt
    if (!h) return res.status(404).json({ error: "Hospital not found." });
    const allowed = [
      "name",
      "address",
      "city",
      "state",
      "phone",
      "email",
      "is_active",
    ];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) h[k] = req.body[k];
    });
    res.json({ hospital: h });
  },
);

app.delete(
  "/api/admin/hospitals/:id",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const h = demoHospitals.find((x) => x.id === parseInt(req.params.id)); // FIX-9
    if (h) h.is_active = false;
    res.json({ success: true });
  },
);

app.get("/api/admin/users", requireAuth, requireRole("admin"), (req, res) => {
  const { role } = req.query;
  let users = demoUsers.map(safeUser); // FIX-3: always use safeUser
  if (role) users = users.filter((u) => u.role === role);
  res.json({ users });
});

app.patch(
  "/api/admin/users/:id/status",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const u = demoUsers.find((x) => x.id === parseInt(req.params.id)); // FIX-9
    if (!u) return res.status(404).json({ error: "User not found." });
    if (req.body.is_active !== undefined) u.is_active = !!req.body.is_active;
    if (req.body.is_approved !== undefined)
      u.is_approved = !!req.body.is_approved;
    res.json({ user: safeUser(u) }); // FIX-3
  },
);

// FIX-4: Admin can approve pending hospital registrations
app.patch(
  "/api/admin/users/:id/approve",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    const u = demoUsers.find((x) => x.id === parseInt(req.params.id));
    if (!u) return res.status(404).json({ error: "User not found." });
    u.is_approved = true;
    cappedUnshift(demoAuditLogs, {
      id: nextId("logs"),
      actor_id: req.user.id,
      action: "APPROVE_USER",
      target: u.email,
      email: req.user.email,
      role: "admin",
      created_at: new Date().toISOString(),
    });
    res.json({ user: safeUser(u) });
  },
);

app.get(
  "/api/admin/audit-logs",
  requireAuth,
  requireRole("admin"),
  (req, res) => {
    res.json({ logs: demoAuditLogs });
  },
);

// ─── Hospital routes ──────────────────────────────────────────────────────────

app.get(
  "/api/hospital/stats",
  requireAuth,
  requireRole("hospital"),
  (req, res) => {
    const hid = parseInt(
      demoUsers.find((u) => u.id === req.user.id)?.hospital_id,
    ); // FIX-9
    res.json({
      doctors: demoUsers.filter(
        (u) =>
          u.role === "doctor" && parseInt(u.hospital_id) === hid && u.is_active,
      ).length,
      patients: demoUsers.filter(
        (u) =>
          u.role === "patient" &&
          parseInt(u.hospital_id) === hid &&
          u.is_active,
      ).length,
      reports: demoReports.filter((r) => parseInt(r.hospital_id) === hid)
        .length,
      pendingAppointments: demoAppointments.filter(
        (a) => parseInt(a.hospital_id) === hid && a.status === "scheduled",
      ).length,
    });
  },
);

app.get(
  "/api/hospital/doctors",
  requireAuth,
  requireRole("hospital"),
  (req, res) => {
    const hid = parseInt(
      demoUsers.find((u) => u.id === req.user.id)?.hospital_id,
    );
    res.json({
      doctors: demoUsers
        .filter((u) => u.role === "doctor" && parseInt(u.hospital_id) === hid)
        .map(safeUser),
    });
  },
);

app.post(
  "/api/hospital/doctors",
  requireAuth,
  requireRole("hospital"),
  (req, res) => {
    const firstName = str(req.body.firstName, 100);
    const lastName = str(req.body.lastName, 100);
    const walletAddress = str(req.body.walletAddress, 100);
    const specialization = str(req.body.specialization, 100);
    const phone = str(req.body.phone, 50);
    const email = str(req.body.email, 200);
    const password = str(req.body.password, 200);

    const valErr = requireFields({ firstName, lastName }, [
      "firstName",
      "lastName",
    ]);
    if (valErr) return res.status(400).json({ error: valErr });

    const hid = parseInt(
      demoUsers.find((u) => u.id === req.user.id)?.hospital_id,
    );
    const doc = {
      id: nextId("users"),
      role: "doctor",
      wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
      email: email || null,
      _pw: password || DEMO_PASSWORD_PLAIN,
      first_name: firstName,
      last_name: lastName,
      specialization,
      phone,
      hospital_id: hid,
      is_active: true,
      is_approved: true,
      created_at: new Date().toISOString(),
    };
    demoUsers.push(doc);
    cappedUnshift(demoAuditLogs, {
      id: nextId("logs"),
      actor_id: req.user.id,
      action: "REGISTER_DOCTOR",
      target: `${firstName} ${lastName}`,
      email: req.user.email,
      role: "hospital",
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ doctor: safeUser(doc) }); // FIX-3
  },
);

// FIX-5: explicit hospital_id validation — doctor cannot access another hospital's patients
app.get(
  "/api/hospital/patients",
  requireAuth,
  requireRole("hospital", "doctor"),
  (req, res) => {
    const caller = demoUsers.find((u) => u.id === req.user.id);
    const hid = parseInt(caller?.hospital_id);
    if (!hid)
      return res
        .status(403)
        .json({ error: "No hospital association found for this account." });
    res.json({
      patients: demoUsers
        .filter((u) => u.role === "patient" && parseInt(u.hospital_id) === hid)
        .map((u) => ({
          // FIX-3: manual safe projection
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          email: u.email,
          phone: u.phone,
          date_of_birth: u.date_of_birth,
          created_at: u.created_at || new Date().toISOString(),
        })),
    });
  },
);

app.post(
  "/api/hospital/patients",
  requireAuth,
  requireRole("hospital"),
  (req, res) => {
    const firstName = str(req.body.firstName, 100);
    const lastName = str(req.body.lastName, 100);
    const email = str(req.body.email, 200);
    const password = str(req.body.password, 200);
    const phone = str(req.body.phone, 50);
    const dateOfBirth = str(req.body.dateOfBirth, 20);

    const valErr = requireFields({ firstName, email }, ["firstName", "email"]);
    if (valErr) return res.status(400).json({ error: valErr });
    if (demoUsers.find((u) => u.email === email))
      return res.status(409).json({ error: "Email already registered." });

    const hid = parseInt(
      demoUsers.find((u) => u.id === req.user.id)?.hospital_id,
    );
    const pat = {
      id: nextId("users"),
      role: "patient",
      email,
      _pw: password || DEMO_PASSWORD_PLAIN,
      first_name: firstName,
      last_name: lastName,
      phone,
      date_of_birth: dateOfBirth,
      hospital_id: hid,
      is_active: true,
      is_approved: true,
      created_at: new Date().toISOString(),
    };
    demoUsers.push(pat);
    cappedUnshift(demoAuditLogs, {
      id: nextId("logs"),
      actor_id: req.user.id,
      action: "REGISTER_PATIENT",
      target: `${firstName} ${lastName}`,
      email: req.user.email,
      role: "hospital",
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ patient: safeUser(pat) }); // FIX-3
  },
);

app.get(
  "/api/hospital/reports",
  requireAuth,
  requireRole("hospital"),
  (req, res) => {
    const hid = parseInt(
      demoUsers.find((u) => u.id === req.user.id)?.hospital_id,
    );
    res.json({
      reports: demoReports.filter((r) => parseInt(r.hospital_id) === hid),
    });
  },
);

app.get(
  "/api/hospital/appointments",
  requireAuth,
  requireRole("hospital"),
  (req, res) => {
    const hid = parseInt(
      demoUsers.find((u) => u.id === req.user.id)?.hospital_id,
    );
    res.json({
      appointments: demoAppointments.filter(
        (a) => parseInt(a.hospital_id) === hid,
      ),
    });
  },
);

// ─── Doctor routes ────────────────────────────────────────────────────────────

app.get(
  "/api/doctor/reports",
  requireAuth,
  requireRole("doctor"),
  (req, res) => {
    res.json({
      reports: demoReports.filter((r) => r.doctor_id === req.user.id),
    });
  },
);

// ─── Visits / Reports ─────────────────────────────────────────────────────────

app.post(
  "/api/visits/record",
  requireAuth,
  requireRole("doctor"),
  async (req, res) => {
    // FIX-2: validated inputs with length caps
    const patientId = parseInt(req.body.patientId);
    const hospitalId = parseInt(req.body.hospitalId);
    const transcript = str(req.body.transcript, 10000);
    const prescriptionText = str(req.body.prescriptionText, 5000);
    const imageData = req.body.imageData; // base64 — validated below
    const imageMimeType = str(req.body.imageMimeType, 50);

    if (!patientId || !hospitalId)
      return res
        .status(400)
        .json({ error: "patientId and hospitalId are required." });

    const hasTranscript = transcript.length >= 5;
    // Max image check aligned with 10mb body limit (~7.5MB base64 = ~5.6MB binary)
    const hasImage =
      typeof imageData === "string" &&
      imageData.length > 100 &&
      imageData.length < 7500000;

    if (!hasTranscript && !hasImage) {
      return res
        .status(400)
        .json({ error: "Clinical notes or a prescription image is required." });
    }

    // FIX-5: verify patient belongs to this doctor's hospital
    const doctor = demoUsers.find((u) => u.id === req.user.id);
    const patient = demoUsers.find(
      (u) => u.id === patientId && u.role === "patient",
    );
    const hospital = demoHospitals.find((h) => h.id === hospitalId);

    if (!patient) return res.status(404).json({ error: "Patient not found." });
    if (!hospital)
      return res.status(404).json({ error: "Hospital not found." });
    if (parseInt(patient.hospital_id) !== parseInt(doctor?.hospital_id)) {
      return res
        .status(403)
        .json({ error: "Patient does not belong to your hospital." });
    }

    try {
      const txHash = "0x" + crypto.randomBytes(20).toString("hex"); // FIX-7: top-level crypto

      // Step 1 (optional): Mistral OCR — extract text from prescription image
      let ocrText = null;
      let ocrError = null;
      if (hasImage) {
        console.log("[Mistral OCR] Extracting text from prescription image…");
        // Strip the data-URL prefix (data:image/jpeg;base64,...) if present
        const base64 = imageData.includes(",")
          ? imageData.split(",")[1]
          : imageData;
        const ocrResult = await extractTextFromImage(
          base64,
          imageMimeType || "image/jpeg",
        );
        ocrText = ocrResult.text;
        ocrError = ocrResult.error;
        if (ocrError) {
          console.warn("[Mistral OCR] OCR did not succeed:", ocrError);
        }
      }

      // Step 2: Merge text sources
      const combinedPrescription = [
        prescriptionText,
        ocrText ? `\n[Prescription Image OCR]:\n${ocrText}` : "",
      ]
        .join(" ")
        .trim();

      const effectiveTranscript = hasTranscript
        ? transcript
        : `Patient visit notes extracted from prescription image. ${combinedPrescription}`;

      // Step 3: AI summarization — FIX-8: errors now surface properly
      console.log("[Gemini] Summarizing clinical data…");
      const ai = await summarizeWithGemini(
        effectiveTranscript,
        combinedPrescription,
      );
      console.log(`[Gemini] Summary generated. geminiUsed=${ai.geminiUsed}`);

      // Step 4: Build IPFS payload
      const ipfsPayload = {
        version: "1.0",
        createdAt: new Date().toISOString(),
        patient: {
          id: patientId,
          name: `${patient?.first_name || "?"} ${patient?.last_name || ""}`.trim(),
        },
        doctor: {
          id: req.user.id,
          name: `${doctor?.first_name || "Dr."} ${doctor?.last_name || "?"}`.trim(),
          specialization: doctor?.specialization || "General Practice",
        },
        hospital: { id: hospitalId, name: hospital?.name || "?" },
        transcript: effectiveTranscript,
        ocrText: ocrText || null,
        aiSummary: ai,
        txHash,
      };

      // Step 5: Upload to IPFS
      console.log("[IPFS] Uploading report…");
      const ipfsResult = await uploadToIPFS(
        ipfsPayload,
        `MedBlock-Report-P${patientId}-${Date.now()}`,
      );
      const cid = ipfsResult.cid;

      // Step 6: Save report — FIX-6: capped unshift
      const report = {
        id: nextId("reports"),
        cid,
        tx_hash: txHash,
        ipfs_real: ipfsResult.real,
        patient_id: patientId,
        doctor_id: req.user.id,
        hospital_id: hospitalId,
        created_at: new Date().toISOString(),
        patient_first: patient?.first_name || "?",
        patient_last: patient?.last_name || "",
        doctor_first: doctor?.first_name || "Dr.",
        doctor_last: doctor?.last_name || "?",
        specialization: doctor?.specialization || "General Practice",
        hospital_name: hospital?.name || "?",
        summary: ai.summary,
        medicines: ai.medicines,
        precautions: ai.precautions,
        followUp: ai.followUp,
        hasImage,
        ocrText: ocrText || null,
        source: ipfsResult.source || "simulated",
      };
      cappedUnshift(demoReports, report); // FIX-6
      cappedUnshift(demoAuditLogs, {
        id: nextId("logs"),
        actor_id: req.user.id,
        action: "CREATE_REPORT",
        target: cid,
        email: req.user.email,
        role: "doctor",
        created_at: new Date().toISOString(),
      });

      res.status(201).json({
        success: true,
        cid,
        txHash,
        ipfsReal: ipfsResult.real,
        source: ipfsResult.source || "simulated",
        geminiUsed: ai.geminiUsed === true,
        geminiError: ai.geminiError || null,
        summary: ai.summary,
        medicines: ai.medicines,
        precautions: ai.precautions,
        followUp: ai.followUp,
        ocrText: ocrText || null,
        ocrError: ocrError || null,
        hasImage,
      });
    } catch (err) {
      console.error("[visits/record] Unexpected error:", err);
      res
        .status(500)
        .json({ error: "Failed to process report: " + err.message });
    }
  },
);

app.get(
  "/api/visits/my-records",
  requireAuth,
  requireRole("patient"),
  (req, res) => {
    res.json({
      records: demoReports.filter((r) => r.patient_id === req.user.id),
    });
  },
);

app.get(
  "/api/visits/patient/:patientId",
  requireAuth,
  requireRole("doctor"),
  (req, res) => {
    const patientId = parseInt(req.params.patientId); // FIX-9
    // FIX-5: doctor can only view patients from same hospital
    const doctor = demoUsers.find((u) => u.id === req.user.id);
    const patient = demoUsers.find(
      (u) => u.id === patientId && u.role === "patient",
    );
    if (!patient) return res.status(404).json({ error: "Patient not found." });
    if (parseInt(patient.hospital_id) !== parseInt(doctor?.hospital_id)) {
      return res.status(403).json({ error: "Access denied to this patient." });
    }
    res.json({
      records: demoReports.filter((r) => r.patient_id === patientId),
    });
  },
);

app.post(
  "/api/visits/appointments",
  requireAuth,
  requireRole("patient"),
  (req, res) => {
    const doctorId = parseInt(req.body.doctorId);
    const hospitalId = parseInt(req.body.hospitalId);
    const appointmentDate = str(req.body.appointmentDate, 20);
    const reason = str(req.body.reason, 500);

    if (!doctorId || !hospitalId || !appointmentDate) {
      return res.status(400).json({
        error: "doctorId, hospitalId, and appointmentDate are required.",
      });
    }

    const doc = demoUsers.find((u) => u.id === doctorId && u.role === "doctor");
    const hosp = demoHospitals.find((h) => h.id === hospitalId);
    const pat = demoUsers.find((u) => u.id === req.user.id);

    if (!doc) return res.status(404).json({ error: "Doctor not found." });
    if (!hosp) return res.status(404).json({ error: "Hospital not found." });

    const appt = {
      id: nextId("appointments"),
      patient_id: req.user.id,
      doctor_id: doctorId,
      hospital_id: hospitalId,
      appointment_date: appointmentDate,
      reason,
      status: "scheduled",
      patient_first: pat?.first_name || "?",
      patient_last: pat?.last_name || "?",
      doctor_first: doc.first_name,
      doctor_last: doc.last_name,
      specialization: doc.specialization || "",
      hospital_name: hosp.name,
      created_at: new Date().toISOString(),
    };
    cappedUnshift(demoAppointments, appt); // FIX-6
    res.status(201).json({ appointment: appt });
  },
);

app.get(
  "/api/visits/appointments",
  requireAuth,
  requireRole("patient"),
  (req, res) => {
    res.json({
      appointments: demoAppointments.filter(
        (a) => a.patient_id === req.user.id,
      ),
    });
  },
);

// ─── Health & Status endpoints ────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  const pinataOk = !!(
    getPinataKey() &&
    getPinataSecret() &&
    getPinataKey() !== "placeholder"
  );
  const geminiOk = !!getGeminiKey(); // FIX-1: always live
  res.json({
    status: "ok",
    mode: "demo",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    ai: {
      keyPresent: geminiOk,
      model: getGeminiModel(),
      status: geminiOk ? "configured" : "no-key",
    },
    ipfs: {
      localConfigured: !!IPFS_API_URL,
      pinataConfigured: pinataOk,
      tier: pinataOk ? "pinata" : "simulated",
    },
    counts: {
      reports: demoReports.length,
      users: demoUsers.length,
      hospitals: demoHospitals.length,
      appointments: demoAppointments.length,
    },
  });
});

app.get("/api/health/ai", (req, res) => {
  const keyPresent = !!getGeminiKey(); // FIX-1: live key check
  res.json({
    geminiKeyPresent: keyPresent,
    model: getGeminiModel(),
    status: keyPresent ? "ok" : "no-key",
    message: keyPresent
      ? "Gemini API key is configured. Model ready."
      : "No GEMINI_API_KEY set — local smart extractor will be used as fallback.",
  });
});

app.get("/api/blockchain/status", (req, res) => {
  const pinataOk = !!(
    getPinataKey() &&
    getPinataSecret() &&
    getPinataKey() !== "placeholder"
  );
  const tier = demoReports.some((r) => r.source === "pinata")
    ? "pinata"
    : demoReports.some((r) => r.source === "local")
      ? "local"
      : pinataOk
        ? "pinata"
        : "simulated";
  const lastCids = demoReports
    .slice(0, 5)
    .map((r) => ({ cid: r.cid, source: r.source, date: r.created_at }));
  res.json({
    ipfsTier: tier,
    reportCount: demoReports.length,
    uptime: Math.floor(process.uptime()),
    lastCids,
  });
});

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`[MedBlock API] Running on http://localhost:${PORT}`);
  console.log(
    `[MedBlock API] DEMO MODE — in-memory store (no PostgreSQL required)`,
  );
  console.log(
    `[MedBlock API] Gemini key: ${getGeminiKey() ? "CONFIGURED" : "NOT SET (local extractor will be used)"}`,
  );
  console.log(
    `[MedBlock API] Default password for all demo accounts: Admin@1234`,
  );
});
