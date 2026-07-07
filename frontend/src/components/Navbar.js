import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const ORG_TYPE_ICONS = {
  college: "🎓", business: "🏢", government: "🏛️", hospital: "🏥",
};

export default function Navbar({ org, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="glass" style={{
      borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 200,
      boxShadow: "0 1px 0 var(--border), var(--shadow-sm)",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "0 24px", height: 58,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12,
      }}>

        {/* Logo */}
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex", alignItems: "center", gap: 9,
            background: "none", border: "none", cursor: "pointer",
            padding: 0, flexShrink: 0,
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 70%, #000) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 15,
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            letterSpacing: -1,
          }}>Q</div>
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 19, letterSpacing: -0.3, color: "var(--text)",
          }}>
            QueueZen
          </span>
        </button>

        {/* Org pill (shown on public/admin pages when org context exists) */}
        {org && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--stone)", border: "1px solid var(--border)",
            borderRadius: 99, padding: "5px 13px",
            flex: 1, maxWidth: 380, overflow: "hidden",
          }}>
            <span style={{ fontSize: 13 }}>
              {ORG_TYPE_ICONS[org.orgType] || "🏢"}
            </span>
            <span style={{
              fontSize: 13, fontWeight: 600, color: "var(--text)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {org.orgName}
            </span>
            <span style={{ color: "var(--border)", flexShrink: 0 }}>·</span>
            <span style={{
              fontSize: 12, color: "var(--text-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {org.serviceCenter}
            </span>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: org.isQueueOpen !== false ? "var(--green)" : "var(--red)",
              flexShrink: 0, marginLeft: 2,
            }} title={org.isQueueOpen !== false ? "Queue open" : "Queue closed"} />
          </div>
        )}

        {/* Nav actions */}
        <nav style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {onLogout ? (
            <>
              <span className="hide-mobile" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text)" }}>{org?.username}</strong>
              </span>
              <NavButton
                onClick={onLogout}
                style={{ color: "var(--red)", borderColor: "var(--red-light)" }}
              >
                Sign Out
              </NavButton>
            </>
          ) : (
            <>
              <NavButton
                onClick={() => navigate("/admin/login")}
              >
                Admin Login
              </NavButton>
              <button
                onClick={() => navigate("/register")}
                style={{
                  padding: "7px 16px", borderRadius: "var(--radius-sm)",
                  border: "none", background: "var(--accent)", color: "#fff",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "filter 0.13s, transform 0.1s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={e => e.currentTarget.style.filter = "brightness(0.9)"}
                onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = ""; }}
                onMouseDown={e => e.currentTarget.style.transform = "scale(0.96)"}
                onMouseUp={e => e.currentTarget.style.transform = ""}
              >
                Register →
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavButton({ children, onClick, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: "var(--radius-sm)",
        border: "1.5px solid var(--border)", background: "transparent",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        color: "var(--text-muted)", transition: "all 0.13s",
        fontFamily: "'DM Sans', sans-serif",
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "var(--stone)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = style.color || "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}
