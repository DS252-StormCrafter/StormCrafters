import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, setAuthToken } from "../services/admin";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  // ✅ NO hardcoded creds (security + UX)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
      if (!token) throw new Error("No token returned from backend");

      setAuthToken(token);
      signIn(token, { email, role: "admin" });

      // ✅ send to a sane landing page
      navigate("/drivers", { replace: true });
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
    <div
      className="login-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        background: "var(--tv-bg, #0b1220)", // respects your theme vars if present
      }}
    >
      <form
        className="card login"
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 420,
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: 12 }}>Admin Sign in</h2>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="username"
          placeholder="Admin's Mail"
          required
        />

        <label style={{ marginTop: 8 }}>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Admin's Password"
          required
        />

        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}

        <button className="btn" type="submit" disabled={loading} style={{ width: "100%", marginTop: 12 }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}