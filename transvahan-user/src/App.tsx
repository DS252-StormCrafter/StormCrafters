// src/App.tsx
import React from "react";
import { AuthProvider } from "./auth/authContext";
import AppNav from "./navigation";
import silenceLogsForProd from "./utils/silenceLogs";

export default function App() {
  // Disable noisy console logs in release builds.
  silenceLogsForProd();

  return (
    <AuthProvider>
      <AppNav />
    </AuthProvider>
  );
}
