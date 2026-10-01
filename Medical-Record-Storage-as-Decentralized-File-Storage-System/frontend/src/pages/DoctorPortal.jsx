import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  PlusCircle,
  Users,
  ClipboardList,
  Mic,
  MicOff,
  Search,
  Activity,
  ChevronRight,
  ExternalLink,
  Download,
  Copy,
  Check,
  Upload,
} from "lucide-react";
import Shell from "../components/Shell";
import { api, getSession } from "../api";

const NAV = [
  { key: "overview", label: "Overview", Icon: Activity },
  { key: "new-record", label: "New Visit", Icon: PlusCircle },
  { key: "my-patients", label: "My Patients", Icon: Users },
  { key: "records", label: "Patient Records", Icon: ClipboardList },
];

const LANGUAGES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "mr-IN", label: "मराठी" },
  { code: "ta-IN", label: "தமிழ்" },
];

function useApiData(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const reload = useCallback(() => {
    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    api
      .get(path, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setError(err?.message || "Failed to load data.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    reload();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [reload]);

  return { data, loading, error, reload };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function cidGatewayUrl(cid, source) {
  if (!cid) return null;
  if (source === "simulated") return null; // no real gateway for simulated CIDs
  if (source === "pinata") return `https://gateway.pinata.cloud/ipfs/${cid}`;
  return `https://ipfs.io/ipfs/${cid}`; // local or fallback
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      title="Copy CID"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: copied ? "var(--success)" : "var(--muted)",
        padding: "2px 4px",
        borderRadius: 4,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// IPFS source badge
function IpfsBadge({ source }) {
  const map = {
    local: { label: "Local Node", cls: "badge-green" },
    pinata: { label: "Pinata", cls: "badge-blue" },
    simulated: { label: "Simulated", cls: "badge-amber" },
  };
  const { label, cls } = map[source] || {
    label: source || "?",
    cls: "badge-purple",
  };
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Collapsible accordion section ─────────────────────────────────────────────
function ReportSection({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "13px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          fontWeight: 600,
          fontSize: "0.9rem",
        }}
      >
        <span>
          {icon}&nbsp; {title}
        </span>
        <span
          style={{
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
            color: "var(--muted)",
            fontSize: "0.75rem",
          }}
        >
          ▼
        </span>
      </button>
      {open && (
        <div
          style={{
            paddingBottom: 16,
            color: "var(--muted)",
            fontSize: "0.87rem",
            lineHeight: 1.7,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────────
function Overview({ user }) {
  const { data: patients } = useApiData("/hospital/patients");
  const { data: reports } = useApiData("/doctor/reports");

  const stats = [
    {
      label: "Patients",
      value: patients?.patients?.length ?? "—",
      icon: "👥",
      color: "var(--warning)",
      accent: "#f59e0b",
    },
    {
      label: "Reports Created",
      value: reports?.reports?.length ?? "—",
      icon: "📋",
      color: "var(--success)",
      accent: "#22c55e",
    },
  ];

  return (
    <>
      <h1 className="page-title">Hello, {user?.firstName}! 👨‍⚕️</h1>
      <p className="page-subtitle">Your clinical overview for today</p>

      <div
        className="stat-grid"
        style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: 440 }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="stat-card"
            style={{ "--card-accent": s.accent }}
          >
            <div className="stat-icon" style={{ background: `${s.accent}18` }}>
              <span style={{ fontSize: "1.2rem" }}>{s.icon}</span>
            </div>
            <div className="stat-body">
              <div className="label">{s.label}</div>
              <div
                className="value"
                style={{ color: s.color, fontSize: "1.7rem" }}
              >
                {s.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{
          borderLeft: "3px solid var(--primary)",
          background: "var(--primary-soft)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: "0.95rem" }}>
          💡 Quick Start
        </div>
        <p
          style={{
            color: "var(--muted)",
            fontSize: "0.86rem",
            lineHeight: 1.7,
          }}
        >
          Go to <strong style={{ color: "var(--text)" }}>New Visit</strong> to
          record a patient consultation. Dictate clinical notes, upload a
          prescription image, and MedBlock will generate an AI summary secured
          on IPFS + Blockchain.
        </p>
      </div>
    </>
  );
}

// ── Drag & Drop Image Upload ───────────────────────────────────────────────────
function ImageDropZone({ imgState, onFile, onClear }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const processFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () =>
      onFile({
        preview: reader.result,
        base64: reader.result,
        mimeType: file.type || "image/jpeg",
      });
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  if (imgState) {
    return (
      <div
        style={{
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--border2)",
          maxWidth: 380,
        }}
      >
        <img
          src={imgState.preview}
          alt="Prescription"
          style={{
            width: "100%",
            display: "block",
            maxHeight: 240,
            objectFit: "cover",
          }}
        />
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <button
            type="button"
            onClick={onClear}
            className="btn btn-sm btn-danger"
            style={{ padding: "4px 10px" }}
          >
            ✕ Remove
          </button>
        </div>
        <div
          style={{
            background: "rgba(0,0,0,0.6)",
            padding: "8px 14px",
            fontSize: "0.78rem",
            color: "#a7f3d0",
          }}
        >
          ✅ AI Vision will extract text from this prescription
        </div>
      </div>
    );
  }

  return (
    <div
      className={`drop-zone${dragOver ? " drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => processFile(e.target.files?.[0])}
      />
      <div className="drop-zone-icon">
        <Upload size={20} color="var(--primary)" />
      </div>
      <div className="drop-zone-text">
        <strong>Drag & drop prescription</strong> or click to upload
        <br />
        <span style={{ fontSize: "0.78rem" }}>
          JPG, PNG, WEBP • AI will OCR extract text automatically
        </span>
      </div>
    </div>
  );
}

// ── New Visit ─────────────────────────────────────────────────────────────────
function NewRecord() {
  const { user } = getSession();
  const { data: patientData } = useApiData("/hospital/patients");
  const [form, setForm] = useState({
    patientId: "",
    hospitalId: String(user?.hospitalId || "1"),
    transcript: "",
    prescriptionText: "",
  });
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [elapsed, setElapsed] = useState(0);
  const [imgState, setImgState] = useState(null);

  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const finalRef = useRef("");

  const patients = patientData?.patients ?? [];

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const startRecording = () => {
    if (!SpeechRecognition) {
      setErr("Speech Recognition not supported. Use Chrome or Edge.");
      return;
    }
    setErr("");
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    finalRef.current = form.transcript;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalRef.current += text + " ";
        else interim += text;
      }
      setForm((f) => ({ ...f, transcript: finalRef.current + interim }));
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed")
        setErr("Microphone access denied. Please allow mic permissions.");
    };
    recognition.onend = () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  useEffect(
    () => () => {
      stopRecording();
    },
    [stopRecording],
  );

  const handlePatientSelect = (e) => {
    const p = patients.find((pt) => pt.id === Number(e.target.value));
    setForm((f) => ({
      ...f,
      patientId: String(e.target.value),
      hospitalId: String(p?.hospital_id || user?.hospitalId || "1"),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (recording) stopRecording();
    const transcript = finalRef.current.trim() || form.transcript.trim();
    const hasTranscript = transcript.length >= 5;
    const hasImage = !!imgState;
    if (!hasTranscript && !hasImage) {
      setErr("Please record clinical notes or upload a prescription image.");
      return;
    }

    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const payload = {
        ...form,
        transcript,
        ...(imgState
          ? { imageData: imgState.base64, imageMimeType: imgState.mimeType }
          : {}),
      };
      const data = await api.post("/visits/record", payload);
      setResult(data);
      setForm({
        patientId: "",
        hospitalId: String(user?.hospitalId || "1"),
        transcript: "",
        prescriptionText: "",
      });
      finalRef.current = "";
      setImgState(null);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (r) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medblock-report-${r.cid?.slice(0, 12) || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const gatewayUrl = result ? cidGatewayUrl(result.cid, result.source) : null;

  return (
    <>
      <h1 className="page-title">New Visit Record</h1>
      <p className="page-subtitle">
        Select a patient, dictate or type notes — AI will summarize and secure
        on IPFS + Blockchain.
      </p>

      {err && <div className="alert alert-error">{err}</div>}

      {/* ── AI Report Result ── */}
      {result && (
        <div style={{ marginBottom: 24 }}>
          {/* Show banner when local fallback was used (Gemini quota exhausted) */}
          {result.source !== "gemini" && !result.geminiUsed && (
            <div
              className="alert"
              style={{
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.35)",
                borderRadius: 10,
                padding: "10px 16px",
                marginBottom: 12,
                fontSize: "0.83rem",
                color: "var(--warning)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              ⚠️{" "}
              <span>
                <strong>Local AI fallback used</strong> —{" "}
                {result.geminiError
                  ? `Gemini API Error: ${result.geminiError}`
                  : "Gemini API quota is currently exhausted."}{" "}
                Report was extracted from your transcript using local pattern
                matching. Consider updating your Gemini API key for full
                AI-quality summaries.
              </span>
            </div>
          )}
          <div
            className="alert alert-success"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                ✅ Report secured on blockchain!
              </div>
              <div
                style={{
                  fontSize: "0.83rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <IpfsBadge source={result.source} />
                <span>
                  CID:{" "}
                  <code style={{ fontSize: "0.8rem", opacity: 0.9 }}>
                    {result.cid?.slice(0, 28)}…
                  </code>
                </span>
                <CopyButton text={result.cid} />
                {gatewayUrl && (
                  <a
                    href={gatewayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--primary)",
                      fontSize: "0.8rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    View on IPFS <ExternalLink size={11} />
                  </a>
                )}
              </div>
              {result.txHash && (
                <div
                  style={{ fontSize: "0.78rem", marginTop: 6, opacity: 0.8 }}
                >
                  Tx: <code>{result.txHash.slice(0, 30)}…</code>
                </div>
              )}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => downloadReport(result)}
              style={{ flexShrink: 0 }}
            >
              <Download size={13} /> Download JSON
            </button>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 4,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                🤖 AI Health Report
              </div>
              {result.hasImage && result.ocrText && (
                <span className="badge badge-blue">📷 Mistral OCR Included</span>
              )}
              {result.hasImage && result.ocrError && (
                <span className="badge badge-amber">⚠️ OCR Failed</span>
              )}
            </div>

            {/* OCR error notice */}
            {result.hasImage && result.ocrError && (
              <div
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.4)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 12,
                  fontSize: "0.82rem",
                  color: "var(--warning)",
                }}
              >
                ⚠️ <strong>Mistral OCR could not extract text</strong> from the prescription
                image. {result.ocrError} — The AI summary was generated from the
                transcript only.
              </div>
            )}

            {result.ocrText && (
              <ReportSection
                icon="📄"
                title="Extracted Prescription Text (Mistral OCR)"
              >
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: "0.83rem",
                    margin: 0,
                    lineHeight: 1.6,
                    background: "var(--surface2)",
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  {result.ocrText}
                </pre>
              </ReportSection>
            )}

            <ReportSection icon="📝" title="Summary" defaultOpen>
              <p style={{ lineHeight: 1.7 }}>
                {result.summary || "No summary generated."}
              </p>
            </ReportSection>

            <ReportSection icon="💊" title="Medications">
              {result.medicines?.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {result.medicines.map((med, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(59,130,246,0.06)",
                        borderRadius: 9,
                        border: "1px solid rgba(59,130,246,0.15)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text)",
                          fontSize: "0.88rem",
                        }}
                      >
                        {typeof med === "string"
                          ? med
                          : med.name || String(med)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No specific medications mentioned.</p>
              )}
            </ReportSection>

            <ReportSection icon="⚠️" title="Precautions">
              {result.precautions?.length > 0 ? (
                <ul
                  style={{
                    paddingLeft: 20,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {result.precautions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p>No precautions specified.</p>
              )}
            </ReportSection>

            <ReportSection icon="📅" title="Follow-Up">
              <p>{result.followUp || "No follow-up instructions."}</p>
            </ReportSection>
          </div>
        </div>
      )}

      {/* ── Main Form ── */}
      <div className="card">
        <form onSubmit={submit}>
          {/* Patient selector */}
          <div className="form-group">
            <label>Select Patient *</label>
            {patients.length > 0 ? (
              <select
                id="patient-id"
                className="input"
                required
                value={form.patientId}
                onChange={handlePatientSelect}
              >
                <option value="">— Select Patient —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} — {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                placeholder="Patient ID"
                required
                value={form.patientId}
                onChange={(e) =>
                  setForm({ ...form, patientId: e.target.value })
                }
              />
            )}
          </div>

          {/* Clinical Notes + Speech-to-Text */}
          <div className="form-group">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <label style={{ margin: 0 }}>Clinical Notes / Transcript *</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  className="input"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  disabled={recording}
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.78rem",
                    width: "auto",
                    minWidth: 88,
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
                {!recording ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={startRecording}
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <Mic size={13} /> Dictate
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={stopRecording}
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <MicOff size={13} /> Stop
                  </button>
                )}
              </div>
            </div>

            {/* Mic Wave Recording Indicator */}
            {recording && (
              <div className="recording-bar">
                <div className="mic-wave">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bar" />
                  ))}
                </div>
                <span
                  style={{
                    color: "var(--danger)",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                >
                  Recording… {fmtTime(elapsed)}
                </span>
                <span
                  style={{
                    color: "var(--muted)",
                    marginLeft: "auto",
                    fontSize: "0.78rem",
                  }}
                >
                  {LANGUAGES.find((l) => l.code === lang)?.label}
                </span>
              </div>
            )}

            <textarea
              id="transcript"
              className="input"
              rows={7}
              placeholder="Patient presents with acute pharyngitis, temp 38.5°C. Prescribed Amoxicillin 500mg BID for 7 days…"
              value={form.transcript}
              onChange={(e) => {
                setForm({ ...form, transcript: e.target.value });
                finalRef.current = e.target.value;
              }}
            />

            {!SpeechRecognition && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.77rem",
                  color: "var(--warning)",
                }}
              >
                ⚠️ Speech Recognition requires Chrome or Edge for live
                dictation.
              </div>
            )}
          </div>

          {/* Additional Notes */}
          <div className="form-group">
            <label>
              Additional Prescription Notes{" "}
              <span style={{ color: "var(--muted)" }}>(optional)</span>
            </label>
            <textarea
              className="input"
              rows={3}
              placeholder="Follow-up instructions, allergy notes, additional context…"
              value={form.prescriptionText}
              onChange={(e) =>
                setForm({ ...form, prescriptionText: e.target.value })
              }
            />
          </div>

          {/* Drag & Drop Image Upload */}
          <div className="form-group">
            <label>
              Prescription Image{" "}
              <span style={{ color: "var(--muted)" }}>
                (optional — AI will OCR extract text)
              </span>
            </label>
            <ImageDropZone
              imgState={imgState}
              onFile={setImgState}
              onClear={() => setImgState(null)}
            />
          </div>

          <button
            id="submit-record"
            type="submit"
            className="btn btn-primary"
            disabled={loading || recording}
            style={{ padding: "12px 28px", fontSize: "0.92rem" }}
          >
            {loading
              ? imgState
                ? "📷 Extracting image & generating report…"
                : "⚙️ Processing via AI & Blockchain…"
              : "🔒 Generate & Secure Report"}
          </button>
        </form>
      </div>
    </>
  );
}

// ── My Patients ────────────────────────────────────────────────────────────────
function MyPatients({ onViewRecords }) {
  const { data } = useApiData("/hospital/patients");
  const [q, setQ] = useState("");
  const patients = (data?.patients ?? []).filter(
    (p) =>
      !q ||
      `${p.first_name} ${p.last_name} ${p.email}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            My Patients
          </h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {patients.length} patient{patients.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
            }}
          />
          <input
            className="input"
            style={{ paddingLeft: 30, width: 200 }}
            placeholder="Search patients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>DOB</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    color: "var(--muted)",
                    padding: 32,
                  }}
                >
                  {q
                    ? "No patients match your search."
                    : "No patients registered yet."}
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr key={p.id}>
                <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                  #{p.id}
                </td>
                <td className="fw-600">
                  {p.first_name} {p.last_name}
                </td>
                <td style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {p.email}
                </td>
                <td>{p.phone || "—"}</td>
                <td style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  {p.date_of_birth
                    ? new Date(p.date_of_birth).toLocaleDateString("en-IN")
                    : "—"}
                </td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onViewRecords(p.id)}
                  >
                    Records <ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Patient Records ────────────────────────────────────────────────────────────
function PatientRecords({ initialId, onBack }) {
  const [patientId, setPatientId] = useState(
    initialId ? String(initialId) : "",
  );
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialId) {
      setLoading(true);
      api
        .get(`/visits/patient/${initialId}`)
        .then((d) => setRecords(d.records))
        .catch(() => setRecords([]))
        .finally(() => setLoading(false));
    }
  }, [initialId]);

  const search = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const d = await api.get(`/visits/patient/${patientId}`);
      setRecords(d.records);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="page-title">Patient Records</h1>
      <div className="card" style={{ marginBottom: 20 }}>
        <form className="flex gap-3 items-center" onSubmit={search}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Enter Patient ID…"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              "Fetching…"
            ) : (
              <>
                <Search size={14} /> Search
              </>
            )}
          </button>
        </form>
      </div>
      {records && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>IPFS CID</th>
                <th>Hospital</th>
                <th>Doctor</th>
                <th>Date</th>
                <th>Source</th>
                <th>Chain</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      color: "var(--muted)",
                      padding: 24,
                    }}
                  >
                    No records found.
                  </td>
                </tr>
              )}
              {records.map((r, i) => {
                const gUrl = cidGatewayUrl(r.cid, r.source);
                return (
                  <tr key={i}>
                    <td style={{ fontSize: "0.78rem", maxWidth: 160 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 120,
                          }}
                        >
                          {r.cid?.slice(0, 20)}…
                        </span>
                        <CopyButton text={r.cid} />
                        {gUrl && (
                          <a
                            href={gUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--primary)" }}
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td>{r.hospital_name}</td>
                    <td>
                      {r.doctor_first} {r.doctor_last}
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td>
                      <IpfsBadge source={r.source} />
                    </td>
                    <td>
                      {r.tx_hash ? (
                        <span className="badge badge-green">✓ Verified</span>
                      ) : (
                        <span className="badge badge-amber">Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Doctor Portal Root ─────────────────────────────────────────────────────────
export default function DoctorPortal() {
  const [page, setPage] = useState("overview");
  const [viewRecordsId, setViewRecordsId] = useState(null);
  const { user } = getSession();

  const goToRecords = useCallback((id) => {
    setViewRecordsId(id);
    setPage("records");
  }, []);
  const clearRecords = useCallback(() => {
    setViewRecordsId(null);
  }, []);

  return (
    <Shell
      brand={{
        icon: "⚕️",
        name: "Doctor Panel",
        sub: `${user?.firstName || ""} ${user?.lastName || ""}`,
        role: "Doctor",
      }}
      grad="var(--doctor-grad)"
      navItems={NAV}
      activePage={page}
      onNav={(k) => {
        if (k !== "records") setViewRecordsId(null);
        setPage(k);
      }}
    >
      <div className="anim-slide-up">
        {page === "overview" && <Overview user={user} />}
        {page === "new-record" && <NewRecord />}
        {page === "my-patients" && <MyPatients onViewRecords={goToRecords} />}
        {page === "records" && (
          <PatientRecords
            initialId={viewRecordsId}
            onBack={viewRecordsId ? clearRecords : null}
          />
        )}
      </div>
    </Shell>
  );
}
