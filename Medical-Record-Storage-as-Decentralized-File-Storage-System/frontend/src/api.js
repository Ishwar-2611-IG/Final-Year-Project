// ─────────────────────────────────────────────────────────────
//  Central API helper — all calls go through here
//  BASE URL can be overridden via VITE_API_URL env variable
//  (create frontend/.env.local to set it)
// ─────────────────────────────────────────────────────────────

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:5001") + "/api";
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds — OCR + AI pipeline can take 20-40s

// ─── Dev-time warning ────────────────────────────────────────
if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn(
    "[api] VITE_API_URL is not set — falling back to http://localhost:5001.\n" +
      "Create frontend/.env.local and add: VITE_API_URL=http://your-backend-url",
  );
}

// ─── Session helpers ─────────────────────────────────────────
const TOKEN_KEY = "mb_token";
const USER_KEY = "mb_user";

/** @returns {string|null} */
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Persist a new session to localStorage.
 * @param {string} token
 * @param {object} user
 */
export function saveSession(token, user) {
  if (!token || typeof token !== "string") {
    throw new Error("[api] saveSession: invalid token");
  }
  if (!user || typeof user !== "object") {
    throw new Error("[api] saveSession: invalid user object");
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Read the current session from localStorage.
 * Automatically clears corrupted data instead of throwing.
 * @returns {{ token: string|null, user: object|null }}
 */
export function getSession() {
  const token = getToken();
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) return { token, user: null };

  try {
    return { token, user: JSON.parse(raw) };
  } catch {
    // Corrupted data — wipe it rather than crashing the app
    console.warn("[api] Corrupted session data detected — clearing session.");
    clearSession();
    return { token: null, user: null };
  }
}

/**
 * Returns true only when both a token AND a user object are present.
 * @returns {boolean}
 */
export function isAuthenticated() {
  const { token, user } = getSession();
  return Boolean(token && user);
}

/** Remove all session data from localStorage. */
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ─── 401 / session-expiry handler ────────────────────────────
/**
 * Called automatically on any 401 response.
 * Override this in your app's entry point if you want custom behaviour
 * (e.g. dispatching a Redux/Zustand logout action instead of a hard redirect).
 *
 * @example
 *   import { onSessionExpired } from './api';
 *   onSessionExpired(() => store.dispatch(logout()));
 */
let _onSessionExpired = () => {
  clearSession();
  window.location.href = "/login";
};

export function onSessionExpired(handler) {
  if (typeof handler !== "function") {
    throw new Error("[api] onSessionExpired expects a function");
  }
  _onSessionExpired = handler;
}

// ─── Core request ─────────────────────────────────────────────
/**
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path   – e.g. '/users/42'
 * @param {object|null}   body
 * @param {object}        options
 * @returns {Promise<any>}
 */
async function request(method, path, body = null, options = {}) {
  // Build headers — skip Content-Type for bodyless requests
  const headers = { ...options.headers };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== null) headers["Content-Type"] = "application/json";

  // Timeout via AbortController (merged with user signal if provided)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // If the component unmounts, abort our fetch
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timed out or was cancelled.");
    }
    throw new Error(
      "Cannot reach the MedBlock server. Is the backend running?",
    );
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener("abort", () => controller.abort());
    }
  }

  // ── 401: session expired ──────────────────────────────────
  if (res.status === 401) {
    _onSessionExpired();
    throw new Error("Session expired. Please log in again.");
  }

  // ── Parse body ────────────────────────────────────────────
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  // ── HTTP errors ───────────────────────────────────────────
  if (!res.ok) {
    // Don't leak raw 5xx messages to users
    const msg =
      res.status >= 500
        ? "Something went wrong on the server. Please try again later."
        : data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

// ─── Public API surface ───────────────────────────────────────
export const api = {
  get: (path, options) => request("GET", path, null, options),
  post: (path, body, options) => request("POST", path, body, options),
  put: (path, body, options) => request("PUT", path, body, options),
  patch: (path, body, options) => request("PATCH", path, body, options),
  delete: (path, body, options) =>
    request("DELETE", path, body ?? null, options),
};
