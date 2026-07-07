import React from "react";

// ─── Button ───────────────────────────────────────────────────────────────────
export function Button({
  children, onClick, variant = "primary", size = "md",
  disabled = false, loading = false, style = {}, type = "button", fullWidth = false,
}) {
  const sizes = {
    sm: { padding: "6px 13px", fontSize: 12.5 },
    md: { padding: "10px 20px", fontSize: 14 },
    lg: { padding: "13px 28px", fontSize: 15 },
  };

  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    border: "none", cursor: disabled || loading ? "not-allowed" : "pointer",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: 0.1,
    transition: "filter 0.13s ease, transform 0.1s ease, box-shadow 0.13s ease",
    borderRadius: "var(--radius-sm)",
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    position: "relative",
    overflow: "hidden",
    userSelect: "none",
    ...sizes[size],
  };

  const variants = {
    primary: {
      background: "var(--accent)",
      color: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.15), 0 1px 0 rgba(255,255,255,0.1) inset",
    },
    success: {
      background: "var(--green)",
      color: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
    },
    danger: {
      background: "var(--red)",
      color: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    },
    ghost: {
      background: "var(--stone)",
      color: "var(--text-mid)",
      boxShadow: "none",
    },
    outline: {
      background: "transparent",
      color: "var(--text)",
      border: "1.5px solid var(--border)",
      boxShadow: "none",
    },
    white: {
      background: "var(--white)",
      color: "var(--text)",
      border: "1.5px solid var(--border)",
      boxShadow: "var(--shadow-sm)",
    },
  };

  return (
    <button
      type={type}
      onClick={disabled || loading ? undefined : onClick}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={e => {
        if (disabled || loading) return;
        e.currentTarget.style.filter = "brightness(0.91)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = "";
        e.currentTarget.style.transform = "";
      }}
      onMouseDown={e => {
        if (disabled || loading) return;
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = "";
      }}
    >
      {loading && (
        <span style={{
          width: 13, height: 13,
          border: "2px solid rgba(255,255,255,0.35)",
          borderTopColor: "#fff",
          borderRadius: "50%",
          display: "inline-block",
          animation: "spin 0.65s linear infinite",
          flexShrink: 0,
        }} />
      )}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, className = "", onClick, hoverable = false }) {
  const hoverClass = hoverable ? "card-hover" : "";
  return (
    <div
      className={[hoverClass, className].filter(Boolean).join(" ")}
      onClick={onClick}
      style={{
        background: "var(--white)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
        padding: 24,
        ...style,
        ...(onClick ? { cursor: "pointer" } : {}),
      }}
    >
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({
  label, value, onChange, placeholder, type = "text",
  error, required, name, autoComplete,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <label style={{
          fontSize: 12, fontWeight: 700, color: "var(--text-muted)",
          letterSpacing: 0.4, textTransform: "uppercase",
        }}>
          {label}
          {required && <span style={{ color: "var(--red)", marginLeft: 3 }}>*</span>}
        </label>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          padding: "10px 13px",
          borderRadius: "var(--radius-sm)",
          border: `1.5px solid ${error ? "var(--red)" : "var(--border)"}`,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          color: "var(--text)",
          background: "var(--white)",
          outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          width: "100%",
        }}
        onFocus={e => {
          e.target.style.borderColor = error ? "var(--red)" : "var(--accent)";
          e.target.style.boxShadow = `0 0 0 3px var(--accent-light)`;
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? "var(--red)" : "var(--border)";
          e.target.style.boxShadow = "none";
        }}
      />
      {error && (
        <span style={{ fontSize: 12, color: "var(--red)", display: "flex", alignItems: "center", gap: 4 }}>
          ⚠ {error}
        </span>
      )}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const STATUS = {
  waiting:   { bg: "var(--accent-light)",  text: "var(--accent)",  dot: "var(--accent)",  label: "Waiting" },
  serving:   { bg: "var(--green-light)",   text: "var(--green)",   dot: "var(--green)",   label: "Serving" },
  completed: { bg: "var(--blue-light)",    text: "var(--blue)",    dot: "var(--blue)",    label: "Completed" },
  skipped:   { bg: "var(--stone)",         text: "var(--text-muted)", dot: "var(--text-faint)", label: "Skipped" },
};

export function StatusBadge({ status }) {
  const c = STATUS[status] || STATUS.waiting;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: c.bg, color: c.text,
      padding: "3px 10px", borderRadius: 99,
      fontSize: 12, fontWeight: 700, letterSpacing: 0.3, whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0,
        ...(status === "serving" ? { animation: "blink 1.2s ease infinite" } : {}),
      }} />
      {c.label}
    </span>
  );
}

// ─── Tag / Pill ───────────────────────────────────────────────────────────────
export function Tag({ children, color = "var(--text-muted)", bg = "var(--stone)", style = {} }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 9px", borderRadius: 99,
      fontSize: 11.5, fontWeight: 700,
      color, background: bg,
      ...style,
    }}>
      {children}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 24, color = "var(--accent)" }) {
  return (
    <span style={{
      width: size, height: size,
      border: `2.5px solid rgba(0,0,0,0.08)`,
      borderTopColor: color,
      borderRadius: "50%",
      display: "inline-block",
      animation: "spin 0.65s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
export function Alert({ type = "info", children }) {
  const map = {
    info:    { bg: "var(--blue-light)",   text: "var(--blue)",   border: "#b8d0f5", icon: "ℹ" },
    success: { bg: "var(--green-light)",  text: "var(--green)",  border: "#9fd4be", icon: "✓" },
    error:   { bg: "var(--red-light)",    text: "var(--red)",    border: "#f5b4ad", icon: "✕" },
    warning: { bg: "var(--accent-light)", text: "var(--accent)", border: "var(--accent-mid)", icon: "⚠" },
  };
  const s = map[type];
  return (
    <div style={{
      background: s.bg, color: s.text,
      border: `1px solid ${s.border}`,
      borderRadius: "var(--radius-sm)",
      padding: "10px 14px",
      fontSize: 13.5, fontWeight: 500,
      display: "flex", alignItems: "flex-start", gap: 8,
    }}>
      <span style={{ flexShrink: 0, fontWeight: 700 }}>{s.icon}</span>
      <span>{children}</span>
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      {label && (
        <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600, whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon = "📭", title, subtitle }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>{icon}</div>
      {title && <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 6 }}>{title}</div>}
      {subtitle && <div style={{ fontSize: 13, lineHeight: 1.6 }}>{subtitle}</div>}
    </div>
  );
}
