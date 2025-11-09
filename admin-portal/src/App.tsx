//admin-portal/src/App.tsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Sidebar from "./components/sidebar";
import Topbar from "./components/topbar";
import Drivers from "./routes/Drivers";
import Vehicles from "./routes/Vehicles";
import Reports from "./routes/Reports";
import Notifications from "./routes/Notifications";
import AdminLogin from "./routes/AdminLogin";
import RoutesEditor from "./routes/RoutesEditor";
import Assignments from "./routes/Assignments";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { token } = useAuth();
  const isAuthed = !!token;

  return (
    <Router>
      <div className="app-shell">
        {isAuthed ? (
          <>
            <Sidebar />
            <div className="main-area">
              <Topbar />
              <div className="content">
                <Routes>
                  {/* ✅ Reports is now the default landing page */}
                  <Route path="/" element={<Navigate to="/reports" replace />} />
                  <Route path="/reports" element={<Reports />} />

                  {/* ✅ Other pages remain intact */}
                  <Route path="/drivers" element={<Drivers />} />
                  <Route path="/vehicles" element={<Vehicles />} />
                  <Route path="/routes" element={<RoutesEditor />} />
                  <Route path="/assignments" element={<Assignments />} />
                  <Route path="/notifications" element={<Notifications />} />

                  {/* Fallback to reports */}
                  <Route path="*" element={<Navigate to="/reports" replace />} />
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