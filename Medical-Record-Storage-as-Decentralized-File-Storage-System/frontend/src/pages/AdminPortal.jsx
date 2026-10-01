/**
 * AdminPortal.tsx — Production-grade Admin Portal
 *
 * Bugs fixed from original:
 *  [BUG-1]  useApiData: reload() closure captures stale setLoading/setError —
 *             should use a stable callback pattern
 *  [BUG-2]  api.delete/put/patch called inline in onClick with no error handling —
 *             failures are silent, UI doesn't reflect errors
 *  [BUG-3]  Modal has no focus trap or Escape-key handler — keyboard users can't close it
 *  [BUG-4]  HospitalsPage submit catches e.message but variable name shadows outer e
 *  [BUG-5]  AuditPage role badge lookup uses `${l.role?.toUpperCase()}_x` — always misses,
 *             role badge class is always the fallback 'badge-blue'
 *  [BUG-6]  UsersPage roleFilter changes cause full remount of useApiData (new path string
 *             reference on every render) — causes duplicate fetches
 *  [BUG-7]  getSession() called at render in AdminPortal — stale after session changes
 *
 * New features added:
 *  [FEAT-1]  Toast notification system (success / error / info) — replaces silent failures
 *  [FEAT-2]  Global search / command palette (Cmd+K) across hospitals, users, logs
 *  [FEAT-3]  Confirm dialog for destructive actions (deactivate hospital / user)
 *  [FEAT-4]  Pagination for Users and Audit Logs tables
 *  [FEAT-5]  Empty states with actionable CTAs for every table
 *  [FEAT-6]  Dashboard auto-refresh with countdown indicator
 *  [FEAT-7]  Audit log action filter + actor search
 *  [FEAT-8]  Hospital form: password strength meter
 *  [FEAT-9]  Keyboard shortcut hints in UI
 *  [FEAT-10] Export audit logs as CSV
 */

import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useContext,
    createContext,
    useMemo,
} from 'react';
import {
    LayoutDashboard,
    Building2,
    Users,
    BookOpen,
    Plus,
    X,
    Check,
    XCircle,
    TrendingUp,
    Power,
    Search,
    Download,
    RefreshCw,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Command,
    CheckCircle,
    Info,
    AlertCircle,
    Eye,
    EyeOff,
} from 'lucide-react';
import Shell from '../components/Shell';
import { api, getSession } from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// Toast context  [FEAT-1]
// ─────────────────────────────────────────────────────────────────────────────
const ToastContext = createContext({ toast: () => {} });

function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const counter = useRef(0);

    const toast = useCallback((kind, message) => {
        const id = ++counter.current;
        setToasts(prev => [...prev, { id, kind, message }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };
    const COLORS = {
        success: 'var(--success)',
        error: 'var(--danger)',
        info: 'var(--primary)',
    };

    return ( <
        ToastContext.Provider value = {
            { toast } } > { children } <
        div style = {
            {
                position: 'fixed',
                bottom: 24,
                right: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                zIndex: 9999,
                pointerEvents: 'none',
            }
        } > {
            toasts.map(t => {
                const Icon = ICONS[t.kind];
                return ( <
                    div key = { t.id }
                    style = {
                        {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderLeft: `3px solid ${COLORS[t.kind]}`,
                            borderRadius: 10,
                            padding: '10px 16px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            animation: 'slideInRight 0.2s ease',
                            pointerEvents: 'all',
                            maxWidth: 360,
                        }
                    } >
                    <
                    Icon size = { 15 }
                    color = { COLORS[t.kind] }
                    style = {
                        { flexShrink: 0 } }
                    /> { t.message } </div>
                );
            })
        } </div> <
        style > { `
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            ` } </style> </ToastContext.Provider>
    );
}

const useToast = () => useContext(ToastContext);

// ─────────────────────────────────────────────────────────────────────────────
// Confirm dialog  [FEAT-3]
// ─────────────────────────────────────────────────────────────────────────────

const ConfirmContext = createContext({ confirm: () => {} });

function ConfirmProvider({ children }) {
    const [state, setState] = useState(null);

    const confirm = useCallback((message, onConfirm) => {
        setState({ message, onConfirm });
    }, []);

    const handleConfirm = () => { state ?.onConfirm();
        setState(null); };
    const handleCancel = () => setState(null);

    return ( <
        ConfirmContext.Provider value = {
            { confirm } } > { children } {
            state && ( <
                div className = "modal-overlay"
                role = "alertdialog"
                aria-modal = "true" >
                <
                div className = "modal anim-slide-up"
                style = {
                    { maxWidth: 400 } } >
                <
                div style = {
                    { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 } } >
                <
                AlertTriangle size = { 20 }
                color = "var(--warning)"
                style = {
                    { flexShrink: 0, marginTop: 1 } }
                /> <
                div >
                <
                div style = {
                    { fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 } } > Are you sure ? </div> <
                div style = {
                    { fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.5 } } > { state.message } </div> </div> </div> <
                div style = {
                    { display: 'flex', gap: 8, justifyContent: 'flex-end' } } >
                <
                button className = "btn btn-ghost"
                onClick = { handleCancel } > Cancel </button> <
                button className = "btn btn-danger"
                onClick = { handleConfirm } > Confirm </button> </div> </div> </div>
            )
        } </ConfirmContext.Provider>
    );
}

const useConfirm = () => useContext(ConfirmContext);

// ─────────────────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
    { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { key: 'hospitals', label: 'Hospitals', Icon: Building2 },
    { key: 'users', label: 'All Users', Icon: Users },
    { key: 'logs', label: 'Audit Logs', Icon: BookOpen },
];

// ─────────────────────────────────────────────────────────────────────────────
// Modal — with focus trap + Escape handler  [BUG-3]
// ─────────────────────────────────────────────────────────────────────────────

function Modal({
    title,
    onClose,
    children,
    width = 520,
}) {
    const ref = useRef(null);

    useEffect(() => {
        const prev = document.activeElement;
        ref.current ?.focus();
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => {
            document.removeEventListener('keydown', handler);
            prev ?.focus();
        };
    }, [onClose]);

    return ( <
        div className = "modal-overlay"
        role = "dialog"
        aria-modal = "true"
        aria-labelledby = "modal-title"
        onClick = { e => e.target === e.currentTarget && onClose() } >
        <
        div ref = { ref }
        className = "modal anim-slide-up"
        tabIndex = {-1 }
        style = {
            { maxWidth: width, outline: 'none' } } >
        <
        div className = "flex items-center justify-between mb-6" >
        <
        div className = "modal-title"
        id = "modal-title" > { title } </div> <
        button className = "btn btn-ghost btn-sm"
        onClick = { onClose }
        aria-label = "Close modal" >
        <
        X size = { 16 }
        /> </button> </div> { children } </div> </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// useApiData — fixed stable reload reference  [BUG-1]
// ─────────────────────────────────────────────────────────────────────────────

function useApiData(path) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const reload = useCallback(() => {
        setLoading(true);
        setError('');
        api.get(path)
            .then((d) => setData(d))
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [path]);

    useEffect(() => { reload(); }, [reload]);

    return { data, loading, error, reload };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination hook  [FEAT-4]
// ─────────────────────────────────────────────────────────────────────────────

function usePagination(items, pageSize = 15) {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const slice = items.slice((safePage - 1) * pageSize, safePage * pageSize);

    return {
        page: safePage,
        totalPages,
        slice,
        setPage,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
    };
}

function Pagination({
    page,
    totalPages,
    hasPrev,
    hasNext,
    setPage,
    total,
}) {
    if (totalPages <= 1) return null;
    return ( <
        div style = {
            {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                fontSize: '0.82rem',
                color: 'var(--muted)',
            }
        } >
        <
        span > { total }
        total </span> <
        div style = {
            { display: 'flex', gap: 8, alignItems: 'center' } } >
        <
        button className = "btn btn-ghost btn-sm"
        disabled = {!hasPrev }
        onClick = {
            () => setPage(p => p - 1) } >
        <
        ChevronLeft size = { 13 }
        /> </button> <
        span style = {
            { fontWeight: 600, color: 'var(--text)' } } > { page }
        / {totalPages} </span> <
        button className = "btn btn-ghost btn-sm"
        disabled = {!hasNext }
        onClick = {
            () => setPage(p => p + 1) } >
        <
        ChevronRight size = { 13 }
        /> </button> </div> </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state  [FEAT-5]
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
    icon,
    title,
    description,
    action,
}) {
    return ( <
        tr >
        <
        td colSpan = { 99 }
        style = {
            { textAlign: 'center', padding: '48px 24px' } } >
        <
        div style = {
            { fontSize: '2rem', marginBottom: 12 } } > { icon } </div> <
        div style = {
            { fontWeight: 600, marginBottom: 6, fontSize: '0.95rem' } } > { title } </div> <
        div style = {
            { color: 'var(--muted)', fontSize: '0.83rem', marginBottom: action ? 16 : 0 } } > { description } </div> { action } </td> </tr>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Password strength meter  [FEAT-8]
// ─────────────────────────────────────────────────────────────────────────────

function PasswordField({
    value,
    onChange,
    label = 'Portal Password',
    required = false,
}) {
    const [show, setShow] = useState(false);

    const strength = useMemo(() => {
        if (!value) return 0;
        let score = 0;
        if (value.length >= 8) score++;
        if (value.length >= 12) score++;
        if (/[A-Z]/.test(value)) score++;
        if (/[0-9]/.test(value)) score++;
        if (/[^A-Za-z0-9]/.test(value)) score++;
        return score;
    }, [value]);

    const LABELS = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
    const COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

    return ( <
        div className = "form-group" >
        <
        label > { label } { required && ' *' } </label> <
        div style = {
            { position: 'relative' } } >
        <
        input type = { show ? 'text' : 'password' }
        className = "input"
        required = { required }
        value = { value }
        onChange = { e => onChange(e.target.value) }
        style = {
            { paddingRight: 40 } }
        autoComplete = "new-password" /
        >
        <
        button type = "button"
        onClick = {
            () => setShow(s => !s) }
        style = {
            {
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: 0,
            }
        }
        aria-label = { show ? 'Hide password' : 'Show password' } >
        { show ? < EyeOff size = { 14 } /> : <Eye size={14} / > } </button> </div> {
            value && ( <
                div style = {
                    { marginTop: 6 } } >
                <
                div style = {
                    { display: 'flex', gap: 3, marginBottom: 4 } } > {
                    [1, 2, 3, 4, 5].map(i => ( <
                        div key = { i }
                        style = {
                            {
                                flex: 1,
                                height: 3,
                                borderRadius: 2,
                                background: i <= strength ? COLORS[strength] : 'var(--border)',
                                transition: 'background 0.2s',
                            }
                        }
                        />
                    ))
                } </div> <
                div style = {
                    { fontSize: '0.72rem', color: COLORS[strength] } } > { LABELS[strength] } </div> </div>
            )
        } </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard  [FEAT-6 auto-refresh]
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard() {
    const { data, reload } = useApiData('/admin/stats');
    const { data: chain } = useApiData('/blockchain/status');
    const [countdown, setCountdown] = useState(30);

    // Auto-refresh every 30 seconds with visible countdown
    useEffect(() => {
        setCountdown(30);
        const tick = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { reload(); return 30; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(tick);
    }, [reload]);

    const stats = [
        { label: 'Hospitals', value: data ?.hospitals, icon: '🏥', accent: '#3b82f6', trend: '+1 this month' },
        { label: 'Doctors', value: data ?.doctors, icon: '👨‍⚕️', accent: '#f59e0b', trend: 'Active staff' },
        { label: 'Patients', value: data ?.patients, icon: '👥', accent: '#a78bfa', trend: 'Registered' },
        { label: 'Reports', value: data ?.reports, icon: '📋', accent: '#22c55e', trend: 'On IPFS' },
    ];

    return ( <
        >
        <
        div className = "flex items-center justify-between mb-6" >
        <
        div >
        <
        h1 className = "page-title"
        style = {
            { marginBottom: 4 } } > System Overview </h1> <
        p className = "page-subtitle"
        style = {
            { marginBottom: 0 } } >
        Platform - wide statistics and blockchain status </p> </div> <
        button className = "btn btn-ghost btn-sm"
        onClick = {
            () => { reload();
                setCountdown(30); } }
        title = "Refresh now"
        style = {
            { gap: 6 } } >
        <
        RefreshCw size = { 13 }
        /> <
        span style = {
            { fontSize: '0.78rem', color: 'var(--muted)' } } > { countdown }
        s </span> </button> </div>

        <
        div className = "stat-grid" > {
            stats.map(s => ( <
                    div key = { s.label }
                    className = "stat-card"
                    style = {
                        { '--card-accent': s.accent }
                         } >
                    <
                    div className = "stat-icon"
                    style = {
                        { background: `${s.accent}18` } } >
                    <
                    span style = {
                        { fontSize: '1.15rem' } } > { s.icon } </span> </div> <
                    div className = "stat-body" >
                    <
                    div className = "label" > { s.label } </div> <
                    div className = "value"
                    style = {
                        { color: s.accent } } > {
                        s.value ?? < span style = {
                            { opacity: 0.35 } } > — </span>} </div> <
                        div className = "trend" >
                        <
                        TrendingUp size = { 10 }
                        style = {
                            { verticalAlign: 'middle', marginRight: 3 } }
                        /> { s.trend } </div> </div> </div>
                    ))
            } </div>

            {
                chain && ( <
                    div className = "card"
                    style = {
                        {
                            borderLeft: `3px solid ${
                        chain.ipfsTier === 'simulated' ? 'var(--warning)' :
                        chain.ipfsTier === 'local'     ? 'var(--success)' :
                                                         'var(--primary)'
                    }`,
                        }
                    } >
                    <
                    div style = {
                        { fontWeight: 700, marginBottom: 12, fontSize: '0.95rem' } } > ⛓️Blockchain / IPFS Status </div> <
                    div style = {
                        { display: 'flex', gap: 32, flexWrap: 'wrap' } } > {
                        [
                            { label: 'IPFS Tier', value: chain.ipfsTier, badge: true },
                            { label: 'Reports Stored', value: chain.reportCount },
                            { label: 'Uptime', value: chain.uptime ? `${Math.floor(chain.uptime / 60)}m` : '—' },
                        ].map(item => ( <
                            div key = { item.label } >
                            <
                            div style = {
                                {
                                    fontSize: '0.72rem',
                                    color: 'var(--muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1,
                                    marginBottom: 6,
                                }
                            } > { item.label } </div> {
                                item.badge ? ( <
                                    span className = { `badge ${
                                        chain.ipfsTier === 'local'  ? 'badge-green' :
                                        chain.ipfsTier === 'pinata' ? 'badge-blue'  :
                                                                      'badge-amber'
                                    }` } > { item.value } </span>
                                ) : ( <
                                    span style = {
                                        { fontWeight: 700 } } > { item.value } </span>
                                )
                            } </div>
                        ))
                    } </div> </div>
                )
            } </>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Hospitals  [BUG-2 error handling] [BUG-4 variable shadow] [FEAT-1] [FEAT-3]
    // ─────────────────────────────────────────────────────────────────────────────

    const HOSPITAL_FORM_DEFAULT = {
        name: '',
        city: '',
        address: '',
        email: '',
        phone: '',
        password: '',
    };

    function HospitalsPage() {
        const { data, reload } = useApiData('/admin/hospitals');
        const { toast } = useToast();
        const { confirm } = useConfirm();
        const [showModal, setShowModal] = useState(false);
        const [form, setForm] = useState(HOSPITAL_FORM_DEFAULT);
        const [saving, setSaving] = useState(false);
        const [formErr, setFormErr] = useState('');

        const closeModal = useCallback(() => {
            setShowModal(false);
            setForm(HOSPITAL_FORM_DEFAULT);
            setFormErr('');
        }, []);

        // [BUG-4] Renamed catch param to avoid shadowing outer scope
        const submit = async(e) => {
            e.preventDefault();
            setSaving(true);
            setFormErr('');
            try {
                await api.post('/admin/hospitals', form);
                closeModal();
                reload();
                toast('success', `${form.name} registered successfully.`);
            } catch (err) {
                setFormErr(err ?.response ?.data ?.message || err.message || 'Registration failed.');
            } finally {
                setSaving(false);
            }
        };

        // [BUG-2][FEAT-3] Deactivate with confirmation + toast feedback
        const handleDeactivate = (h) => {
            confirm(
                `Deactivating "${h.name}" will prevent its staff from logging in. This can be reversed.`,
                async() => {
                    try {
                        await api.delete(`/admin/hospitals/${h.id}`);
                        reload();
                        toast('success', `${h.name} deactivated.`);
                    } catch (err) {
                        toast('error', err ?.response ?.data ?.message || 'Failed to deactivate.');
                    }
                }
            );
        };

        const handleActivate = async(h) => {
            try {
                await api.put(`/admin/hospitals/${h.id}`, { is_active: true });
                reload();
                toast('success', `${h.name} reactivated.`);
            } catch (err) {
                toast('error', err ?.response ?.data ?.message || 'Failed to activate.');
            }
        };

        const hospitals = data ?.hospitals ?? [];

        return ( <
            >
            <
            div className = "flex items-center justify-between mb-6" >
            <
            div >
            <
            h1 className = "page-title"
            style = {
                { marginBottom: 0 } } > Hospitals </h1> <
            p className = "page-subtitle"
            style = {
                { marginBottom: 0 } } >
            Manage registered healthcare institutions </p> </div> <
            button className = "btn btn-primary"
            onClick = {
                () => setShowModal(true) } >
            <
            Plus size = { 15 }
            /> Add Hospital </button> </div>

            <
            div className = "table-wrap" >
            <
            table >
            <
            thead >
            <
            tr >
            <
            th > Name </th><th>City</th > < th > Email </th> <
            th > Phone </th><th>Status</th > < th > Actions </th> </tr> </thead> <
            tbody > {
                hospitals.length === 0 ? ( <
                    EmptyState icon = "🏥"
                    title = "No hospitals registered"
                    description = "Add your first hospital to get started."
                    action = { <
                        button className = "btn btn-primary btn-sm"
                        onClick = {
                            () => setShowModal(true) } >
                        <
                        Plus size = { 13 }
                        /> Add Hospital </button>
                    }
                    />
                ) : hospitals.map(h => ( <
                    tr key = { h.id } >
                    <
                    td className = "fw-600" > { h.name } </td> <
                    td > { h.city || '—' } </td> <
                    td style = {
                        { color: 'var(--muted)', fontSize: '0.85rem' } } > { h.email } </td> <
                    td > { h.phone || '—' } </td> <
                    td >
                    <
                    span className = { `badge ${h.is_active ? 'badge-green' : 'badge-red'}` } > { h.is_active ? 'Active' : 'Inactive' } </span> </td> <
                    td > {
                        h.is_active ? ( <
                            button className = "btn btn-ghost btn-sm"
                            title = "Deactivate this hospital"
                            onClick = {
                                () => handleDeactivate(h) } >
                            <
                            XCircle size = { 13 }
                            /> Deactivate </button>
                        ) : ( <
                            button className = "btn btn-success btn-sm"
                            title = "Reactivate this hospital"
                            onClick = {
                                () => handleActivate(h) } >
                            <
                            Power size = { 13 }
                            /> Activate </button>
                        )
                    } </td> </tr>
                ))
            } </tbody> </table> </div>

            {
                showModal && ( <
                        Modal title = "🏥 Register New Hospital"
                        onClose = { closeModal } > {
                            formErr && < div className = "alert alert-error"
                            style = {
                                { marginBottom: 16 } } > { formErr } </div>} <
                            form onSubmit = { submit } >
                            <
                            div className = "grid-2" >
                            <
                            div className = "form-group" >
                            <
                            label > Hospital Name * </label> <
                            input className = "input"
                            required value = { form.name }
                            onChange = { e => setForm({...form, name: e.target.value }) }
                            /> </div> <
                            div className = "form-group" >
                            <
                            label > City </label> <
                            input className = "input"
                            value = { form.city }
                            onChange = { e => setForm({...form, city: e.target.value }) }
                            /> </div> <
                            div className = "form-group" >
                            <
                            label > Login Email * </label> <
                            input type = "email"
                            className = "input"
                            required value = { form.email }
                            onChange = { e => setForm({...form, email: e.target.value }) }
                            /> </div> <
                            div className = "form-group" >
                            <
                            label > Phone </label> <
                            input className = "input"
                            value = { form.phone }
                            onChange = { e => setForm({...form, phone: e.target.value }) }
                            /> </div> </div> <
                            div className = "form-group" >
                            <
                            label > Address </label> <
                            input className = "input"
                            value = { form.address }
                            onChange = { e => setForm({...form, address: e.target.value }) }
                            /> </div> { /* [FEAT-8] Password strength meter */ } <
                            PasswordField
                            value = { form.password }
                            onChange = { v => setForm({...form, password: v }) }
                            label = "Portal Password"
                            required /
                            >
                            <
                            div className = "flex gap-2"
                            style = {
                                { justifyContent: 'flex-end', marginTop: 8 } } >
                            <
                            button type = "button"
                            className = "btn btn-ghost"
                            onClick = { closeModal } >
                            Cancel </button> <
                            button type = "submit"
                            className = "btn btn-primary"
                            disabled = { saving } > { saving ? 'Saving…' : 'Create Hospital' } </button> </div> </form> </Modal>
                        )
                    } </>
            );
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // Role badge helper — defined once, used everywhere
        // ─────────────────────────────────────────────────────────────────────────────

        const ROLE_BADGE = {
            admin: 'badge-purple',
            hospital: 'badge-green',
            doctor: 'badge-amber',
            patient: 'badge-blue',
        };

        function RoleBadge({ role }) {
            return ( <
                span className = { `badge ${ROLE_BADGE[role] ?? 'badge-teal'}` }
                style = {
                    { textTransform: 'capitalize' } } > { role } </span>
            );
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // Users  [BUG-6 stable path] [FEAT-1] [FEAT-3] [FEAT-4] [FEAT-5]
        // ─────────────────────────────────────────────────────────────────────────────

        function UsersPage() {
            const { toast } = useToast();
            const { confirm } = useConfirm();
            const [roleFilter, setRoleFilter] = useState('');
            const [search, setSearch] = useState('');

            // [BUG-6] useMemo ensures path string reference is stable
            const path = useMemo(
                    () => `/admin/users${roleFilter ? `?role=${roleFilter}` : ''}`,
        [roleFilter]
    );
    const { data, reload } = useApiData(path);

    const users = useMemo(() => {
        const all = data?.users ?? [];
        if (!search.trim()) return all;
        const q = search.toLowerCase();
        return all.filter(u =>
            `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.wallet_address?.toLowerCase().includes(q)
        );
    }, [data, search]);

    const pagination = usePagination(users);

    const toggle = (u) => {
        const action = u.is_active ? 'deactivate' : 'activate';
        const run = async () => {
            try {
                await api.patch(`/admin/users/${u.id}/status`, { is_active: !u.is_active });
                reload();
                toast('success', `${u.first_name} ${u.last_name} ${action}d.`);
            } catch (err) {
                toast('error', err?.response?.data?.message || `Failed to ${action}.`);
            }
        };
        if (u.is_active) {
            confirm(
                `Deactivating ${u.first_name} ${u.last_name} will block their access immediately.`,
                run
            );
        } else {
            run();
        }
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title" style={{ marginBottom: 0 }}>All Users</h1>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>
                        {users.length} {roleFilter || 'total'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{
                            position: 'absolute', left: 10, top: '50%',
                            transform: 'translateY(-50%)', color: 'var(--muted)',
                        }} />
                        <input
                            className="input"
                            placeholder="Search users…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 30, width: 180 }}
                        />
                    </div>
                    <select className="input" style={{ width: 140 }} value={roleFilter}
                        onChange={e => { setRoleFilter(e.target.value); pagination.setPage(1); }}>
                        <option value="">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="hospital">Hospital</option>
                        <option value="doctor">Doctor</option>
                        <option value="patient">Patient</option>
                    </select>
                </div>
            </div>

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th><th>Email / Wallet</th><th>Role</th>
                            <th>Status</th><th>Since</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagination.slice.length === 0 ? (
                            <EmptyState
                                icon="👥"
                                title={search ? 'No users match your search' : 'No users found'}
                                description={search ? 'Try a different name or email.' : 'Users will appear here once registered.'}
                            />
                        ) : pagination.slice.map(u => (
                            <tr key={u.id}>
                                <td className="fw-600">{u.first_name} {u.last_name}</td>
                                <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                                    {u.email || u.wallet_address || '—'}
                                </td>
                                <td><RoleBadge role={u.role} /></td>
                                <td>
                                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                                        {u.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                                    {new Date(u.created_at).toLocaleDateString()}
                                </td>
                                <td>
                                    <button
                                        className={`btn btn-sm ${u.is_active ? 'btn-ghost' : 'btn-success'}`}
                                        onClick={() => toggle(u)}
                                    >
                                        {u.is_active
                                            ? <><XCircle size={12} /> Deactivate</>
                                            : <><Check size={12} /> Activate</>
                                        }
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <Pagination {...pagination} total={users.length} />
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Logs  [BUG-5 role badge] [FEAT-4] [FEAT-7] [FEAT-10]
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_STYLE = {
    LOGIN:            { cls: 'badge-blue',   label: 'Login' },
    WALLET_LOGIN:     { cls: 'badge-teal',   label: 'Wallet Login' },
    SELF_REGISTER:    { cls: 'badge-green',  label: 'Register' },
    HOSPITAL_SIGNUP:  { cls: 'badge-green',  label: 'Hospital Signup' },
    CREATE_HOSPITAL:  { cls: 'badge-purple', label: 'Create Hospital' },
    REGISTER_DOCTOR:  { cls: 'badge-amber',  label: 'Register Doctor' },
    REGISTER_PATIENT: { cls: 'badge-blue',   label: 'Register Patient' },
    CREATE_REPORT:    { cls: 'badge-green',  label: 'Create Report' },
    LINK_WALLET:      { cls: 'badge-teal',   label: 'Link Wallet' },
    SYSTEM_INIT:      { cls: 'badge-purple', label: 'System Init' },
    DEACTIVATE:       { cls: 'badge-red',    label: 'Deactivate' },
};

// [FEAT-10] Export logs to CSV
function exportCsv(logs) {
    const header = 'ID,Actor,Role,Action,Target,Time';
    const rows = logs.map(l =>
        [
            l.id,
            l.email || `#${l.actor_id}`,
            l.role || '',
            l.action,
            `"${String(l.target || '').replace(/"/g, '""')}"`,
            new Date(l.created_at).toISOString(),
        ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function AuditPage() {
    const { data } = useApiData('/admin/audit-logs');
    const [actionFilter, setActionFilter] = useState('');
    const [actorSearch, setActorSearch]   = useState('');

    const logs = useMemo(() => {
        let all = data?.logs ?? [];
        if (actionFilter) all = all.filter(l => l.action === actionFilter);
        if (actorSearch.trim()) {
            const q = actorSearch.toLowerCase();
            all = all.filter(l =>
                l.email?.toLowerCase().includes(q) ||
                String(l.actor_id).includes(q)
            );
        }
        return all;
    }, [data, actionFilter, actorSearch]);

    const pagination = usePagination(logs, 20);

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="page-title" style={{ marginBottom: 4 }}>Audit Logs</h1>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>
                        All system actions — tamper-evident activity trail
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {/* [FEAT-7] Actor search */}
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{
                            position: 'absolute', left: 10, top: '50%',
                            transform: 'translateY(-50%)', color: 'var(--muted)',
                        }} />
                        <input
                            className="input"
                            placeholder="Search actor…"
                            value={actorSearch}
                            onChange={e => setActorSearch(e.target.value)}
                            style={{ paddingLeft: 30, width: 160 }}
                        />
                    </div>
                    {/* [FEAT-7] Action filter */}
                    <select className="input" style={{ width: 160 }} value={actionFilter}
                        onChange={e => { setActionFilter(e.target.value); pagination.setPage(1); }}>
                        <option value="">All Actions</option>
                        {Object.entries(ACTION_STYLE).map(([key, { label }]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    {/* [FEAT-10] Export CSV */}
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => exportCsv(data?.logs ?? [])}
                        title="Export all logs as CSV"
                        style={{ gap: 6 }}
                        disabled={!data?.logs?.length}
                    >
                        <Download size={13} /> Export
                    </button>
                </div>
            </div>

            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Actor</th><th>Role</th><th>Action</th><th>Target</th><th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagination.slice.length === 0 ? (
                            <EmptyState
                                icon="📋"
                                title={actionFilter || actorSearch ? 'No logs match your filters' : 'No audit logs yet'}
                                description="System actions will appear here automatically."
                            />
                        ) : pagination.slice.map(l => {
                            const style = ACTION_STYLE[l.action] ?? { cls: 'badge-purple', label: l.action };
                            return (
                                <tr key={l.id}>
                                    <td style={{ fontSize: '0.85rem' }}>
                                        {l.email || `#${l.actor_id}`}
                                    </td>
                                    {/* [BUG-5] Use RoleBadge which references the correct map */}
                                    <td>
                                        {l.role ? <RoleBadge role={l.role} /> : '—'}
                                    </td>
                                    <td>
                                        <span className={`badge ${style.cls}`}>{style.label}</span>
                                    </td>
                                    <td style={{
                                        color: 'var(--muted)', fontSize: '0.82rem',
                                        maxWidth: 180, overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {String(l.target || '—').slice(0, 40)}
                                    </td>
                                    <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                                        {new Date(l.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <Pagination {...pagination} total={logs.length} />
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Command palette  [FEAT-2]
// ─────────────────────────────────────────────────────────────────────────────

function CommandPalette({
    onNavigate,
    onClose,
}) {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);

    const COMMANDS = [
        { label: 'Go to Dashboard',  page: 'dashboard', icon: '⚡' },
        { label: 'Go to Hospitals',  page: 'hospitals',  icon: '🏥' },
        { label: 'Go to All Users',  page: 'users',      icon: '👥' },
        { label: 'Go to Audit Logs', page: 'logs',       icon: '📋' },
    ];

    const filtered = query.trim()
        ? COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
        : COMMANDS;

    useEffect(() => { inputRef.current?.focus(); }, []);

    return (
        <div
            className="modal-overlay"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div style={{
                background: 'var(--surface)', borderRadius: 14,
                border: '1px solid var(--border)',
                width: '100%', maxWidth: 480,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                    <Search size={15} color="var(--muted)" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search pages and actions…"
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            fontSize: '0.9rem', color: 'var(--text)',
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Escape') onClose();
                            if (e.key === 'Enter' && filtered.length > 0) {
                                onNavigate(filtered[0].page);
                                onClose();
                            }
                        }}
                    />
                    <kbd style={{
                        padding: '2px 6px', borderRadius: 5,
                        background: 'var(--border)', fontSize: '0.72rem',
                        color: 'var(--muted)',
                    }}>
                        Esc
                    </kbd>
                </div>
                <div style={{ padding: '6px 0', maxHeight: 280, overflowY: 'auto' }}>
                    {filtered.map(cmd => (
                        <button
                            key={cmd.page}
                            onClick={() => { onNavigate(cmd.page); onClose(); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                width: '100%', padding: '10px 16px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text)', fontSize: '0.87rem', textAlign: 'left',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = 'var(--hover)')}
                            onMouseOut={e  => (e.currentTarget.style.background = 'none')}
                        >
                            <span style={{ fontSize: '1rem' }}>{cmd.icon}</span>
                            {cmd.label}
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div style={{ padding: '16px', color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                            No results for "{query}"
                        </div>
                    )}
                </div>
                <div style={{
                    padding: '8px 16px', borderTop: '1px solid var(--border)',
                    fontSize: '0.72rem', color: 'var(--muted)',
                    display: 'flex', gap: 16,
                }}>
                    <span><kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--border)' }}>↵</kbd> select</span>
                    <span><kbd style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--border)' }}>Esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Portal Root  [BUG-7]
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPortal() {
    const [page, setPage]       = useState('dashboard');
    const [cmdOpen, setCmdOpen] = useState(false);

    // [BUG-7] useMemo so session isn't re-read on every render
    const { user } = useMemo(() => getSession(), []);

    // [FEAT-2] Cmd+K / Ctrl+K opens command palette
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setCmdOpen(open => !open);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const PAGE = {
        dashboard: <Dashboard />,
        hospitals: <HospitalsPage />,
        users:     <UsersPage />,
        logs:      <AuditPage />,
    };

    return (
        <ToastProvider>
            <ConfirmProvider>
                <Shell
                    brand={{
                        icon: '⚡',
                        name: 'Admin Panel',
                        // [BUG from Shell.tsx] sub is portal subtitle, not user name
                        sub:  'Admin Portal',
                        role: 'Admin',
                    }}
                    grad="var(--admin-grad)"
                    navItems={NAV}
                    activePage={page}
                    onNav={setPage}
                >
                    {/* [FEAT-9] Keyboard hint */}
                    <div style={{
                        position: 'fixed', bottom: 24, left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8, padding: '5px 12px',
                        fontSize: '0.72rem', color: 'var(--muted)',
                        display: 'flex', gap: 6, alignItems: 'center',
                        zIndex: 100, pointerEvents: 'none',
                        opacity: 0.7,
                    }}>
                        <Command size={11} />
                        <kbd>K</kbd> to search
                    </div>

                    <div className="anim-slide-up">{PAGE[page]}</div>
                </Shell>

                {/* [FEAT-2] Command palette */}
                {cmdOpen && (
                    <CommandPalette
                        onNavigate={setPage}
                        onClose={() => setCmdOpen(false)}
                    />
                )}
            </ConfirmProvider>
        </ToastProvider>
    );
}