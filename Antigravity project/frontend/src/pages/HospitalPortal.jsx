import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard, Stethoscope, Users,
    Calendar, ClipboardList, Plus, X, Search, Activity,
    TrendingUp, ChevronUp, ChevronDown, ChevronsUpDown,
    Eye, Download, Share2, Flag, AlertTriangle, UserPlus,
    ChevronRight, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';
import Shell from '../components/Shell';
import { api, getSession } from '../api';
import { useToast } from '../components/ui/Toast';

const NAV = [
    { key: 'dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
    { key: 'doctors',      label: 'Doctors',      Icon: Stethoscope },
    { key: 'patients',     label: 'Patients',     Icon: Users },
    { key: 'reports',      label: 'Reports',      Icon: ClipboardList },
    { key: 'appointments', label: 'Appointments', Icon: Calendar },
];

// ── useApiData ─────────────────────────────────────────────────────────────────
function useApiData(path) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const reload = useCallback(() => {
        setLoading(true);
        api.get(path).then(setData).catch(console.error).finally(() => setLoading(false));
    }, [path]);
    useEffect(() => { reload(); }, [reload]);
    return { data, loading, reload };
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="modal-overlay anim-scale-in"
            onClick={e => e.target === e.currentTarget && onClose()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div className="modal anim-slide-up">
                <div className="flex items-center justify-between mb-6">
                    <div className="modal-title">{title}</div>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={onClose}
                        aria-label="Close dialog"
                    >
                        <X size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ── Sortable hook ──────────────────────────────────────────────────────────────
function useSortable(data, defaultKey) {
    const [sortKey, setSortKey] = useState(defaultKey ?? null);
    const [sortDir, setSortDir] = useState('asc');

    const toggle = (key) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
            if (sortDir === null) setSortKey(null);
        } else {
            setSortKey(key); setSortDir('asc');
        }
    };

    const sorted = [...data].sort((a, b) => {
        if (!sortKey || !sortDir) return 0;
        const av = String(a[sortKey] ?? '').toLowerCase();
        const bv = String(b[sortKey] ?? '').toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    const renderSortIcon = (col) => {
        if (sortKey !== col) return <ChevronsUpDown size={11} className="sort-icon" aria-hidden="true" />;
        return sortDir === 'asc'
            ? <ChevronUp   size={11} className="sort-icon" aria-hidden="true" />
            : <ChevronDown size={11} className="sort-icon" aria-hidden="true" />;
    };

    const thClass = (col) =>
        sortKey === col ? (sortDir === 'asc' ? 'sort-asc' : 'sort-desc') : '';

    return { sorted, toggle, renderSortIcon, thClass };
}

// ── Highlight matching text ────────────────────────────────────────────────────
function Highlight({ text, query }) {
    if (!query || !text) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
        <>
            {parts.map((p, i) =>
                p.toLowerCase() === query.toLowerCase()
                    ? <mark key={i} className="search-highlight">{p}</mark>
                    : p
            )}
        </>
    );
}

// ── Skeleton table rows ────────────────────────────────────────────────────────
function TableSkeletonRows({ cols, rows = 4 }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, r) => (
                <tr key={r} className="skeleton-row">
                    {Array.from({ length: cols }).map((_, c) => (
                        <td key={c}>
                            <div
                                className="skeleton skeleton-cell"
                                style={{ width: `${50 + Math.random() * 40}%` }}
                                aria-hidden="true"
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

// ── Animated count-up value ────────────────────────────────────────────────────
function AnimatedValue({ value }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        if (value === undefined) return;
        let start = 0;
        const end = value;
        if (end === 0) { setDisplay(0); return; }
        const step = Math.max(1, Math.ceil(end / 30));
        const timer = setInterval(() => {
            start = Math.min(start + step, end);
            setDisplay(start);
            if (start >= end) clearInterval(timer);
        }, 40);
        return () => clearInterval(timer);
    }, [value]);
    return <>{value === undefined ? '—' : display.toLocaleString()}</>;
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────────
function Breadcrumb({ crumbs }) {
    return (
        <nav className="breadcrumb" aria-label="Breadcrumb">
            {crumbs.map((crumb, i) => {
                const isLast = i === crumbs.length - 1;
                return (
                    <React.Fragment key={i}>
                        {i > 0 && (
                            <ChevronRight
                                size={11}
                                className="breadcrumb-sep"
                                aria-hidden="true"
                            />
                        )}
                        {isLast ? (
                            <span className="breadcrumb-current" aria-current="page">
                                {crumb.label}
                            </span>
                        ) : (
                            <button
                                className="breadcrumb-link"
                                onClick={crumb.onClick}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
                                aria-label={`Go to ${crumb.label}`}
                            >
                                {crumb.label}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
}

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub, action }) {
    return (
        <tr>
            <td colSpan={20} style={{ padding: 0, border: 'none' }}>
                <div className="empty-state" role="status" aria-label={title}>
                    <div className="empty-state-icon" aria-hidden="true">
                        <span>{icon}</span>
                    </div>
                    <div className="empty-state-title">{title}</div>
                    <p className="empty-state-sub">{sub}</p>
                    {action && (
                        <button
                            className="btn btn-primary"
                            id={action.id}
                            onClick={action.onClick}
                            aria-label={action.label}
                        >
                            {action.label}
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ user, onNav }) {
    const { data, loading } = useApiData('/hospital/stats');

    const stats = [
        { label: 'Doctors',       value: data?.doctors,             icon: '👨‍⚕️', color: 'var(--warning)', accent: '#f59e0b', trend: 'Active staff',   nav: 'doctors' },
        { label: 'Patients',      value: data?.patients,            icon: '👥', color: 'var(--accent)',  accent: '#a78bfa', trend: 'Registered',     nav: 'patients' },
        { label: 'Reports',       value: data?.reports,             icon: '📋', color: 'var(--success)', accent: '#22c55e', trend: 'Stored on IPFS', nav: 'reports' },
        { label: 'Pending Appts', value: data?.pendingAppointments, icon: '📅', color: 'var(--primary)', accent: '#3b82f6', trend: 'Scheduled',      nav: 'appointments' },
    ];

    return (
        <>
            <Breadcrumb crumbs={[{ label: 'Dashboard' }]} />

            <h1 className="page-title">Hospital Dashboard</h1>
            <p className="page-subtitle">Live statistics for your hospital.</p>

            {/* Stat grid with skeleton & animated values */}
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="skeleton skeleton-stat" aria-hidden="true" />
                    ))
                    : stats.map(s => (
                        <div
                            key={s.label}
                            className="stat-card"
                            style={{ '--card-accent': s.accent }}
                            role="button"
                            tabIndex={0}
                            onClick={() => onNav(s.nav)}
                            onKeyDown={e => e.key === 'Enter' && onNav(s.nav)}
                            aria-label={`${s.label}: ${s.value ?? 0}. Click to view.`}
                            title={`View ${s.label}`}
                        >
                            <div className="stat-icon" style={{ background: `${s.accent}18` }}>
                                <span style={{ fontSize: '1.1rem' }} aria-hidden="true">{s.icon}</span>
                            </div>
                            <div className="stat-body">
                                <div className="label">{s.label}</div>
                                <div className="value" style={{ color: s.color, fontSize: '1.8rem' }}>
                                    <AnimatedValue value={s.value} />
                                </div>
                                <div className="trend">
                                    <TrendingUp size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} aria-hidden="true" />
                                    {s.trend}
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>

            {/* System status cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="card" style={{ borderLeft: '3px solid var(--teal)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>
                        Blockchain Status
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Activity size={18} color="var(--teal)" aria-hidden="true" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>IPFS + Ethereum</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>All nodes operational</div>
                        </div>
                        <span className="badge badge-teal" style={{ marginLeft: 'auto' }}>
                            ✓ Online
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 16 }}>
                        {['Submitted', 'Mining', 'Confirmed', 'Verified'].map((step, i, arr) => (
                            <React.Fragment key={step}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: '50%',
                                        background: 'rgba(20,184,166,0.15)',
                                        border: '2px solid var(--teal)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.65rem', color: 'var(--teal)', fontWeight: 700,
                                    }} aria-label={`Step ${i + 1}: ${step}`}>
                                        {i + 1}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--teal)', textAlign: 'center', whiteSpace: 'nowrap' }}>{step}</div>
                                </div>
                                {i < arr.length - 1 && (
                                    <div style={{ flex: 1, height: 2, background: 'var(--teal)', marginBottom: 14, opacity: 0.5 }} aria-hidden="true" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, borderLeft: '3px solid var(--primary)' }}>
                    <div style={{ fontSize: '2rem' }} aria-hidden="true">🏥</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{user?.firstName} {user?.lastName}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>Hospital Administrator · MedBlock</div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                            <span className="badge badge-blue">Admin</span>
                            <span className="badge badge-teal">Verified</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick actions */}
            <div className="card">
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 12 }}>
                    Quick Actions
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => onNav('doctors')} aria-label="Manage doctors">
                        <Stethoscope size={15} aria-hidden="true" /> Manage Doctors
                    </button>
                    <button className="btn btn-ghost" onClick={() => onNav('patients')} aria-label="Register a new patient">
                        <Users size={15} aria-hidden="true" /> Register Patient
                    </button>
                    <button className="btn btn-ghost" onClick={() => onNav('appointments')} aria-label="View appointments">
                        <Calendar size={15} aria-hidden="true" /> View Appointments
                    </button>
                    <button className="btn btn-ghost" onClick={() => onNav('reports')} aria-label="View reports">
                        <ClipboardList size={15} aria-hidden="true" /> View Reports
                    </button>
                </div>
            </div>

            {/* Keyboard shortcut reference */}
            <div style={{ marginTop: 16, padding: '10px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--muted-2)' }}>Keyboard shortcuts:</span>
                {[['D', 'Dashboard'], ['C', 'Doctors'], ['P', 'Patients'], ['R', 'Reports'], ['A', 'Appointments']].map(([k, l]) => (
                    <span key={k}><kbd>{k}</kbd> {l}</span>
                ))}
            </div>
        </>
    );
}

// ── Doctors ───────────────────────────────────────────────────────────────────
function DoctorsPage({ onNav }) {
    const toast = useToast();
    const { data, reload } = useApiData('/hospital/doctors');
    const [show, setShow]   = useState(false);
    const [form, setForm]   = useState({ firstName: '', lastName: '', walletAddress: '', specialization: '', phone: '', email: '', password: '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr]     = useState('');
    const [q, setQ]         = useState('');

    const submit = async (e) => {
        e.preventDefault(); setSaving(true); setErr('');
        try {
            await api.post('/hospital/doctors', form);
            setShow(false);
            setForm({ firstName: '', lastName: '', walletAddress: '', specialization: '', phone: '', email: '', password: '' });
            reload();
            toast.success(`Dr. ${form.firstName} ${form.lastName} registered successfully.`, 'New doctor account created and activated.');
        } catch (ex) {
            const msg = ex instanceof Error ? ex.message : 'An error occurred';
            setErr(msg);
            toast.error('Registration failed', msg);
        } finally { setSaving(false); }
    };

    const allDoctors = data?.doctors ?? [];
    const filtered = allDoctors.filter(d =>
        !q || `${d.first_name} ${d.last_name} ${d.specialization} ${d.email}`.toLowerCase().includes(q.toLowerCase())
    );

    const { sorted, toggle, renderSortIcon, thClass } = useSortable(filtered, 'first_name');

    return (
        <>
            <Breadcrumb crumbs={[
                { label: 'Dashboard', onClick: () => onNav('dashboard') },
                { label: 'Doctors' },
            ]} />

            <div className="flex items-center justify-between mb-6">
                <h1 className="page-title" style={{ marginBottom: 0 }}>Doctors</h1>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Enhanced search bar */}
                    <div style={{ position: 'relative' }}>
                        {q
                            ? <button style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', padding: 0, zIndex: 1 }} onClick={() => setQ('')} aria-label="Clear search"><X size={13} /></button>
                            : <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} aria-hidden="true" />
                        }
                        <input
                            className="input"
                            style={{ paddingLeft: 28, width: 180 }}
                            placeholder="Search…"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            aria-label="Search doctors"
                            type="search"
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        id="add-doctor-btn"
                        onClick={() => setShow(true)}
                        aria-label="Add new doctor"
                        title="Add Doctor"
                    >
                        <Plus size={16} aria-hidden="true" /> Add Doctor
                    </button>
                </div>
            </div>

            {/* Active filter chips */}
            {q && (
                <div className="filter-chips" style={{ marginBottom: 12 }}>
                    <span className="filter-chip" onClick={() => setQ('')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setQ('')} aria-label={`Remove filter: ${q}`}>
                        Search: "{q}" <X size={10} aria-hidden="true" />
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', alignSelf: 'center' }}>
                        {filtered.length} of {allDoctors.length} records
                    </span>
                </div>
            )}

            <div className="table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table aria-label="Doctors table">
                        <thead>
                            <tr>
                                <th className={thClass('first_name')} onClick={() => toggle('first_name')} style={{ cursor: 'pointer' }} aria-sort={thClass('first_name') === 'sort-asc' ? 'ascending' : thClass('first_name') === 'sort-desc' ? 'descending' : 'none'}>
                                    Name {renderSortIcon('first_name')}
                                </th>
                                <th className={thClass('specialization')} onClick={() => toggle('specialization')} style={{ cursor: 'pointer' }}>
                                    Specialization {renderSortIcon('specialization')}
                                </th>
                                <th>Email</th>
                                <th>Wallet Address</th>
                                <th>Phone</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Skeleton loading rows */}
                            {!data && <TableSkeletonRows cols={6} rows={5} />}

                            {/* Designed empty state */}
                            {data && sorted.length === 0 && (
                                <EmptyState
                                    icon="🩺"
                                    title={q ? 'No doctors match your search' : 'No doctors registered yet'}
                                    sub={q ? 'Try a different search term or clear the filter.' : 'Register your first doctor to get started with MedBlock.'}
                                    action={!q ? { label: 'Register First Doctor', onClick: () => setShow(true), id: 'add-doctor-empty-btn' } : undefined}
                                />
                            )}

                            {sorted.map(d => (
                                <tr key={d.id}>
                                    <td className="fw-600">
                                        <Highlight text={`${d.first_name} ${d.last_name}`} query={q} />
                                    </td>
                                    <td>
                                        <Highlight text={d.specialization || '—'} query={q} />
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                                        <Highlight text={d.email || '—'} query={q} />
                                    </td>
                                    <td style={{ fontSize: '0.76rem', color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {d.wallet_address
                                            ? <span title={d.wallet_address}>{d.wallet_address.slice(0, 10)}…{d.wallet_address.slice(-6)}</span>
                                            : <span style={{ opacity: 0.5 }}>Not connected</span>
                                        }
                                    </td>
                                    <td>{d.phone || '—'}</td>
                                    <td>
                                        <span className={`badge ${d.is_active ? 'badge-green' : 'badge-red'}`}>
                                            {d.is_active ? '● Active' : '● Inactive'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Live results count */}
                {data && allDoctors.length > 0 && (
                    <div className="results-count" aria-live="polite" aria-atomic="true">
                        Showing {sorted.length} of {allDoctors.length} doctor{allDoctors.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {show && (
                <Modal title="🩺 Register Doctor" onClose={() => setShow(false)}>
                    {err && <div className="alert alert-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {err}</div>}
                    <form onSubmit={submit} noValidate>
                        <div className="grid-2">
                            <div className="form-group">
                                <label htmlFor="doc-fname">First Name *</label>
                                <input id="doc-fname" className="input" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} aria-required="true" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="doc-lname">Last Name</label>
                                <input id="doc-lname" className="input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="doc-spec">Specialization</label>
                                <input id="doc-spec" className="input" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="doc-phone">Phone</label>
                                <input id="doc-phone" className="input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="doc-email">Login Email</label>
                                <input id="doc-email" type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="doc-pass">Password</label>
                                <input id="doc-pass" type="password" className="input" placeholder="Default: Admin@1234" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="doc-wallet">MetaMask Wallet Address</label>
                            <input id="doc-wallet" className="input" placeholder="0x… (optional)" value={form.walletAddress} onChange={e => setForm({ ...form, walletAddress: e.target.value })} />
                        </div>
                        <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShow(false)} aria-label="Cancel registration">Cancel</button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                                aria-label={saving ? 'Saving doctor record' : 'Register doctor'}
                                aria-busy={saving}
                            >
                                {saving ? (
                                    <><div className="spinner" role="status" aria-label="Processing" /><span>Processing…</span></>
                                ) : (
                                    <><Plus size={15} aria-hidden="true" /><span>Register Doctor</span></>
                                )}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}

// ── Patients ──────────────────────────────────────────────────────────────────
function PatientsPage({ onNav }) {
    const toast = useToast();
    const { data, reload } = useApiData('/hospital/patients');
    const [show, setShow]   = useState(false);
    const [form, setForm]   = useState({ firstName: '', lastName: '', email: '', password: '', phone: '', dateOfBirth: '' });
    const [saving, setSaving] = useState(false);
    const [err, setErr]     = useState('');
    const [q, setQ]         = useState('');

    const submit = async (e) => {
        e.preventDefault(); setSaving(true); setErr('');
        try {
            await api.post('/hospital/patients', form);
            setShow(false);
            setForm({ firstName: '', lastName: '', email: '', password: '', phone: '', dateOfBirth: '' });
            reload();
            toast.success(`Patient ${form.firstName} ${form.lastName} registered.`, 'Patient portal access has been created.');
        } catch (ex) {
            const msg = ex instanceof Error ? ex.message : 'An error occurred';
            setErr(msg);
            toast.error('Registration failed', msg);
        } finally { setSaving(false); }
    };

    const allPatients = data?.patients ?? [];
    const filtered = allPatients.filter(p =>
        !q || `${p.first_name} ${p.last_name} ${p.email} ${p.phone}`.toLowerCase().includes(q.toLowerCase())
    );

    const { sorted, toggle, renderSortIcon, thClass } = useSortable(filtered, 'first_name');

    return (
        <>
            <Breadcrumb crumbs={[
                { label: 'Dashboard', onClick: () => onNav('dashboard') },
                { label: 'Patients' },
            ]} />

            <div className="flex items-center justify-between mb-6">
                <h1 className="page-title" style={{ marginBottom: 0 }}>Patients</h1>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        {q
                            ? <button style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', padding: 0, zIndex: 1 }} onClick={() => setQ('')} aria-label="Clear search"><X size={13} /></button>
                            : <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} aria-hidden="true" />
                        }
                        <input
                            className="input"
                            style={{ paddingLeft: 28, width: 180 }}
                            placeholder="Search…"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            aria-label="Search patients"
                            type="search"
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        id="add-patient-btn"
                        onClick={() => setShow(true)}
                        aria-label="Register new patient"
                    >
                        <UserPlus size={16} aria-hidden="true" /> Register Patient
                    </button>
                </div>
            </div>

            {q && (
                <div className="filter-chips" style={{ marginBottom: 12 }}>
                    <span className="filter-chip" onClick={() => setQ('')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setQ('')} aria-label={`Remove filter: ${q}`}>
                        Search: "{q}" <X size={10} aria-hidden="true" />
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', alignSelf: 'center' }}>
                        {filtered.length} of {allPatients.length} records
                    </span>
                </div>
            )}

            <div className="table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table aria-label="Patients table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th className={thClass('first_name')} onClick={() => toggle('first_name')} style={{ cursor: 'pointer' }}>
                                    Name {renderSortIcon('first_name')}
                                </th>
                                <th className={thClass('email')} onClick={() => toggle('email')} style={{ cursor: 'pointer' }}>
                                    Email {renderSortIcon('email')}
                                </th>
                                <th>Phone</th>
                                <th>D.O.B</th>
                                <th>Registered</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!data && <TableSkeletonRows cols={6} rows={5} />}

                            {data && sorted.length === 0 && (
                                <EmptyState
                                    icon="👥"
                                    title={q ? 'No patients match your search' : 'No patients registered yet'}
                                    sub={q ? 'Try a different search term or clear the filter.' : 'Register your first patient to begin managing their records on MedBlock.'}
                                    action={!q ? { label: 'Register First Patient', onClick: () => setShow(true), id: 'add-patient-empty-btn' } : undefined}
                                />
                            )}

                            {sorted.map(p => (
                                <tr key={p.id}>
                                    <td style={{ color: 'var(--muted)', fontSize: '0.83rem' }}>
                                        <span className="badge badge-purple">#{p.id}</span>
                                    </td>
                                    <td className="fw-600">
                                        <Highlight text={`${p.first_name} ${p.last_name}`} query={q} />
                                    </td>
                                    <td>
                                        <Highlight text={p.email} query={q} />
                                    </td>
                                    <td>
                                        <Highlight text={p.phone || '—'} query={q} />
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                                        {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('en-IN') : '—'}
                                    </td>
                                    <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {data && allPatients.length > 0 && (
                    <div className="results-count" aria-live="polite" aria-atomic="true">
                        Showing {sorted.length} of {allPatients.length} patient{allPatients.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>

            {show && (
                <Modal title="👤 Register Patient" onClose={() => setShow(false)}>
                    {err && <div className="alert alert-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {err}</div>}
                    <form onSubmit={submit} noValidate>
                        <div className="grid-2">
                            <div className="form-group">
                                <label htmlFor="pat-fname">First Name *</label>
                                <input id="pat-fname" className="input" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} aria-required="true" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pat-lname">Last Name</label>
                                <input id="pat-lname" className="input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pat-email">Email *</label>
                                <input id="pat-email" type="email" className="input" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} aria-required="true" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pat-phone">Phone</label>
                                <input id="pat-phone" className="input" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="pat-dob">Date of Birth</label>
                                <input id="pat-dob" type="date" className="input" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="pat-pass">Portal Password *</label>
                            <input id="pat-pass" type="password" className="input" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} aria-required="true" />
                        </div>
                        <div className="flex gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="button" className="btn btn-ghost" onClick={() => setShow(false)} aria-label="Cancel">Cancel</button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                                aria-label={saving ? 'Saving patient record' : 'Register patient'}
                                aria-busy={saving}
                            >
                                {saving ? (
                                    <><div className="spinner" role="status" aria-label="Processing" /><span>Processing…</span></>
                                ) : (
                                    <><UserPlus size={15} aria-hidden="true" /><span>Register Patient</span></>
                                )}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </>
    );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function ReportsPage({ onNav }) {
    const { data, loading } = useApiData('/hospital/reports');
    const [expandedId, setExpandedId] = useState(null);

    const reports = data?.reports ?? [];

    return (
        <>
            <Breadcrumb crumbs={[
                { label: 'Dashboard', onClick: () => onNav('dashboard') },
                { label: 'Reports' },
            ]} />

            <h1 className="page-title">Reports</h1>
            <p className="page-subtitle">
                {loading
                    ? <span className="skeleton skeleton-text" style={{ width: 180, display: 'inline-block' }} aria-hidden="true" />
                    : <>{reports.length} report{reports.length !== 1 ? 's' : ''} issued by this hospital.</>
                }
            </p>

            {/* Summary badges */}
            {!loading && reports.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <span className="badge badge-green">✓ Verified: {reports.filter(r => r.tx_hash).length}</span>
                    <span className="badge badge-amber">⏳ Pending: {reports.filter(r => !r.tx_hash).length}</span>
                    <span className="badge badge-teal">Total: {reports.length}</span>
                </div>
            )}

            <div className="table-wrap">
                <div style={{ overflowX: 'auto' }}>
                    <table aria-label="Reports table">
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Doctor</th>
                                <th>IPFS CID</th>
                                <th>Date</th>
                                <th>Blockchain Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <TableSkeletonRows cols={6} rows={4} />}

                            {!loading && reports.length === 0 && (
                                <EmptyState
                                    icon="📋"
                                    title="No reports issued yet"
                                    sub="Medical reports will appear here once doctors begin creating visit records."
                                />
                            )}

                            {!loading && reports.map(r => (
                                <React.Fragment key={r.id}>
                                    <tr
                                        onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                                        style={{ cursor: 'pointer' }}
                                        aria-expanded={expandedId === r.id}
                                        title="Click to expand report details"
                                    >
                                        <td className="fw-600">{r.patient_first} {r.patient_last}</td>
                                        <td>Dr. {r.doctor_first} {r.doctor_last}</td>
                                        <td>
                                            <span
                                                style={{ fontSize: '0.76rem', color: 'var(--muted)', fontFamily: 'monospace', cursor: 'text' }}
                                                title={r.cid}
                                            >
                                                {r.cid.slice(0, 16)}…
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                            {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td>
                                            {r.tx_hash
                                                ? <span className="badge badge-green">✓ Verified on-chain</span>
                                                : <span className="badge badge-amber">⏳ Pending confirmation</span>
                                            }
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-ghost btn-sm" aria-label={`View report ${r.id}`} title="View report" onClick={e => e.stopPropagation()}>
                                                    <Eye size={13} aria-hidden="true" />
                                                </button>
                                                <button className="btn btn-ghost btn-sm" aria-label={`Download report ${r.id}`} title="Download report" onClick={e => e.stopPropagation()}>
                                                    <Download size={13} aria-hidden="true" />
                                                </button>
                                                <button className="btn btn-ghost btn-sm" aria-label={`Share report ${r.id}`} title="Share report" onClick={e => e.stopPropagation()}>
                                                    <Share2 size={13} aria-hidden="true" />
                                                </button>
                                                <button className="btn btn-ghost btn-sm" aria-label={`Flag report ${r.id}`} title="Flag for review" onClick={e => e.stopPropagation()} style={{ color: 'var(--warning)' }}>
                                                    <Flag size={13} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Expandable accordion row */}
                                    {expandedId === r.id && (
                                        <tr style={{ background: 'var(--surface-2)' }}>
                                            <td colSpan={6} style={{ padding: '12px 20px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: '0.8rem' }}>
                                                    <div>
                                                        <div style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.06em' }}>Full IPFS CID</div>
                                                        <code style={{ background: 'var(--surface-3)', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem', wordBreak: 'break-all', display: 'block' }}>{r.cid}</code>
                                                    </div>
                                                    <div>
                                                        <div style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.06em' }}>Transaction Hash</div>
                                                        {r.tx_hash
                                                            ? <code style={{ background: 'var(--surface-3)', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem', wordBreak: 'break-all', display: 'block' }}>{r.tx_hash}</code>
                                                            : <span style={{ color: 'var(--muted)' }}>Awaiting blockchain confirmation</span>
                                                        }
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && reports.length > 0 && (
                    <div className="results-count">
                        {reports.length} report{reports.length !== 1 ? 's' : ''} · Click any row to expand details
                    </div>
                )}
            </div>
        </>
    );
}

// ── Appointments ──────────────────────────────────────────────────────────────
function AppointmentsPage({ onNav }) {
    const { data, loading } = useApiData('/hospital/appointments');

    const appointments = data?.appointments ?? [];
    const upcoming = appointments.filter(a => a.status === 'scheduled');
    const past     = appointments.filter(a => a.status !== 'scheduled');

    return (
        <>
            <Breadcrumb crumbs={[
                { label: 'Dashboard', onClick: () => onNav('dashboard') },
                { label: 'Appointments' },
            ]} />

            <h1 className="page-title">Appointments</h1>

            {/* Summary badges */}
            {!loading && appointments.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">Upcoming: {upcoming.length}</span>
                    <span className="badge badge-green">Completed: {past.filter(a => a.status === 'completed').length}</span>
                    <span className="badge badge-red">Cancelled: {past.filter(a => a.status === 'cancelled').length}</span>
                </div>
            )}

            {/* Upcoming */}
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>
                Upcoming Appointments
            </div>
            <div className="table-wrap" style={{ marginBottom: 24 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table aria-label="Upcoming appointments">
                        <thead>
                            <tr>
                                <th>Patient</th>
                                <th>Doctor</th>
                                <th>Date</th>
                                <th>Reason</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && <TableSkeletonRows cols={5} rows={3} />}

                            {!loading && upcoming.length === 0 && (
                                <EmptyState
                                    icon="📅"
                                    title="No upcoming appointments"
                                    sub="All scheduled appointments will appear here. Patients can book through their portal."
                                />
                            )}

                            {!loading && upcoming.map(a => (
                                <tr key={a.id} style={{ borderLeft: '3px solid var(--primary)' }}>
                                    <td className="fw-600">{a.patient_first} {a.patient_last}</td>
                                    <td>
                                        Dr. {a.doctor_first} {a.doctor_last}
                                        <br />
                                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{a.specialization}</span>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>
                                            {new Date(a.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                        {/* Days until appointment */}
                                        <div style={{ fontSize: '0.72rem', color: 'var(--teal)' }}>
                                            {Math.ceil((new Date(a.appointment_date).getTime() - Date.now()) / 86400000)} day{Math.ceil((new Date(a.appointment_date).getTime() - Date.now()) / 86400000) !== 1 ? 's' : ''} away
                                        </div>
                                    </td>
                                    <td>{a.reason || '—'}</td>
                                    <td><span className="badge badge-blue">● Scheduled</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Past */}
            {((!loading && past.length > 0) || loading) ? (
                <>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>
                        Past Appointments
                    </div>
                    <div className="table-wrap">
                        <div style={{ overflowX: 'auto' }}>
                            <table aria-label="Past appointments">
                                <thead>
                                    <tr>
                                        <th>Patient</th>
                                        <th>Doctor</th>
                                        <th>Date</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && <TableSkeletonRows cols={5} rows={2} />}
                                    {!loading && past.map(a => (
                                        <tr key={a.id} style={{ borderLeft: `3px solid ${a.status === 'completed' ? 'var(--success)' : 'var(--danger)'}` }}>
                                            <td>{a.patient_first} {a.patient_last}</td>
                                            <td>Dr. {a.doctor_first} {a.doctor_last}</td>
                                            <td style={{ color: 'var(--muted)', fontSize: '0.83rem' }}>
                                                {new Date(a.appointment_date).toLocaleDateString()}
                                            </td>
                                            <td>{a.reason || '—'}</td>
                                            <td>
                                                <span className={`badge ${a.status === 'completed' ? 'badge-green' : 'badge-red'}`}>
                                                    {a.status === 'completed' ? '✓ Completed' : '✕ Cancelled'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : null}
        </>
    );
}

// ── HospitalPortal (entry) ─────────────────────────────────────────────────────
export default function HospitalPortal() {
    const [page, setPage] = useState('dashboard');
    const { user } = getSession();

    const PAGE = {
        dashboard:    <Dashboard    user={user} onNav={setPage} />,
        doctors:      <DoctorsPage  onNav={setPage} />,
        patients:     <PatientsPage onNav={setPage} />,
        reports:      <ReportsPage  onNav={setPage} />,
        appointments: <AppointmentsPage onNav={setPage} />,
    };

    return (
        <Shell
            brand={{ icon: '🏥', name: 'Hospital Panel', sub: user?.firstName || 'Hospital Admin', role: 'Hospital Admin' }}
            grad="var(--hospital-grad)"
            navItems={NAV}
            activePage={page}
            onNav={setPage}
        >
            {/* Page transition animation */}
            <div className="anim-slide-up" key={page}>{PAGE[page]}</div>
        </Shell>
    );
}
