import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Card, Button, Input, Alert } from "../components/UI";
import { loginOrg } from "../utils/api";
import toast from "react-hot-toast";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (val) => {
    setForm((p) => ({ ...p, [field]: val }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError("Please enter username and password.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await loginOrg(form);
      localStorage.setItem("queuezen_token", data.token);
      localStorage.setItem("queuezen_org", JSON.stringify(data.org));
      toast.success(`Welcome back, ${data.org.orgName}!`);
      navigate("/admin/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main style={{ flex: 1, padding: "72px 24px", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", width: "100%" }}>

          {/* Header */}
          <div className="animate-fadeup" style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "linear-gradient(135deg, var(--accent), #e8953a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 auto 16px",
              boxShadow: "0 4px 14px rgba(192,122,60,0.35)",
            }}>Q</div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, marginBottom: 6 }}>
              Admin Sign In
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              Access your organization's queue dashboard
            </p>
          </div>

          <Card className="animate-fadeup-2" style={{ padding: 32 }}>
            {error && (
              <div style={{ marginBottom: 18 }}>
                <Alert type="error">⚠️ {error}</Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Input
                label="Username" required name="username" autoComplete="username"
                value={form.username} onChange={set("username")}
                placeholder="Your admin username"
              />
              <Input
                label="Password" required type="password" name="password" autoComplete="current-password"
                value={form.password} onChange={set("password")}
                placeholder="••••••••"
              />
              <Button type="submit" fullWidth size="lg" loading={loading} style={{ marginTop: 4 }}>
                {loading ? "Signing in..." : "Sign In →"}
              </Button>
            </form>
          </Card>

          <div className="animate-fadeup-3" style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Register your organization
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
