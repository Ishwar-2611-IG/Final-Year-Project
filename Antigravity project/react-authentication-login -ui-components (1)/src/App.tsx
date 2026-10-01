import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import { ToastProvider } from './components/ui/Toast';
import { LoadingProvider, useLoading } from './components/ui/LoadingContext';
import { LoadingBar } from './components/ui/LoadingBar';

function RouteProgress() {
  const location = useLocation();
  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    startLoading();
    const timeout = window.setTimeout(() => stopLoading(), 280);
    return () => window.clearTimeout(timeout);
  }, [location.pathname, startLoading, stopLoading]);

  return null;
}

function LoadingBarWrapper() {
  const { active } = useLoading();
  return <LoadingBar active={active} />;
}

export default function App() {
  return (
    <ToastProvider>
      <LoadingProvider>
        <BrowserRouter>
          <LoadingBarWrapper />
          <RouteProgress />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            {/* ENHANCEMENT: Stub role dashboards so post-login nav doesn't crash */}
            <Route
              path="/:role"
              element={
                <div
                  style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text2)',
                    fontFamily: 'system-ui',
                    padding: 24,
                    textAlign: 'center',
                    background: '#05070d',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>✅</div>
                    <h1 style={{ margin: '0 0 8px' }}>Signed in successfully</h1>
                    <p style={{ color: 'var(--muted)' }}>
                      This is a stub dashboard — route back to <code>/login</code> to explore the enhanced login experience.
                    </p>
                  </div>
                </div>
              }
            />
          </Routes>
        </BrowserRouter>
      </LoadingProvider>
    </ToastProvider>
  );
}