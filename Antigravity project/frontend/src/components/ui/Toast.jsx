/**
 * MedBlock — Ultimate Toast Notification System
 * Ported from Login Project's Toast.tsx to plain JSX.
 * API: useToast() → { toast: { success, error, warning, info } }
 *
 * Features:
 *  ✅ Progress bar (countdown to auto-dismiss)
 *  ✅ Pause on hover
 *  ✅ Smooth exit animation before unmount
 *  ✅ prefers-reduced-motion respected
 *  ✅ Max 5 toast stack — oldest auto-dropped
 *  ✅ Glow accent behind icon
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

// ─── STYLES ─────────────────────────────────────────────────────────────────

const STYLES = {
  success: {
    icon: React.createElement(CheckCircle2, { size: 16, strokeWidth: 2.5 }),
    grad: 'linear-gradient(135deg,#10b981,#059669)',
    border: 'rgba(16,185,129,0.30)',
    bg: 'rgba(16,185,129,0.07)',
    bar: 'linear-gradient(90deg,#10b981,#34d399)',
    glow: 'rgba(16,185,129,0.10)',
  },
  error: {
    icon: React.createElement(XCircle, { size: 16, strokeWidth: 2.5 }),
    grad: 'linear-gradient(135deg,#ef4444,#dc2626)',
    border: 'rgba(239,68,68,0.30)',
    bg: 'rgba(239,68,68,0.07)',
    bar: 'linear-gradient(90deg,#ef4444,#f87171)',
    glow: 'rgba(239,68,68,0.10)',
  },
  warning: {
    icon: React.createElement(AlertTriangle, { size: 16, strokeWidth: 2.5 }),
    grad: 'linear-gradient(135deg,#f59e0b,#d97706)',
    border: 'rgba(245,158,11,0.30)',
    bg: 'rgba(245,158,11,0.07)',
    bar: 'linear-gradient(90deg,#f59e0b,#fbbf24)',
    glow: 'rgba(245,158,11,0.10)',
  },
  info: {
    icon: React.createElement(Info, { size: 16, strokeWidth: 2.5 }),
    grad: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
    border: 'rgba(14,165,233,0.30)',
    bg: 'rgba(14,165,233,0.07)',
    bar: 'linear-gradient(90deg,#0ea5e9,#38bdf8)',
    glow: 'rgba(14,165,233,0.10)',
  },
};

const DEFAULT_DURATION = 4200;
const MAX_TOASTS = 5;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── CONTEXT ─────────────────────────────────────────────────────────────────

const Ctx = createContext(null);

// ─── SINGLE TOAST ITEM ───────────────────────────────────────────────────────

function ToastItem({ t, onDismiss }) {
  const s = STYLES[t.type];
  const duration = t.duration ?? DEFAULT_DURATION;

  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const intervalRef = useRef(null);
  const remainingRef = useRef(duration);
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);

  const triggerExit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearInterval(intervalRef.current);
    setExiting(true);
    setTimeout(() => onDismiss(t.id), prefersReducedMotion ? 0 : 340);
  }, [onDismiss, t.id]);

  const startTick = useCallback(() => {
    clearInterval(intervalRef.current);
    startRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      startRef.current = Date.now();

      setProgress(Math.max(0, (remainingRef.current / duration) * 100));

      if (remainingRef.current <= 0) {
        clearInterval(intervalRef.current);
        triggerExit();
      }
    }, 40);
  }, [duration, triggerExit]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    startTick();
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseEnter = () => clearInterval(intervalRef.current);
  const handleMouseLeave = () => {
    startRef.current = Date.now();
    startTick();
  };

  const isIn = visible && !exiting;
  const transform = prefersReducedMotion
    ? 'none'
    : isIn
    ? 'translateX(0)'
    : 'translateX(120%)';
  const opacity = prefersReducedMotion ? 1 : isIn ? 1 : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mb-toast"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'relative',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        minWidth: 280,
        maxWidth: 360,
        padding: '12px 14px 16px',
        borderRadius: 12,
        background: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${s.border}`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow: 'hidden',
        transform,
        opacity,
        transition: prefersReducedMotion
          ? 'none'
          : 'transform 0.35s cubic-bezier(.2,.8,.2,1), opacity 0.35s',
        willChange: 'transform, opacity',
      }}
    >
      {/* Glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 80px 80px at 28px 50%, ${s.glow}, transparent)`,
          pointerEvents: 'none',
        }}
      />

      {/* Icon badge */}
      <div
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: s.grad,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
          boxShadow: `0 4px 12px ${s.border}`,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {s.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.88rem',
            color: 'var(--text)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {t.title}
        </div>
        {t.message && (
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--muted)',
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {t.message}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        aria-label="Dismiss notification"
        onClick={triggerExit}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--muted)',
          cursor: 'pointer',
          padding: '2px 3px',
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <X size={15} />
      </button>

      {/* Progress bar */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: s.bar,
            transition: 'width 0.04s linear',
          }}
        />
      </div>
    </div>
  );
}

// ─── PROVIDER ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, title, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, title, message }];
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastFn = useCallback((message, type = 'info') => {
    push(type, message, '');
  }, [push]);

  toastFn.success = useCallback((title, message) => push('success', title, message), [push]);
  toastFn.error   = useCallback((title, message) => push('error', title, message), [push]);
  toastFn.warning = useCallback((title, message) => push('warning', title, message), [push]);
  toastFn.info    = useCallback((title, message) => push('info', title, message), [push]);

  toastFn.toast = {
    success: toastFn.success,
    error: toastFn.error,
    warning: toastFn.warning,
    info: toastFn.info,
  };

  return (
    <Ctx.Provider value={toastFn}>
      {children}
      <div
        aria-label="Notifications"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 18,
          right: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem t={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

// ─── HOOK ────────────────────────────────────────────────────────────────────

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used inside ToastProvider');
  return c;
}
