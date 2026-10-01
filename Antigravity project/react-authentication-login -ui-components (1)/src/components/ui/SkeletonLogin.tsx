/**
 * MedBlock — SkeletonLogin (improved)
 * Same Code 1 style — inline styles, CSS vars, no external dependencies.
 *
 * Improvements over original:
 *  ✅ Keyframes injected once — no external CSS needed
 *  ✅ Matches real Login layout exactly (logo, subtitle, role pills, inputs, button, divider, wallet btn, footer links)
 *  ✅ Staggered shimmer — each block animates slightly offset so it feels alive
 *  ✅ Pulse glow on card border — same aesthetic as the rest of MedBlock UI
 *  ✅ Trust badges row at the bottom (HIPAA / AES-256 / On-Chain / ZK-ID)
 *  ✅ aria-busy + aria-label for accessibility
 */

import React from 'react';

// ─── inject keyframes once ───────────────────────────────────────────────────
const STYLE_ID = 'mb-skeleton-style';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes mb-shimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
    @keyframes mb-card-pulse {
      0%, 100% { box-shadow: 0 0 0 1px rgba(99,102,241,0.10), 0 24px 64px rgba(0,0,0,0.55); }
      50%       { box-shadow: 0 0 0 1px rgba(99,102,241,0.22), 0 24px 64px rgba(0,0,0,0.55); }
    }
  `;
  document.head.appendChild(s);
}

// ─── shimmer block factory ───────────────────────────────────────────────────
// `delay` staggers each block so they don't all pulse in sync
function shimmerStyle(
  width: string | number,
  height: number,
  delay = 0,
  borderRadius = 8,
): React.CSSProperties {
  return {
    width,
    height,
    borderRadius,
    flexShrink: 0,
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.03) 100%)',
    backgroundSize: '200% 100%',
    animation: `mb-shimmer 1.6s ease-in-out ${delay}s infinite`,
  };
}

// ─── tiny sub-components ─────────────────────────────────────────────────────

function Row({
  children,
  gap = 8,
  mb = 0,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  mb?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', gap, marginBottom: mb, ...style }}>
      {children}
    </div>
  );
}

function Block(props: React.CSSProperties & { delay?: number }) {
  const { delay = 0, ...rest } = props;
  return (
    <div
      style={shimmerStyle(
        (rest.width as string | number) ?? '100%',
        (rest.height as number) ?? 36,
        delay,
        (rest.borderRadius as number) ?? 8,
      )}
    />
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function SkeletonLogin() {
  return (
    <div
      className="login-bg"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading login form"
      style={{
        minHeight:      '100vh',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 16px',
      }}
    >
      <div
        style={{
          width:          '100%',
          maxWidth:       460,
          borderRadius:   20,
          background:     'rgba(15,21,38,0.88)',
          border:         '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding:        '28px 28px 24px',
          animation:      'mb-card-pulse 3s ease-in-out infinite',
        }}
      >

        {/* ── Logo + subtitle ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 22, gap: 8 }}>
          {/* Icon circle */}
          <div style={shimmerStyle(44, 44, 0, 12)} />
          {/* Brand name */}
          <div style={shimmerStyle(120, 22, 0.05, 6)} />
          {/* Tagline */}
          <div style={shimmerStyle(180, 13, 0.1, 4)} />
        </div>

        {/* ── Role selector — 4 pills ─────────────────────────────────────── */}
        <div
          style={{
            display:               'grid',
            gridTemplateColumns:   'repeat(4, 1fr)',
            gap:                   6,
            marginBottom:          18,
            padding:               6,
            borderRadius:          12,
            background:            'rgba(255,255,255,0.03)',
            border:                '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={shimmerStyle('100%', 36, i * 0.07, 8)} />
          ))}
        </div>

        {/* ── First + Last name row (register mode) ───────────────────────── */}
        <Row gap={8} mb={12}>
          <div style={shimmerStyle('50%', 44, 0.10, 10)} />
          <div style={shimmerStyle('50%', 44, 0.15, 10)} />
        </Row>

        {/* ── Email input ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 12 }}>
          <div style={shimmerStyle('100%', 44, 0.12, 10)} />
        </div>

        {/* ── Password input ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 10 }}>
          <div style={shimmerStyle('100%', 44, 0.16, 10)} />
        </div>

        {/* ── Password strength bar ───────────────────────────────────────── */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={shimmerStyle('25%', 4, 0.18 + i * 0.04, 99)} />
          ))}
        </div>

        {/* ── Sign in button ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 14 }}>
          <div style={shimmerStyle('100%', 46, 0.20, 12)} />
        </div>

        {/* ── Divider: "or continue with" ─────────────────────────────────── */}
        <Row gap={10} mb={14} style={{ alignItems: 'center' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }} />
          <div style={shimmerStyle(110, 12, 0.22, 4)} />
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }} />
        </Row>

        {/* ── Wallet connect button ───────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div style={shimmerStyle('100%', 42, 0.24, 12)} />
        </div>

        {/* ── Footer links: forgot / register ─────────────────────────────── */}
        <Row gap={8} mb={18} style={{ justifyContent: 'space-between' }}>
          <div style={shimmerStyle(110, 12, 0.26, 4)} />
          <div style={shimmerStyle(130, 12, 0.28, 4)} />
        </Row>

        {/* ── Trust badges row ─────────────────────────────────────────────── */}
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap:                 6,
            paddingTop:          16,
            borderTop:           '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            5,
              }}
            >
              <div style={shimmerStyle(20, 20, 0.30 + i * 0.05, 6)} />
              <div style={shimmerStyle('80%', 10, 0.32 + i * 0.05, 4)} />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}