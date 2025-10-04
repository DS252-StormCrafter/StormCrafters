import React from "react";
import { useAuth } from "../context/AuthContext";

export default function Topbar() {
  const { user, signOut } = useAuth();
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger" aria-label="menu">☰</button>
        <h1>Admin Dashboard</h1>
      </div>
      <div className="topbar-right">
        <div className="admin-info">
          <strong>{user?.email}</strong>
        </div>
        <button className="btn" onClick={signOut}>Logout</button>
      </div>
    </header>
  );
}
