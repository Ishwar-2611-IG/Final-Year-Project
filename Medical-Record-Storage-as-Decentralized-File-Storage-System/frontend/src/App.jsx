import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getSession } from "./api";
import Login from "./pages/Login";
import AdminPortal from "./pages/AdminPortal";
import HospitalPortal from "./pages/HospitalPortal";
import DoctorPortal from "./pages/DoctorPortal";
import PatientPortal from "./pages/PatientPortal";

// Route guard — redirects to / if not logged in or wrong role
function Protected({ role, children }) {
  const { user } = getSession();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role)
    return <Navigate to={`/${user.role}`} replace />;
  return children;
}

function App() {
  const { user } = getSession();

  // Redirect logged-in users away from login page
  const defaultPath = user ? `/${user.role}` : "/";

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to={defaultPath} replace /> : <Login />}
        />
        <Route
          path="/admin"
          element={
            <Protected role="admin">
              <AdminPortal />
            </Protected>
          }
        />
        <Route
          path="/hospital"
          element={
            <Protected role="hospital">
              <HospitalPortal />
            </Protected>
          }
        />
        <Route
          path="/doctor"
          element={
            <Protected role="doctor">
              <DoctorPortal />
            </Protected>
          }
        />
        <Route
          path="/patient"
          element={
            <Protected role="patient">
              <PatientPortal />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
