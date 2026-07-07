import React from "react";

export default function Footer() {
  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      background: "var(--white)",
    }}>

      {/* ── Main footer row ── */}
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: "linear-gradient(135deg, var(--accent), #e8953a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 12,
          }}>Q</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-mid)" }}>QueueZen</span>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>— Intelligent Queue Management</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", display: "flex", gap: 14, alignItems: "center" }}>
          <span>React</span><span>·</span>
          <span>Node.js</span><span>·</span>
          <span>MongoDB</span><span>·</span>
          <span>Socket.IO</span>
        </div>
      </div>

      {/* ── Group credit band ── */}
      <div style={{
        borderTop: "1px solid var(--border)",
        background: "linear-gradient(135deg, #1a1a1a 0%, #2d2926 100%)",
        padding: "14px 24px",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 14,
        }}>

          {/* Left */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 10, padding: "7px 14px",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <span style={{ fontSize: 16 }}>🎓</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.1, lineHeight: 1, marginBottom: 2 }}>
                  TD-PCL Project
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", letterSpacing: 0.2, lineHeight: 1 }}>
                  Made by Group 56
                </div>
              </div>
            </div>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", opacity: 0.8, flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
              Trans-Disciplinary Project Centric Learning
            </div>
            {/* <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
             Yashas R · Rachel Mary Mathew · Zoya Tarannum · Amina Munna · Hamza Muhammed · Sadanand
            </div> */}
          </div>

          {/* Right — Jain University */}
          <a
            href="https://www.jainuniversity.ac.in"
            target="_blank"
            rel="noreferrer"
            title="JAIN (Deemed-to-be University), Bangalore"
            style={{
              display: "flex", alignItems: "center", gap: 11,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.13)",
              borderRadius: 10, padding: "9px 16px",
              textDecoration: "none",
              transition: "background 0.18s",
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.13)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
          >
            <svg height="24" viewBox="0 0 168 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="5" height="38" rx="2.5" fill="white" />
              <text x="12" y="29" fontFamily="Georgia, serif" fontWeight="900" fontSize="28" fill="white" letterSpacing="3">JAIN</text>
              <circle cx="161" cy="7" r="6" fill="#e8953a" />
            </svg>
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.18)", paddingLeft: 11 }}>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.9, lineHeight: 1, marginBottom: 3 }}>
                Deemed-to-be University
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: 600, lineHeight: 1 }}>
                Bangalore, India
              </div>
            </div>
          </a>

        </div>
      </div>

    </footer>
  );
}