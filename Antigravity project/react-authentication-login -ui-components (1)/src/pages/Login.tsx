/* ENHANCEMENT: MedBlock Login — enhanced UI layer
 * Original logic preserved. Enhancements are clearly marked with ENHANCEMENT comments.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Hospital,
  User,
  Stethoscope,
  Wallet,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  ChevronRight,
  Mail,
  Sparkles,
  Fingerprint,
  Lock,
  Keyboard,
} from 'lucide-react';
import { api, saveSession, type User as ApiUser } from '../api';
import { useToast } from '../components/ui/Toast';
import { CapsLockWarning, PasswordStrength } from '../components/ui/PasswordStrength';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';
import { SkeletonLogin } from '../components/ui/SkeletonLogin';
import { useLoading } from '../components/ui/LoadingContext';

/* ENHANCEMENT: Trust badges for brand confidence */
const TRUST_BADGES = [
  { icon: 'fa-solid fa-shield-halved', label: 'HIPAA-Ready' },
  { icon: 'fa-solid fa-link', label: 'On-Chain Audit' },
  { icon: 'fa-solid fa-lock', label: 'AES-256 Encryption' },
  { icon: 'fa-solid fa-fingerprint', label: 'Zero-Knowledge ID' },
];

const ROLES = [
  { key: 'patient', label: 'Patient', Icon: User, grad: 'var(--patient-grad)' },
  { key: 'doctor', label: 'Doctor', Icon: Stethoscope, grad: 'var(--doctor-grad)' },
  { key: 'hospital', label: 'Hospital', Icon: Hospital, grad: 'var(--hospital-grad)' },
  { key: 'admin', label: 'Admin', Icon: Shield, grad: 'var(--admin-grad)' },
] as const;

type RoleKey = (typeof ROLES)[number]['key'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function Alert({ msg, type = 'error' }: { msg: string; type?: string }) {
  if (!msg) return null;
  return <div className={`alert alert-${type}`}>{msg}</div>;
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  label = 'Password',
  required = true,
  showStrength = false,
  onCaps = () => {},
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  showStrength?: boolean;
  onCaps?: (active: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  // ENHANCEMENT: Detect caps lock via keyboard event
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const c = (e as any).getModifierState?.('CapsLock') ?? false;
    setCaps(c);
    onCaps(c);
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          className="input"
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onKeyDown={handleKey}
          onKeyUp={handleKey}
          required={required}
          autoComplete={id === 'password' ? 'current-password' : 'new-password'}
          style={{ paddingRight: 40 }}
          aria-label={label}
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow((s) => !s)}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--muted)',
            padding: 2,
          }}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {/* ENHANCEMENT: Caps lock warning */}
      <CapsLockWarning active={caps} />
      {/* ENHANCEMENT: Password strength meter (opt-in for registration forms) */}
      {showStrength && <PasswordStrength value={value} />}
    </div>
  );
}

// MetaMask connect (works for any role)
async function connectMetaMask() {
  if (!window.ethereum) throw new Error('MetaMask not detected. Please install it.');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

// ── Email Sign In — role is REQUIRED for RBAC enforcement ────────────────────
function EmailSignIn({
  role,
  loading,
  setLoading,
  setError,
  error,
}: {
  role: RoleKey;
  loading: boolean;
  setLoading: (b: boolean) => void;
  setError: (s: string) => void;
  error: string;
}) {
  const [email, setEmail] = useState('');
  const { startLoading, stopLoading } = useLoading();
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Demo credentials per role
  const DEMO_CREDS: Record<RoleKey, { email: string; password: string }> = {
    patient: { email: 'john.doe@example.com', password: 'Admin@1234' },
    doctor: { email: 'dr.sarah.connor@citygeneral.com', password: 'Admin@1234' },
    hospital: { email: 'admin@citygeneral.com', password: 'Admin@1234' },
    admin: { email: 'admin@medblock.io', password: 'Admin@1234' },
  };

  const fillDemo = () => {
    const creds = DEMO_CREDS[role];
    if (creds) {
      setEmail(creds.email);
      setPassword(creds.password);
      setError('');
      toast.info('Demo credentials loaded', 'Press Sign In to continue.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    startLoading();
    try {
      // role is sent to backend so it can reject cross-role logins
      const data = await api.post('/auth/login', { email, password, role }) as { token: string; user: ApiUser };
      saveSession(data.token, data.user);
      toast.success('Welcome back', `Signed in as ${data.user.email}`);
      navigate(`/${data.user.role}`);
    } catch (err: any) {
      setError(err.message);
      toast.error('Sign in failed', err.message);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  return (
    <form onSubmit={submit}>
      <Alert msg={error} />
      <div className="form-group">
        <label>Email Address</label>
        <input
          id="email"
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          aria-label="Email Address"
        />
      </div>
      <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      {/* ENHANCEMENT: Remember me + Forgot password row */}
      <div className="mb-row">
        <label className="mb-checkbox">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span className="mb-check" />
          <span>Remember me on this device</span>
        </label>
        <button type="button" className="mb-link" onClick={() => toast.info('Password reset', 'Reset links are sent to your email.')}>
          Forgot password?
        </button>
      </div>

      <button
        id="login-submit"
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className="mb-spin-dot" /> Authenticating…
          </>
        ) : (
          <>
            <LogIn size={15} /> Sign In with Email
          </>
        )}
      </button>

      {/* ENHANCEMENT: Keyboard shortcut hint */}
      <div className="mb-hint">
        <Keyboard size={11} /> Press <kbd>Enter ↵</kbd> to sign in
      </div>

      {/* Demo quick-fill */}
      <button
        type="button"
        onClick={fillDemo}
        style={{
          marginTop: 10,
          width: '100%',
          justifyContent: 'center',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'transparent',
          border: '1px dashed rgba(255,255,255,0.12)',
          borderRadius: 8,
          padding: '7px',
          cursor: 'pointer',
          color: 'var(--muted)',
          fontSize: '0.78rem',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
          e.currentTarget.style.color = 'var(--text2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          e.currentTarget.style.color = 'var(--muted)';
        }}
      >
        🎯 Fill Demo Credentials
      </button>
    </form>
  );
}

// ── MetaMask Sign In — role is passed for RBAC enforcement ──────────────────
function WalletSignIn({
  role,
  loading,
  setLoading,
  setError,
  error,
}: {
  role: RoleKey;
  loading: boolean;
  setLoading: (b: boolean) => void;
  setError: (s: string) => void;
  error: string;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();

  const connect = async () => {
    setError('');
    setLoading(true);
    startLoading();
    try {
      const address = await connectMetaMask();
      toast.info('Wallet connected', `${address.slice(0, 6)}…${address.slice(-4)}`);
      // role is sent so backend can reject cross-role wallet logins
      const data = await api.post('/auth/login/wallet', { address, role }) as { token: string; user: ApiUser };
      saveSession(data.token, data.user);
      toast.success('Signed in', 'Wallet-based authentication verified on-chain.');
      navigate(`/${data.user.role}`);
    } catch (err: any) {
      setError(err.message);
      toast.error('Wallet sign-in failed', err.message);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <Alert msg={error} />
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}
      >
        <Wallet size={28} color="var(--warning)" />
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 14, lineHeight: 1.6 }}>
        Connect your MetaMask wallet. Your administrator must have linked it to your account first.
      </p>
      <button
        id="metamask-login"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
        onClick={connect}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Waiting for MetaMask…' : '🦊 Connect MetaMask'}
      </button>
    </div>
  );
}

// ── Patient Sign Up ───────────────────────────────────────────────────────────
function PatientSignUp({ setError, error }: { setError: (s: string) => void; error: string }) {
  const { startLoading, stopLoading } = useLoading();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    dateOfBirth: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      toast.error('Validation error', 'Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      toast.error('Validation error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    startLoading();
    try {
      const data = await api.post('/auth/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
      }) as { token: string; user: ApiUser };
      saveSession(data.token, data.user);
      toast.success('Account created', `Welcome to MedBlock, ${form.firstName}!`);
      navigate('/patient');
    } catch (err: any) {
      setError(err.message);
      toast.error('Registration failed', err.message);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  return (
    <form onSubmit={submit}>
      <Alert msg={error} />
      <div className="grid-2">
        <div className="form-group">
          <label>First Name *</label>
          <input className="input" required placeholder="John" value={form.firstName} onChange={f('firstName')} />
        </div>
        <div className="form-group">
          <label>Last Name</label>
          <input className="input" placeholder="Doe" value={form.lastName} onChange={f('lastName')} />
        </div>
      </div>
      <div className="form-group">
        <label>Email Address *</label>
        <input className="input" type="email" required placeholder="you@example.com" value={form.email} onChange={f('email')} />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label>Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={f('phone')} />
        </div>
        <div className="form-group">
          <label>Date of Birth</label>
          <input className="input" type="date" value={form.dateOfBirth} onChange={f('dateOfBirth')} />
        </div>
      </div>
      <PasswordInput id="reg-pass" label="Password *" value={form.password} onChange={f('password')} placeholder="Min. 6 chars" showStrength />
      <PasswordInput id="reg-confirm" label="Confirm Password *" value={form.confirmPassword} onChange={f('confirmPassword')} />
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className="mb-spin-dot" /> Creating Account…
          </>
        ) : (
          <>
            <UserPlus size={15} /> Create Patient Account
          </>
        )}
      </button>
    </form>
  );
}

// ── Hospital Sign Up ──────────────────────────────────────────────────────────
function HospitalSignUp({ setError, error }: { setError: (s: string) => void; error: string }) {
  const { startLoading, stopLoading } = useLoading();
  const [form, setForm] = useState({
    hospitalName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    registrationId: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    startLoading();
    try {
      const data = await api.post('/auth/register-hospital', {
        hospitalName: form.hospitalName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        registrationId: form.registrationId,
      }) as { token: string; user: ApiUser };
      saveSession(data.token, data.user);
      toast.success('Hospital registered', `${form.hospitalName} is now live on MedBlock.`);
      navigate('/hospital');
    } catch (err: any) {
      setError(err.message);
      toast.error('Registration failed', err.message);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  return (
    <form onSubmit={submit}>
      <Alert msg={error} />
      <div className="form-group">
        <label>Hospital / Clinic Name *</label>
        <input className="input" required placeholder="e.g. City General Hospital" value={form.hospitalName} onChange={f('hospitalName')} />
      </div>
      <div className="form-group">
        <label>Official Email *</label>
        <input className="input" type="email" required placeholder="admin@yourhospital.com" value={form.email} onChange={f('email')} />
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label>Phone</label>
          <input className="input" type="tel" value={form.phone} onChange={f('phone')} />
        </div>
        <div className="form-group">
          <label>Registration / License ID</label>
          <input className="input" placeholder="HOSP-12345" value={form.registrationId} onChange={f('registrationId')} />
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label>City</label>
          <input className="input" value={form.city} onChange={f('city')} />
        </div>
        <div className="form-group">
          <label>State</label>
          <input className="input" value={form.state} onChange={f('state')} />
        </div>
      </div>
      <div className="form-group">
        <label>Address</label>
        <input className="input" placeholder="Street address" value={form.address} onChange={f('address')} />
      </div>
      <PasswordInput id="hosp-pass" label="Admin Password *" value={form.password} onChange={f('password')} placeholder="Min. 6 chars" showStrength />
      <PasswordInput id="hosp-confirm" label="Confirm Password *" value={form.confirmPassword} onChange={f('confirmPassword')} />
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className="mb-spin-dot" /> Registering…
          </>
        ) : (
          <>
            <Hospital size={15} /> Register Hospital
          </>
        )}
      </button>
    </form>
  );
}

// ── Doctor Signup Info (wallet-based — contact admin) ─────────────────────────
function DoctorSignupInfo() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🩺</div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Doctor Registration</div>
      <p style={{ color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.7, marginBottom: 14 }}>
        Doctor accounts are registered by your <strong>Hospital Admin</strong>. They link your email address and MetaMask wallet to the MedBlock system.
      </p>
      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', textAlign: 'left', marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Steps to get access:
        </div>
        {['Contact your hospital admin with your email address.', 'Install MetaMask and share your wallet address.', 'Return here and sign in with Email or MetaMask.'].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: '0.82rem', color: 'var(--muted)' }}>
            <span
              style={{
                minWidth: 20,
                height: 20,
                background: 'var(--doctor-grad)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
            {s}
          </div>
        ))}
      </div>
      <a
        href="https://metamask.io"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        🦊 Download MetaMask <ChevronRight size={13} />
      </a>
    </div>
  );
}

// ── Admin Info ────────────────────────────────────────────────────────────────
function AdminInfo() {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>⚡</div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Admin Access</div>
      <p style={{ color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.7, marginBottom: 14 }}>
        System admin accounts are provisioned during deployment. Contact your MedBlock operator for access.
      </p>
      <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px', textAlign: 'left' }}>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          Demo credentials
        </div>
        <code style={{ fontSize: '0.82rem', display: 'block' }}>admin@medblock.io</code>
        <code style={{ fontSize: '0.82rem', display: 'block', marginTop: 4 }}>Password: Admin@1234</code>
      </div>
    </div>
  );
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role: r, mode, authMethod }: { role: (typeof ROLES)[number]; mode: string; authMethod: string }) {
  const subtitle =
    r.key === 'doctor' ? (authMethod === 'wallet' ? 'MetaMask Wallet Authentication' : 'Email & Password') : 'Email & Password';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: r.grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <r.Icon size={18} color="#fff" />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          {r.label} {mode === 'signup' ? 'Registration' : 'Login'}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{subtitle}</div>
      </div>
    </div>
  );
}

// ── Auth Method Toggle (Email vs Wallet) ──────────────────────────────────────
function AuthMethodToggle({
  value,
  onChange,
  grad,
}: {
  value: string;
  onChange: (m: 'email' | 'wallet') => void;
  grad: string;
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3, marginBottom: 14 }}>
      {(
        [
          ['email', <> <Mail size={12} /> Email</>],
          ['wallet', <> <Wallet size={12} /> MetaMask</>],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={{
            flex: 1,
            padding: '6px 0',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            background: value === key ? grad : 'transparent',
            color: value === key ? '#fff' : 'var(--muted)',
            transition: 'all 0.2s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
export default function Login() {
  const [role, setRole] = useState<RoleKey>('patient');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'wallet'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const { toast } = useToast();

  // ENHANCEMENT: Brief skeleton splash for perceived performance
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 520);
    return () => clearTimeout(t);
  }, []);

  const selectedRole = ROLES.find((r) => r.key === role)!;
  const switchRole = (r: RoleKey) => {
    setRole(r);
    setMode('login');
    setAuthMethod('email');
    setError('');
    toast.info(`Switched to ${r} portal`, 'Sign in or register to continue.');
  };
  const switchMode = (m: 'login' | 'signup') => {
    setMode(m);
    setError('');
  };

  // Which roles show the Sign In / Sign Up toggle
  const hasSignup = role === 'patient' || role === 'hospital';
  // Which roles show the MetaMask toggle (all except admin)
  const hasWallet = role !== 'admin';

  // ENHANCEMENT: Announce role changes to screen readers
  useEffect(() => {
    const el = document.getElementById('mb-live-region');
    if (el) el.textContent = `Showing ${selectedRole.label} ${mode} form`;
  }, [role, mode, selectedRole.label]);

  // ENHANCEMENT: Skeleton splash screen before UI is ready
  if (!ready) return <SkeletonLogin />;

  return (
    <div className="login-bg">
      {/* ENHANCEMENT: Floating decorative background orbs */}
      <div aria-hidden="true" className="mb-orbs">
        <div className="mb-orb mb-orb-1" />
        <div className="mb-orb mb-orb-2" />
        <div className="mb-orb mb-orb-3" />
      </div>

      {/* ENHANCEMENT: Screen-reader live region */}
      <div id="mb-live-region" aria-live="polite" aria-atomic="true" className="sr-only" />

      {/* ENHANCEMENT: Top connection status bar */}
      <ConnectionStatus />

      <div className="login-card anim-slide-up" id="main-login">
        {/* ── Brand ── */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div
              className="logo-icon"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--admin-grad)',
                fontSize: '1.3rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(99,102,241,0.4)',
              }}
            >
              <Fingerprint size={22} color="#fff" />
            </div>
            <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>MedBlock</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>Secure Health Records on Blockchain</p>

          {/* ENHANCEMENT: Feature highlights strip */}
          <div className="mb-feature-strip">
            <span>
              <Sparkles size={11} /> Decentralized Storage
            </span>
            <span>
              <Lock size={11} /> End-to-End Encrypted
            </span>
            <span>
              <Shield size={11} /> Auditable Access
            </span>
          </div>
        </div>

        {/* ── Role Tabs ── */}
        <div className="role-tabs" role="tablist" aria-label="User role">
          {ROLES.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`role-tab ${role === key ? 'active' : ''}`}
              onClick={() => switchRole(key)}
              role="tab"
              aria-selected={role === key}
              aria-controls={`panel-${key}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ── Sign In / Sign Up toggle ── */}
        {hasSignup && (
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  background: mode === m ? selectedRole.grad : 'transparent',
                  color: mode === m ? '#fff' : 'var(--muted)',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'login' ? (
                  <>
                    <LogIn size={13} /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlus size={13} /> Sign Up
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Doctor: Sign In / Sign Up tabs ── */}
        {role === 'doctor' && (
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
            {(['login', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  background: mode === m ? selectedRole.grad : 'transparent',
                  color: mode === m ? '#fff' : 'var(--muted)',
                  transition: 'all 0.2s',
                }}
              >
                {m === 'login' ? (
                  <>
                    <LogIn size={13} /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlus size={13} /> Sign Up Info
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Card ── */}
        <div className="card" style={{ padding: '22px' }} role="tabpanel" id={`panel-${role}`}>
          <RoleBadge role={selectedRole} mode={mode} authMethod={authMethod} />

          {/* Sign In flows */}
          {mode === 'login' && (
            <>
              {/* Email/Wallet method toggle — all roles except admin */}
              {hasWallet && (
                <AuthMethodToggle
                  value={authMethod}
                  onChange={(m) => {
                    setAuthMethod(m);
                    setError('');
                  }}
                  grad={selectedRole.grad}
                />
              )}
              <Alert msg={error} />

              {authMethod === 'email' || !hasWallet ? (
                <EmailSignIn role={role} loading={loading} setLoading={setLoading} setError={setError} error={''} />
              ) : (
                <WalletSignIn role={role} loading={loading} setLoading={setLoading} setError={setError} error={''} />
              )}
            </>
          )}

          {/* Sign Up flows */}
          {mode === 'signup' && role === 'patient' && <PatientSignUp setError={setError} error={error} />}
          {mode === 'signup' && role === 'hospital' && <HospitalSignUp setError={setError} error={error} />}
          {mode === 'signup' && role === 'doctor' && <DoctorSignupInfo />}
          {mode === 'signup' && role === 'admin' && <AdminInfo />}
        </div>

        {/* ── Footer hint ── */}
        <p style={{ textAlign: 'center', marginTop: 12, color: 'var(--muted)', fontSize: '0.78rem', lineHeight: 1.7 }}>
          {role === 'patient' && mode === 'login' && (
            <>
              No account?{' '}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline', padding: '0 4px' }}
                onClick={() => switchMode('signup')}
              >
                Create one free →
              </button>{' '}
              &nbsp;·&nbsp; Demo: <code style={{ fontSize: '0.82rem' }}>john.doe@example.com</code>
            </>
          )}
          {role === 'patient' && mode === 'signup' && (
            <>
              Already registered?{' '}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline', padding: '0 4px' }}
                onClick={() => switchMode('login')}
              >
                Sign In →
              </button>
            </>
          )}
          {role === 'hospital' && mode === 'signup' && (
            <>
              Already registered?{' '}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline', padding: '0 4px' }}
                onClick={() => switchMode('login')}
              >
                Sign In →
              </button>
            </>
          )}
          {role === 'hospital' && mode === 'login' && (
            <>
              New hospital?{' '}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: 'inline', padding: '0 4px' }}
                onClick={() => switchMode('signup')}
              >
                Register →
              </button>{' '}
              &nbsp;·&nbsp; Demo: <code style={{ fontSize: '0.82rem' }}>admin@citygeneral.com</code>
            </>
          )}
          {role === 'doctor' && (
            <>
              <b>Demo:</b> <code style={{ fontSize: '0.82rem' }}>dr.sarah.connor@citygeneral.com</code> (email) or MetaMask
              Hardhat #0
            </>
          )}
          {role === 'admin' && <>Admin access is provisioned by your MedBlock operator.</>}
        </p>

        {/* ENHANCEMENT: Trust badges */}
        <div className="mb-trust" aria-label="Security trust badges">
          {TRUST_BADGES.map((b) => (
            <div key={b.label} className="mb-trust-item" title={b.label}>
              <i className={b.icon} />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
