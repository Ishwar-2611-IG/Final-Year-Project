import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  Heart,
  Mail,
  Pill,
  Plus,
  ShieldCheck,
  Stethoscope,
  User,
  X,
  FileText,
  Clock,
  Building2,
} from "lucide-react";
import Shell from "../components/Shell";
import { api, getSession } from "../api";

const NAV = [
  { key: "overview",     label: "Overview",      Icon: Activity },
  { key: "records",      label: "My Records",    Icon: ClipboardList },
  { key: "appointments", label: "Appointments",  Icon: Calendar },
];

const DEMO_DOCTORS = [
  { id: 5, name: "Dr. Sarah Connor",  specialization: "General Practice",   hospitalId: 1, hospitalName: "City General Hospital" },
  { id: 6, name: "Dr. Rahul Verma",   specialization: "Cardiologist",        hospitalId: 1, hospitalName: "City General Hospital" },
  { id: 7, name: "Dr. Priya Sharma",  specialization: "Dermatologist",       hospitalId: 2, hospitalName: "Oakwood Medical Centre" },
  { id: 8, name: "Dr. Aditya Nair",   specialization: "Orthopaedic Surgeon", hospitalId: 3, hospitalName: "Apollo Sunrise Hospital" },
];

const EMPTY_APPOINTMENT_FORM = { doctorId: "", hospitalId: "", appointmentDate: "", reason: "" };

// ── Helpers ─────────────────────────────────────────────────────────────────────
function formatDate(value, options, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", options);
}

function safeText(value, fallback = "Not provided") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function getRecordSummary(value, limit) {
  const summary = typeof value === "string" ? value.trim() : "";
  if (!summary) return "";
  if (summary.length <= limit) return summary;
  return `${summary.slice(0, limit).trimEnd()}...`;
}

function normalizeError(error, fallback = "Something went wrong. Please try again.") {
  if (typeof error?.response?.data?.message === "string") return error.response.data.message;
  if (typeof error?.message === "string") return error.message;
  return fallback;
}

function sanitizeCid(cid) {
  if (typeof cid !== "string") return "";
  const trimmed = cid.trim();
  return /^[a-zA-Z0-9]+$/.test(trimmed) ? trimmed : "";
}

function getGatewayUrl(record) {
  const cid = sanitizeCid(record?.cid);
  if (!cid) return null;
  if (record?.source === "pinata") return `https://gateway.pinata.cloud/ipfs/${cid}`;
  if (record?.source === "local") return `https://ipfs.io/ipfs/${cid}`;
  return null;
}

// ── Data fetching ────────────────────────────────────────────────────────────────
function useApiData(path, initialData) {
  const [data, setData]       = useState(initialData ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const requestIdRef          = useRef(0);

  const reload = useCallback(async () => {
    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current   = currentRequestId;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(path);
      if (requestIdRef.current === currentRequestId) setData(response);
    } catch (err) {
      if (requestIdRef.current === currentRequestId)
        setError(normalizeError(err, "Unable to load data right now."));
    } finally {
      if (requestIdRef.current === currentRequestId) setLoading(false);
    }
  }, [path]);

  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

// ── Copy Button ──────────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);
  useEffect(() => () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); }, []);

  const copy = useCallback(async () => {
    const value = typeof text === "string" ? text : "";
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }, [text]);

  return (
    <button type="button" onClick={copy} title="Copy" aria-label="Copy value"
      style={{ background: "none", border: "none", cursor: "pointer",
        color: copied ? "var(--success)" : "var(--muted)", padding: "2px 4px",
        borderRadius: 4, display: "inline-flex", alignItems: "center", transition: "color 0.2s" }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation">
      <div className="modal anim-slide-up" role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.2px" }}>{title}</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────────
function SourceBadge({ source }) {
  const map = {
    pinata:    { label: "Pinata",      cls: "badge-blue" },
    local:     { label: "Local Node",  cls: "badge-green" },
    simulated: { label: "Simulated",   cls: "badge-amber" },
  };
  const { label, cls } = map[source] ?? { label: source || "?", cls: "badge-purple" };
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Record Detail Modal ───────────────────────────────────────────────────────────
function RecordModal({ rec, onClose }) {
  const gatewayUrl = getGatewayUrl(rec);
  const doctorName = `${safeText(rec?.doctor_first, "")} ${safeText(rec?.doctor_last, "")}`.trim() || "Unknown Doctor";

  return (
    <Modal title="Health Record Details" onClose={onClose}>
      {/* Doctor + Hospital row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Doctor", main: doctorName, sub: safeText(rec?.specialization, "General Practice"), icon: <Stethoscope size={13} /> },
          { label: "Hospital", main: safeText(rec?.hospital_name), sub: formatDate(rec?.created_at, { day: "2-digit", month: "long", year: "numeric" }), icon: <Building2 size={13} /> },
        ].map(({ label, main, sub, icon }) => (
          <div key={label} style={{ background: "var(--surface2)", borderRadius: 12, padding: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
              {icon} {label}
            </div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 2 }}>{main}</div>
            <div style={{ fontSize: "0.76rem", color: "var(--muted)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* IPFS CID */}
      <div style={{ background: "var(--surface2)", borderRadius: 12, padding: 14, marginBottom: 14, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>IPFS CID</div>
          <SourceBadge source={rec?.source} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <code style={{ fontSize: "0.76rem", color: "var(--primary)", wordBreak: "break-all", flex: 1 }}>
            {sanitizeCid(rec?.cid) || "Unavailable"}
          </code>
          {sanitizeCid(rec?.cid) && <CopyButton text={sanitizeCid(rec?.cid)} />}
          {gatewayUrl && (
            <a href={gatewayUrl} target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--primary)", fontSize: "0.76rem", display: "inline-flex", alignItems: "center", gap: 3 }}>
              View <ExternalLink size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      {safeText(rec?.summary, "") && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Doctor's Summary
          </div>
          <p style={{ lineHeight: 1.75, background: "var(--surface2)", borderRadius: 12, padding: 14, fontSize: "0.87rem", border: "1px solid var(--border)" }}>
            {safeText(rec?.summary, "")}
          </p>
        </div>
      )}

      {/* Medicines + Precautions */}
      {((Array.isArray(rec?.medicines) && rec.medicines.length > 0) ||
        (Array.isArray(rec?.precautions) && rec.precautions.length > 0)) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {Array.isArray(rec?.medicines) && rec.medicines.length > 0 && (
            <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.18)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, color: "#22d3ee", fontWeight: 700, fontSize: "0.82rem" }}>
                <Pill size={14} /> Medicines
              </div>
              <ul style={{ paddingLeft: 16, fontSize: "0.82rem", lineHeight: 1.8, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 4 }}>
                {rec.medicines.map((m, i) => <li key={i}>{safeText(m)}</li>)}
              </ul>
            </div>
          )}
          {Array.isArray(rec?.precautions) && rec.precautions.length > 0 && (
            <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, color: "#fbbf24", fontWeight: 700, fontSize: "0.82rem" }}>
                <AlertTriangle size={14} /> Precautions
              </div>
              <ul style={{ paddingLeft: 16, fontSize: "0.82rem", lineHeight: 1.8, color: "var(--text2)", display: "flex", flexDirection: "column", gap: 4 }}>
                {rec.precautions.map((p, i) => <li key={i}>{safeText(p)}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Follow-up */}
      {safeText(rec?.followUp, "") && (
        <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.22)", borderRadius: 10, padding: "12px 14px", fontSize: "0.86rem", marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Clock size={14} style={{ color: "var(--primary)", marginTop: 2, flexShrink: 0 }} />
          <span><strong style={{ color: "var(--primary)" }}>Follow-up: </strong>{safeText(rec?.followUp, "")}</span>
        </div>
      )}

      {/* Blockchain verified */}
      {safeText(rec?.tx_hash, "") && (
        <div style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "12px 14px", fontSize: "0.82rem", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <ShieldCheck size={14} style={{ color: "var(--success)", marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong style={{ color: "var(--success)" }}>Blockchain Verified</strong>
            <code style={{ display: "block", fontSize: "0.72rem", color: "var(--success)", opacity: 0.8, marginTop: 3, wordBreak: "break-all" }}>
              {safeText(rec?.tx_hash, "")}
            </code>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Record Card ───────────────────────────────────────────────────────────────────
function RecordCard({ rec }) {
  const [open, setOpen] = useState(false);
  const doctorName = `${safeText(rec?.doctor_first, "")} ${safeText(rec?.doctor_last, "")}`.trim() || "Unknown Doctor";
  const summary = getRecordSummary(rec?.summary, 160);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        style={{
          width: "100%", textAlign: "left",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14, padding: "18px 20px",
          marginBottom: 12, cursor: "pointer",
          transition: "all 0.2s ease",
          position: "relative", overflow: "hidden",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(6,182,212,0.5)";
          e.currentTarget.style.boxShadow = "0 0 0 1px rgba(6,182,212,0.15), 0 8px 32px rgba(6,182,212,0.08)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.transform = "translateY(0)";
        }}
        aria-label={`View record from ${safeText(rec?.hospital_name)}`}>

        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #06b6d4, #3b82f6)", opacity: 0.6 }} />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 3 }}>
              {safeText(rec?.hospital_name)}
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.8rem", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Stethoscope size={11} /> {doctorName}
              </span>
              <span style={{ color: "var(--border2)" }}>·</span>
              <span>{formatDate(rec?.created_at, { day: "2-digit", month: "short", year: "numeric" })}</span>
              {safeText(rec?.specialization, "") && (
                <>
                  <span style={{ color: "var(--border2)" }}>·</span>
                  <span>{safeText(rec?.specialization, "")}</span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 10 }}>
            {safeText(rec?.tx_hash, "") ? (
              <span className="badge badge-green" style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <ShieldCheck size={9} /> Verified
              </span>
            ) : (
              <span className="badge badge-amber">Pending</span>
            )}
            <ArrowRight size={14} color="var(--muted)" />
          </div>
        </div>

        {summary && (
          <p style={{ marginTop: 10, fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.65,
            borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            {summary}
          </p>
        )}
      </button>
      {open && <RecordModal rec={rec} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Section state ─────────────────────────────────────────────────────────────────
function SectionState({ loading, error, empty, emptyText, children }) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", gap: 12 }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border2)", borderTopColor: "#06b6d4",
          borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Loading your data…</div>
      </div>
    );
  }
  if (error) return <div className="alert alert-error">{error}</div>;
  if (empty) return (
    <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.4 }}>📋</div>
      <div style={{ color: "var(--muted)", fontSize: "0.88rem" }}>{emptyText}</div>
    </div>
  );
  return children;
}

// ── OVERVIEW PAGE ─────────────────────────────────────────────────────────────────
function Overview({ user }) {
  const recordsState = useApiData("/visits/my-records", { records: [] });
  const apptsState   = useApiData("/visits/appointments", { appointments: [] });

  const allRecords    = recordsState.data?.records ?? [];
  const upcomingAppts = (apptsState.data?.appointments ?? []).filter(a => a?.status === "scheduled");

  const initials = [
    (safeText(user?.firstName, "P")[0] || "P").toUpperCase(),
    (safeText(user?.lastName, "U")[0]  || "U").toUpperCase(),
  ].join("");

  const stats = [
    { label: "Total Records",   value: allRecords.length,    icon: <FileText size={18} />,  accent: "#06b6d4", glow: "rgba(6,182,212,0.15)" },
    { label: "Upcoming Visits", value: upcomingAppts.length, icon: <Calendar size={18} />,  accent: "#818cf8", glow: "rgba(129,140,248,0.15)" },
    { label: "Doctors Seen",    value: new Set(allRecords.map(r => r.doctor_id)).size, icon: <Stethoscope size={18} />, accent: "#34d399", glow: "rgba(52,211,153,0.15)" },
    { label: "Blockchain Txns", value: allRecords.filter(r => r.tx_hash).length, icon: <ShieldCheck size={18} />, accent: "#fb923c", glow: "rgba(251,146,60,0.15)" },
  ];

  return (
    <>
      {/* ── Hero banner ── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(59,130,246,0.08) 50%, rgba(129,140,248,0.06) 100%)",
        border: "1px solid rgba(6,182,212,0.2)",
        borderRadius: 20, padding: "28px 28px 24px",
        marginBottom: 28, position: "relative", overflow: "hidden",
      }}>
        {/* background glow orbs */}
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -30, left: "30%", width: 150, height: 150, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(129,140,248,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative" }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.4rem", fontWeight: 800, color: "#fff",
            boxShadow: "0 0 0 4px rgba(6,182,212,0.2), 0 8px 24px rgba(6,182,212,0.3)",
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Hello, {safeText(user?.firstName, "Patient")}! 👋
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 5, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <User size={12} /> Patient
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Mail size={12} /> {safeText(user?.email)}
              </span>
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div style={{
              background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)",
              borderRadius: 10, padding: "6px 14px", fontSize: "0.75rem", fontWeight: 600,
              color: "#22d3ee", letterSpacing: "0.5px",
            }}>
              🏥 MEDBLOCK PROTECTED
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {stats.map(({ label, value, icon, accent, glow }) => (
          <div key={label} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 16, padding: "18px 20px", position: "relative", overflow: "hidden",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = accent + "60"; e.currentTarget.style.boxShadow = `0 8px 32px ${glow}`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
            {/* top accent bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent, opacity: 0.7 }} />
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: `${glow}`, color: accent, marginBottom: 12,
            }}>
              {icon}
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: accent, lineHeight: 1, marginBottom: 4 }}>
              {value}
            </div>
            <div style={{ fontSize: "0.73rem", color: "var(--muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Errors */}
      {recordsState.error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{recordsState.error}</div>}
      {apptsState.error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{apptsState.error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* ── Health Timeline ── */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 14 }}>
            Health Timeline
          </div>
          {allRecords.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
              <Heart size={28} style={{ color: "var(--muted)", marginBottom: 10, opacity: 0.4 }} />
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>No records yet.</div>
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 28 }}>
              {/* vertical line */}
              <div style={{ position: "absolute", left: 9, top: 8, bottom: 8, width: 2,
                background: "linear-gradient(to bottom, #06b6d4, rgba(6,182,212,0.1))", borderRadius: 2 }} />

              {allRecords.slice(0, 5).map((rec, idx) => (
                <div key={rec.id ?? idx} style={{ position: "relative", marginBottom: 16 }}>
                  {/* dot */}
                  <div style={{
                    position: "absolute", left: -20, top: 14,
                    width: 10, height: 10, borderRadius: "50%",
                    background: idx === 0 ? "#06b6d4" : "var(--surface3)",
                    border: `2px solid ${idx === 0 ? "#06b6d4" : "var(--border2)"}`,
                    boxShadow: idx === 0 ? "0 0 8px rgba(6,182,212,0.6)" : "none",
                  }} />
                  <div style={{
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 12, padding: "12px 16px",
                    transition: "border-color 0.2s",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: "0.87rem", marginBottom: 3 }}>
                      {safeText(rec?.hospital_name)}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.76rem", display: "flex", gap: 6, alignItems: "center" }}>
                      <Stethoscope size={10} />
                      Dr. {safeText(rec?.doctor_first, "")} {safeText(rec?.doctor_last, "")}
                      <span style={{ color: "var(--border2)" }}>·</span>
                      {formatDate(rec?.created_at, { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                    {getRecordSummary(rec?.summary, 90) && (
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: 6, lineHeight: 1.55 }}>
                        {getRecordSummary(rec?.summary, 90)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel: Next appointment ── */}
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase",
            letterSpacing: 0.8, marginBottom: 14 }}>
            Next Appointment
          </div>
          {upcomingAppts.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "32px 16px" }}>
              <Calendar size={28} style={{ color: "var(--muted)", marginBottom: 10, opacity: 0.4 }} />
              <div style={{ color: "var(--muted)", fontSize: "0.83rem" }}>No upcoming appointments</div>
            </div>
          ) : upcomingAppts.slice(0, 1).map(appt => (
            <div key={appt.id} style={{
              background: "linear-gradient(135deg, rgba(129,140,248,0.08), rgba(59,130,246,0.06))",
              border: "1px solid rgba(129,140,248,0.25)", borderRadius: 16, padding: 20,
            }}>
              <div style={{ fontSize: "0.68rem", color: "#818cf8", textTransform: "uppercase",
                letterSpacing: 1, fontWeight: 700, marginBottom: 12 }}>
                🗓 Scheduled
              </div>
              <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 4 }}>
                {safeText(appt?.doctor_first, "")} {safeText(appt?.doctor_last, "")}
              </div>
              {safeText(appt?.specialization, "") && (
                <div style={{ fontSize: "0.78rem", color: "#818cf8", marginBottom: 10 }}>
                  {safeText(appt?.specialization, "")}
                </div>
              )}
              <div style={{ fontSize: "0.82rem", color: "var(--muted)", display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={12} /> {safeText(appt?.hospital_name)}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={12} />
                  {formatDate(appt?.appointment_date, { day: "2-digit", month: "long", year: "numeric" })}
                </span>
                {safeText(appt?.reason, "") && (
                  <span style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 4 }}>
                    <FileText size={12} style={{ marginTop: 2, flexShrink: 0 }} />
                    {safeText(appt?.reason, "")}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Quick tip card */}
          <div style={{ marginTop: 16, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
            borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ShieldCheck size={15} style={{ color: "var(--success)" }} />
              <span style={{ fontWeight: 700, fontSize: "0.83rem", color: "var(--success)" }}>Blockchain Secured</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.65 }}>
              All your health records are encrypted and stored on IPFS with a blockchain transaction hash for tamper-proof verification.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── RECORDS PAGE ──────────────────────────────────────────────────────────────────
function RecordsPage() {
  const { data, loading, error } = useApiData("/visits/my-records", { records: [] });
  const records = data?.records ?? [];

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">My Health Records</h1>
        <p className="page-subtitle">Click any record to view the full AI report secured on IPFS + Blockchain.</p>
      </div>

      {records.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10,
            padding: "8px 14px", fontSize: "0.78rem", color: "#22d3ee", fontWeight: 600 }}>
            📋 {records.length} Total Records
          </div>
          <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10,
            padding: "8px 14px", fontSize: "0.78rem", color: "var(--success)", fontWeight: 600 }}>
            ✓ {records.filter(r => r.tx_hash).length} Blockchain Verified
          </div>
        </div>
      )}

      <SectionState loading={loading} error={error} empty={records.length === 0}
        emptyText="No records yet. Your doctor will add visit reports here after your consultation.">
        {records.map((rec, idx) => (
          <RecordCard key={rec.id ?? `${rec.cid ?? "record"}-${idx}`} rec={rec} />
        ))}
      </SectionState>
    </>
  );
}

// ── APPOINTMENTS PAGE ─────────────────────────────────────────────────────────────
function AppointmentsPage() {
  const { data, loading, error, reload } = useApiData("/visits/appointments", { appointments: [] });
  const [show, setShow]             = useState(false);
  const [form, setForm]             = useState(EMPTY_APPOINTMENT_FORM);
  const [saving, setSaving]         = useState(false);
  const [submitError, setSubmitError] = useState("");

  const upcoming = (data?.appointments ?? []).filter(a => a?.status === "scheduled");
  const past     = (data?.appointments ?? []).filter(a => a?.status !== "scheduled");

  const selectedDoctor = useMemo(
    () => DEMO_DOCTORS.find(d => d.id === Number(form.doctorId)) ?? null,
    [form.doctorId],
  );

  const handleDoctorSelect = useCallback((e) => {
    const doctor = DEMO_DOCTORS.find(d => d.id === Number(e.target.value));
    if (!doctor) { setForm(c => ({ ...c, doctorId: "", hospitalId: "" })); return; }
    setForm(c => ({ ...c, doctorId: String(doctor.id), hospitalId: String(doctor.hospitalId) }));
  }, []);

  const closeModal = useCallback(() => {
    if (saving) return;
    setShow(false); setSubmitError(""); setForm(EMPTY_APPOINTMENT_FORM);
  }, [saving]);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true); setSubmitError("");
    const trimmedReason = form.reason.trim();
    const appointmentDate = new Date(form.appointmentDate);
    const today = new Date(); today.setHours(0,0,0,0);
    if (!form.doctorId || !form.hospitalId || Number.isNaN(appointmentDate.getTime())) {
      setSubmitError("Please choose a doctor and a valid date."); setSaving(false); return;
    }
    if (appointmentDate < today) {
      setSubmitError("Appointment date cannot be in the past."); setSaving(false); return;
    }
    try {
      await api.post("/visits/appointments", { doctorId: form.doctorId, hospitalId: form.hospitalId, appointmentDate: form.appointmentDate, reason: trimmedReason });
      closeModal(); await reload();
    } catch (err) {
      setSubmitError(normalizeError(err, "Unable to book the appointment right now."));
    } finally { setSaving(false); }
  }, [closeModal, form, reload]);

  const AppointmentRow = ({ appt, dim }) => (
    <tr style={{ opacity: dim ? 0.65 : 1 }}>
      <td>
        <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>
          {safeText(appt?.doctor_first, "")} {safeText(appt?.doctor_last, "")}
        </div>
        <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: 2 }}>
          {safeText(appt?.specialization)}
        </div>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.85rem" }}>
          <Building2 size={12} style={{ color: "var(--muted)" }} />
          {safeText(appt?.hospital_name)}
        </div>
      </td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.85rem" }}>
          <Calendar size={12} style={{ color: "var(--muted)" }} />
          {formatDate(appt?.appointment_date, { day: "2-digit", month: "short", year: "numeric" })}
        </div>
      </td>
      <td style={{ color: "var(--muted)", fontSize: "0.83rem" }}>{safeText(appt?.reason, "—")}</td>
      <td>
        <span className={`badge ${appt?.status === "scheduled" ? "badge-blue" : appt?.status === "completed" ? "badge-green" : "badge-red"}`}>
          {safeText(appt?.status)}
        </span>
      </td>
    </tr>
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>My Appointments</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {upcoming.length} upcoming · {past.length} past
          </p>
        </div>
        <button type="button" className="btn btn-primary" id="book-appt-btn" onClick={() => setShow(true)}>
          <Plus size={15} /> Book Appointment
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Upcoming */}
      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#06b6d4", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
        Upcoming
      </div>
      <div className="table-wrap" style={{ marginBottom: 28, border: "1px solid rgba(6,182,212,0.2)" }}>
        <table>
          <thead style={{ background: "rgba(6,182,212,0.06)" }}>
            <tr>
              {["Doctor", "Hospital", "Date", "Reason", "Status"].map(h => (
                <th key={h} style={{ color: "#22d3ee", fontSize: "0.7rem" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>
                Loading appointments…
              </td></tr>
            )}
            {!loading && upcoming.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                <Calendar size={24} style={{ opacity: 0.3, marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                No upcoming appointments. Book one above!
              </td></tr>
            )}
            {upcoming.map(a => <AppointmentRow key={a.id} appt={a} dim={false} />)}
          </tbody>
        </table>
      </div>

      {/* Past */}
      {past.length > 0 && (
        <>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
            Past
          </div>
          <div className="table-wrap" style={{ border: "1px solid var(--border)" }}>
            <table>
              <thead>
                <tr>
                  {["Doctor", "Hospital", "Date", "Reason", "Status"].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {past.map(a => <AppointmentRow key={a.id} appt={a} dim={true} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Book modal */}
      {show && (
        <Modal title="📅 Book an Appointment" onClose={closeModal}>
          {submitError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{submitError}</div>}
          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="doctor-select">Select Doctor *</label>
              <select id="doctor-select" className="input" required value={form.doctorId} onChange={handleDoctorSelect}>
                <option value="">Choose a doctor…</option>
                {DEMO_DOCTORS.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialization} ({d.hospitalName})
                  </option>
                ))}
              </select>
            </div>
            {selectedDoctor && (
              <div className="form-group">
                <label htmlFor="hospital-name">Hospital</label>
                <input id="hospital-name" className="input" readOnly value={selectedDoctor.hospitalName} style={{ opacity: 0.65 }} />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="appt-date">Preferred Date *</label>
              <input id="appt-date" type="date" className="input" required
                min={new Date().toISOString().split("T")[0]}
                value={form.appointmentDate}
                onChange={e => setForm(c => ({ ...c, appointmentDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label htmlFor="visit-reason">Reason for Visit</label>
              <textarea id="visit-reason" className="input" rows={3} maxLength={300}
                placeholder="Briefly describe your symptoms or reason for the visit…"
                value={form.reason}
                onChange={e => setForm(c => ({ ...c, reason: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Booking…" : "✓ Confirm Booking"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ── ROOT EXPORT ───────────────────────────────────────────────────────────────────
export default function PatientPortal() {
  const [page, setPage] = useState("overview");
  const session = getSession();
  const user = session?.user ?? {};

  const currentPage = useMemo(() => ({
    overview:     <Overview user={user} />,
    records:      <RecordsPage />,
    appointments: <AppointmentsPage />,
  }), [user]);

  return (
    <Shell
      brand={{
        icon: "P",
        name: "Patient Portal",
        sub: `${safeText(user?.firstName, "")} ${safeText(user?.lastName, "")}`.trim(),
        role: "Patient",
      }}
      grad="var(--patient-grad)"
      navItems={NAV}
      activePage={page}
      onNav={setPage}
    >
      <div className="anim-slide-up">
        {currentPage[page] ?? currentPage.overview}
      </div>
    </Shell>
  );
}
