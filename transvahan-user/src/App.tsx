import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppNav from "./navigation";
import { AuthProvider } from "./auth/authContext";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
