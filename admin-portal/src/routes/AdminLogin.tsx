import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, setAuthToken } from "../services/admin";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const [email, setEmail] = useState("admin@transvahan.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await adminLogin({ email, password });
      const token: string = res.data?.token;
      if (!token) {
        throw new Error("No token returned from backend");
      }

      setAuthToken(token);
      signIn(token, { email, role: "admin" });
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Admin login error:", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="card login" onSubmit={submit}>
        <h2>Admin Sign in</h2>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="username"
        />

        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
        />

        {error && <div className="error">{error}</div>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
