// Shared Sidebar + Topbar wrapper — used by all 4 portals
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bell, ChevronLeft, User, Menu, X, Wifi, WifiOff } from 'lucide-react';
import { clearSession, getSession } from '../api';

// ── Backend health status indicator ───────────────────────────────────────────
function BackendStatus() {
    const [status, setStatus] = useState('checking'); // 'checking' | 'online' | 'offline'

    useEffect(() => {
        let cancelled = false;
        const check = async () => {
            if (cancelled) return;
            setStatus('checking');
            try {
                const res = await fetch('http://localhost:5001/api/health', { signal: AbortSignal.timeout(3000) });
                if (!cancelled) setStatus(res.ok ? 'online' : 'offline');
            } catch {
                if (!cancelled) setStatus('offline');
            }
        };
        check();
        const interval = setInterval(check, 30000); // Re-check every 30s
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const labels = { checking: 'Connecting…', online: 'Backend Online', offline: 'Backend Offline' };
    const cls    = { checking: 'status-checking', online: 'status-online', offline: 'status-offline' };

    return (
        <div className={`status-pill ${cls[status]}`} title={labels[status]}>
            <div className="status-dot" />
            <span className="status-label">{labels[status]}</span>
        </div>
    );
}

// ── Sidebar content — shared between desktop sidebar and mobile drawer ─────────
function SidebarContent({ brand, grad, navItems, activePage, onNav, onClose, user, hoverLogout, setHoverLogout, logout }) {
    return (
        <>
            {/* Brand */}
            <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="logo-icon" style={{ background: grad }}>{brand.icon}</div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', letterSpacing: '-0.2px' }}>{brand.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 1 }}>{brand.sub}</div>
                    </div>
                </div>
                {/* Close button — only shown in mobile drawer */}
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex', alignItems: 'center' }}
                        title="Close menu"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Nav */}
            <nav className="sidebar-nav">
                {navItems.map(({ key, label, Icon }) => (
                    <div
                        key={key}
                        className={`nav-item ${activePage === key ? 'active' : ''}`}
                        onClick={() => { onNav(key); onClose?.(); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && (onNav(key), onClose?.())}
                    >
                        <Icon size={16} />
                        <span>{label}</span>
                    </div>
                ))}
            </nav>

            {/* Footer — user chip + sign out */}
            <div className="sidebar-footer">
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 10, marginBottom: 8,
                    border: '1px solid var(--border)',
                }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: grad, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                    }}>
                        <User size={14} color="#fff" />
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {brand.sub || user?.email || 'User'}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 1 }}>{brand.role || 'Authenticated'}</div>
                    </div>
                </div>

                <button
                    className="btn btn-ghost"
                    style={{
                        width: '100%', justifyContent: 'flex-start', gap: 8, fontSize: '0.82rem',
                        color: hoverLogout ? 'var(--danger)' : 'var(--muted)',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={() => setHoverLogout(true)}
                    onMouseLeave={() => setHoverLogout(false)}
                    onClick={logout}
                >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                </button>
            </div>
        </>
    );
}

export default function Shell({ brand, grad, navItems, activePage, onNav, children, onBack, pageTitle }) {
    const navigate = useNavigate();
    const { user } = getSession();
    const [hoverLogout, setHoverLogout] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const logout = () => { clearSession(); navigate('/'); };

    // Derive page title from nav item label or explicit prop
    const currentLabel = pageTitle
        || navItems.find(n => n.key === activePage)?.label
        || brand.name;

    // Close drawer on Escape key
    React.useEffect(() => {
        if (!mobileOpen) return;
        const handler = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [mobileOpen]);

    const sidebarProps = { brand, grad, navItems, activePage, onNav, user, hoverLogout, setHoverLogout, logout };

    return (
        <div className="app-shell">
            {/* ── Desktop Sidebar ── */}
            <aside className="sidebar">
                <SidebarContent {...sidebarProps} />
            </aside>

            {/* ── Mobile Sidebar Drawer ── */}
            <div className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`} onClick={() => setMobileOpen(false)} />
            <div className={`sidebar-drawer ${mobileOpen ? 'open' : ''}`}>
                <SidebarContent {...sidebarProps} onClose={() => setMobileOpen(false)} />
            </div>

            {/* ── Right side: topbar + content ── */}
            <div className="portal-wrapper">
                {/* Top Navbar */}
                <header className="topbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Hamburger — visible on mobile only */}
                        <button
                            className="hamburger-btn"
                            onClick={() => setMobileOpen(true)}
                            title="Open menu"
                            aria-label="Open navigation menu"
                        >
                            <Menu size={18} />
                        </button>

                        {onBack && (
                            <button
                                className="btn btn-ghost btn-sm"
                                style={{ gap: 5, padding: '5px 10px' }}
                                onClick={onBack}
                            >
                                <ChevronLeft size={14} /> Back
                            </button>
                        )}
                        <span className="topbar-title">{currentLabel}</span>
                    </div>
                    <div className="topbar-actions">
                        {/* Backend status pill */}
                        <BackendStatus />

                        {/* Notification bell */}
                        <div className="notif-btn" title="Notifications">
                            <Bell size={15} />
                            <span className="notif-dot" />
                        </div>
                        {/* Role badge */}
                        <div style={{
                            padding: '5px 12px',
                            borderRadius: 8,
                            background: brand.role === 'Admin'         ? 'rgba(139,92,246,0.15)' :
                                        brand.role === 'Doctor'        ? 'rgba(245,158,11,0.15)' :
                                        brand.role === 'Patient'       ? 'rgba(6,182,212,0.15)'  :
                                                                         'rgba(16,185,129,0.15)',
                            color: brand.role === 'Admin'         ? '#c4b5fd' :
                                   brand.role === 'Doctor'        ? '#fcd34d' :
                                   brand.role === 'Patient'       ? '#67e8f9' :
                                                                    '#6ee7b7',
                            fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.3px',
                        }}>
                            {brand.role || 'User'}
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
