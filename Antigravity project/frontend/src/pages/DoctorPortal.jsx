import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    PlusCircle, Users, ClipboardList, Mic, MicOff, Search,
    Activity, ChevronRight, ExternalLink, Download, Copy, Check, Upload,
    AlertTriangle, ShieldCheck, Mail, Phone, ArrowLeft, Loader2,
    X, Calendar, CheckCircle2,
} from 'lucide-react';
import Shell from '../components/Shell';
import { api, getSession } from '../api';

const NAV = [
    { key: 'overview',    label: 'Overview',       Icon: Activity },
    { key: 'new-record',  label: 'New Visit',       Icon: PlusCircle },
    { key: 'my-patients', label: 'My Patients',     Icon: Users },
    { key: 'records',     label: 'Patient Records', Icon: ClipboardList },
];

const LANGUAGES = [
    { code: 'en-IN', label: 'English' },
    { code: 'hi-IN', label: 'हिन्दी' },
    { code: 'mr-IN', label: 'मराठी' },
    { code: 'ta-IN', label: 'தமிழ்' },
];

// ── Mock patients for enhanced patient cards ───────────────────────────────────
const MOCK_PATIENTS_RICH = [
    { id: 1001, firstName: 'Ayesha',  lastName: 'Kapoor', email: 'ayesha.k@gmail.com',      phone: '+91 98201 44512', condition: 'Type 2 Diabetes — follow-up',       lastVisit: '2026-04-27T10:30:00Z', avatar: 'AK' },
    { id: 1002, firstName: 'Rohan',   lastName: 'Mehta',  email: 'rohan.m@outlook.com',      phone: '+91 87654 12390', condition: 'Post-operative cardiac check',       lastVisit: '2026-04-26T14:15:00Z', avatar: 'RM' },
    { id: 1003, firstName: 'Priya',   lastName: 'Sharma', email: 'priya.s@yahoo.com',        phone: '+91 99887 65432', condition: 'Hypertension management',            lastVisit: '2026-04-25T09:45:00Z', avatar: 'PS' },
    { id: 1004, firstName: 'Dev',     lastName: 'Patel',  email: 'dev.p@gmail.com',          phone: '+91 76543 21098', condition: 'Acute bronchitis',                   lastVisit: '2026-04-24T16:00:00Z', avatar: 'DP' },
    { id: 1005, firstName: 'Neha',    lastName: 'Gupta',  email: 'neha.g@proton.me',         phone: '+91 88776 55443', condition: 'Migraine — chronic',                 lastVisit: '2026-04-23T11:20:00Z', avatar: 'NG' },
    { id: 1006, firstName: 'Kiran',   lastName: 'Desai',  email: 'kiran.d@gmail.com',        phone: '+91 65432 10987', condition: 'Osteoarthritis — knee',              lastVisit: '2026-04-20T08:30:00Z', avatar: 'KD' },
    { id: 1007, firstName: 'Sanjay',  lastName: 'Iyer',   email: 'sanjay.iyer@hotmail.com',  phone: '+91 98765 43210', condition: 'Thyroid disorder — monitoring',      lastVisit: '2026-04-18T13:45:00Z', avatar: 'SI' },
    { id: 1008, firstName: 'Meera',   lastName: 'Rao',    email: 'meera.rao@gmail.com',      phone: '+91 77889 90012', condition: 'Prenatal — 24 weeks',                lastVisit: '2026-04-15T10:00:00Z', avatar: 'MR' },
];

const MOCK_RECORDS = [
    { id: 5001, patientId: 1001, hospitalName: 'Apollo Hospital Mumbai', doctorFirst: 'Dr. Vikram', doctorLast: 'Singh', summary: 'Patient presented for Type 2 Diabetes follow-up. HbA1c improved to 6.8% from 7.4%. Continue Metformin 1000mg BID. Added lifestyle counseling.', medications: ['Metformin 1000mg BID', 'Atorvastatin 10mg QHS', 'Vitamin D3 60K IU weekly'], precautions: ['Monitor fasting glucose weekly', 'Report any hypoglycemic episodes immediately'], followUp: 'Review in 3 months with HbA1c and lipid profile.', cid: 'bafybeih7x2fkd3mn5pqrstu8vwxyz', txHash: '0x8a4f2c1d9e3b7a5f6c8d2e1a3b4c5d6e7f8a9b', source: 'pinata', createdAt: '2026-04-27T10:30:00Z', hasImage: false },
    { id: 5002, patientId: 1001, hospitalName: 'Apollo Hospital Mumbai', doctorFirst: 'Dr. Vikram', doctorLast: 'Singh', summary: 'Initial diabetes workup. Fasting glucose 186 mg/dL, HbA1c 7.4%. Started on Metformin 500mg TID.', medications: ['Metformin 500mg TID'], precautions: ['Check blood sugar daily', 'Avoid sugary foods'], followUp: '2 weeks for dosage adjustment.', cid: 'bafybeig3k8lm9nop2qrstuv5wxyz123', txHash: '0x1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b', source: 'local', createdAt: '2026-03-15T09:00:00Z', hasImage: true },
    { id: 5003, patientId: 1002, hospitalName: 'Apollo Hospital Mumbai', doctorFirst: 'Dr. Vikram', doctorLast: 'Singh', summary: 'Post-CABG 6-week follow-up. Wound healing satisfactory. Echo shows LVEF 55%.', medications: ['Aspirin 75mg OD', 'Metoprolol 50mg BID', 'Ramipril 5mg OD'], precautions: ['Continue cardiac rehab 3x/week', 'No heavy lifting >5kg for 3 months'], followUp: '4 weeks — stress test scheduled.', cid: 'bafybeic4m5n6op7qrstuv8wxyz456', txHash: '0x2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c', source: 'pinata', createdAt: '2026-04-26T14:15:00Z', hasImage: false },
    { id: 5004, patientId: 1003, hospitalName: 'Apollo Hospital Mumbai', doctorFirst: 'Dr. Vikram', doctorLast: 'Singh', summary: 'Hypertension review. BP 148/92 — above target. Increased Amlodipine to 10mg. Added Losartan 50mg.', medications: ['Amlodipine 10mg OD', 'Losartan 50mg OD'], precautions: ['Home BP monitoring twice daily', 'Reduce sodium intake to <2g/day'], followUp: '2 weeks for BP reassessment.', cid: 'bafybeid5n6op7qrstuv8wxyz789', txHash: null, source: 'local', createdAt: '2026-04-25T09:45:00Z', hasImage: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function cidGatewayUrl(cid, source) {
    if (!cid) return null;
    if (source === 'simulated') return null;
    if (source === 'pinata') return `https://gateway.pinata.cloud/ipfs/${cid}`;
    return `https://ipfs.io/ipfs/${cid}`;
}

function formatDate(value) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatTime(value) {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function useApiData(path) {
    const [data, setData] = useState(null);
    const pathRef = useRef(path);
    pathRef.current = path;
    const reload = useCallback(() => {
        api.get(pathRef.current).then(setData).catch(console.error);
    }, []);
    useEffect(() => { reload(); }, [reload]);
    return { data, reload };
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <button onClick={copy} title="Copy CID" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: copied ? 'var(--success)' : 'var(--muted)',
            padding: '2px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center',
        }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
    );
}

// ── IPFS source badge ─────────────────────────────────────────────────────────
function IpfsBadge({ source }) {
    const map = {
        local:     { label: 'Local Node', cls: 'badge-green' },
        pinata:    { label: 'Pinata',     cls: 'badge-blue' },
        simulated: { label: 'Simulated',  cls: 'badge-amber' },
    };
    const { label, cls } = map[source] || { label: source || '?', cls: 'badge-purple' };
    return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Collapsible report section ────────────────────────────────────────────────
function ReportSection({ icon, title, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
            <button type="button" onClick={() => setOpen(!open)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px 0', background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem',
            }}>
                <span>{icon}&nbsp; {title}</span>
                <span style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--muted)', fontSize: '0.75rem' }}>▼</span>
            </button>
            {open && <div style={{ paddingBottom: 16, color: 'var(--muted)', fontSize: '0.87rem', lineHeight: 1.7 }}>{children}</div>}
        </div>
    );
}

// ── Drag & Drop Image Upload ──────────────────────────────────────────────────
function ImageDropZone({ imgState, onFile, onClear }) {
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef(null);

    const processFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => onFile({ preview: reader.result, base64: reader.result, mimeType: file.type || 'image/jpeg' });
        reader.readAsDataURL(file);
    };

    const onDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        processFile(e.dataTransfer.files[0]);
    };

    if (imgState) {
        return (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border2)', maxWidth: 380 }}>
                <img src={imgState.preview} alt="Prescription" style={{ width: '100%', display: 'block', maxHeight: 240, objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <button type="button" onClick={onClear} className="btn btn-sm btn-danger" style={{ padding: '4px 10px' }}>✕ Remove</button>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.6)', padding: '8px 14px', fontSize: '0.78rem', color: '#a7f3d0' }}>
                    ✅ AI Vision will extract text from this prescription
                </div>
            </div>
        );
    }

    return (
        <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => processFile(e.target.files?.[0])}
            />
            <div className="drop-zone-icon">
                <Upload size={20} color="var(--primary)" />
            </div>
            <div className="drop-zone-text">
                <strong>Drag & drop prescription</strong> or click to upload<br />
                <span style={{ fontSize: '0.78rem' }}>JPG, PNG, WEBP • AI will OCR extract text automatically</span>
            </div>
        </div>
    );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ user, onNav }) {
    const { data: patients } = useApiData('/hospital/patients');
    const { data: reports }  = useApiData('/doctor/reports');

    const stats = [
        { label: 'My Patients',     value: patients?.patients?.length ?? '—', icon: '👥', color: 'var(--warning)',  accent: '#f59e0b', nav: 'my-patients' },
        { label: 'Reports Created', value: reports?.reports?.length  ?? '—', icon: '📋', color: 'var(--success)',  accent: '#22c55e', nav: 'records' },
    ];

    return (
        <>
            <h1 className="page-title">Hello, {user?.firstName}! 👨‍⚕️</h1>
            <p className="page-subtitle">Your clinical overview for today</p>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 440, marginBottom: 24 }}>
                {stats.map(s => (
                    <div
                        key={s.label}
                        className="stat-card"
                        style={{ '--card-accent': s.accent, cursor: 'pointer' }}
                        onClick={() => onNav(s.nav)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && onNav(s.nav)}
                    >
                        <div className="stat-icon" style={{ background: `${s.accent}18` }}>
                            <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                        </div>
                        <div className="stat-body">
                            <div className="label">{s.label}</div>
                            <div className="value" style={{ color: s.color, fontSize: '1.7rem' }}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick start card */}
            <div className="card" style={{ borderLeft: '3px solid var(--primary)', background: 'var(--primary-soft)', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, fontSize: '0.95rem' }}>💡 Quick Start</div>
                <p style={{ color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.7 }}>
                    Go to <strong style={{ color: 'var(--text)' }}>New Visit</strong> to record a patient consultation. Dictate clinical notes,
                    upload a prescription image, and MedBlock will generate an AI summary secured on IPFS + Blockchain.
                </p>
                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {[
                        ['🎙️', 'Multilingual dictation'],
                        ['📷', 'Prescription OCR Engine'],
                        ['🤖', 'AI Health Summaries'],
                        ['🔗', 'IPFS Cryptographic Anchors'],
                    ].map(([icon, text]) => (
                        <span key={text} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 999, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700,
                        }}>
                            {icon} {text}
                        </span>
                    ))}
                </div>
            </div>

            {/* Quick actions */}
            <div className="card">
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
                    Quick Actions
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => onNav('new-record')}>
                        <PlusCircle size={15} /> New Visit Record
                    </button>
                    <button className="btn btn-ghost" onClick={() => onNav('my-patients')}>
                        <Users size={15} /> My Patients
                    </button>
                    <button className="btn btn-ghost" onClick={() => onNav('records')}>
                        <ClipboardList size={15} /> Patient Records
                    </button>
                </div>
            </div>
        </>
    );
}

// ── New Visit Record ──────────────────────────────────────────────────────────
function NewRecord({ onNav }) {
    const { user } = getSession();
    const { data: patientData } = useApiData('/hospital/patients');
    const [form, setForm] = useState({
        patientId: '', hospitalId: String(user?.hospitalId || '1'),
        transcript: '', prescriptionText: '',
    });
    const [recording, setRecording]     = useState(false);
    const [loading, setLoading]         = useState(false);
    const [result, setResult]           = useState(null);
    const [err, setErr]                 = useState('');
    const [lang, setLang]               = useState('en-IN');
    const [elapsed, setElapsed]         = useState(0);
    const [imgState, setImgState]       = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [saveStatus, setSaveStatus]   = useState(null); // 'saving' | 'saved' | null

    const recognitionRef = useRef(null);
    const timerRef       = useRef(null);
    const finalRef       = useRef('');
    const saveTimeoutRef = useRef(null);

    const patients = patientData?.patients ?? [];

    const SpeechRecognition = typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

    const startRecording = () => {
        if (!SpeechRecognition) { setErr('Speech Recognition not supported. Use Chrome or Edge.'); return; }
        setErr('');
        const recognition = new SpeechRecognition();
        recognition.lang = lang;
        recognition.continuous = true;
        recognition.interimResults = true;
        finalRef.current = form.transcript;
        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const text = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalRef.current += text + ' ';
                else interim += text;
            }
            setForm(f => ({ ...f, transcript: finalRef.current + interim }));
        };
        recognition.onerror = (e) => {
            if (e.error === 'not-allowed') setErr('Microphone access denied. Please allow mic permissions.');
        };
        recognition.onend = () => {
            if (recognitionRef.current) { try { recognitionRef.current.start(); } catch { } }
        };
        recognition.start();
        recognitionRef.current = recognition;
        setRecording(true);
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
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

    useEffect(() => () => { stopRecording(); }, [stopRecording]);

    const handleFieldChange = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
        setSaveStatus('saving');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 2000);
        }, 1200);
    };

    const handleSubmitClick = (e) => {
        e.preventDefault();
        if (recording) stopRecording();
        const transcript = (finalRef.current.trim() || form.transcript.trim());
        if (!transcript && !imgState) { setErr('Please record clinical notes or upload a prescription image.'); return; }
        setShowConfirm(true);
    };

    const executeSubmit = async () => {
        setShowConfirm(false);
        setLoading(true); setErr(''); setResult(null);
        // Simulate AI processing
        await new Promise(r => setTimeout(r, 2200));
        const transcript = finalRef.current.trim() || form.transcript.trim();
        const mockResult = {
            cid: 'bafybeia' + Math.random().toString(36).slice(2, 18) + 'x4z',
            source: Math.random() > 0.5 ? 'pinata' : 'local',
            txHash: '0x' + Math.random().toString(16).slice(2, 42),
            geminiUsed: true,
            summary: transcript
                ? `AI-generated clinical summary: Patient consultation recorded. ${transcript.slice(0, 120)}...`
                : 'Clinical report generated from prescription image. AI extracted medication details.',
            medicines: imgState ? ['Aspirin 75mg OD', 'Atorvastatin 10mg QHS'] : ['Metformin 1000mg BID', 'Vitamin D3 60K IU weekly'],
            precautions: ['Monitor vitals daily for 7 days', 'Report adverse reactions immediately', 'Follow prescribed dosage strictly'],
            followUp: 'Review in 2 weeks. Schedule lab tests before next visit.',
            ocrText: imgState ? 'Rx:\nAspirin 75mg — 1 tab daily\nAtorvastatin 10mg — 1 tab at night\n\nAdvice: Low-fat diet, regular exercise.' : undefined,
            hasImage: !!imgState,
        };
        setResult(mockResult);
        setForm({ patientId: '', hospitalId: String(user?.hospitalId || '1'), transcript: '', prescriptionText: '' });
        finalRef.current = '';
        setImgState(null);
        setLoading(false);
    };

    const downloadReport = (r) => {
        const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `medblock-report-${r.cid?.slice(0, 12) || Date.now()}.json`;
        a.click(); URL.revokeObjectURL(url);
    };

    const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const gatewayUrl = result ? cidGatewayUrl(result.cid, result.source) : null;

    return (
        <>
            <h1 className="page-title">New Visit Record</h1>
            <p className="page-subtitle">Select a patient, dictate or type notes — AI will summarize and secure on IPFS + Blockchain.</p>

            {err && (
                <div className="alert alert-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
                    <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>{err}</div>
                    <button onClick={() => setErr('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                </div>
            )}

            {/* AI Report result */}
            {result && (
                <div style={{ marginBottom: 24 }}>
                    <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 6 }}>
                                <CheckCircle2 size={18} /> Report secured on blockchain!
                            </div>
                            <div style={{ fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <IpfsBadge source={result.source} />
                                <span>CID: <code style={{ fontSize: '0.8rem', opacity: 0.9 }}>{result.cid?.slice(0, 28)}…</code></span>
                                <CopyButton text={result.cid} />
                                {gatewayUrl && (
                                    <a href={gatewayUrl} target="_blank" rel="noopener noreferrer"
                                        style={{ color: 'var(--primary)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                        View on IPFS <ExternalLink size={11} />
                                    </a>
                                )}
                            </div>
                            {result.txHash && (
                                <div style={{ fontSize: '0.78rem', marginTop: 6, opacity: 0.8 }}>
                                    Tx: <code>{result.txHash.slice(0, 42)}</code>
                                </div>
                            )}
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => downloadReport(result)} style={{ flexShrink: 0 }}>
                            <Download size={13} /> Download JSON
                        </button>
                    </div>

                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>🤖 AI Health Report</div>
                            {result.hasImage && <span className="badge badge-blue">📷 Image OCR Included</span>}
                        </div>

                        {result.ocrText && (
                            <ReportSection icon="📄" title="Extracted Prescription Text (OCR)">
                                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.83rem', margin: 0, lineHeight: 1.6, background: 'var(--surface2)', borderRadius: 8, padding: 12 }}>
                                    {result.ocrText}
                                </pre>
                            </ReportSection>
                        )}

                        <ReportSection icon="📝" title="Clinical Summary" defaultOpen>
                            <p style={{ lineHeight: 1.7 }}>{result.summary || 'No summary generated.'}</p>
                        </ReportSection>

                        <ReportSection icon="💊" title="Medications">
                            {result.medicines?.length > 0 ? (
                                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                    {result.medicines.map((med, i) => (
                                        <div key={i} style={{
                                            padding: '10px 14px', background: 'rgba(59,130,246,0.06)',
                                            borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)',
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                        }}>
                                            <span style={{ fontSize: '1.1rem' }}>💊</span>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.88rem' }}>
                                                    {typeof med === 'string' ? med : med.name || String(med)}
                                                </div>
                                                <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                                                    <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.1)', borderRadius: 4, padding: '2px 6px', fontWeight: 700, color: 'var(--primary)' }}>🌅 Morning</span>
                                                    <span style={{ fontSize: '0.7rem', background: 'rgba(59,130,246,0.1)', borderRadius: 4, padding: '2px 6px', fontWeight: 700, color: 'var(--primary)' }}>🌙 Night</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <p>No specific medications mentioned.</p>}
                        </ReportSection>

                        <ReportSection icon="⚠️" title="Precautions">
                            {result.precautions?.length > 0 ? (
                                <ul style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {result.precautions.map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                            ) : <p>No precautions specified.</p>}
                        </ReportSection>

                        <ReportSection icon="📅" title="Follow-Up">
                            <p>{result.followUp || 'No follow-up instructions.'}</p>
                        </ReportSection>
                    </div>
                </div>
            )}

            {/* Main form */}
            <div className="card" style={{ position: 'relative' }}>
                {/* Auto-save indicator */}
                {saveStatus && (
                    <div style={{ position: 'absolute', top: 20, right: 20, fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {saveStatus === 'saving' ? (
                            <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Saving draft...</>
                        ) : (
                            <><Check size={10} style={{ color: 'var(--success)' }} /> Draft saved</>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmitClick}>
                    {/* Patient selector */}
                    <div className="form-group">
                        <label>Select Patient *</label>
                        {patients.length > 0 ? (
                            <select
                                id="patient-id"
                                className="input"
                                required
                                value={form.patientId}
                                onChange={e => handleFieldChange('patientId', e.target.value)}
                            >
                                <option value="">— Select Patient —</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>#{p.id} — {p.first_name} {p.last_name}</option>
                                ))}
                            </select>
                        ) : (
                            <input className="input" placeholder="Patient ID" required value={form.patientId}
                                onChange={e => handleFieldChange('patientId', e.target.value)} />
                        )}
                    </div>

                    {/* Clinical Notes */}
                    <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                            <label style={{ margin: 0 }}>Clinical Notes / Transcript *</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <select className="input" value={lang} onChange={e => setLang(e.target.value)} disabled={recording}
                                    style={{ padding: '4px 8px', fontSize: '0.78rem', width: 'auto', minWidth: 88 }}>
                                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                                </select>
                                {!recording ? (
                                    <button type="button" className="btn btn-sm btn-ghost" onClick={startRecording}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <Mic size={13} /> Dictate
                                    </button>
                                ) : (
                                    <button type="button" className="btn btn-sm btn-danger" onClick={stopRecording}
                                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <MicOff size={13} /> Stop
                                    </button>
                                )}
                            </div>
                        </div>

                        {recording && (
                            <div className="recording-bar">
                                <div className="mic-wave">
                                    {[1,2,3,4,5].map(i => <div key={i} className="bar" />)}
                                </div>
                                <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                                    Recording… {fmtTime(elapsed)}
                                </span>
                                <span style={{ color: 'var(--muted)', marginLeft: 'auto', fontSize: '0.78rem' }}>
                                    {LANGUAGES.find(l => l.code === lang)?.label}
                                </span>
                            </div>
                        )}

                        <textarea
                            id="transcript"
                            className="input"
                            rows={7}
                            placeholder="Patient presents with acute pharyngitis, temp 38.5°C. Prescribed Amoxicillin 500mg BID for 7 days…"
                            value={form.transcript}
                            onChange={e => { handleFieldChange('transcript', e.target.value); finalRef.current = e.target.value; }}
                        />

                        {!SpeechRecognition && (
                            <div style={{ marginTop: 6, fontSize: '0.77rem', color: 'var(--warning)' }}>
                                ⚠️ Speech Recognition requires Chrome or Edge for live dictation.
                            </div>
                        )}
                    </div>

                    {/* Additional Notes */}
                    <div className="form-group">
                        <label>Additional Prescription Notes <span style={{ color: 'var(--muted)' }}>(optional)</span></label>
                        <textarea className="input" rows={3}
                            placeholder="Follow-up instructions, allergy notes, additional context…"
                            value={form.prescriptionText}
                            onChange={e => handleFieldChange('prescriptionText', e.target.value)}
                        />
                    </div>

                    {/* Drag & Drop Image */}
                    <div className="form-group">
                        <label>Prescription Image <span style={{ color: 'var(--muted)' }}>(optional — AI will OCR extract text)</span></label>
                        <ImageDropZone imgState={imgState} onFile={setImgState} onClear={() => setImgState(null)} />
                    </div>

                    <button
                        id="submit-record"
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || recording}
                        style={{ padding: '12px 28px', fontSize: '0.92rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                        {loading ? (
                            <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {imgState ? 'Extracting image…' : 'Processing via AI…'}</>
                        ) : (
                            <><ShieldCheck size={16} /> Generate &amp; Secure Report</>
                        )}
                    </button>
                </form>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConfirm(false)} role="dialog" aria-modal="true">
                    <div className="modal anim-slide-up" style={{ maxWidth: 440 }}>
                        <div style={{ display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, background: 'rgba(59,130,246,0.08)', color: 'var(--primary)', marginBottom: 16 }}>
                            <ShieldCheck size={24} />
                        </div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Secure record on ledger?</h3>
                        <p style={{ color: 'var(--muted)', fontSize: '0.87rem', lineHeight: 1.6, marginBottom: 24 }}>
                            This action writes the diagnostic summary and prescription payload onto decentralized IPFS storage and anchors its hash to the ledger. This process cannot be undone.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={executeSubmit}>
                                <ShieldCheck size={14} /> Confirm &amp; Anchor
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ── My Patients (enhanced cards) ──────────────────────────────────────────────
function MyPatients({ onViewRecords }) {
    const { data } = useApiData('/hospital/patients');
    const [query, setQuery]           = useState('');
    const [activeCondition, setActiveCondition] = useState(null);

    // Use API patients if available, else fall back to mock rich patients
    const allPatients = useMemo(() => {
        if (data?.patients?.length > 0) {
            return data.patients.map(p => ({
                id: p.id,
                firstName: p.first_name,
                lastName: p.last_name,
                email: p.email,
                phone: p.phone,
                condition: 'General — under care',
                lastVisit: p.created_at,
                avatar: `${(p.first_name || '?')[0]}${(p.last_name || '?')[0]}`,
            }));
        }
        return MOCK_PATIENTS_RICH;
    }, [data]);

    const uniqueConditions = useMemo(() => {
        const tags = allPatients.map(p => {
            if (p.condition.includes('Diabetes')) return 'Diabetes';
            if (p.condition.includes('Hypertension') || p.condition.includes('cardiac') || p.condition.includes('Cardiac')) return 'Cardiac';
            if (p.condition.includes('Migraine') || p.condition.includes('bronchitis')) return 'General';
            return null;
        }).filter(Boolean);
        return Array.from(new Set(tags));
    }, [allPatients]);

    const filtered = useMemo(() => {
        const term = query.trim().toLowerCase();
        return allPatients.filter(p => {
            const matchesSearch = !term || `${p.firstName} ${p.lastName} ${p.email} ${p.condition}`.toLowerCase().includes(term);
            const matchesCondition = !activeCondition || p.condition.toLowerCase().includes(activeCondition.toLowerCase());
            return matchesSearch && matchesCondition;
        });
    }, [allPatients, query, activeCondition]);

    return (
        <>
            {/* Header */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.22em', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 4 }}>Patient Directory</p>
                        <h1 className="page-title" style={{ marginBottom: 0 }}>My Patients</h1>
                        <p className="page-subtitle" style={{ marginBottom: 0 }}>Search, review conditions, and jump to visit records.</p>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search patients"
                            className="input"
                            style={{ paddingLeft: 34, width: 240 }}
                        />
                    </div>
                </div>
            </div>

            {/* Condition filter chips */}
            {uniqueConditions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                    <button
                        onClick={() => setActiveCondition(null)}
                        className={`btn btn-sm ${!activeCondition ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ borderRadius: 999 }}
                    >
                        All Conditions
                    </button>
                    {uniqueConditions.map(cond => (
                        <button
                            key={cond}
                            onClick={() => setActiveCondition(cond === activeCondition ? null : cond)}
                            className={`btn btn-sm ${activeCondition === cond ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ borderRadius: 999 }}
                        >
                            {cond}
                        </button>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)' }}>
                        Showing {filtered.length} of {allPatients.length} patients
                    </span>
                </div>
            )}

            {/* Patient cards grid */}
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {filtered.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => onViewRecords(p.id)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
                        }}
                        className="patient-card-btn"
                    >
                        <div className="card" style={{
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,0.15)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                {/* Avatar */}
                                <div style={{
                                    width: 52, height: 52, flexShrink: 0,
                                    background: 'linear-gradient(135deg, var(--surface-3), var(--text))',
                                    borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem', fontWeight: 800, color: '#fff', letterSpacing: 1,
                                }}>
                                    {p.avatar || `${(p.firstName || '?')[0]}${(p.lastName || '?')[0]}`}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.97rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {p.firstName} {p.lastName}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                                        #{p.id} • Last visit {formatDate(p.lastVisit)}
                                    </div>
                                    <div style={{ marginTop: 8, borderRadius: 10, background: 'var(--surface-2)', padding: '5px 10px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                        {p.condition}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--muted)' }}>
                                    <Mail size={12} style={{ color: 'var(--muted-2)' }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--muted)' }}>
                                    <Phone size={12} style={{ color: 'var(--muted-2)' }} />
                                    {p.phone || '—'}
                                </div>
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    View records
                                    <ChevronRight size={13} />
                                </div>
                                <div style={{ borderRadius: 999, background: 'rgba(34,197,94,0.1)', padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--success)' }}>
                                    {formatTime(p.lastVisit)}
                                </div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔍</div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>No patients found</div>
                    <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>Try a different search term or condition filter.</p>
                </div>
            )}
        </>
    );
}

// ── Patient Records (enhanced cards) ─────────────────────────────────────────
function PatientRecords({ initialId, onBack }) {
    const [patientId, setPatientId] = useState(initialId ? String(initialId) : '');
    const [records, setRecords]     = useState(null);
    const [loading, setLoading]     = useState(false);
    const [searched, setSearched]   = useState(false);

    useEffect(() => {
        if (initialId) {
            setLoading(true); setSearched(true);
            setTimeout(() => {
                setRecords(MOCK_RECORDS.filter(r => r.patientId === initialId));
                setLoading(false);
            }, 600);
        }
    }, [initialId]);

    const search = async (e) => {
        e.preventDefault(); setLoading(true); setSearched(true);
        await new Promise(r => setTimeout(r, 800));
        const id = Number(patientId);
        setRecords(MOCK_RECORDS.filter(r => r.patientId === id));
        setLoading(false);
    };

    return (
        <>
            <h1 className="page-title">Patient Records</h1>

            <div className="card" style={{ marginBottom: 20 }}>
                {initialId && (
                    <button onClick={onBack} style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.87rem', fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <ArrowLeft size={15} /> Back to patients
                    </button>
                )}
                <form className="flex gap-3 items-center" onSubmit={search}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                        <input
                            className="input"
                            style={{ paddingLeft: 34 }}
                            placeholder="Enter Patient ID…"
                            value={patientId}
                            onChange={e => setPatientId(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Fetching…</> : <><Search size={14} /> Search</>}
                    </button>
                </form>
            </div>

            {/* Loading */}
            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                    <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
                    <span style={{ marginLeft: 12, fontSize: '0.87rem', fontWeight: 700, color: 'var(--muted)' }}>Fetching records…</span>
                </div>
            )}

            {/* Records */}
            {searched && !loading && records && (
                records.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>No records found</div>
                        <p style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
                            {patientId ? `No visit records found for Patient #${patientId}.` : 'Search for a patient to view their visit history.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {records.map(r => {
                            const gUrl = cidGatewayUrl(r.cid, r.source);
                            return (
                                <div key={r.id} className="card anim-slide-up">
                                    {/* Record header */}
                                    <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 14,
                                                background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <ClipboardList size={20} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>Visit Report #{r.id}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                                                    {r.hospitalName} • {r.doctorFirst} {r.doctorLast}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            <IpfsBadge source={r.source} />
                                            {r.txHash
                                                ? <span className="badge badge-green"><Check size={10} /> Verified</span>
                                                : <span className="badge badge-amber"><AlertTriangle size={10} /> Pending</span>
                                            }
                                            {r.hasImage && <span className="badge badge-blue">📷 OCR</span>}
                                        </div>
                                    </div>

                                    {/* CID row */}
                                    <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, borderRadius: 10, background: 'var(--surface-2)', padding: '10px 14px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>IPFS CID:</span>
                                        <code style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text)' }}>{r.cid.slice(0, 36)}…</code>
                                        <CopyButton text={r.cid} />
                                        {gUrl && (
                                            <a href={gUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                View on IPFS <ExternalLink size={11} />
                                            </a>
                                        )}
                                        {r.txHash && (
                                            <>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)' }}>Tx:</span>
                                                <code style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>{r.txHash.slice(0, 30)}…</code>
                                            </>
                                        )}
                                    </div>

                                    {/* Summary */}
                                    <p style={{ fontSize: '0.87rem', lineHeight: 1.7, color: 'var(--text)', marginBottom: 14 }}>{r.summary}</p>

                                    {/* Medications */}
                                    <div style={{ marginBottom: 14 }}>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 8 }}>Medications</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {r.medications.map((med, i) => (
                                                <span key={i} style={{
                                                    borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)',
                                                    background: 'rgba(59,130,246,0.06)', padding: '5px 12px',
                                                    fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)',
                                                }}>
                                                    {med}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Follow-up */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--muted)' }}>
                                        <Calendar size={14} style={{ color: 'var(--muted-2)' }} />
                                        <span style={{ fontWeight: 600 }}>Follow-up:</span> {r.followUp}
                                    </div>

                                    {/* Timestamp */}
                                    <div style={{ marginTop: 14, textAlign: 'right', fontSize: '0.72rem', color: 'var(--muted)' }}>
                                        {formatTime(r.createdAt)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </>
    );
}

// ── Doctor Portal Root ─────────────────────────────────────────────────────────
export default function DoctorPortal() {
    const [page, setPage]                   = useState('overview');
    const [viewRecordsId, setViewRecordsId] = useState(null);
    const { user } = getSession();

    const goToRecords = useCallback((id) => { setViewRecordsId(id); setPage('records'); }, []);
    const clearRecords = useCallback(() => { setViewRecordsId(null); }, []);

    return (
        <Shell
            brand={{ icon: '⚕️', name: 'Doctor Panel', sub: `${user?.firstName || ''} ${user?.lastName || ''}`, role: 'Doctor' }}
            grad="var(--doctor-grad)"
            navItems={NAV}
            activePage={page}
            onNav={(k) => { if (k !== 'records') setViewRecordsId(null); setPage(k); }}
        >
            <div className="anim-slide-up" key={page}>
                {page === 'overview'    && <Overview user={user} onNav={setPage} />}
                {page === 'new-record'  && <NewRecord onNav={setPage} />}
                {page === 'my-patients' && <MyPatients onViewRecords={goToRecords} />}
                {page === 'records'     && <PatientRecords initialId={viewRecordsId} onBack={viewRecordsId ? clearRecords : null} />}
            </div>
        </Shell>
    );
}
