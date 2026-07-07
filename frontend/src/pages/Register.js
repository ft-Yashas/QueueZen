import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Card, Button, Input, Alert, Divider } from "../components/UI";
import { registerOrg } from "../utils/api";
import toast from "react-hot-toast";

const ORG_TYPES = [
  {
    value: "college",
    label: "College / University",
    icon: "🎓",
    description: "Universities, schools & academic institutions",
    accent: "#1e3a6e",
    light: "#e8f0fe",
    emailHint: "e.g. jainuniversity.ac.in",
    theme: "college",
  },
  {
    value: "business",
    label: "Business / Office",
    icon: "🏢",
    description: "Companies, stores & private offices",
    accent: "#1e40af",
    light: "#eff6ff",
    emailHint: "e.g. company.com",
    theme: "business",
  },
  {
    value: "government",
    label: "Government Office",
    icon: "🏛️",
    description: "Public offices & government departments",
    accent: "#166534",
    light: "#f0fdf4",
    emailHint: "e.g. dept.gov.in",
    theme: "government",
  },
  {
    value: "hospital",
    label: "Hospital / Healthcare",
    icon: "🏥",
    description: "Hospitals, clinics & healthcare centers",
    accent: "#0891b2",
    light: "#ecfeff",
    emailHint: "e.g. cityhospital.org",
    theme: "hospital",
  },
];

export default function Register() {
  const navigate = useNavigate();
  const [orgType, setOrgType] = useState("");
  const [form, setForm] = useState({
    orgName: "", department: "", serviceCenter: "",
    officialEmailDomain: "",
    username: "", email: "", password: "", confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const set = (field) => (val) => {
    setForm((p) => ({ ...p, [field]: val }));
    setErrors((p) => ({ ...p, [field]: "" }));
    setServerError("");
  };

  const selectOrgType = (type) => {
    setOrgType(type);
    setErrors((p) => ({ ...p, orgType: "" }));
    // Apply theme preview
    document.documentElement.setAttribute("data-theme", type);
  };

  const validate = () => {
    const e = {};
    if (!orgType) e.orgType = "Please select an organization type";
    if (!form.orgName.trim()) e.orgName = "Organization name is required";
    if (!form.department.trim()) e.department = "Department is required";
    if (!form.serviceCenter.trim()) e.serviceCenter = "Service center is required";
    if (!form.username.trim() || form.username.length < 3) e.username = "Username must be at least 3 characters";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Valid email is required";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords do not match";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const { data } = await registerOrg({
        orgName: form.orgName,
        department: form.department,
        serviceCenter: form.serviceCenter,
        orgType,
        officialEmailDomain: form.officialEmailDomain,
        username: form.username,
        email: form.email,
        password: form.password,
      });

      localStorage.setItem("queuezen_token", data.token);
      localStorage.setItem("queuezen_org", JSON.stringify(data.org));
      toast.success(`Welcome, ${data.org.orgName}!`);
      navigate("/admin/dashboard");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        (err.code === "ECONNABORTED" ? "Request timed out. Please try again." : null) ||
        "Registration failed. Please try again.";
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedType = ORG_TYPES.find((t) => t.value === orgType);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main style={{ flex: 1, padding: "48px 24px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {/* Header */}
          <div className="animate-fadeup" style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: "linear-gradient(135deg, var(--accent), var(--accent-hover, #a86530))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 auto 16px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            }}>Q</div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, marginBottom: 8 }}>
              Register Your Organization
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
              Set up your digital queue in minutes.
            </p>
          </div>

          <Card className="animate-fadeup-2" style={{ padding: 36 }}>
            {serverError && (
              <div style={{ marginBottom: 20 }}>
                <Alert type="error">⚠️ {serverError}</Alert>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Step 1: Organization Type */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                  🏷️ Organization Type
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14 }}>
                  This determines which queue features and priority types are available.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {ORG_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => selectOrgType(t.value)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "var(--radius-sm)",
                        border: `2px solid ${orgType === t.value ? t.accent : "var(--border)"}`,
                        background: orgType === t.value ? t.light : "var(--white)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{
                        fontWeight: 700, fontSize: 13,
                        color: orgType === t.value ? t.accent : "var(--text)",
                        marginBottom: 2,
                      }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.4 }}>
                        {t.description}
                      </div>
                    </button>
                  ))}
                </div>
                {errors.orgType && (
                  <p style={{ fontSize: 12, color: "var(--red)", marginTop: 6 }}>{errors.orgType}</p>
                )}

                {/* Feature preview based on org type */}
                {selectedType && (
                  <div className="animate-slidedown" style={{
                    marginTop: 12, padding: "10px 14px",
                    background: selectedType.light,
                    border: `1px solid ${selectedType.accent}30`,
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12.5, color: selectedType.accent,
                  }}>
                    <strong>{selectedType.icon} {selectedType.label} features:</strong>
                    <div style={{ marginTop: 4, lineHeight: 1.8 }}>
                      ✓ Normal queue · ✓ Senior Citizen priority (with ID verification)
                      {orgType === "hospital" && " · ✓ Emergency priority (with medical docs)"}
                      {" · "}✓ Authorized Priority (official email OTP)
                    </div>
                  </div>
                )}
              </div>

              <Divider />

              {/* Step 2: Organization Details */}
              <div style={{ marginTop: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 }}>
                  🏛️ Organization Details
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Input
                    label="Organization / Institute Name" required
                    value={form.orgName} onChange={set("orgName")}
                    placeholder={
                      orgType === "college" ? "e.g. Jain University" :
                      orgType === "hospital" ? "e.g. City General Hospital" :
                      orgType === "government" ? "e.g. District Collectorate" :
                      "e.g. Horizon Pvt Ltd"
                    }
                    error={errors.orgName}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Input
                      label="Department" required
                      value={form.department} onChange={set("department")}
                      placeholder={
                        orgType === "college" ? "e.g. Student Services" :
                        orgType === "hospital" ? "e.g. OPD" :
                        orgType === "government" ? "e.g. Revenue Department" :
                        "e.g. Customer Support"
                      }
                      error={errors.department}
                    />
                    <Input
                      label="Service Center / Counter" required
                      value={form.serviceCenter} onChange={set("serviceCenter")}
                      placeholder="e.g. Counter A"
                      error={errors.serviceCenter}
                    />
                  </div>

                  {/* Official Email Domain for Authorized Priority */}
                  <div>
                    <Input
                      label={`Official Email Domain (for Authorized Priority)`}
                      value={form.officialEmailDomain} onChange={set("officialEmailDomain")}
                      placeholder={selectedType?.emailHint || "e.g. organization.com"}
                    />
                    <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>
                      Staff/students with emails from this domain can use Authorized Priority via OTP.
                      {orgType === "college" && " e.g. @jainuniversity.ac.in"}
                    </p>
                  </div>
                </div>
              </div>

              <Divider />

              {/* Step 3: Admin Account */}
              <div style={{ marginTop: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 }}>
                  🔐 Admin Account
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Input
                      label="Username" required name="username" autoComplete="username"
                      value={form.username} onChange={set("username")}
                      placeholder="e.g. admin_user"
                      error={errors.username}
                    />
                    <Input
                      label="Email" required type="email" name="email" autoComplete="email"
                      value={form.email} onChange={set("email")}
                      placeholder="admin@organization.com"
                      error={errors.email}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Input
                      label="Password" required type="password" name="password" autoComplete="new-password"
                      value={form.password} onChange={set("password")}
                      placeholder="Min 6 characters"
                      error={errors.password}
                    />
                    <Input
                      label="Confirm Password" required type="password" autoComplete="new-password"
                      value={form.confirmPassword} onChange={set("confirmPassword")}
                      placeholder="Repeat password"
                      error={errors.confirmPassword}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" fullWidth size="lg" loading={loading} style={{ marginTop: 8 }}>
                {loading ? "Creating Organization..." : "Create Organization & Get Started →"}
              </Button>
            </form>
          </Card>

          <div className="animate-fadeup-3" style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link to="/admin/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Sign in here
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
