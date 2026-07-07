import React from "react";

export default function StatsCard({ label, value, icon, color, bg }) {
  return (
    <div
      className="card-hover"
      style={{
        background: bg || "var(--white)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: color || "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>
          {label}
        </span>
        <span style={{ fontSize: 18 }}>{icon}</span>
      </div>
      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 30, lineHeight: 1,
        color: color || "var(--text)",
      }}>
        {value}
      </div>
    </div>
  );
}
