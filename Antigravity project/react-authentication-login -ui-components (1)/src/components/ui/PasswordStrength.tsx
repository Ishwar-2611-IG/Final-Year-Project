/* ENHANCEMENT: Password Strength Meter
 * Shows a 4-step bar + tips based on length, chars, mixed case, digits.
 * Non-blocking — purely visual.
 */
import { useMemo } from 'react';
import { Check, X, ShieldAlert } from 'lucide-react';

function score(p: string) {
  let s = 0;
  const checks = {
    length: p.length >= 8,
    lower: /[a-z]/.test(p),
    upper: /[A-Z]/.test(p),
    digit: /\d/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
  };
  if (checks.length) s++;
  if (checks.lower && checks.upper) s++;
  if (checks.digit) s++;
  if (checks.special) s++;
  return { s: Math.min(4, s), checks };
}

const LABELS = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
const COLORS = ['#ef4444', '#f59e0b', '#eab308', '#10b981'];

export function PasswordStrength({ value }: { value: string }) {
  const { s, checks } = useMemo(() => score(value || ''), [value]);
  if (!value) return null;

  return (
    <div className="pw-strength" style={{ marginTop: 8 }}>
      {/* ENHANCEMENT: Strength bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              background: i < s ? COLORS[s - 1] : 'var(--surface2)',
              transition: 'background 0.3s, transform 0.3s',
              transform: i < s ? 'scaleY(1)' : 'scaleY(0.7)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
        <span style={{ color: 'var(--muted)' }}>Strength:</span>
        <span style={{ color: s > 0 ? COLORS[s - 1] : 'var(--muted)', fontWeight: 600 }}>
          {s > 0 ? LABELS[s] : 'Too short'}
        </span>
      </div>
      {/* ENHANCEMENT: Tips */}
      <div className="pw-tips" style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px' }}>
        {[
          ['8+ chars', checks.length],
          ['Upper & lower', checks.lower && checks.upper],
          ['Number', checks.digit],
          ['Special char', checks.special],
        ].map(([label, ok]) => (
          <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: ok ? '#10b981' : 'var(--muted)' }}>
            {ok ? <Check size={11} /> : <X size={11} />}
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ENHANCEMENT: Caps Lock indicator — warns when typing in caps */
export function CapsLockWarning({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div
      role="alert"
      className="caps-warn"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        padding: '6px 10px',
        borderRadius: 8,
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.25)',
        fontSize: '0.75rem',
        color: '#fbbf24',
      }}
    >
      <ShieldAlert size={13} /> Caps Lock is on — passwords are case-sensitive
    </div>
  );
}
