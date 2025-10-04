import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import Dashboard from "./routes/Dashboard";
import Drivers from "./routes/Drivers";
import Vehicles from "./routes/Vehicles";
import Reports from "./routes/Reports";
import Users from "./routes/Users";
import Notifications from "./routes/Notifications";
import AdminLogin from "./routes/AdminLogin";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { token } = useAuth();

  return (
    <Router>
      <div className="app-shell">
        {token ? (
          <>
            <Sidebar />
            <div className="main-area">
              <Topbar />
              <div className="content">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/drivers" element={<Drivers />} />
                  <Route path="/vehicles" element={<Vehicles />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          </>
        ) : (
          <Routes>
            <Route path="/login" element={<AdminLogin />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        )}
      </div>
    </Router>
  );
}
