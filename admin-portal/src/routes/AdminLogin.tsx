import React, { useState } from "react";
import { adminLogin, setAuthToken } from "../services/admin";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@transvahan.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await adminLogin({ email, password });
      const token = res.data.token;
      setAuthToken(token);
      signIn(token, { email, role: "admin" });
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login" onSubmit={submit}>
        <h2>Admin Sign in</h2>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </div>
  );
}
