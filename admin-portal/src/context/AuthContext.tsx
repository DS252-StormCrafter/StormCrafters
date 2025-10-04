import React, { createContext, useContext, useState, useEffect } from "react";

type User = { email: string; role?: string };
type AuthCtx = {
  user: User | null;
  token: string | null;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem("admin_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));

  useEffect(() => {
    if (token) localStorage.setItem("admin_token", token);
    else localStorage.removeItem("admin_token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("admin_user", JSON.stringify(user));
    else localStorage.removeItem("admin_user");
  }, [user]);

  const signIn = (t: string, u: User) => {
    setToken(t);
    setUser(u);
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, token, signIn, signOut }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
