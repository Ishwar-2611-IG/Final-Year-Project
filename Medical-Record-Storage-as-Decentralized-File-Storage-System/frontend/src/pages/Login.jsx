import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  AlertCircle,
  Info,
} from "lucide-react";
import { api, saveSession } from "../api";

const ROLES = [
  { key: "patient", label: "Patient", Icon: User, grad: "var(--patient-grad)" },
  {
    key: "doctor",
    label: "Doctor",
    Icon: Stethoscope,
    grad: "var(--doctor-grad)",
  },
  {
    key: "hospital",
    label: "Hospital",
    Icon: Hospital,
    grad: "var(--hospital-grad)",
  },
  { key: "admin", label: "Admin", Icon: Shield, grad: "var(--admin-grad)" },
];

// Roles that allow self-service account creation.
// Doctor and Admin are provisioned by an admin/operator instead.
const SIGNUP_ENABLED_ROLES = new Set(["patient", "hospital"]);
// Roles that support MetaMask wallet sign-in.
const WALLET_ENABLED_ROLES = new Set(["patient", "doctor", "hospital"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Helpers ───────────────────────────────────────────────────────────────────
function Alert({ msg, type = "error" }) {
  if (!msg) return null;
  return (
    <div
      className={`alert alert-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <AlertCircle size={14} style={{ flexShrink: 0 }} />{" "}
      <span> {msg} </span>{" "}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder = "••••••••",
  label = "Password",
  required = true,
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      <label htmlFor={id}> {label} </label>{" "}
      <div style={{ position: "relative" }}>
        <input
          id={id}
          className="input"
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={
            id.includes("confirm") ? "new-password" : "current-password"
          }
          minLength={required ? 6 : undefined}
          style={{ paddingRight: 40 }}
        />{" "}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted)",
            padding: 2,
          }}
        >
          {" "}
          {show ? <EyeOff size={15} /> : <Eye size={15} />}{" "}
        </button>{" "}
      </div>{" "}
    </div>
  );
}

// MetaMask connect (works for any role). Surfaces specific, actionable
// messages for the errors people actually hit in the wild.
async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask not detected. Please install the extension and refresh this page.",
    );
  }
  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    if (!accounts || accounts.length === 0) {
      throw new Error(
        "No wallet account was returned. Please unlock MetaMask and try again.",
      );
    }
    return accounts[0];
  } catch (err) {
    if (err.code === 4001) {
      throw new Error(
        "Connection request was rejected. Approve the MetaMask prompt to sign in.",
      );
    }
    if (err.code === -32002) {
      throw new Error(
        "A MetaMask connection request is already pending — open the MetaMask extension to approve it.",
      );
    }
    throw new Error(err.message || "Could not connect to MetaMask.");
  }
}

// ── Email Sign In — role is REQUIRED for RBAC enforcement ────────────────────
// Error display is owned entirely by the parent (Login); this component never
// renders its own Alert, so there is exactly one place an error can appear.
function EmailSignIn({ role, loading, setLoading, setError, requestIdRef }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();

    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);
    const myRequestId = ++requestIdRef.current;
    try {
      // role is sent to backend so it can reject cross-role logins
      const data = await api.post("/auth/login", { email, password, role });
      // Ignore stale responses if the user switched role/mode while this was in flight
      if (myRequestId !== requestIdRef.current) return;
      saveSession(data.token, data.user);
      navigate(`/${data.user.role}`);
    } catch (err) {
      if (myRequestId !== requestIdRef.current) return;
      setError(err.message || "Sign in failed. Please try again.");
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-group">
        <label htmlFor="email"> Email Address </label>{" "}
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>{" "}
      <PasswordInput
        id="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />{" "}
      <button
        id="login-submit"
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", padding: "11px" }}
        disabled={loading}
      >
        {" "}
        {loading ? (
          "Authenticating…"
        ) : (
          <>
            {" "}
            <LogIn size={15} /> Sign In with Email
          </>
        )}{" "}
      </button>{" "}
    </form>
  );
}

// ── MetaMask Sign In — role is passed for RBAC enforcement ──────────────────
function WalletSignIn({ role, loading, setLoading, setError, requestIdRef }) {
  const navigate = useNavigate();

  const connect = async () => {
    setError("");
    setLoading(true);
    const myRequestId = ++requestIdRef.current;
    try {
      const address = await connectMetaMask();
      // role is sent so backend can reject cross-role wallet logins
      const data = await api.post("/auth/login/wallet", { address, role });
      if (myRequestId !== requestIdRef.current) return;
      saveSession(data.token, data.user);
      navigate(`/${data.user.role}`);
    } catch (err) {
      if (myRequestId !== requestIdRef.current) return;
      setError(err.message || "Wallet sign in failed. Please try again.");
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "rgba(245,158,11,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        <Wallet size={28} color="var(--warning)" />
      </div>{" "}
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.85rem",
          marginBottom: 14,
          lineHeight: 1.6,
        }}
      >
        Connect your MetaMask wallet.Your administrator must have linked it to
        your account first.{" "}
      </p>{" "}
      <button
        id="metamask-login"
        type="button"
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", padding: "11px" }}
        onClick={connect}
        disabled={loading}
      >
        {" "}
        {loading ? "Waiting for MetaMask…" : "🦊 Connect MetaMask"}{" "}
      </button>{" "}
    </div>
  );
}

// ── Patient Sign Up ───────────────────────────────────────────────────────────
function PatientSignUp({ loading, setLoading, setError, requestIdRef }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    dateOfBirth: "",
  });
  const navigate = useNavigate();
  const f = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!EMAIL_RE.test(form.email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);
    const myRequestId = ++requestIdRef.current;
    try {
      const data = await api.post("/auth/register", {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        dateOfBirth: form.dateOfBirth,
      });
      if (myRequestId !== requestIdRef.current) return;
      saveSession(data.token, data.user);
      navigate("/patient");
    } catch (err) {
      if (myRequestId !== requestIdRef.current) return;
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid-2">
        <div className="form-group">
          {" "}
          <label htmlFor="p-fn"> First Name * </label>
          <input
            id="p-fn"
            className="input"
            required
            placeholder="John"
            value={form.firstName}
            onChange={f("firstName")}
          />{" "}
        </div>{" "}
        <div className="form-group">
          {" "}
          <label htmlFor="p-ln"> Last Name </label>
          <input
            id="p-ln"
            className="input"
            placeholder="Doe"
            value={form.lastName}
            onChange={f("lastName")}
          />{" "}
        </div>{" "}
      </div>{" "}
      <div className="form-group">
        {" "}
        <label htmlFor="p-email"> Email Address * </label>
        <input
          id="p-email"
          className="input"
          type="email"
          required
          placeholder="you@example.com"
          value={form.email}
          onChange={f("email")}
        />{" "}
      </div>{" "}
      <div className="grid-2">
        <div className="form-group">
          {" "}
          <label htmlFor="p-phone"> Phone </label>
          <input
            id="p-phone"
            className="input"
            type="tel"
            value={form.phone}
            onChange={f("phone")}
          />{" "}
        </div>{" "}
        <div className="form-group">
          {" "}
          <label htmlFor="p-dob"> Date of Birth </label>
          <input
            id="p-dob"
            className="input"
            type="date"
            max={new Date().toISOString().split("T")[0]}
            value={form.dateOfBirth}
            onChange={f("dateOfBirth")}
          />{" "}
        </div>{" "}
      </div>{" "}
      <PasswordInput
        id="reg-pass"
        label="Password *"
        value={form.password}
        onChange={f("password")}
        placeholder="Min. 6 chars"
      />
      <PasswordInput
        id="reg-confirm"
        label="Confirm Password *"
        value={form.confirmPassword}
        onChange={f("confirmPassword")}
      />{" "}
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", padding: "11px" }}
        disabled={loading}
      >
        {" "}
        {loading ? (
          "Creating Account…"
        ) : (
          <>
            {" "}
            <UserPlus size={15} /> Create Patient Account
          </>
        )}{" "}
      </button>{" "}
    </form>
  );
}

// ── Hospital Sign Up ──────────────────────────────────────────────────────────
function HospitalSignUp({ loading, setLoading, setError, requestIdRef }) {
  const [form, setForm] = useState({
    hospitalName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    registrationId: "",
  });
  const navigate = useNavigate();
  const f = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.hospitalName.trim()) {
      setError("Hospital / clinic name is required.");
      return;
    }
    if (!EMAIL_RE.test(form.email)) {
      setError("Enter a valid official email address.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);
    const myRequestId = ++requestIdRef.current;
    try {
      const data = await api.post("/auth/register-hospital", {
        hospitalName: form.hospitalName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        registrationId: form.registrationId,
      });
      if (myRequestId !== requestIdRef.current) return;
      saveSession(data.token, data.user);
      navigate("/hospital");
    } catch (err) {
      if (myRequestId !== requestIdRef.current) return;
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="form-group">
        {" "}
        <label htmlFor="h-name"> Hospital / Clinic Name * </label>
        <input
          id="h-name"
          className="input"
          required
          placeholder="e.g. City General Hospital"
          value={form.hospitalName}
          onChange={f("hospitalName")}
        />{" "}
      </div>{" "}
      <div className="form-group">
        {" "}
        <label htmlFor="h-email"> Official Email * </label>
        <input
          id="h-email"
          className="input"
          type="email"
          required
          placeholder="admin@yourhospital.com"
          value={form.email}
          onChange={f("email")}
        />{" "}
      </div>{" "}
      <div className="grid-2">
        <div className="form-group">
          {" "}
          <label htmlFor="h-phone"> Phone </label>
          <input
            id="h-phone"
            className="input"
            type="tel"
            value={form.phone}
            onChange={f("phone")}
          />{" "}
        </div>{" "}
        <div className="form-group">
          {" "}
          <label htmlFor="h-reg"> Registration / License ID </label>
          <input
            id="h-reg"
            className="input"
            placeholder="HOSP-12345"
            value={form.registrationId}
            onChange={f("registrationId")}
          />{" "}
        </div>{" "}
      </div>{" "}
      <div className="grid-2">
        <div className="form-group">
          {" "}
          <label htmlFor="h-city"> City </label>
          <input
            id="h-city"
            className="input"
            value={form.city}
            onChange={f("city")}
          />{" "}
        </div>{" "}
        <div className="form-group">
          {" "}
          <label htmlFor="h-state"> State </label>
          <input
            id="h-state"
            className="input"
            value={form.state}
            onChange={f("state")}
          />{" "}
        </div>{" "}
      </div>{" "}
      <div className="form-group">
        {" "}
        <label htmlFor="h-addr"> Address </label>
        <input
          id="h-addr"
          className="input"
          placeholder="Street address"
          value={form.address}
          onChange={f("address")}
        />{" "}
      </div>{" "}
      <PasswordInput
        id="hosp-pass"
        label="Admin Password *"
        value={form.password}
        onChange={f("password")}
        placeholder="Min. 6 chars"
      />
      <PasswordInput
        id="hosp-confirm"
        label="Confirm Password *"
        value={form.confirmPassword}
        onChange={f("confirmPassword")}
      />{" "}
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%", justifyContent: "center", padding: "11px" }}
        disabled={loading}
      >
        {" "}
        {loading ? (
          "Registering…"
        ) : (
          <>
            {" "}
            <Hospital size={15} /> Register Hospital
          </>
        )}{" "}
      </button>{" "}
    </form>
  );
}

// ── Doctor Signup Info (wallet-based — contact admin) ─────────────────────────
function DoctorSignupInfo() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 10 }}> 🩺 </div>{" "}
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        {" "}
        Doctor Registration{" "}
      </div>{" "}
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.86rem",
          lineHeight: 1.7,
          marginBottom: 14,
        }}
      >
        Doctor accounts are registered by your <strong> Hospital Admin </strong>
        . They link your email address and MetaMask wallet to the MedBlock
        system.{" "}
      </p>{" "}
      <div
        style={{
          background: "var(--surface2)",
          borderRadius: 10,
          padding: "14px 16px",
          textAlign: "left",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          {" "}
          Steps to get access:{" "}
        </div>{" "}
        {[
          "Contact your hospital admin with your email address.",
          "Install MetaMask and share your wallet address.",
          "Return here and sign in with Email or MetaMask.",
        ].map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 8,
              fontSize: "0.82rem",
              color: "var(--muted)",
            }}
          >
            <span
              style={{
                minWidth: 20,
                height: 20,
                background: "var(--doctor-grad)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {" "}
              {i + 1}{" "}
            </span>{" "}
            {s}{" "}
          </div>
        ))}{" "}
      </div>{" "}
      <a
        href="https://metamask.io"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost"
        style={{ width: "100%", justifyContent: "center" }}
      >
        {" "}
        🦊Download MetaMask <ChevronRight size={13} />{" "}
      </a>{" "}
    </div>
  );
}

// ── Admin Info ────────────────────────────────────────────────────────────────
function AdminInfo() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 10 }}> ⚡ </div>{" "}
      <div style={{ fontWeight: 600, marginBottom: 8 }}> Admin Access </div>{" "}
      <p
        style={{
          color: "var(--muted)",
          fontSize: "0.86rem",
          lineHeight: 1.7,
          marginBottom: 14,
        }}
      >
        System admin accounts are provisioned during deployment.Contact your
        MedBlock operator for access.{" "}
      </p>{" "}
      <div
        style={{
          background: "var(--surface2)",
          border: "1px dashed var(--warning)",
          borderRadius: 10,
          padding: "12px 16px",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.72rem",
            color: "var(--warning)",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 6,
            fontWeight: 700,
          }}
        >
          <Info size={12} /> Sandbox demo only — do not use in production{" "}
        </div>{" "}
        <code style={{ fontSize: "0.82rem", display: "block" }}>
          {" "}
          admin @medblock.io{" "}
        </code>{" "}
        <code style={{ fontSize: "0.82rem", display: "block", marginTop: 4 }}>
          {" "}
          Password: Admin @1234{" "}
        </code>{" "}
      </div>{" "}
    </div>
  );
}

// ── RoleBadge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role: r, mode, authMethod }) {
  const subtitle =
    r.key === "doctor"
      ? authMethod === "wallet"
        ? "MetaMask Wallet Authentication"
        : "Email & Password"
      : "Email & Password";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: r.grad,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <r.Icon size={18} color="#fff" />
      </div>{" "}
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
          {" "}
          {r.label} {mode === "signup" ? "Registration" : "Login"}{" "}
        </div>{" "}
        <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          {" "}
          {subtitle}{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}

// ── Auth Method Toggle (Email vs Wallet) ──────────────────────────────────────
function AuthMethodToggle({ value, onChange, grad, disabled }) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--surface2)",
        borderRadius: 8,
        padding: 3,
        marginBottom: 14,
      }}
    >
      {" "}
      {[
        [
          "email",
          <>
            {" "}
            <Mail size={12} /> Email
          </>,
        ],
        [
          "wallet",
          <>
            {" "}
            <Wallet size={12} /> MetaMask
          </>,
        ],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(key)}
          style={{
            flex: 1,
            padding: "6px 0",
            borderRadius: 6,
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "0.8rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            background: value === key ? grad : "transparent",
            color: value === key ? "#fff" : "var(--muted)",
            opacity: disabled ? 0.6 : 1,
            transition: "all 0.2s",
          }}
        >
          {" "}
          {label}{" "}
        </button>
      ))}{" "}
    </div>
  );
}

// ── Generic Sign In / Sign Up segmented toggle ────────────────────────────────
// Used by both the standard roles and the doctor role (which shows "Sign Up Info"
// instead of "Sign Up"), so the markup only exists once.
function ModeToggle({
  mode,
  onChange,
  grad,
  disabled,
  signupLabel = "Sign Up",
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--surface2)",
        borderRadius: 10,
        padding: 3,
        marginBottom: 14,
      }}
    >
      {" "}
      {["login", "signup"].map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          style={{
            flex: 1,
            padding: "7px 0",
            borderRadius: 8,
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: "0.84rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            background: mode === m ? grad : "transparent",
            color: mode === m ? "#fff" : "var(--muted)",
            opacity: disabled ? 0.6 : 1,
            transition: "all 0.2s",
          }}
        >
          {" "}
          {m === "login" ? (
            <>
              {" "}
              <LogIn size={13} /> Sign In
            </>
          ) : (
            <>
              {" "}
              <UserPlus size={13} /> {signupLabel}
            </>
          )}{" "}
        </button>
      ))}{" "}
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
export default function Login() {
  const [role, setRole] = useState("patient");
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [authMethod, setAuthMethod] = useState("email"); // 'email' | 'wallet'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Monotonically increasing id used to ignore stale async responses —
  // e.g. if a user fires a slow login request, then switches role before
  // it resolves, the late response is discarded instead of redirecting
  // them to the wrong dashboard or showing a stale error.
  const requestIdRef = useRef(0);

  const selectedRole = ROLES.find((r) => r.key === role);

  const switchRole = (r) => {
    requestIdRef.current++; // invalidate any in-flight request
    setRole(r);
    setMode("login");
    setAuthMethod("email");
    setError("");
    setLoading(false);
  };

  const switchMode = (m) => {
    requestIdRef.current++; // invalidate any in-flight request
    setMode(m);
    setError("");
    setLoading(false);
  };

  const switchAuthMethod = (m) => {
    requestIdRef.current++;
    setAuthMethod(m);
    setError("");
    setLoading(false);
  };

  // Clear any leftover error when the underlying form changes shape
  useEffect(() => {
    setError("");
  }, [role, mode, authMethod]);

  const hasSignup = SIGNUP_ENABLED_ROLES.has(role);
  const hasWallet = WALLET_ENABLED_ROLES.has(role);

  const sharedFormProps = { loading, setLoading, setError, requestIdRef };

  return (
    <div className="login-bg">
      <div className="login-card anim-slide-up">
        {" "}
        {/* ── Brand ── */}{" "}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div
              className="logo-icon"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "var(--admin-grad)",
                fontSize: "1.3rem",
              }}
            >
              {" "}
              M{" "}
            </div>{" "}
            <span style={{ fontSize: "1.6rem", fontWeight: 700 }}>
              {" "}
              MedBlock{" "}
            </span>{" "}
          </div>{" "}
          <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
            {" "}
            Secure Health Records on Blockchain{" "}
          </p>{" "}
        </div>
        {/* ── Role Tabs ── */}{" "}
        <div className="role-tabs" role="tablist" aria-label="Account type">
          {" "}
          {ROLES.map(({ key, label, Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={role === key}
              className={`role-tab ${role === key ? "active" : ""}`}
              onClick={() => switchRole(key)}
            >
              <Icon size={13} /> {label}{" "}
            </button>
          ))}{" "}
        </div>
        {/* ── Sign In / Sign Up toggle ── */}{" "}
        {/* Patient & Hospital get a real signup flow; Doctor gets an info panel
                                    explaining why there's no self-signup, with matching but distinct copy. */}{" "}
        {hasSignup && (
          <ModeToggle
            mode={mode}
            onChange={switchMode}
            grad={selectedRole.grad}
            disabled={loading}
          />
        )}{" "}
        {role === "doctor" && (
          <ModeToggle
            mode={mode}
            onChange={switchMode}
            grad={selectedRole.grad}
            disabled={loading}
            signupLabel="Sign Up Info"
          />
        )}
        {/* ── Card ── */}{" "}
        <div className="card" style={{ padding: "22px" }}>
          <RoleBadge role={selectedRole} mode={mode} authMethod={authMethod} />
          {/* Single source of truth for the error/notice banner — every
                                        auth form below reports into this via setError, none of them
                                        render their own Alert. */}{" "}
          <Alert msg={error} />
          {/* Sign In flows */}{" "}
          {mode === "login" && (
            <>
              {" "}
              {hasWallet && (
                <AuthMethodToggle
                  value={authMethod}
                  onChange={switchAuthMethod}
                  grad={selectedRole.grad}
                  disabled={loading}
                />
              )}
              {authMethod === "email" || !hasWallet ? (
                <EmailSignIn role={role} {...sharedFormProps} />
              ) : (
                <WalletSignIn role={role} {...sharedFormProps} />
              )}{" "}
            </>
          )}
          {/* Sign Up flows */}{" "}
          {mode === "signup" && role === "patient" && (
            <PatientSignUp {...sharedFormProps} />
          )}{" "}
          {mode === "signup" && role === "hospital" && (
            <HospitalSignUp {...sharedFormProps} />
          )}{" "}
          {mode === "signup" && role === "doctor" && <DoctorSignupInfo />}{" "}
          {mode === "signup" && role === "admin" && <AdminInfo />}{" "}
        </div>
        {/* ── Footer hint ── */}{" "}
        <p
          style={{
            textAlign: "center",
            marginTop: 12,
            color: "var(--muted)",
            fontSize: "0.78rem",
            lineHeight: 1.7,
          }}
        >
          {" "}
          {role === "patient" && mode === "login" && (
            <>
              {" "}
              No account ?{" "}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: "inline", padding: "0 4px" }}
                onClick={() => switchMode("signup")}
              >
                {" "}
                Create one free→{" "}
              </button>{" "}
              &nbsp;·&nbsp; Demo:{" "}
              <code style={{ fontSize: "0.82rem" }}>
                john.doe@example.com
              </code>{" "}
            </>
          )}{" "}
          {role === "patient" && mode === "signup" && (
            <>
              {" "}
              Already registered ?{" "}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: "inline", padding: "0 4px" }}
                onClick={() => switchMode("login")}
              >
                {" "}
                Sign In→{" "}
              </button>
            </>
          )}{" "}
          {role === "hospital" && mode === "signup" && (
            <>
              {" "}
              Already registered ?{" "}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: "inline", padding: "0 4px" }}
                onClick={() => switchMode("login")}
              >
                {" "}
                Sign In→{" "}
              </button>
            </>
          )}{" "}
          {role === "hospital" && mode === "login" && (
            <>
              {" "}
              New hospital ?{" "}
              <button
                className="btn btn-ghost btn-sm"
                style={{ display: "inline", padding: "0 4px" }}
                onClick={() => switchMode("signup")}
              >
                {" "}
                Register→{" "}
              </button>{" "}
              &nbsp;·&nbsp; Demo:{" "}
              <code style={{ fontSize: "0.82rem" }}>
                admin@citygeneral.com
              </code>{" "}
            </>
          )}{" "}
          {role === "doctor" && mode === "login" && (
            <>
              {" "}
              <b> Demo: </b>{" "}
              <code style={{ fontSize: "0.82rem" }}>
                dr.sarah.connor@citygeneral.com
              </code>{" "}
              (email) or MetaMask Hardhat #0
            </>
          )}
          {role === "doctor" && mode === "signup" && (
            <> Need an account? Ask your hospital admin to register you. </>
          )}{" "}
          {role === "admin" && (
            <> Admin access is provisioned by your MedBlock operator. </>
          )}{" "}
        </p>{" "}
      </div>{" "}
    </div>
  );
}
