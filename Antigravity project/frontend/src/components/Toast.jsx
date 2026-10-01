import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);

let _nextId = 1;

const ICONS = {
    success: <CheckCircle size={16} />,
    error:   <XCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    info:    <Info size={16} />,
};

const COLORS = {
    success: { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)',   color: '#86efac' },
    error:   { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   color: '#fca5a5' },
    warning: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  color: '#fcd34d' },
    info:    { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  color: '#93c5fd' },
};

function ToastItem({ toast, onDismiss }) {
    const c = COLORS[toast.type] || COLORS.info;
    return (
        <div
            className="toast-item"
            style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                color: c.color,
            }}
        >
            <span className="toast-icon">{ICONS[toast.type]}</span>
            <span className="toast-msg">{toast.message}</span>
            <button
                className="toast-close"
                onClick={() => onDismiss(toast.id)}
                title="Dismiss"
            >
                <X size={13} />
            </button>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef({});

    const dismiss = useCallback((id) => {
        setToasts(t => t.filter(x => x.id !== id));
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
    }, []);

    const toast = useCallback((message, type = 'info', duration = 4000) => {
        const id = _nextId++;
        setToasts(t => [...t, { id, message, type }]);
        timersRef.current[id] = setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    // Convenience shorthands
    toast.success = (msg, d) => toast(msg, 'success', d);
    toast.error   = (msg, d) => toast(msg, 'error', d);
    toast.warning = (msg, d) => toast(msg, 'warning', d);
    toast.info    = (msg, d) => toast(msg, 'info', d);

    return (
        <ToastCtx.Provider value={toast}>
            {children}
            <div className="toast-container">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
                ))}
            </div>
        </ToastCtx.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastCtx);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
