import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "../components/UI";
import QueueCard from "../components/QueueCard";
import {
  getCounterMe, counterCallNext, counterSkip, counterComplete,
  counterRecall, counterGetQueue,
} from "../utils/api";
import { connectToOrg, disconnectFromOrg } from "../utils/socket";
import toast from "react-hot-toast";

export default function CounterDashboard() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState(() => {
    try { return JSON.parse(localStorage.getItem("queuezen_staff")); } catch { return null; }
  });
  const [org, setOrg] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const socketRef = useRef(null);

  // ── Auth guard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem("queuezen_staff_token")) navigate("/counter/login");
  }, [navigate]);

  // ── Apply org theme ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (org?.orgType) {
      document.documentElement.setAttribute("data-theme", org.orgType);
    }
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [org?.orgType]);

  // ── Load me + queue ───────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [meRes, queueRes] = await Promise.all([
        getCounterMe(),
        staff?.orgId ? counterGetQueue(staff.orgId) : Promise.resolve({ data: { queue: [], stats: {} } }),
      ]);
      const { staff: s, org: o } = meRes.data;
      setStaff(s);
      setOrg(o);
      localStorage.setItem("queuezen_staff", JSON.stringify(s));
      setQueue(queueRes.data.queue || []);
      setStats(queueRes.data.stats || {});
    } catch (err) {
      if (err.response?.status !== 401) toast.error("Failed to load queue.");
    } finally {
      setLoading(false);
    }
  }, [staff?.orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Socket ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!staff?.orgId) return;
    const socket = connectToOrg(staff.orgId);
    socketRef.current = socket;

    socket.on("queueUpdated", ({ queue: q, stats: s }) => {
      setQueue(q || []);
      setStats(s || {});
    });

    socket.on("connect_error", () => toast.error("Live connection lost.", { id: "socket-err" }));

    return () => {
      disconnectFromOrg(staff.orgId);
      socket.off("queueUpdated");
      socket.off("connect_error");
    };
  }, [staff?.orgId]);

  // ── Actions ────────────────────────────────────────────────────────────────────
  const doAction = async (key, fn, successMsg) => {
    setActionLoading(key);
    try {
      const { data } = await fn();
      toast.success(data.message || successMsg);
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed.");
    } finally {
      setActionLoading("");
    }
  };

  const handleCallNext = () => doAction("next",     counterCallNext,  "Next token called!");
  const handleSkip     = () => doAction("skip",     counterSkip,      "Token skipped.");
  const handleComplete = () => doAction("complete", counterComplete,  "Token marked complete.");

  const handleRecall = async (tokenId) => {
    setActionLoading("recall_" + tokenId);
    try {
      const { data } = await counterRecall(tokenId);
      toast.success(data.message || "Token re-queued.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to recall token.");
    } finally {
      setActionLoading("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("queuezen_staff_token");
    localStorage.removeItem("queuezen_staff");
    navigate("/counter/login");
  };

  // ── Derived ────────────────────────────────────────────────────────────────────
  const counterName    = staff?.counterName;
  const myServing      = queue.find((t) => t.status === "serving" && t.counter === counterName);
  const waitingQueue   = queue.filter((t) => t.status === "waiting");
  const allServingNow  = queue.filter((t) => t.status === "serving");
  const skippedTokens  = queue.filter((t) => t.status === "skipped");

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <div style={{ color: "var(--text-muted)" }}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background: "var(--white)", borderBottom: "1px solid var(--border)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, lineHeight: 1.1 }}>
            {counterName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {org?.orgName} · Counter Staff
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "blink 1.5s ease infinite" }} />
            Live
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 14px", borderRadius: "var(--radius-sm)",
              border: "1.5px solid var(--border)", background: "var(--stone)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", color: "var(--text-muted)",
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Serving banner ── */}
      {myServing && (
        <div style={{
          background: "var(--green)", color: "#fff",
          textAlign: "center", padding: "9px 16px",
          fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.7)", animation: "blink 1.2s ease infinite" }} />
          Now Serving: <strong>{myServing.tokenDisplay}</strong> — {myServing.name}
        </div>
      )}

      <div className="counter-main-grid" style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px", display: "grid", gridTemplateColumns: "clamp(260px, 30%, 320px) 1fr", gap: 20 }}>

        {/* ── Controls ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 16 }}>
              {counterName}
            </h3>

            {myServing && (
              <div style={{
                background: "var(--green-light)", border: "1.5px solid var(--green)",
                borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>
                  Currently Serving
                </div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "var(--green)", lineHeight: 1 }}>
                  {myServing.tokenDisplay}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{myServing.name}</div>
              </div>
            )}

            {!myServing && waitingQueue.length > 0 && (
              <div style={{
                background: "var(--accent-light)", border: "1px dashed var(--accent-mid)",
                borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 16,
                fontSize: 13, color: "var(--accent)",
              }}>
                🎯 Next: <strong>{waitingQueue[0].tokenDisplay}</strong> — {waitingQueue[0].name}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button
                variant="success" fullWidth size="lg"
                onClick={handleCallNext}
                loading={actionLoading === "next"}
                disabled={waitingQueue.length === 0}
              >
                ▶ Call Next
                {waitingQueue.length > 0 && (
                  <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 8px", fontSize: 12 }}>
                    {waitingQueue.length}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost" fullWidth
                onClick={handleComplete}
                loading={actionLoading === "complete"}
                disabled={!myServing}
                style={{ color: "var(--blue)" }}
              >
                ✓ Mark Complete
              </Button>
              <Button
                variant="ghost" fullWidth
                onClick={handleSkip}
                loading={actionLoading === "skip"}
                disabled={!myServing}
                style={{ color: "var(--text-mid)" }}
              >
                ⏭ Skip
              </Button>
            </div>
          </Card>

          {/* Stats */}
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>
              Queue Overview
            </div>
            {[
              ["Waiting",  waitingQueue.length,                            "var(--accent)"],
              ["Serving",  allServingNow.length,                           "var(--green)"],
              ["Skipped",  skippedTokens.length,                           "var(--red)"],
              ["Done",     stats.completed || 0,                           "var(--text-muted)"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <strong style={{ color }}>{val}</strong>
              </div>
            ))}
          </Card>

          {/* Other counters serving */}
          {allServingNow.filter((t) => t.counter !== counterName).length > 0 && (
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
                Other Counters
              </div>
              {allServingNow.filter((t) => t.counter !== counterName).map((t) => (
                <div key={t._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text-muted)" }}>{t.counter || "Admin"}</span>
                  <strong style={{ color: "var(--green)" }}>{t.tokenDisplay}</strong>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* ── Queue list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Waiting */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>Waiting Queue</h3>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
                {waitingQueue.length}
              </span>
            </div>
            {waitingQueue.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <div style={{ fontWeight: 600 }}>Queue is empty!</div>
              </div>
            ) : (
              <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                {waitingQueue.map((t, i) => (
                  <QueueCard key={t._id} token={t} position={i} />
                ))}
              </div>
            )}
          </Card>

          {/* Skipped with recall */}
          {skippedTokens.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18 }}>Skipped Tokens</h3>
              </div>
              <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {skippedTokens.map((t) => (
                  <div key={t._id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 12px", borderRadius: "var(--radius-sm)",
                    background: "var(--stone)", border: "1px solid var(--border)",
                  }}>
                    <div>
                      <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "var(--text-muted)", marginRight: 10 }}>
                        {t.tokenDisplay}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.name}</span>
                    </div>
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => handleRecall(t._id)}
                      loading={actionLoading === "recall_" + t._id}
                      style={{ color: "var(--accent)", borderColor: "var(--accent-mid)", background: "var(--accent-light)" }}
                    >
                      ↩ Re-queue
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
