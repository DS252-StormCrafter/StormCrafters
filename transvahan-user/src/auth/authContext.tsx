import React, { createContext, useContext, useState } from "react";
import { User } from "../types";

interface Ctx {
  user: User | null;
  token: string | null;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<Ctx>({
  user: null,
  token: null,
  signIn: async () => {},
  signOut: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const signIn = async (t: string, u: User) => {
    setToken(t);
    setUser(u);
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
