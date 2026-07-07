import React from "react";
import { StatusBadge } from "./UI";

const PRIORITY_CONFIG = {
  senior:     { icon: "🧓", label: "Senior",        color: "var(--blue)",   bg: "var(--blue-light)" },
  emergency:  { icon: "🚨", label: "Emergency",     color: "var(--red)",    bg: "var(--red-light)" },
  authorized: { icon: "🔐", label: "Auth. Priority", color: "var(--accent)", bg: "var(--accent-light)" },
};

const PRIORITY_STATUS_ICONS = {
  approved: { icon: "✓", label: "Verified" },
  pending:  { icon: "⏳", label: "Pending"  },
  rejected: { icon: "✗", label: "Rejected" },
};

function StarRating({ rating }) {
  return (
    <span style={{ fontSize: 11, letterSpacing: -1, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= rating ? "#f59e0b" : "var(--border)" }}>★</span>
      ))}
    </span>
  );
}

export default function QueueCard({ token, isMe, position }) {
  const isServing   = token.status === "serving";
  const isCompleted = token.status === "completed";
  const isSkipped   = token.status === "skipped";
  const isHistory   = isCompleted || isSkipped;
  const pConfig     = PRIORITY_CONFIG[token.priority];
  const psInfo      = PRIORITY_STATUS_ICONS[token.priorityStatus];
  const showPriorityStatus = token.priority !== "normal" &&
    token.priorityStatus && token.priorityStatus !== "none";

  return (
    <div
      className={isServing ? "serving-glow" : ""}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 14px",
        borderRadius: "var(--radius-sm)",
        background: isServing   ? "var(--green-light)"
                  : isMe        ? "var(--accent-light)"
                  : isSkipped   ? "var(--stone)"
                  : isCompleted ? "#fafafa"
                  : "var(--cream)",
        border: isServing   ? "1.5px solid var(--green)"
              : isMe        ? "1.5px solid var(--accent-mid)"
              : isHistory   ? "1px solid var(--border)"
              : "1.5px solid transparent",
        opacity: isSkipped ? 0.75 : 1,
        transition: "all 0.25s ease",
        position: "relative",
      }}
    >
      {/* Position badge */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: isServing   ? "var(--green)"
                  : isMe        ? "var(--accent)"
                  : isCompleted ? "var(--blue)"
                  : isSkipped   ? "var(--text-faint)"
                  : "var(--border)",
        color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Serif Display', serif",
        fontWeight: 700, fontSize: 13,
      }}>
        {isServing   ? "★"
       : isCompleted ? "✓"
       : isSkipped   ? "–"
       : position !== undefined ? position + 1 : "–"}
      </div>

      {/* Name + info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          flexWrap: "wrap", marginBottom: 1,
        }}>
          <span style={{
            fontWeight: 600, fontSize: 13.5,
            color: isHistory ? "var(--text-muted)" : "var(--text)",
          }}>
            {token.name}
          </span>

          {isMe && (
            <span style={{
              fontSize: 10.5, background: "var(--accent)", color: "#fff",
              borderRadius: 99, padding: "1px 7px", fontWeight: 700,
            }}>
              You
            </span>
          )}

          {pConfig && (
            <span style={{
              fontSize: 10.5, borderRadius: 99, padding: "1px 7px",
              fontWeight: 700, background: pConfig.bg, color: pConfig.color,
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>
              {pConfig.icon} {pConfig.label}
              {showPriorityStatus && psInfo && (
                <span style={{ opacity: 0.75 }}>· {psInfo.icon} {psInfo.label}</span>
              )}
            </span>
          )}
        </div>

        <div style={{
          fontSize: 11.5, color: "var(--text-faint)",
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", color: "var(--text-muted)" }}>
            {token.tokenDisplay}
          </span>

          {token.phone && (
            <span>· {token.phone}</span>
          )}

          {/* Counter name for serving tokens */}
          {isServing && token.counter && (
            <span style={{
              background: "rgba(45,122,85,0.12)", color: "var(--green)",
              borderRadius: 99, padding: "1px 7px", fontWeight: 600, fontSize: 10.5,
            }}>
              🪑 {token.counter}
            </span>
          )}

          {/* Feedback rating for completed tokens */}
          {isCompleted && token.feedback?.rating && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <StarRating rating={token.feedback.rating} />
            </span>
          )}
        </div>
      </div>

      {/* Status badge — hide for normal history to reduce clutter */}
      <StatusBadge status={token.status} />

      {/* Serving pulse dot */}
      {isServing && (
        <span style={{
          position: "absolute", top: 9, right: 9,
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--green)", flexShrink: 0,
        }}>
          <span style={{
            position: "absolute", inset: 0,
            borderRadius: "50%",
            background: "var(--green)",
            animation: "pulse-ring 1.6s ease-out infinite",
          }} />
        </span>
      )}
    </div>
  );
}
