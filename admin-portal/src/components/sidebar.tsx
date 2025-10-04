import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Transvahan — Admin</div>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Dashboard</NavLink>
        <NavLink to="/drivers" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Drivers</NavLink>
        <NavLink to="/vehicles" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Vehicles</NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Reports</NavLink>
        <NavLink to="/users" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Users</NavLink>
        <NavLink to="/notifications" className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>Notifications</NavLink>
      </nav>
      <div style={{ flex: 1 }} />
      <div className="sidebar-foot">Version 0.1</div>
    </aside>
  );
}
