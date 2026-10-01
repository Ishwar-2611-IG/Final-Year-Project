import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Calendar, Plus, X, ShieldCheck, Pill,
    AlertTriangle, ArrowRight, Activity, User, Mail, ExternalLink, Copy, Check
} from 'lucide-react';
import Shell from '../components/Shell';
import { api, getSession } from '../api';
import { useToast } from '../components/ui/Toast';

const NAV = [
    { key: 'overview',      label: 'Overview',       Icon: Activity },
    { key: 'records',       label: 'My Records',     Icon: ClipboardList },
    { key: 'appointments',  label: 'Appointments',   Icon: Calendar },
];

// ── Fixed useApiData — stable reload via useCallback ─────────────────────────
function useApiData(path) {
    const [data, setData] = useState(null);
    const reload = useCallback(() => {
        api.get(path).then(setData).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);
    useEffect(() => { reload(); }, [reload]);
    return { data, reload };
}

function Modal({ title, onClose, children }) {
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal anim-slide-up">
                <div className="flex items-center justify-between mb-6">
                    <div className="modal-title">{title}</div>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };
    return (
        <button onClick={copy} title="Copy" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: copied ? 'var(--success)' : 'var(--muted)',
            padding: '2px 4px', borderRadius: 4, display: 'inline-flex', alignItems: 'center',
        }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
    );
}

// ── Full-detail record modal ───────────────────────────────────────────────────
function RecordModal({ rec, onClose }) {
    const isPinata = rec.source === 'pinata';
    const isLocal  = rec.source === 'local';
    const gatewayUrl = isPinata
        ? `https://gateway.pinata.cloud/ipfs/${rec.cid}`
        : isLocal ? `https://ipfs.io/ipfs/${rec.cid}` : null;

    return (
        <Modal title="🏥 Health Record Details" onClose={onClose}>
            {/* Doctor / Hospital summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Doctor</div>
                    <div style={{ fontWeight: 600 }}>{rec.doctor_first} {rec.doctor_last}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{rec.specialization || 'General Practice'}</div>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Hospital</div>
                    <div style={{ fontWeight: 600 }}>{rec.hospital_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                        {new Date(rec.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* IPFS CID */}
            <div style={{ marginBottom: 14, background: 'var(--surface2)', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>IPFS CID</div>
                    <span className={`badge ${rec.source === 'pinata' ? 'badge-blue' : rec.source === 'local' ? 'badge-green' : 'badge-amber'}`}>
                        {rec.source === 'pinata' ? 'Pinata' : rec.source === 'local' ? 'Local Node' : 'Simulated'}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <code style={{ fontSize: '0.78rem', color: 'var(--primary)', wordBreak: 'break-all' }}>{rec.cid}</code>
                    <CopyButton text={rec.cid} />
                    {gatewayUrl && (
                        <a href={gatewayUrl} target="_blank" rel="noopener noreferrer"
                            style={{ color: 'var(--primary)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            View <ExternalLink size={10} />
                        </a>
                    )}
                </div>
            </div>

            {/* Summary */}
            {rec.summary && (
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Doctor's Summary</div>
                    <p style={{ lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 10, padding: 14, fontSize: '0.88rem' }}>{rec.summary}</p>
                </div>
            )}

            {/* Medicines & Precautions */}
            {(rec.medicines?.length > 0 || rec.precautions?.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    {rec.medicines?.length > 0 && (
                        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--accent)', fontWeight: 600, fontSize: '0.85rem' }}>
                                <Pill size={14} /> Medicines
                            </div>
                            <ul style={{ paddingLeft: 18, color: 'var(--muted)', fontSize: '0.83rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {rec.medicines.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                        </div>
                    )}
                    {rec.precautions?.length > 0 && (
                        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--warning)', fontWeight: 600, fontSize: '0.85rem' }}>
                                <AlertTriangle size={14} /> Precautions
                            </div>
                            <ul style={{ paddingLeft: 18, color: 'var(--muted)', fontSize: '0.83rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {rec.precautions.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {rec.followUp && (
                <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 9, padding: 12, fontSize: '0.87rem', marginBottom: 12 }}>
                    📅 <strong>Follow-up:</strong> {rec.followUp}
                </div>
            )}

            {rec.tx_hash && (
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 9, padding: 12, fontSize: '0.82rem' }}>
                    <ShieldCheck size={13} style={{ verticalAlign: 'middle', color: 'var(--success)', marginRight: 6 }} />
                    <strong>Blockchain Verified:</strong> <code style={{ fontSize: '0.75rem', color: 'var(--success)', wordBreak: 'break-all' }}>{rec.tx_hash}</code>
                </div>
            )}
        </Modal>
    );
}

// ── Health Record Card ─────────────────────────────────────────────────────────
function RecordCard({ rec }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <div className="report-card" onClick={() => setOpen(true)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{rec.hospital_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {rec.tx_hash
                            ? <span className="badge badge-green"><ShieldCheck size={10} /> Verified</span>
                            : <span className="badge badge-amber">Pending Chain</span>}
                        <ArrowRight size={14} color="var(--muted)" />
                    </div>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Dr. {rec.doctor_first} {rec.doctor_last}</span>
                    <span>·</span>
                    <span>{new Date(rec.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {rec.specialization && <><span>·</span><span>{rec.specialization}</span></>}
                </div>
                {rec.summary && (
                    <p style={{ marginTop: 10, fontSize: '0.83rem', color: 'var(--muted)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        {rec.summary.slice(0, 160)}{rec.summary.length > 160 ? '…' : ''}
                    </p>
                )}
            </div>
            {open && <RecordModal rec={rec} onClose={() => setOpen(false)} />}
        </>
    );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ user }) {
    const { data: records } = useApiData('/visits/my-records');
    const { data: appts }   = useApiData('/visits/appointments');
    const allRecords    = records?.records ?? [];
    const upcomingAppts = appts?.appointments?.filter(a => a.status === 'scheduled') ?? [];

    return (
        <>
            <h1 className="page-title">Welcome back, {user?.firstName}! 👋</h1>
            <p className="page-subtitle">Here's your health summary.</p>

            {/* Stats */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxWidth: 420, marginBottom: 24 }}>
                <div className="stat-card" style={{ '--card-accent': '#3b82f6' }}>
                    <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>📋</div>
                    <div className="stat-body">
                        <div className="label">Records</div>
                        <div className="value" style={{ color: 'var(--primary)', fontSize: '1.7rem' }}>{allRecords.length}</div>
                    </div>
                </div>
                <div className="stat-card" style={{ '--card-accent': '#a78bfa' }}>
                    <div className="stat-icon" style={{ background: 'rgba(167,139,250,0.12)' }}>📅</div>
                    <div className="stat-body">
                        <div className="label">Upcoming</div>
                        <div className="value" style={{ color: 'var(--accent)', fontSize: '1.7rem' }}>{upcomingAppts.length}</div>
                    </div>
                </div>
            </div>

            {/* Profile card */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 52, height: 52, borderRadius: '50%',
                        background: 'var(--patient-grad)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700, color: '#fff',
                        flexShrink: 0,
                    }}>
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{user?.firstName} {user?.lastName}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <span><User size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Patient</span>
                            <span><Mail size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />{user?.email || 'Not provided'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Health Timeline */}
            {allRecords.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                    <div className="section-title">Health Timeline</div>
                    <div className="timeline">
                        {allRecords.slice(0, 4).map((r, i) => (
                            <div key={i} className="timeline-item">
                                <div className="timeline-dot" style={{ background: i === 0 ? 'var(--primary)' : 'var(--muted)' }} />
                                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.87rem' }}>{r.hospital_name}</div>
                                    <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 3 }}>
                                        Dr. {r.doctor_first} {r.doctor_last} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                    </div>
                                    {r.summary && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                                            {r.summary.slice(0, 100)}…
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Next Appointment */}
            {upcomingAppts.slice(0, 1).map(a => (
                <div key={a.id} className="card" style={{ borderLeft: '3px solid var(--primary)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Next Appointment</div>
                    <div style={{ fontWeight: 700 }}>{a.doctor_first} {a.doctor_last}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.83rem', marginTop: 4 }}>
                        {a.hospital_name} · {new Date(a.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                    {a.reason && <div style={{ fontSize: '0.83rem', marginTop: 6 }}>📌 {a.reason}</div>}
                </div>
            ))}
        </>
    );
}

// ── Records Page ──────────────────────────────────────────────────────────────
function RecordsPage() {
    const { data } = useApiData('/visits/my-records');
    const records = data?.records ?? [];
    return (
        <>
            <h1 className="page-title">My Health Records</h1>
            <p className="page-subtitle">Click any record to view the full AI report secured on IPFS + Blockchain.</p>
            {!data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12 }} />
                    ))}
                </div>
            )}
            {records.length === 0 && data && (
                <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
                    <div style={{ fontSize: '2rem', marginBottom: 10 }}>📂</div>
                    No records yet. Your doctor will add visit reports here.
                </div>
            )}
            {records.map((r, i) => <RecordCard key={r.id ?? i} rec={r} />)}
        </>
    );
}

// ── Appointments Page ─────────────────────────────────────────────────────────
function AppointmentsPage() {
    const toast = useToast();
    const { data, reload } = useApiData('/visits/appointments');
    // Fetch live doctors from API instead of hardcoded list
    const { data: doctorsData } = useApiData('/hospital/patients');
    const [allDoctors, setAllDoctors] = useState([]);
    const [show, setShow]  = useState(false);
    const [form, setForm]  = useState({ doctorId: '', hospitalId: '', appointmentDate: '', reason: '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr]    = useState('');

    // Fetch all doctors from the public-visible hospital doctors list
    useEffect(() => {
        api.get('/hospital/patients').catch(() => null); // keep session alive
        // Fetch doctors via a separate direct call
        fetch('http://localhost:5001/api/hospital/doctors', {
            headers: { Authorization: `Bearer ${localStorage.getItem('mb_token')}` }
        })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.doctors) setAllDoctors(d.doctors); })
            .catch(() => {});
    }, []);

    // Fallback to well-known demo doctors if API returns nothing
    const DEMO_DOCTORS = [
        { id: 5, first_name: 'Dr. Sarah',  last_name: 'Connor',  specialization: 'General Practice',   hospital_id: 1, hospital_name: 'City General Hospital' },
        { id: 6, first_name: 'Dr. Rahul',  last_name: 'Verma',   specialization: 'Cardiologist',        hospital_id: 1, hospital_name: 'City General Hospital' },
        { id: 7, first_name: 'Dr. Priya',  last_name: 'Sharma',  specialization: 'Dermatologist',       hospital_id: 2, hospital_name: 'Oakwood Medical Centre' },
        { id: 8, first_name: 'Dr. Aditya', last_name: 'Nair',    specialization: 'Orthopaedic Surgeon', hospital_id: 3, hospital_name: 'Apollo Sunrise Hospital' },
    ];
    const doctors = allDoctors.length > 0 ? allDoctors : DEMO_DOCTORS;

    const handleDoctorSelect = (e) => {
        const doc = doctors.find(d => d.id === Number(e.target.value));
        if (doc) setForm(f => ({ ...f, doctorId: String(doc.id), hospitalId: String(doc.hospital_id) }));
        else setForm(f => ({ ...f, doctorId: '', hospitalId: '' }));
    };

    const submit = async (e) => {
        e.preventDefault(); setSaving(true); setErr('');
        try {
            await api.post('/visits/appointments', form);
            setShow(false);
            setForm({ doctorId: '', hospitalId: '', appointmentDate: '', reason: '' });
            reload();
            toast.success('Appointment booked successfully!');
        } catch (e) { setErr(e.message); }
        finally { setSaving(false); }
    };

    const upcoming = data?.appointments?.filter(a => a.status === 'scheduled') ?? [];
    const past     = data?.appointments?.filter(a => a.status !== 'scheduled') ?? [];

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>My Appointments</h1>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>{upcoming.length} upcoming</p>
                </div>
                <button className="btn btn-primary" id="book-appt-btn" onClick={() => setShow(true)}>
                    <Plus size={15} /> Book Appointment
                </button>
            </div>

            <div className="section-title">Upcoming</div>
            <div className="table-wrap" style={{ marginBottom: 28 }}>
                <table>
                    <thead><tr><th>Doctor</th><th>Hospital</th><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
                    <tbody>
                        {upcoming.length === 0 && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No upcoming appointments.</td></tr>
                        )}
                        {upcoming.map(a => (
                            <tr key={a.id}>
                                <td>
                                    <div className="fw-600">{a.doctor_first} {a.doctor_last}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{a.specialization}</div>
                                </td>
                                <td>{a.hospital_name}</td>
                                <td>{new Date(a.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                <td>{a.reason || '—'}</td>
                                <td><span className="badge badge-blue">{a.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {past.length > 0 && (
                <>
                    <div className="section-title">Past</div>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Doctor</th><th>Hospital</th><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
                            <tbody>
                                {past.map(a => (
                                    <tr key={a.id}>
                                        <td>{a.doctor_first} {a.doctor_last}</td>
                                        <td>{a.hospital_name}</td>
                                        <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>{new Date(a.appointment_date).toLocaleDateString()}</td>
                                        <td>{a.reason || '—'}</td>
                                        <td><span className={`badge ${a.status === 'completed' ? 'badge-green' : 'badge-red'}`}>{a.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {show && (
                <Modal title="📅 Book Appointment" onClose={() => setShow(false)}>
                    {err && <div className="alert alert-error">{err}</div>}
                    <form onSubmit={submit}>
                        <div className="form-group">
                            <label>Select Doctor *</label>
                            <select className="input" required value={form.doctorId} onChange={handleDoctorSelect}>
                                <option value="">— Choose a Doctor —</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.first_name} {d.last_name} — {d.specialization} ({d.hospital_name || `Hospital #${d.hospital_id}`})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {form.hospitalId && (
                            <div className="form-group">
                                <label>Hospital</label>
                                <input className="input" readOnly
                                    value={doctors.find(d => d.id === Number(form.doctorId))?.hospital_name || `Hospital #${form.hospitalId}`}
                                    style={{ opacity: 0.7 }} />
                            </div>
                        )}
                        <div className="form-group">
                            <label>Preferred Date *</label>
                            <input id="appt-date" type="date" className="input" required
                                min={new Date().toISOString().split('T')[0]}
                                value={form.appointmentDate}
                                onChange={e => setForm({ ...form, appointmentDate: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Reason for Visit</label>
                            <textarea className="input" rows={3} placeholder="Briefly describe your symptoms or reason…"
                                value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                        </div>
                        <div className="flex gap-2" style={{ justifyContent: 'flex-end' }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShow(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Booking…' : '✓ Confirm Booking'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}

// ── Patient Portal Root ───────────────────────────────────────────────────────
export default function PatientPortal() {
    const [page, setPage] = useState('overview');
    const { user } = getSession();

    const PAGE = {
        overview:     <Overview user={user} />,
        records:      <RecordsPage />,
        appointments: <AppointmentsPage />,
    };

    return (
        <Shell
            brand={{ icon: '💊', name: 'Patient Portal', sub: `${user?.firstName || ''} ${user?.lastName || ''}`, role: 'Patient' }}
            grad="var(--patient-grad)"
            navItems={NAV}
            activePage={page}
            onNav={setPage}
        >
            <div className="anim-slide-up" key={page}>{PAGE[page]}</div>
        </Shell>
    );
}
