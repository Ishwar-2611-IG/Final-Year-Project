/**
 * MedBlock — Ultimate Toast Notification System
 * Matches Code 1 API exactly: useToast() → { toast: { success, error, warning, info } }
 * Drop-in replacement — zero changes needed in your existing frontend.
 *
 * Improvements over Code 1:
 *  ✅ Lucide SVG icons (same as Code 1)
 *  ✅ Progress bar (countdown to auto-dismiss)
 *  ✅ Pause on hover — fixed double-interval bug from Code 2
 *  ✅ Smooth exit animation before unmount
 *  ✅ prefers-reduced-motion respected
 *  ✅ Max 5 toast stack — oldest auto-dropped
 *  ✅ Glow accent behind icon
 *  ✅ removedRef guard — no double-dismiss crash
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

// ─────────────────────────────────────────────
// TYPES  (same shape as Code 1)
// ─────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ✅ Identical to Code 1 — your existing callers need zero changes
interface ToastCtx {
  toast: {
    success: (title: string, message?: string) => void;
    error:   (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info:    (title: string, message?: string) => void;
  };
}

const Ctx = createContext<ToastCtx | null>(null);

// ─────────────────────────────────────────────
// THEME  (same CSS-variable colour names as Code 1)
// ─────────────────────────────────────────────

const STYLES: Record<
  ToastType,
  {
    icon:   React.ReactNode;
    grad:   string;
    border: string;
    bg:     string;
    bar:    string;
    glow:   string;
  }
> = {
  success: {
    icon:   <CheckCircle2 size={16} strokeWidth={2.5} />,
    grad:   'linear-gradient(135deg,#10b981,#059669)',
    border: 'rgba(16,185,129,0.30)',
    bg:     'rgba(16,185,129,0.07)',
    bar:    'linear-gradient(90deg,#10b981,#34d399)',
    glow:   'rgba(16,185,129,0.10)',
  },
  error: {
    icon:   <XCircle size={16} strokeWidth={2.5} />,
    grad:   'linear-gradient(135deg,#ef4444,#dc2626)',
    border: 'rgba(239,68,68,0.30)',
    bg:     'rgba(239,68,68,0.07)',
    bar:    'linear-gradient(90deg,#ef4444,#f87171)',
    glow:   'rgba(239,68,68,0.10)',
  },
  warning: {
    icon:   <AlertTriangle size={16} strokeWidth={2.5} />,
    grad:   'linear-gradient(135deg,#f59e0b,#d97706)',
    border: 'rgba(245,158,11,0.30)',
    bg:     'rgba(245,158,11,0.07)',
    bar:    'linear-gradient(90deg,#f59e0b,#fbbf24)',
    glow:   'rgba(245,158,11,0.10)',
  },
  info: {
    icon:   <Info size={16} strokeWidth={2.5} />,
    grad:   'linear-gradient(135deg,#0ea5e9,#0284c7)',
    border: 'rgba(14,165,233,0.30)',
    bg:     'rgba(14,165,233,0.07)',
    bar:    'linear-gradient(90deg,#0ea5e9,#38bdf8)',
    glow:   'rgba(14,165,233,0.10)',
  },
};

const DEFAULT_DURATION = 4200;
const MAX_TOASTS       = 5;

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─────────────────────────────────────────────
// SINGLE TOAST ITEM
// ─────────────────────────────────────────────

function ToastItem({
  t,
  onDismiss,
}: {
  t: Toast;
  onDismiss: (id: string) => void;
}) {
  const s        = STYLES[t.type];
  const duration = t.duration ?? DEFAULT_DURATION;

  const [visible,  setVisible]  = useState(false);
  const [exiting,  setExiting]  = useState(false);
  const [progress, setProgress] = useState(100);

  // Refs — fix for Code 2's double-interval bug
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const remainingRef = useRef(duration);   // ms still to go
  const startRef     = useRef(Date.now());
  const doneRef      = useRef(false);      // guard against double-dismiss

  // Trigger CSS exit then unmount
  const triggerExit = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearInterval(intervalRef.current!);
    setExiting(true);
    setTimeout(() => onDismiss(t.id), prefersReducedMotion ? 0 : 340);
  }, [onDismiss, t.id]);

  // Start (or resume) the countdown
  const startTick = useCallback(() => {
    clearInterval(intervalRef.current!);   // always clear first — prevents stacking
    startRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed      = Date.now() - startRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      startRef.current   = Date.now();

      setProgress(Math.max(0, (remainingRef.current / duration) * 100));

      if (remainingRef.current <= 0) {
        clearInterval(intervalRef.current!);
        triggerExit();
      }
    }, 40);
  }, [duration, triggerExit]);

  // Mount: entrance + start timer
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    startTick();
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(intervalRef.current!);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hover: pause by clearing interval (remainingRef keeps the value)
  const handleMouseEnter = () => clearInterval(intervalRef.current!);

  // Hover out: resume from exact remaining time
  const handleMouseLeave = () => {
    startRef.current = Date.now();
    startTick();
  };

  const isIn      = visible && !exiting;
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
        position:       'relative',
        display:        'flex',
        gap:            12,
        alignItems:     'flex-start',
        minWidth:       280,
        maxWidth:       360,
        padding:        '12px 14px 16px',
        borderRadius:   12,
        background:     'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:         `1px solid ${s.border}`,
        boxShadow:      '0 10px 30px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.06)',
        overflow:       'hidden',
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
          position:       'absolute',
          inset:          0,
          background:     `radial-gradient(ellipse 80px 80px at 28px 50%, ${s.glow}, transparent)`,
          pointerEvents:  'none',
        }}
      />

      {/* Icon badge — same 34×34 as Code 1, Lucide inside */}
      <div
        aria-hidden="true"
        style={{
          width:          34,
          height:         34,
          borderRadius:   10,
          background:     s.grad,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          color:          '#fff',
          flexShrink:     0,
          boxShadow:      `0 4px 12px ${s.border}`,
          position:       'relative',
          zIndex:         1,
        }}
      >
        {s.icon}
      </div>

      {/* Text — uses var(--text) and var(--muted) from Code 1's index.css */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontWeight:    600,
            fontSize:      '0.88rem',
            color:         'var(--text)',
            lineHeight:    1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {t.title}
        </div>
        {t.message && (
          <div
            style={{
              fontSize:   '0.78rem',
              color:      'var(--muted)',
              marginTop:  2,
              lineHeight: 1.5,
            }}
          >
            {t.message}
          </div>
        )}
      </div>

      {/* Dismiss — same style as Code 1 */}
      <button
        aria-label="Dismiss notification"
        onClick={triggerExit}
        style={{
          background:  'transparent',
          border:      'none',
          color:       'var(--muted)',
          cursor:      'pointer',
          padding:     '2px 3px',
          borderRadius: 5,
          display:     'flex',
          alignItems:  'center',
          position:    'relative',
          zIndex:      1,
          transition:  'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color       = 'var(--text)';
          e.currentTarget.style.background  = 'rgba(255,255,255,0.07)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color       = 'var(--muted)';
          e.currentTarget.style.background  = 'transparent';
        }}
      >
        <X size={15} />
      </button>

      {/* Progress bar */}
      <div
        aria-hidden="true"
        style={{
          position:     'absolute',
          bottom:       0,
          left:         0,
          right:        0,
          height:       3,
          background:   'rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            height:     '100%',
            width:      `${progress}%`,
            background: s.bar,
            transition: 'width 0.04s linear',
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PROVIDER  (same JSX shape as Code 1)
// ─────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, title, message }];
      // Drop oldest if over limit
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ✅ Exact same ctx shape as Code 1
  const ctx: ToastCtx = {
    toast: {
      success: (title, message) => push('success', title, message),
      error:   (title, message) => push('error',   title, message),
      warning: (title, message) => push('warning', title, message),
      info:    (title, message) => push('info',    title, message),
    },
  };

  return (
    <Ctx.Provider value={ctx}>
      {children}

      {/* Toast container — same position as Code 1 */}
      <div
        aria-label="Notifications"
        aria-live="polite"
        style={{
          position:       'fixed',
          top:            18,
          right:          18,
          display:        'flex',
          flexDirection:  'column',
          gap:            10,
          zIndex:         9999,
          pointerEvents:  'none',
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

// ─────────────────────────────────────────────
// HOOK  (identical signature to Code 1)
// ─────────────────────────────────────────────

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used inside ToastProvider');
  return c;
}
