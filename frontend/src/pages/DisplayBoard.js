import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { getQueue } from "../utils/api";
import { connectToOrg, disconnectFromOrg } from "../utils/socket";

const PRIORITY_COLORS = {
  emergency: "#ef4444",
  senior:    "#3b82f6",
  authorized:"#8b5cf6",
  normal:    "#6b7280",
};

const PRIORITY_LABELS = {
  emergency: "Emergency",
  senior:    "Senior",
  authorized:"Auth.",
  normal:    "",
};

export default function DisplayBoard() {
  const { orgId } = useParams();
  const [org, setOrg] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [error, setError] = useState("");
  const [clock, setClock] = useState(new Date());
  const socketRef = useRef(null);

  // ── Clock ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    try {
      const { data } = await getQueue(orgId);
      setOrg(data.org);
      setQueue(data.queue || []);
      setStats(data.stats || {});
    } catch {
      setError("Failed to load. Please refresh.");
    }
  }, [orgId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  // ── Socket ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    const socket = connectToOrg(orgId);
    socketRef.current = socket;

    socket.on("queueUpdated", ({ queue: q, stats: s }) => {
      setQueue(q || []);
      setStats(s || {});
    });

    return () => {
      disconnectFromOrg(orgId);
      socket.off("queueUpdated");
    };
  }, [orgId]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const servingTokens = queue.filter((t) => t.status === "serving");
  const waitingQueue  = queue.filter((t) => t.status === "waiting");

  const formatTime = (d) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const formatDate = (d) => d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#ef4444", fontSize: 20, fontFamily: "DM Sans, sans-serif" }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0a 0%, #111827 100%)",
      color: "#fff",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "20px 40px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.03)",
      }}>
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>
            Queue Display
          </div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "#fff", lineHeight: 1.1 }}>
            {org?.orgName || "Loading..."}
          </div>
          {org && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>
              {org.department} · {org.serviceCenter}
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 40, lineHeight: 1, color: "#fff" }}>
            {formatTime(clock)}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
            {formatDate(clock)}
          </div>
        </div>
      </div>

      {/* ── Closed banner ── */}
      {org && !org.isQueueOpen && (
        <div style={{
          background: "#ef4444", color: "#fff",
          textAlign: "center", padding: "12px 24px",
          fontSize: 16, fontWeight: 700, letterSpacing: 0.5,
        }}>
          QUEUE CURRENTLY CLOSED
        </div>
      )}

      <div style={{ flex: 1, padding: "32px 40px", display: "flex", gap: 32 }}>

        {/* ── Now Serving ── */}
        <div style={{ flex: 1.4 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 20,
          }}>
            Now Serving
          </div>

          {servingTokens.length === 0 ? (
            <div style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16, padding: "60px 40px", textAlign: "center",
            }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>—</div>
              <div style={{ fontSize: 18, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                No one being served right now
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {servingTokens.map((token) => (
                <ServingCard key={token._id} token={token} />
              ))}
            </div>
          )}

          {/* ── Stats row ── */}
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            {[
              { label: "Waiting",   value: stats.waiting   || 0, color: "#f59e0b" },
              { label: "Completed", value: stats.completed || 0, color: "#10b981" },
              { label: "Skipped",   value: stats.skipped   || 0, color: "#ef4444" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                flex: 1, background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "16px 20px", textAlign: "center",
              }}>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 36, color, lineHeight: 1 }}>
                  {value}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Waiting Queue ── */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 20,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>Up Next</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>
              {waitingQueue.length} waiting
            </span>
          </div>

          {waitingQueue.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              color: "rgba(255,255,255,0.2)", fontSize: 16,
            }}>
              Queue is empty
            </div>
          ) : (
            <div style={{
              display: "flex", flexDirection: "column", gap: 6,
              maxHeight: "calc(100vh - 280px)", overflowY: "auto",
            }}>
              {waitingQueue.slice(0, 15).map((token, i) => (
                <WaitingRow key={token._id} token={token} position={i} />
              ))}
              {waitingQueue.length > 15 && (
                <div style={{
                  textAlign: "center", padding: "12px 0",
                  color: "rgba(255,255,255,0.3)", fontSize: 13,
                }}>
                  +{waitingQueue.length - 15} more in queue
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: "12px 40px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
          QueueZen · Live Display · Updates automatically
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10b981", marginLeft: 8, verticalAlign: "middle", animation: "blink 1.5s ease infinite" }} />
        </div>
      </div>
    </div>
  );
}

function ServingCard({ token }) {
  const priorityColor = PRIORITY_COLORS[token.priority] || "#6b7280";
  const priorityLabel = PRIORITY_LABELS[token.priority] || "";

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
      border: "1.5px solid rgba(16,185,129,0.3)",
      borderRadius: 20,
      padding: "28px 36px",
      display: "flex", alignItems: "center", gap: 28,
      position: "relative", overflow: "hidden",
    }}>
      {/* Pulse indicator */}
      <div style={{
        position: "absolute", top: 20, right: 20,
        width: 10, height: 10, borderRadius: "50%",
        background: "#10b981", animation: "blink 1.2s ease infinite",
      }} />

      {/* Token number */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 80, lineHeight: 1,
          color: "#10b981",
          textShadow: "0 0 40px rgba(16,185,129,0.4)",
        }}>
          {token.tokenDisplay}
        </div>
        {priorityLabel && (
          <div style={{
            marginTop: 6, fontSize: 12, fontWeight: 700,
            color: priorityColor, textTransform: "uppercase", letterSpacing: 1,
          }}>
            {priorityLabel}
          </div>
        )}
      </div>

      {/* Name + counter */}
      <div>
        <div style={{ fontSize: 28, fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>
          {token.name}
        </div>
        {token.counter && (
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", marginTop: 8, fontWeight: 500 }}>
            Counter: {token.counter}
          </div>
        )}
      </div>
    </div>
  );
}

function WaitingRow({ token, position }) {
  const priorityColor = PRIORITY_COLORS[token.priority] || "#6b7280";
  const priorityLabel = PRIORITY_LABELS[token.priority];
  const isNext = position === 0;

  return (
    <div style={{
      background: isNext
        ? "rgba(245,158,11,0.08)"
        : "rgba(255,255,255,0.03)",
      border: `1px solid ${isNext ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 10,
      padding: "12px 18px",
      display: "flex", alignItems: "center", gap: 14,
      transition: "all 0.2s",
    }}>
      <div style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: 22,
        color: isNext ? "#f59e0b" : "rgba(255,255,255,0.7)",
        minWidth: 70,
      }}>
        {token.tokenDisplay}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
          {token.name}
        </div>
        {priorityLabel && (
          <div style={{ fontSize: 11, color: priorityColor, fontWeight: 600, marginTop: 1 }}>
            {priorityLabel}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 12, color: "rgba(255,255,255,0.25)",
        minWidth: 20, textAlign: "right",
      }}>
        #{position + 1}
      </div>
    </div>
  );
}
