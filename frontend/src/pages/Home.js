import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Card, Button } from "../components/UI";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* Hero */}
      <main style={{ flex: 1 }}>
        <section style={{
          background: "linear-gradient(160deg, var(--white) 0%, var(--accent-light) 55%, var(--cream) 100%)",
          borderBottom: "1px solid var(--border)",
          padding: "72px 24px 72px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div className="animate-fadeup" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--accent-light)", border: "1px solid var(--accent-mid)",
              borderRadius: 99, padding: "5px 14px", marginBottom: 24,
              fontSize: 13, fontWeight: 600, color: "var(--accent)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, animation: "blink 1.5s ease infinite" }} />
              Real-time Queue Management
            </div>

            <h1 className="animate-fadeup-2" style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(36px, 6vw, 58px)",
              lineHeight: 1.1, letterSpacing: -1,
              marginBottom: 20,
            }}>
              Skip the wait.<br />
              <em style={{ color: "var(--accent)" }}>Serve smarter.</em>
            </h1>

            <p className="animate-fadeup-3" style={{
              fontSize: 18, color: "var(--text-muted)", lineHeight: 1.7,
              marginBottom: 40, maxWidth: 520, margin: "0 auto 40px",
            }}>
              QueueZen helps offices, hospitals, banks and universities manage queues digitally — with live updates, admin controls, and zero crowding.
            </p>

            <div className="animate-fadeup-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Button size="lg" onClick={() => navigate("/register")} style={{ minWidth: 180 }}>
                Register Your Office →
              </Button>
              <Button size="lg" variant="white" onClick={() => navigate("/admin/login")} style={{ minWidth: 160 }}>
                Admin Login
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px" }}>
          <div className="animate-fadeup" style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, marginBottom: 10 }}>
              Everything you need to manage queues
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: 16 }}>
              From hospitals to universities — QueueZen adapts to your organization.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            {[
              { icon: "⚡", title: "Real-Time Updates",   desc: "Socket.IO powered live queue sync. Admin actions instantly reflect on every user screen.", color: "var(--accent)", bg: "var(--accent-light)" },
              { icon: "🏛️", title: "Multi-Organization",  desc: "Each office gets its own isolated queue, custom theme, and admin controls.", color: "var(--blue)", bg: "var(--blue-light)" },
              { icon: "📊", title: "Live Analytics",       desc: "Track tokens, peak hours, crowd density, and avg service times — all in real time.", color: "var(--green)", bg: "var(--green-light)" },
              { icon: "🧓", title: "Priority Queuing",     desc: "Senior citizen, emergency, and authorized priority with document verification flows.", color: "var(--purple)", bg: "var(--purple-light)" },
              { icon: "🪑", title: "Multiple Counters",    desc: "Staff can log in per counter and manage their queue independently.", color: "var(--accent)", bg: "var(--accent-light)" },
              { icon: "📺", title: "TV Display Board",     desc: "Full-screen live display for waiting rooms — shows current and upcoming tokens.", color: "var(--green)", bg: "var(--green-light)" },
            ].map((f, i) => (
              <Card key={i} hoverable className={`animate-fadeup-${(i % 3) + 2}`} style={{ padding: 22 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 11,
                  background: f.bg, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 19, marginBottom: 14,
                  border: "1px solid rgba(0,0,0,0.04)",
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 7, color: f.color }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.65 }}>{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{
          background: "linear-gradient(135deg, var(--text) 0%, #2d2926 100%)",
          padding: "56px 24px", textAlign: "center",
        }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif", fontSize: 32,
              color: "#fff", marginBottom: 14,
            }}>
              Ready to digitize your queue?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, marginBottom: 32 }}>
              Register your organization in under 2 minutes. No credit card. No setup fee.
            </p>
            <Button size="lg" onClick={() => navigate("/register")} style={{ minWidth: 220 }}>
              Get Started Free →
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
