import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, Button, Input, Alert } from "../components/UI";
import { loginStaff } from "../utils/api";

export default function CounterLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (localStorage.getItem("queuezen_staff_token")) {
      navigate("/counter/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data } = await loginStaff({ username: username.trim(), password });
      localStorage.setItem("queuezen_staff_token", data.token);
      localStorage.setItem("queuezen_staff", JSON.stringify(data.staff));
      navigate("/counter/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, var(--cream) 0%, var(--accent-light) 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo / branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 14px",
            background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, color: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
          }}>
            🪑
          </div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 6 }}>
            Counter Login
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Sign in with your counter staff credentials
          </p>
        </div>

        <Card style={{ padding: 32 }}>
          {error && (
            <div style={{ marginBottom: 20 }}>
              <Alert type="error">{error}</Alert>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input
              label="Username"
              value={username}
              onChange={(v) => { setUsername(v); setError(""); }}
              placeholder="counter.staff"
              autoComplete="username"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(v) => { setPassword(v); setError(""); }}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <Button type="submit" fullWidth size="lg" loading={loading} style={{ marginTop: 4 }}>
              {loading ? "Signing in..." : "Sign In →"}
            </Button>
          </form>
        </Card>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Link
            to="/admin/login"
            style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
          >
            Admin login instead →
          </Link>
        </div>
      </div>
    </div>
  );
}
