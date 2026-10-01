/**
 * MedBlock — ConnectionStatus (improved)
 * Same Code 1 style — inline styles, CSS vars, Lucide icons.
 *
 * Fixes over original:
 *  ✅ online/offline listeners always cleaned up (not just when MetaMask present)
 *  ✅ Loader2 spinner uses inline keyframes — no external .spin CSS needed
 *  ✅ Click address to copy (with confirmation flash)
 *  ✅ Animated pulse dot on each pill
 *  ✅ Pill colour changes per state (green / red / slate)
 *  ✅ Tooltip on account pill shows full address on hover
 */

import { useEffect, useRef, useState } from 'react';
import {
  Wifi, WifiOff, Wallet,
  Loader2, Activity, Blocks, Copy, Check,
} from 'lucide-react';

// ─── spin keyframe injected once ────────────────────────────────────────────
const SPIN_STYLE_ID = 'mb-spin-style';
if (typeof document !== 'undefined' && !document.getElementById(SPIN_STYLE_ID)) {
  const s = document.createElement('style');
  s.id = SPIN_STYLE_ID;
  s.textContent = `
    @keyframes mb-spin { to { transform: rotate(360deg); } }
    @keyframes mb-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .mb-spin  { animation: mb-spin  1s linear infinite; }
    .mb-pulse { animation: mb-pulse 1.8s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ─── types ───────────────────────────────────────────────────────────────────

type ChainStatus  = 'checking' | 'online' | 'offline';
type WalletStatus = 'not-installed' | 'disconnected' | 'connected';

interface NetworkState {
  chainStatus:  ChainStatus;
  walletStatus: WalletStatus;
  networkName:  string;
  account:      string | null;
  blockNumber:  number | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getNetworkName(chainId: string): string {
  const map: Record<string, string> = {
    '0x1':      'Ethereum',
    '0x89':     'Polygon',
    '0xaa36a7': 'Sepolia',
    '0x7a69':   'Hardhat',
    '0x539':    'Hardhat',
    '0x13881':  'Mumbai',
    '0xa86a':   'Avalanche',
    '0x38':     'BNB Chain',
    '0xa':      'Optimism',
    '0xa4b1':   'Arbitrum',
  };
  return map[chainId] ?? `Chain ${parseInt(chainId, 16)}`;
}

// Dot colours per state
const CHAIN_COLOR: Record<ChainStatus, string> = {
  checking: '#f59e0b',
  online:   '#10b981',
  offline:  '#ef4444',
};
const WALLET_COLOR: Record<WalletStatus, string> = {
  'connected':     '#10b981',
  'disconnected':  '#f59e0b',
  'not-installed': '#94a3b8',
};

// ─── StatusPill ──────────────────────────────────────────────────────────────

interface PillProps {
  children:  React.ReactNode;
  dotColor?: string;
  pulse?:    boolean;
  onClick?:  () => void;
  title?:    string;
}

function StatusPill({ children, dotColor, pulse, onClick, title }: PillProps) {
  return (
    <div
      title={title}
      onClick={onClick}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        padding:        '6px 11px',
        borderRadius:   999,
        background:     'rgba(15,23,42,0.88)',
        border:         '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        color:          '#e2e8f0',
        fontSize:       '0.74rem',
        fontWeight:     500,
        boxShadow:      '0 4px 20px rgba(0,0,0,0.28)',
        cursor:         onClick ? 'pointer' : 'default',
        userSelect:     'none',
        transition:     'background 0.15s',
        whiteSpace:     'nowrap',
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.background = 'rgba(30,41,59,0.95)';
      }}
      onMouseLeave={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.background = 'rgba(15,23,42,0.88)';
      }}
    >
      {/* Pulse dot */}
      {dotColor && (
        <span
          className={pulse ? 'mb-pulse' : undefined}
          style={{
            width:        7,
            height:       7,
            borderRadius: '50%',
            background:   dotColor,
            flexShrink:   0,
            display:      'inline-block',
          }}
        />
      )}
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ConnectionStatus() {
  const [state, setState] = useState<NetworkState>({
    chainStatus:  'checking',
    walletStatus: 'not-installed',
    networkName:  '',
    account:      null,
    blockNumber:  null,
  });

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── fetch blockchain info ──────────────────────────────────────────────────
  const updateBlockchainInfo = async () => {
    const ethereum = (window as any).ethereum;

    try {
      if (!navigator.onLine) {
        setState((prev) => ({ ...prev, chainStatus: 'offline' }));
        return;
      }

      if (!ethereum) {
        setState((prev) => ({
          ...prev,
          chainStatus:  'online',
          walletStatus: 'not-installed',
        }));
        return;
      }

      const [chainId, accounts] = await Promise.all([
        ethereum.request({ method: 'eth_chainId' }),
        ethereum.request({ method: 'eth_accounts' }),
      ]);

      let blockNumber: number | null = null;
      try {
        const raw = await ethereum.request({ method: 'eth_blockNumber' });
        blockNumber = parseInt(raw, 16);
      } catch { /* non-critical */ }

      setState({
        chainStatus:  'online',
        walletStatus: accounts.length ? 'connected' : 'disconnected',
        networkName:  getNetworkName(chainId),
        account:      accounts.length > 0 ? accounts[0] : null,
        blockNumber,
      });
    } catch {
      setState((prev) => ({ ...prev, chainStatus: 'offline' }));
    }
  };

  // ── copy address ──────────────────────────────────────────────────────────
  const copyAddress = () => {
    if (!state.account) return;
    navigator.clipboard.writeText(state.account).catch(() => {});
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  // ── effect ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ethereum = (window as any).ethereum;

    updateBlockchainInfo();

    const onlineHandler  = () => updateBlockchainInfo();
    const offlineHandler = () =>
      setState((prev) => ({ ...prev, chainStatus: 'offline' }));

    // Always register — fix for original bug where these leaked without MetaMask
    window.addEventListener('online',  onlineHandler);
    window.addEventListener('offline', offlineHandler);

    let interval: ReturnType<typeof setInterval> | null = null;

    const accountHandler = (accounts: string[]) => {
      setState((prev) => ({
        ...prev,
        walletStatus: accounts.length ? 'connected' : 'disconnected',
        account:      accounts.length > 0 ? accounts[0] : null,
      }));
    };
    const chainHandler = () => updateBlockchainInfo();

    if (ethereum) {
      ethereum.on?.('accountsChanged', accountHandler);
      ethereum.on?.('chainChanged',    chainHandler);
      interval = setInterval(updateBlockchainInfo, 15000);
    }

    // ── cleanup — always runs ───────────────────────────────────────────────
    return () => {
      window.removeEventListener('online',  onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      if (interval) clearInterval(interval);
      if (ethereum) {
        ethereum.removeListener?.('accountsChanged', accountHandler);
        ethereum.removeListener?.('chainChanged',    chainHandler);
      }
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const { chainStatus, walletStatus, networkName, account, blockNumber } = state;

  return (
    <div
      style={{
        position:   'fixed',
        bottom:     16,
        left:       16,
        zIndex:     9999,
        display:    'flex',
        flexWrap:   'wrap',
        gap:        8,
        maxWidth:   'calc(100vw - 32px)',
      }}
    >
      {/* ── Blockchain status ──────────────────────────────────────────────── */}
      <StatusPill
        dotColor={CHAIN_COLOR[chainStatus]}
        pulse={chainStatus === 'checking' || chainStatus === 'online'}
      >
        {chainStatus === 'checking' ? (
          <>
            <Loader2 size={12} className="mb-spin" />
            Syncing…
          </>
        ) : chainStatus === 'online' ? (
          <>
            <Wifi size={12} color="#10b981" />
            Blockchain Online
          </>
        ) : (
          <>
            <WifiOff size={12} color="#ef4444" />
            Offline
          </>
        )}
      </StatusPill>

      {/* ── Network name ───────────────────────────────────────────────────── */}
      {networkName && (
        <StatusPill dotColor="#818cf8">
          <Blocks size={12} />
          {networkName}
        </StatusPill>
      )}

      {/* ── Wallet status ──────────────────────────────────────────────────── */}
      <StatusPill
        dotColor={WALLET_COLOR[walletStatus]}
        pulse={walletStatus === 'connected'}
      >
        <Wallet size={12} color={WALLET_COLOR[walletStatus]} />
        {walletStatus === 'connected'
          ? 'Wallet Connected'
          : walletStatus === 'disconnected'
          ? 'MetaMask Available'
          : 'MetaMask Missing'}
      </StatusPill>

      {/* ── Block number ───────────────────────────────────────────────────── */}
      {blockNumber !== null && (
        <StatusPill dotColor="#94a3b8">
          <Activity size={12} />
          Block #{blockNumber.toLocaleString()}
        </StatusPill>
      )}

      {/* ── Account address — click to copy ───────────────────────────────── */}
      {account && (
        <StatusPill
          dotColor="#10b981"
          pulse
          onClick={copyAddress}
          title={account}
        >
          {copied
            ? <><Check size={12} color="#10b981" /> Copied!</>
            : <><Copy size={12} />{shortAddress(account)}</>
          }
        </StatusPill>
      )}
    </div>
  );
}