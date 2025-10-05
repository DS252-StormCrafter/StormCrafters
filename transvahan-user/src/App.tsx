// src/App.tsx
import React from "react";
import { AuthProvider } from "./auth/authContext";
import AppNav from "./navigation";

export default function App() {
  return (
    <AuthProvider>
      <AppNav />
    </AuthProvider>
  );
}
