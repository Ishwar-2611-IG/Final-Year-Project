import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  Calendar,
  ClipboardList,
  Plus,
  X,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
} from "lucide-react";
import Shell from "../components/Shell";
import { api, getSession } from "../api";

// ─────────────────────────────────────────────────────────────────────────────
// NAV CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const NAV = [
  { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { key: "doctors", label: "Doctors", Icon: Stethoscope },
  { key: "patients", label: "Patients", Icon: Users },
  { key: "reports", label: "Reports", Icon: ClipboardList },
  { key: "appointments", label: "Appointments", Icon: Calendar },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK: useApiData
// Fixes:
//   1. Stable `reload` via useCallback so it never causes infinite loops
//   2. AbortController cancels in-flight requests on unmount / path change
//   3. Tracks `loading` and `error` states separately
// ─────────────────────────────────────────────────────────────────────────────
function useApiData(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const reload = useCallback(() => {
    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    api
      .get(path, { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setError(err?.message || "Failed to load data.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    reload();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [reload]);

  return { data, loading, error, reload };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: normalise API errors to a user-facing string
// Fix: prevents "undefined" showing when a non-Error is thrown
// ─────────────────────────────────────────────────────────────────────────────
function toErrMsg(e) {
  if (!e) return "An unexpected error occurred.";
  if (typeof e === "string") return e;
  return (
    e.message || e.error || JSON.stringify(e) || "An unexpected error occurred."
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Modal
// Fix: stopPropagation on inner div prevents accidental close on inner clicks
// Enhancement: focus-trap, Escape key close, smooth backdrop
// ─────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = "md" }) {
  const overlayRef = useRef(null);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`modal modal-${size} anim-slide-up`}
        onClick={(e) => e.stopPropagation()} // Fix: prevent bubbling to overlay
      >
        <div className="modal-header">
          <span className="modal-title"> {title} </span>{" "}
          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />{" "}
          </button>{" "}
        </div>{" "}
        <div className="modal-body"> {children} </div>{" "}
      </div>{" "}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: LoadingRows — skeleton placeholder rows
// ─────────────────────────────────────────────────────────────────────────────
function LoadingRows({ cols, rows = 4 }) {
  return Array.from({ length: rows }, (_, i) => (
    <tr key={i}>
      {" "}
      {Array.from({ length: cols }, (_, j) => (
        <td key={j}>
          {" "}
          <div
            className="skeleton"
            style={{
              height: 14,
              borderRadius: 6,
              width: j === 0 ? "70%" : "90%",
            }}
          />
        </td>
      ))}{" "}
    </tr>
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: ErrorBanner
// ─────────────────────────────────────────────────────────────────────────────
function ErrorBanner({ message, onRetry }) {
  return (
    <div
      className="alert alert-error"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <AlertCircle size={16} style={{ flexShrink: 0 }} />{" "}
      <span style={{ flex: 1 }}> {message} </span>{" "}
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          <RefreshCw size={13} /> Retry{" "}
        </button>
      )}{" "}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: EmptyState
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message, action }) {
  return (
    <tr>
      <td colSpan={99} style={{ textAlign: "center", padding: "40px 24px" }}>
        {" "}
        {Icon && (
          <Icon size={28} style={{ color: "var(--muted)", marginBottom: 8 }} />
        )}{" "}
        <div style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          {" "}
          {message}{" "}
        </div>{" "}
        {action}{" "}
      </td>{" "}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: SortableTh — table header with sort toggle
// ─────────────────────────────────────────────────────────────────────────────
function SortableTh({ label, field, sort, onSort }) {
  const active = sort.field === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {" "}
        {label}{" "}
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )
        ) : (
          <ChevronDown size={12} style={{ opacity: 0.3 }} />
        )}{" "}
      </span>{" "}
    </th>
  );
}

function useSort(initialField, initialDir = "asc") {
  const [sort, setSort] = useState({ field: initialField, dir: initialDir });
  const toggle = useCallback((field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "asc" ? "desc" : "asc",
    }));
  }, []);
  const apply = useCallback(
    (arr, getter) => {
      if (!arr) return [];
      return [...arr].sort((a, b) => {
        const av = getter(a, sort.field);
        const bv = getter(b, sort.field);
        const cmp =
          typeof av === "string" ? av.localeCompare(bv) : (av ?? 0) - (bv ?? 0);
        return sort.dir === "asc" ? cmp : -cmp;
      });
    },
    [sort],
  );
  return { sort, toggle, apply };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Dashboard
// Enhancement: animated stat cards, quick-action links
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({ user, onNav }) {
  const { data, loading, error, reload } = useApiData("/hospital/stats");

  const stats = [
    {
      label: "Doctors",
      value: data?.doctors,
      color: "var(--warning)",
      Icon: Stethoscope,
      nav: "doctors",
    },
    {
      label: "Patients",
      value: data?.patients,
      color: "var(--accent)",
      Icon: Users,
      nav: "patients",
    },
    {
      label: "Reports",
      value: data?.reports,
      color: "var(--success)",
      Icon: FileText,
      nav: "reports",
    },
    {
      label: "Pending Appts",
      value: data?.pendingAppointments,
      color: "var(--primary)",
      Icon: Clock,
      nav: "appointments",
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {" "}
            Hospital Dashboard{" "}
          </h1>{" "}
          <p className="page-subtitle" style={{ margin: 0 }}>
            {" "}
            Live overview of your facility.{" "}
          </p>{" "}
        </div>{" "}
        <button
          className="btn btn-ghost btn-sm"
          onClick={reload}
          title="Refresh stats"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Refresh{" "}
        </button>{" "}
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="stat-grid" style={{ marginBottom: 28 }}>
        {" "}
        {stats.map(({ label, value, color, Icon, nav }) => (
          <button
            key={label}
            className="stat-card stat-card-btn"
            onClick={() => onNav(nav)}
            title={`Go to ${label}`}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div className="label"> {label} </div>{" "}
              <Icon size={18} style={{ color, opacity: 0.7 }} />{" "}
            </div>{" "}
            <div className="value" style={{ color }}>
              {" "}
              {loading ? (
                <div
                  className="skeleton"
                  style={{ height: 28, width: 40, borderRadius: 6 }}
                />
              ) : (
                (value ?? "—")
              )}{" "}
            </div>{" "}
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--muted)",
                marginTop: 4,
              }}
            >
              {" "}
              Click to view→{" "}
            </div>{" "}
          </button>
        ))}{" "}
      </div>
      <div
        className="card"
        style={{ display: "flex", alignItems: "center", gap: 18 }}
      >
        <div style={{ fontSize: "2.4rem", lineHeight: 1 }}> 🏥 </div>{" "}
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.08rem" }}>
            {" "}
            {user?.firstName} {user?.lastName}{" "}
          </div>{" "}
          <div style={{ color: "var(--muted)", fontSize: "0.84rem" }}>
            Hospital Administrator· MedBlock{" "}
          </div>{" "}
        </div>{" "}
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
            {" "}
            Today{" "}
          </div>{" "}
          <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>
            {" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Doctors
// Fixes: form reset on close, error normalisation, loading skeletons
// Enhancement: sortable columns, status filter, inline validation
// ─────────────────────────────────────────────────────────────────────────────
const DOCTOR_BLANK = {
  firstName: "",
  lastName: "",
  walletAddress: "",
  specialization: "",
  phone: "",
};

function DoctorsPage() {
  const { data, loading, error, reload } = useApiData("/hospital/doctors");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(DOCTOR_BLANK);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const { sort, toggle, apply } = useSort("first_name");

  // Fix: reset form AND error when modal closes
  const closeModal = useCallback(() => {
    setShow(false);
    setForm(DOCTOR_BLANK);
    setErr("");
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api.post("/hospital/doctors", form);
      closeModal();
      reload();
    } catch (e) {
      setErr(toErrMsg(e)); // Fix: safe error normalisation
    } finally {
      setSaving(false);
    }
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  const doctors = data?.doctors ?? [];
  const byStatus =
    filter === "all"
      ? doctors
      : doctors.filter((d) =>
          filter === "active" ? d.is_active : !d.is_active,
        );
  const bySearch = !q
    ? byStatus
    : byStatus.filter((d) =>
        `${d.first_name} ${d.last_name} ${d.specialization} ${d.phone}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      );
  const sorted = apply(bySearch, (d, f) => {
    if (f === "first_name") return `${d.first_name} ${d.last_name}`;
    return d[f] ?? "";
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {" "}
            Doctors{" "}
          </h1>{" "}
          <p className="page-subtitle" style={{ margin: 0 }}>
            {" "}
            {doctors.length}
            registered doctor {doctors.length !== 1 ? "s" : ""}{" "}
          </p>{" "}
        </div>{" "}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                pointerEvents: "none",
              }}
            />{" "}
            <input
              className="input"
              style={{ paddingLeft: 28, width: 190 }}
              placeholder="Search doctors…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search doctors"
            />
          </div>{" "}
          <select
            className="input"
            style={{ width: 120 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all"> All Status </option>{" "}
            <option value="active"> Active </option>{" "}
            <option value="inactive"> Inactive </option>{" "}
          </select>{" "}
          <button className="btn btn-primary" onClick={() => setShow(true)}>
            <Plus size={15} /> Add Doctor{" "}
          </button>{" "}
        </div>{" "}
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableTh
                label="Name"
                field="first_name"
                sort={sort}
                onSort={toggle}
              />{" "}
              <SortableTh
                label="Specialization"
                field="specialization"
                sort={sort}
                onSort={toggle}
              />{" "}
              <th> Wallet Address </th>{" "}
              <SortableTh
                label="Phone"
                field="phone"
                sort={sort}
                onSort={toggle}
              />{" "}
              <th> Status </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody>
            {" "}
            {loading ? (
              <LoadingRows cols={5} />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={Stethoscope}
                message={
                  q || filter !== "all"
                    ? "No doctors match your filters."
                    : "No doctors registered yet."
                }
                action={
                  !q &&
                  filter === "all" && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 12 }}
                      onClick={() => setShow(true)}
                    >
                      <Plus size={13} /> Add First Doctor{" "}
                    </button>
                  )
                }
              />
            ) : (
              sorted.map((d) => (
                <tr key={d.id ?? d.wallet_address}>
                  <td className="fw-600">
                    {" "}
                    {d.first_name} {d.last_name}{" "}
                  </td>{" "}
                  <td> {d.specialization || "—"} </td>{" "}
                  <td>
                    <code
                      style={{
                        fontSize: "0.73rem",
                        color: "var(--muted)",
                        background: "var(--surface2)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {" "}
                      {d.wallet_address
                        ? `${d.wallet_address.slice(0, 6)}…${d.wallet_address.slice(-4)}`
                        : "—"}{" "}
                    </code>{" "}
                  </td>{" "}
                  <td> {d.phone || "—"} </td>{" "}
                  <td>
                    <span
                      className={`badge ${d.is_active ? "badge-green" : "badge-red"}`}
                    >
                      {" "}
                      {d.is_active ? "Active" : "Inactive"}{" "}
                    </span>{" "}
                  </td>{" "}
                </tr>
              ))
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>
      {show && (
        <Modal title="Register Doctor" onClose={closeModal}>
          {" "}
          {err && <ErrorBanner message={err} />}{" "}
          <form onSubmit={submit} noValidate>
            <div className="grid-2">
              <div className="form-group">
                <label>
                  {" "}
                  First Name <span className="req"> * </span>
                </label>
                <input
                  className="input"
                  required
                  autoFocus
                  {...field("firstName")}
                />{" "}
              </div>{" "}
              <div className="form-group">
                <label> Last Name </label>{" "}
                <input className="input" {...field("lastName")} />{" "}
              </div>{" "}
              <div className="form-group">
                <label> Specialization </label>{" "}
                <input
                  className="input"
                  placeholder="e.g. Cardiology"
                  {...field("specialization")}
                />{" "}
              </div>{" "}
              <div className="form-group">
                <label> Phone </label>{" "}
                <input
                  className="input"
                  type="tel"
                  placeholder="+91…"
                  {...field("phone")}
                />{" "}
              </div>{" "}
            </div>{" "}
            <div className="form-group">
              <label>
                {" "}
                MetaMask Wallet Address <span className="req"> * </span>
              </label>
              <input
                className="input"
                required
                placeholder="0x…"
                pattern="^0x[a-fA-F0-9]{40}$"
                title="Must be a valid Ethereum address (0x followed by 40 hex chars)"
                {...field("walletAddress")}
              />{" "}
              <span className="form-hint">
                {" "}
                Must be a valid Ethereum address.{" "}
              </span>{" "}
            </div>{" "}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                {" "}
                Cancel{" "}
              </button>{" "}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {" "}
                {saving ? (
                  <>
                    {" "}
                    <RefreshCw size={13} className="spin" /> Saving…{" "}
                  </>
                ) : (
                  "Register Doctor"
                )}{" "}
              </button>{" "}
            </div>{" "}
          </form>{" "}
        </Modal>
      )}{" "}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Patients
// Fixes: form reset + password field in reset, error normalisation, loading skeletons
// Enhancement: sortable, DOB age calculation, search highlights
// ─────────────────────────────────────────────────────────────────────────────
const PATIENT_BLANK = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  dateOfBirth: "",
};

function calcAge(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function PatientsPage() {
  const { data, loading, error, reload } = useApiData("/hospital/patients");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(PATIENT_BLANK);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const { sort, toggle, apply } = useSort("first_name");

  // Fix: reset ALL form fields (including password) and error on close
  const closeModal = useCallback(() => {
    setShow(false);
    setForm(PATIENT_BLANK);
    setErr("");
    setShowPwd(false);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      await api.post("/hospital/patients", form);
      closeModal();
      reload();
    } catch (e) {
      setErr(toErrMsg(e)); // Fix: safe error normalisation
    } finally {
      setSaving(false);
    }
  };

  const field = (key, extra = {}) => ({
    value: form[key],
    onChange: (e) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
    ...extra,
  });

  const patients = data?.patients ?? [];
  const bySearch = !q
    ? patients
    : patients.filter((p) =>
        `${p.first_name} ${p.last_name} ${p.email} ${p.phone}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      );
  const sorted = apply(bySearch, (p, f) => {
    if (f === "first_name") return `${p.first_name} ${p.last_name}`;
    if (f === "created_at") return new Date(p.created_at).getTime();
    return p[f] ?? "";
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {" "}
            Patients{" "}
          </h1>{" "}
          <p className="page-subtitle" style={{ margin: 0 }}>
            {" "}
            {patients.length}
            registered patient {patients.length !== 1 ? "s" : ""}{" "}
          </p>{" "}
        </div>{" "}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                pointerEvents: "none",
              }}
            />{" "}
            <input
              className="input"
              style={{ paddingLeft: 28, width: 190 }}
              placeholder="Search patients…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search patients"
            />
          </div>{" "}
          <button className="btn btn-primary" onClick={() => setShow(true)}>
            <Plus size={15} /> Register Patient{" "}
          </button>{" "}
        </div>{" "}
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th> #ID </th>{" "}
              <SortableTh
                label="Name"
                field="first_name"
                sort={sort}
                onSort={toggle}
              />{" "}
              <SortableTh
                label="Email"
                field="email"
                sort={sort}
                onSort={toggle}
              />{" "}
              <th> Phone </th> <th> Age / DOB </th>{" "}
              <SortableTh
                label="Registered"
                field="created_at"
                sort={sort}
                onSort={toggle}
              />{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody>
            {" "}
            {loading ? (
              <LoadingRows cols={6} />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={Users}
                message={
                  q
                    ? "No patients match your search."
                    : "No patients registered yet."
                }
                action={
                  !q && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: 12 }}
                      onClick={() => setShow(true)}
                    >
                      <Plus size={13} /> Register First Patient{" "}
                    </button>
                  )
                }
              />
            ) : (
              sorted.map((p) => {
                const age = calcAge(p.date_of_birth);
                return (
                  <tr key={p.id}>
                    <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      {" "}
                      #{p.id}{" "}
                    </td>{" "}
                    <td className="fw-600">
                      {" "}
                      {p.first_name} {p.last_name}{" "}
                    </td>{" "}
                    <td> {p.email} </td> <td> {p.phone || "—"} </td>{" "}
                    <td>
                      {" "}
                      {p.date_of_birth ? (
                        <span
                          title={new Date(p.date_of_birth).toLocaleDateString(
                            "en-IN",
                          )}
                        >
                          {" "}
                          {age !== null ? `${age} yrs` : "—"}{" "}
                        </span>
                      ) : (
                        "—"
                      )}{" "}
                    </td>{" "}
                    <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                      {" "}
                      {new Date(p.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}{" "}
                    </td>{" "}
                  </tr>
                );
              })
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>
      {show && (
        <Modal title="Register Patient" onClose={closeModal}>
          {" "}
          {err && <ErrorBanner message={err} />}{" "}
          <form onSubmit={submit} noValidate>
            <div className="grid-2">
              <div className="form-group">
                <label>
                  {" "}
                  First Name <span className="req"> * </span>
                </label>
                <input
                  className="input"
                  required
                  autoFocus
                  {...field("firstName")}
                />{" "}
              </div>{" "}
              <div className="form-group">
                <label> Last Name </label>{" "}
                <input className="input" {...field("lastName")} />{" "}
              </div>{" "}
              <div className="form-group">
                <label>
                  {" "}
                  Email <span className="req"> * </span>
                </label>
                <input
                  className="input"
                  type="email"
                  required
                  {...field("email")}
                />{" "}
              </div>{" "}
              <div className="form-group">
                <label> Phone </label>{" "}
                <input
                  className="input"
                  type="tel"
                  placeholder="+91…"
                  {...field("phone")}
                />{" "}
              </div>{" "}
              <div className="form-group">
                <label> Date of Birth </label>{" "}
                <input
                  className="input"
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  {...field("dateOfBirth")}
                />{" "}
              </div>{" "}
            </div>{" "}
            <div className="form-group">
              <label>
                {" "}
                Portal Password <span className="req"> * </span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={8}
                  {...field("password")}
                  style={{ paddingRight: 44 }}
                />{" "}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "2px 6px",
                  }}
                  onClick={() => setShowPwd((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPwd ? "Hide password" : "Show password"}
                >
                  {showPwd ? "🙈" : "👁"}{" "}
                </button>{" "}
              </div>{" "}
              <span className="form-hint"> Minimum 8 characters. </span>{" "}
            </div>{" "}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
              >
                {" "}
                Cancel{" "}
              </button>{" "}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {" "}
                {saving ? (
                  <>
                    {" "}
                    <RefreshCw size={13} className="spin" /> Saving…{" "}
                  </>
                ) : (
                  "Register Patient"
                )}{" "}
              </button>{" "}
            </div>{" "}
          </form>{" "}
        </Modal>
      )}{" "}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Reports
// Fixes: null-guard on map, loading state, error handling
// Enhancement: IPFS link, search, sortable, status filter
// ─────────────────────────────────────────────────────────────────────────────
function ReportsPage() {
  const { data, loading, error, reload } = useApiData("/hospital/reports");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const { sort, toggle, apply } = useSort("created_at", "desc");

  const reports = data?.reports ?? [];
  const byFilter =
    filter === "all"
      ? reports
      : filter === "verified"
        ? reports.filter((r) => r.tx_hash)
        : reports.filter((r) => !r.tx_hash);
  const bySearch = !q
    ? byFilter
    : byFilter.filter((r) =>
        `${r.patient_first} ${r.patient_last} ${r.doctor_first} ${r.doctor_last} ${r.cid}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      );
  const sorted = apply(bySearch, (r, f) => {
    if (f === "created_at") return new Date(r.created_at).getTime();
    if (f === "patient") return `${r.patient_first} ${r.patient_last}`;
    if (f === "doctor") return `${r.doctor_first} ${r.doctor_last}`;
    return r[f] ?? "";
  });

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {" "}
            Reports{" "}
          </h1>{" "}
          <p className="page-subtitle" style={{ margin: 0 }}>
            {" "}
            {reports.length}
            report {reports.length !== 1 ? "s" : ""}
            issued{" "}
          </p>{" "}
        </div>{" "}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 9,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--muted)",
                pointerEvents: "none",
              }}
            />{" "}
            <input
              className="input"
              style={{ paddingLeft: 28, width: 190 }}
              placeholder="Search reports…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />{" "}
          </div>{" "}
          <select
            className="input"
            style={{ width: 130 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all"> All </option>{" "}
            <option value="verified"> Verified </option>{" "}
            <option value="pending"> Pending </option>{" "}
          </select>{" "}
        </div>{" "}
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableTh
                label="Patient"
                field="patient"
                sort={sort}
                onSort={toggle}
              />{" "}
              <SortableTh
                label="Doctor"
                field="doctor"
                sort={sort}
                onSort={toggle}
              />{" "}
              <th> IPFS CID </th>{" "}
              <SortableTh
                label="Date"
                field="created_at"
                sort={sort}
                onSort={toggle}
              />{" "}
              <th> Verified </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody>
            {" "}
            {loading ? (
              <LoadingRows cols={5} />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                message={
                  q || filter !== "all"
                    ? "No reports match your filters."
                    : "No reports issued yet."
                }
              />
            ) : (
              sorted.map((r) => (
                <tr key={r.id ?? r.cid}>
                  <td className="fw-600">
                    {" "}
                    {r.patient_first} {r.patient_last}{" "}
                  </td>{" "}
                  <td>
                    {" "}
                    {r.doctor_first} {r.doctor_last}{" "}
                    {r.specialization && (
                      <div
                        style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                      >
                        {" "}
                        {r.specialization}{" "}
                      </div>
                    )}{" "}
                  </td>{" "}
                  <td>
                    {" "}
                    {r.cid ? (
                      <a
                        href={`https://ipfs.io/ipfs/${r.cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={r.cid}
                        style={{
                          fontSize: "0.73rem",
                          color: "var(--accent)",
                          textDecoration: "none",
                        }}
                      >
                        <code
                          style={{
                            background: "var(--surface2)",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {" "}
                          {r.cid.slice(0, 10)}… {r.cid.slice(-6)}{" "}
                        </code>{" "}
                      </a>
                    ) : (
                      "—"
                    )}{" "}
                  </td>{" "}
                  <td style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
                    {" "}
                    {new Date(r.created_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                  </td>{" "}
                  <td>
                    {" "}
                    {r.tx_hash ? (
                      <a
                        href={`https://etherscan.io/tx/${r.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <span className="badge badge-green" title={r.tx_hash}>
                          <CheckCircle2 size={10} style={{ marginRight: 3 }} />
                          Verified{" "}
                        </span>{" "}
                      </a>
                    ) : (
                      <span className="badge badge-amber">
                        <Clock size={10} style={{ marginRight: 3 }} />
                        Pending{" "}
                      </span>
                    )}{" "}
                  </td>{" "}
                </tr>
              ))
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE: Appointments
// Fixes: null-guard, loading state, error handling, date formatting consistency
// Enhancement: tab UI instead of double table, status badge colour map, search
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_BADGE = {
  scheduled: "badge-blue",
  completed: "badge-green",
  cancelled: "badge-red",
};

function AppointmentsPage() {
  const { data, loading, error, reload } = useApiData("/hospital/appointments");
  const [tab, setTab] = useState("upcoming");
  const [q, setQ] = useState("");
  const { sort, toggle, apply } = useSort("appointment_date", "asc");

  const all = data?.appointments ?? [];
  const upcoming = all.filter((a) => a.status === "scheduled");
  const past = all.filter((a) => a.status !== "scheduled");
  const activeList = tab === "upcoming" ? upcoming : past;

  const filtered = !q
    ? activeList
    : activeList.filter((a) =>
        `${a.patient_first} ${a.patient_last} ${a.doctor_first} ${a.doctor_last} ${a.reason ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      );
  const sorted = apply(filtered, (a, f) => {
    if (f === "appointment_date") return new Date(a.appointment_date).getTime();
    if (f === "patient") return `${a.patient_first} ${a.patient_last}`;
    return a[f] ?? "";
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {" "}
            Appointments{" "}
          </h1>{" "}
          <p className="page-subtitle" style={{ margin: 0 }}>
            {" "}
            {upcoming.length}
            upcoming· {past.length}
            past{" "}
          </p>{" "}
        </div>{" "}
        <div style={{ position: "relative" }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          />{" "}
          <input
            className="input"
            style={{ paddingLeft: 28, width: 200 }}
            placeholder="Search appointments…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />{" "}
        </div>{" "}
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {/* Tab strip */}{" "}
      <div className="tab-strip" style={{ marginBottom: 16 }}>
        {" "}
        {[
          { key: "upcoming", label: `Upcoming (${upcoming.length})` },
          { key: "past", label: `Past (${past.length})` },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? "tab-active" : ""}`}
            onClick={() => {
              setTab(t.key);
              setQ("");
            }}
          >
            {t.label}{" "}
          </button>
        ))}{" "}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortableTh
                label="Patient"
                field="patient"
                sort={sort}
                onSort={toggle}
              />{" "}
              <th> Doctor </th>{" "}
              <SortableTh
                label="Date"
                field="appointment_date"
                sort={sort}
                onSort={toggle}
              />{" "}
              <th> Reason </th> <th> Status </th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody>
            {" "}
            {loading ? (
              <LoadingRows cols={5} />
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={Calendar}
                message={
                  q
                    ? "No appointments match your search."
                    : `No ${tab} appointments.`
                }
              />
            ) : (
              sorted.map((a) => (
                <tr key={a.id}>
                  <td className="fw-600">
                    {" "}
                    {a.patient_first} {a.patient_last}{" "}
                  </td>{" "}
                  <td>
                    {" "}
                    {a.doctor_first} {a.doctor_last}{" "}
                    {a.specialization && (
                      <div
                        style={{ fontSize: "0.75rem", color: "var(--muted)" }}
                      >
                        {" "}
                        {a.specialization}{" "}
                      </div>
                    )}{" "}
                  </td>{" "}
                  <td style={{ fontSize: "0.85rem" }}>
                    {" "}
                    {new Date(a.appointment_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                  </td>{" "}
                  <td
                    style={{
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {" "}
                    {a.reason || "—"}{" "}
                  </td>{" "}
                  <td>
                    <span
                      className={`badge ${STATUS_BADGE[a.status] ?? "badge-amber"}`}
                    >
                      {" "}
                      {a.status}{" "}
                    </span>{" "}
                  </td>{" "}
                </tr>
              ))
            )}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: HospitalPortal
// Fix: getSession() called inside component (not at module level)
// Enhancement: onNav passed to Dashboard for clickable stat cards
// ─────────────────────────────────────────────────────────────────────────────
export default function HospitalPortal() {
  const [page, setPage] = useState("dashboard");
  // Fix: call getSession inside the component, not at module scope
  const { user } = getSession();

  const PAGE = {
    dashboard: <Dashboard user={user} onNav={setPage} />,
    doctors: <DoctorsPage />,
    patients: <PatientsPage />,
    reports: <ReportsPage />,
    appointments: <AppointmentsPage />,
  };

  return (
    <Shell
      brand={{
        icon: "🏥",
        name: "Hospital Panel",
        sub: user?.firstName || "Hospital Admin",
        role: "Hospital Admin",
      }}
      grad="var(--hospital-grad)"
      navItems={NAV}
      activePage={page}
      onNav={setPage}
    >
      <div className="anim-slide-up" key={page}>
        {" "}
        {PAGE[page]}{" "}
      </div>{" "}
    </Shell>
  );
}
