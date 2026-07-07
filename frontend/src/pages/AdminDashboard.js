import AnalyticsDashboard from "../components/AnalyticsDashboard";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import StatsCard from "../components/StatsCard";
import QueueCard from "../components/QueueCard";
import { Card, Button, Input, Alert } from "../components/UI";
import { connectToOrg, disconnectFromOrg } from "../utils/socket";
import {
  getQueue, callNext, skipCurrent, completeCurrent,
  clearQueue, updateSettings, verifyPriority, getUploadUrl,
  toggleQueue, recallToken, getStaffList, createStaff, deleteStaff,
} from "../utils/api";
import toast from "react-hot-toast";

const PRIORITY_LABELS = {
  senior: { label: "Senior Citizen", icon: "🧓", color: "var(--blue)", bg: "var(--blue-light)" },
  emergency: { label: "Emergency", icon: "🚨", color: "var(--red)", bg: "var(--red-light)" },
  authorized: { label: "Authorized Priority", icon: "🔐", color: "var(--accent)", bg: "var(--accent-light)" },
};

const ORG_TYPE_ICONS = { college: "🎓", business: "🏢", government: "🏛️", hospital: "🏥" };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [org, setOrg] = useState(() => {
    try { return JSON.parse(localStorage.getItem("queuezen_org")); } catch { return null; }
  });
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({ total: 0, waiting: 0, serving: 0, completed: 0, skipped: 0, avgWaitMinutes: null, avgServiceMinutes: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [settingsForm, setSettingsForm] = useState({ orgName: "", department: "", serviceCenter: "", officialEmailDomain: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("queue");
  const [showQR, setShowQR] = useState(false);
  const [verifyingId, setVerifyingId] = useState("");
  const [togglingQueue, setTogglingQueue] = useState(false);
  const [recallingId, setRecallingId] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [newStaff, setNewStaff] = useState({ counterName: "", username: "", password: "" });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const socketRef = useRef(null);
  const qrPanelRef = useRef(null);
  const prevPendingCountRef = useRef(0);
  const socketConnectedRef = useRef(false);

  // ── Auth guard ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!org || !localStorage.getItem("queuezen_token")) navigate("/admin/login");
  }, [org, navigate]);

  // ── Apply theme ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (org?.orgType) {
      document.documentElement.setAttribute("data-theme", org.orgType);
    }
  }, [org?.orgType]);

  // ── Load initial data ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!org) return;
    try {
      const { data } = await getQueue(org._id || org.id);
      setQueue(data.queue || []);
      setStats({
        total: data.stats?.total || 0,
        waiting: data.stats?.waiting || 0,
        serving: data.stats?.serving || 0,
        completed: data.stats?.completed || 0,
        skipped: data.stats?.skipped || 0,
        avgWaitMinutes: data.stats?.avgWaitMinutes ?? null,
        avgServiceMinutes: data.stats?.avgServiceMinutes ?? null,
      });
      const freshOrg = data.org;
      setOrg(freshOrg);
      localStorage.setItem("queuezen_org", JSON.stringify(freshOrg));
      setSettingsForm({
        orgName: freshOrg.orgName || "",
        department: freshOrg.department || "",
        serviceCenter: freshOrg.serviceCenter || "",
        officialEmailDomain: freshOrg.officialEmailDomain || "",
      });
    } catch (err) {
      if (err.response?.status !== 401) toast.error("Failed to load queue data.");
    } finally {
      setLoading(false);
    }
  }, [org?._id, org?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Notification sound for priority requests ───────────────────────────────────
  const playPriorityAlert = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const beep = (freq, start, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };
      beep(880, ctx.currentTime, 0.1);
      beep(880, ctx.currentTime + 0.14, 0.1);
      beep(1100, ctx.currentTime + 0.28, 0.22);
    } catch (e) {
      console.warn("Audio not supported:", e);
    }
  };

  // ── Socket.IO ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!org?._id && !org?.id) return;
    const socket = connectToOrg(org._id || org.id);
    socketRef.current = socket;

    socket.on("queueUpdated", ({ queue: q, stats: s }) => {
      setQueue(q || []);
      setStats({
        total: s?.total || 0,
        waiting: s?.waiting || 0,
        serving: s?.serving || 0,
        completed: s?.completed || 0,
        skipped: s?.skipped || 0,
        avgWaitMinutes: s?.avgWaitMinutes ?? null,
        avgServiceMinutes: s?.avgServiceMinutes ?? null,
      });
    });

    socket.on("priorityRequest", (data) => {
      const label = PRIORITY_LABELS[data.priority]?.label || data.priority;
      playPriorityAlert();
      toast(`🔔 Priority request: ${data.name} (${label}) — ${data.tokenDisplay}`, {
        duration: 8000,
        style: {
          background: "#1a1a1a", color: "#fff",
          border: "1px solid rgba(255,255,255,0.1)",
        },
      });
    });

    const handleConnectError = () => toast.error("Live connection lost. Retrying...", { id: "socket-err" });
    const handleReconnect = () => {
      if (!socketConnectedRef.current) {
        socketConnectedRef.current = true;
        return;
      }
      toast.success("Live connection restored.", { id: "socket-err" });
      loadData();
    };

    socket.on("connect_error", handleConnectError);
    socket.on("connect", handleReconnect);

    return () => {
      disconnectFromOrg(org._id || org.id);
      socket.off("queueUpdated");
      socket.off("priorityRequest");
      socket.off("connect_error", handleConnectError);
      socket.off("connect", handleReconnect);
      socketConnectedRef.current = false;
    };
  }, [org?._id, org?.id, loadData]);

  // ── Actions ────────────────────────────────────────────────────────────────────
  const doAction = async (action, fn, successMsg) => {
    setActionLoading(action);
    try {
      await fn();
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed.");
    } finally {
      setActionLoading("");
    }
  };

  const handleCallNext  = () => doAction("next",     callNext,        "Next token called!");
  const handleSkip      = () => doAction("skip",     skipCurrent,     "Token skipped.");
  const handleComplete  = () => doAction("complete", completeCurrent, "Token marked complete.");
  const handleClear     = async () => {
    if (!window.confirm("Clear the entire queue? This cannot be undone.")) return;
    doAction("clear", clearQueue, "Queue cleared.");
  };

  const handleVerifyPriority = async (tokenId, action) => {
    setVerifyingId(tokenId + action);
    try {
      const { data } = await verifyPriority(tokenId, action);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process request.");
    } finally {
      setVerifyingId("");
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsSuccess(false);
    try {
      const { data } = await updateSettings(settingsForm);
      const updatedOrg = data.org;
      setOrg(updatedOrg);
      localStorage.setItem("queuezen_org", JSON.stringify(updatedOrg));
      setSettingsSuccess(true);
      toast.success("Settings saved!");
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggleQueue = async () => {
    setTogglingQueue(true);
    try {
      const { data } = await toggleQueue();
      setOrg((prev) => ({ ...prev, isQueueOpen: data.isQueueOpen }));
      toast.success(data.message);
    } catch {
      toast.error("Failed to toggle queue.");
    } finally {
      setTogglingQueue(false);
    }
  };

  const handleRecall = async (tokenId) => {
    setRecallingId(tokenId);
    try {
      const { data } = await recallToken(tokenId);
      toast.success(data.message || "Token re-queued.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to recall token.");
    } finally {
      setRecallingId("");
    }
  };

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const { data } = await getStaffList();
      setStaffList(data.staff || []);
    } catch {
      toast.error("Failed to load staff.");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.counterName || !newStaff.username || !newStaff.password) {
      toast.error("All fields are required.");
      return;
    }
    setCreatingStaff(true);
    try {
      const { data } = await createStaff(newStaff);
      toast.success(data.message);
      setNewStaff({ counterName: "", username: "", password: "" });
      loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create staff.");
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleDeleteStaff = async (staffId, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const { data } = await deleteStaff(staffId);
      toast.success(data.message);
      loadStaff();
    } catch {
      toast.error("Failed to delete staff.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("queuezen_token");
    localStorage.removeItem("queuezen_org");
    document.documentElement.removeAttribute("data-theme");
    navigate("/admin/login");
  };

  // ── Derived ────────────────────────────────────────────────────────────────────
  const serving      = queue.find((t) => t.status === "serving");
  const waitingQueue = queue.filter((t) => t.status === "waiting");
  const historyQueue = queue.filter((t) => t.status === "completed" || t.status === "skipped");
  const pendingPriorityRequests = queue.filter(
    (t) => t.status === "waiting" &&
           t.priorityStatus === "pending" &&
           (t.priority === "senior" || t.priority === "emergency")
  );
  const orgId = org?._id || org?.id;
  const orgTypeIcon = ORG_TYPE_ICONS[org?.orgType] || "🏢";

  if (!org) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar org={org} onLogout={handleLogout} />

      {/* Serving ticker */}
      {serving && (
        <div style={{
          background: "var(--green)", color: "#fff",
          textAlign: "center", padding: "9px 16px",
          fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.7)", animation: "blink 1.2s ease infinite" }} />
          Now Serving: <strong>{serving.tokenDisplay}</strong> — {serving.name}
        </div>
      )}

      {/* Priority request banner */}
      {pendingPriorityRequests.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff",
          padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          fontSize: 13.5, fontWeight: 600,
        }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <span>
            {pendingPriorityRequests.length} priority verification request{pendingPriorityRequests.length > 1 ? "s" : ""} awaiting review
          </span>
          <button
            onClick={() => setActiveTab("queue")}
            style={{
              padding: "4px 12px", borderRadius: 99,
              background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Review Now
          </button>
        </div>
      )}

      <main style={{ flex: 1, maxWidth: 1200, margin: "0 auto", padding: "32px 24px", width: "100%" }}>

        {/* Page header */}
        <div className="animate-fadeup" style={{
          marginBottom: 28,
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, lineHeight: 1.1 }}>
                {org.orgName}
              </h1>
              {org.orgType && (
                <span style={{
                  padding: "3px 10px", borderRadius: 99,
                  background: "var(--accent-light)", color: "var(--accent)",
                  fontSize: 12, fontWeight: 600,
                }}>
                  {orgTypeIcon} {org.orgType.charAt(0).toUpperCase() + org.orgType.slice(1)}
                </span>
              )}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              {org.department} · {org.serviceCenter} · Admin Dashboard
            </p>
          </div>

          {/* URL + QR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--white)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: 13,
            }}>
              <span style={{ color: "var(--text-muted)" }}>Public Queue URL:</span>
              <a href={`/queue/${orgId}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontWeight: 600 }}>
                /queue/{orgId?.slice(0, 8)}...
              </a>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/queue/${orgId}`); toast.success("Link copied!"); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }} title="Copy link">📋</button>
              <button onClick={() => setShowQR(p => !p)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: showQR ? "var(--accent)" : "var(--text-muted)" }} title="Toggle QR">📲</button>
            </div>

            {showQR && (
              <div ref={qrPanelRef} style={{
                background: "var(--white)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: 20,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
                boxShadow: "var(--shadow-lg)",
              }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>📲 Scan to Join Queue</div>
                <QRCodeSVG value={`${window.location.origin}/queue/${orgId}`} size={180} fgColor="#1a1a1a" bgColor="#ffffff" level="H" includeMargin />
                <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>{org.orgName} · {org.serviceCenter}</div>
                <button
                  onClick={() => {
                    const svgEl = qrPanelRef.current?.querySelector("svg");
                    if (!svgEl) return;
                    const blob = new Blob([svgEl.outerHTML], { type: "image/svg+xml" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "queuezen-qr.svg"; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ padding: "7px 18px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border)", background: "var(--stone)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  ⬇ Download QR Code
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="animate-fadeup-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
          <StatsCard label="Total Tokens" value={stats.total}     icon="🎫" color="var(--text)"   bg="var(--stone)" />
          <StatsCard label="Waiting"      value={stats.waiting}   icon="⏳" color="var(--accent)" bg="var(--accent-light)" />
          <StatsCard label="Serving"      value={stats.serving}   icon="✅" color="var(--green)"  bg="var(--green-light)" />
          <StatsCard label="Completed"    value={stats.completed} icon="🏁" color="var(--blue)"   bg="var(--blue-light)" />
          <StatsCard label="Skipped"      value={stats.skipped}   icon="⏭️" color="var(--red)"    bg="var(--red-light)" />
          {stats.avgWaitMinutes !== null && (
            <StatsCard label="Avg Wait" value={`${stats.avgWaitMinutes}m`} icon="⏱️" color="var(--purple)" bg="var(--purple-light)" />
          )}
          {pendingPriorityRequests.length > 0 && (
            <StatsCard label="Pending Reviews" value={pendingPriorityRequests.length} icon="🔔" color="#7c3aed" bg="#f5f3ff" />
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--stone)", borderRadius: 10, padding: 4, width: "fit-content" }}>
          {[
            ["queue", "📋 Queue Management", pendingPriorityRequests.length],
            ["analytics", "📊 Analytics", 0],
            ["settings", "⚙️ Settings", 0],
          ].map(([key, label, badge]) => (
            <button key={key} onClick={() => { setActiveTab(key); if (key === "settings") loadStaff(); }} style={{
              padding: "8px 18px", borderRadius: 7, border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13,
              background: activeTab === key ? "var(--white)" : "transparent",
              color: activeTab === key ? "var(--text)" : "var(--text-muted)",
              boxShadow: activeTab === key ? "var(--shadow-sm)" : "none",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {label}
              {badge > 0 && (
                <span style={{
                  background: "#7c3aed", color: "#fff",
                  borderRadius: 99, padding: "0px 6px", fontSize: 11, fontWeight: 700,
                }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ QUEUE TAB ══ */}
        {activeTab === "queue" && (
          <div className="animate-fadein" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Priority Requests Panel */}
            {pendingPriorityRequests.length > 0 && (
              <Card style={{ padding: 0, overflow: "hidden", border: "2px solid #7c3aed" }}>
                <div style={{
                  padding: "14px 24px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: "#fff", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>🔔</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Priority Verification Requests</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      {pendingPriorityRequests.length} request{pendingPriorityRequests.length > 1 ? "s" : ""} awaiting your review
                    </div>
                  </div>
                </div>
                <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendingPriorityRequests.map((token) => (
                    <PriorityRequestCard
                      key={token._id}
                      token={token}
                      onApprove={() => handleVerifyPriority(token._id, "approve")}
                      onReject={() => handleVerifyPriority(token._id, "reject")}
                      approving={verifyingId === token._id + "approve"}
                      rejecting={verifyingId === token._id + "reject"}
                    />
                  ))}
                </div>
              </Card>
            )}

            {/* Main queue layout */}
            <div className="admin-queue-grid" style={{ display: "grid", gridTemplateColumns: "clamp(280px, 30%, 340px) 1fr", gap: 24 }}>

              {/* Controls */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Card>
                  <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 18 }}>
                    Queue Controls
                  </h3>

                  {serving && (
                    <div className="serving-glow" style={{
                      background: "linear-gradient(135deg, var(--green-light), #d1fae5)",
                      border: "1.5px solid var(--green)",
                      borderRadius: "var(--radius-sm)", padding: "16px 18px", marginBottom: 18,
                      position: "relative", overflow: "hidden",
                    }}>
                      <div style={{
                        position: "absolute", top: 10, right: 12,
                        width: 8, height: 8, borderRadius: "50%", background: "var(--green)",
                        animation: "blink 1.2s ease infinite",
                      }} />
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                        Now Serving
                      </div>
                      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 34, color: "var(--green)", lineHeight: 1, marginBottom: 3 }}>
                        {serving.tokenDisplay}
                      </div>
                      <div style={{ fontSize: 14, color: "var(--text-mid)", fontWeight: 500 }}>{serving.name}</div>
                      {serving.counter && (
                        <div style={{ fontSize: 11, color: "var(--green)", marginTop: 4, fontWeight: 600 }}>
                          🪑 {serving.counter}
                        </div>
                      )}
                    </div>
                  )}

                  {!serving && waitingQueue.length > 0 && (
                    <div style={{ background: "var(--accent-light)", border: "1px dashed var(--accent-mid)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 18, fontSize: 13, color: "var(--accent)", fontWeight: 500 }}>
                      🎯 Next up: <strong>{waitingQueue[0].tokenDisplay}</strong> — {waitingQueue[0].name}
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <Button variant="success" fullWidth size="lg" onClick={handleCallNext} loading={actionLoading === "next"} disabled={waitingQueue.length === 0}>
                      ▶ Call Next Token
                      {waitingQueue.length > 0 && (
                        <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 99, padding: "1px 8px", fontSize: 12 }}>
                          {waitingQueue.length}
                        </span>
                      )}
                    </Button>
                    <Button variant="ghost" fullWidth onClick={handleComplete} loading={actionLoading === "complete"} disabled={!serving} style={{ color: "var(--blue)" }}>
                      ✓ Mark as Completed
                    </Button>
                    <Button variant="ghost" fullWidth onClick={handleSkip} loading={actionLoading === "skip"} disabled={!serving} style={{ color: "var(--text-mid)" }}>
                      ⏭ Skip Current Token
                    </Button>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2, display: "flex", flexDirection: "column", gap: 8 }}>
                      <Button
                        variant="ghost" fullWidth
                        onClick={handleToggleQueue}
                        loading={togglingQueue}
                        style={{ color: org.isQueueOpen ? "var(--red)" : "var(--green)" }}
                      >
                        {org.isQueueOpen ? "🔒 Close Queue" : "🔓 Open Queue"}
                      </Button>
                      <Button variant="ghost" fullWidth onClick={handleClear} loading={actionLoading === "clear"} disabled={(stats.waiting + stats.serving) === 0} style={{ color: "var(--red)" }}>
                        🗑 Clear Entire Queue
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card style={{ padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 14 }}>
                    Queue Summary
                  </div>
                  {[
                    ["Waiting", waitingQueue.length, "var(--accent)"],
                    ["Pending Review", pendingPriorityRequests.length, "#7c3aed"],
                    ["History", historyQueue.length, "var(--text-muted)"],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)" }}>{label}</span>
                      <strong style={{ color }}>{val}</strong>
                    </div>
                  ))}
                  {stats.avgWaitMinutes !== null && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13 }}>
                      <span style={{ color: "var(--text-muted)" }}>Avg wait time</span>
                      <strong style={{ color: "var(--purple)" }}>{stats.avgWaitMinutes} min</strong>
                    </div>
                  )}
                </Card>
              </div>

              {/* Queue list */}
              <div>
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>All Tokens</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "blink 1.5s ease infinite" }} />
                      Live
                    </div>
                  </div>

                  {loading ? (
                    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 10 }}>
                      {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 66 }} />)}
                    </div>
                  ) : queue.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "56px 0", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>No tokens yet</div>
                      <div style={{ fontSize: 13 }}>Share the public queue link to start receiving visitors.</div>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 600, overflowY: "auto" }}>
                      {waitingQueue.length > 0 && (
                        <div>
                          <div style={{ padding: "10px 24px 6px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.7, background: "var(--cream)" }}>
                            Waiting ({waitingQueue.length})
                          </div>
                          <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                            {waitingQueue.map((t, i) => (
                              <QueueCard key={t._id} token={t} position={i} />
                            ))}
                          </div>
                        </div>
                      )}
                      {serving && (
                        <div>
                          <div style={{ padding: "10px 24px 6px", fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.7, background: "var(--green-light)" }}>
                            Serving Now
                          </div>
                          <div style={{ padding: "8px 16px" }}>
                            <QueueCard token={serving} />
                          </div>
                        </div>
                      )}
                      {historyQueue.length > 0 && (
                        <div>
                          <div style={{ padding: "10px 24px 6px", fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 0.7, background: "var(--cream)" }}>
                            History ({historyQueue.length})
                          </div>
                          <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                            {historyQueue.slice(-20).reverse().map((t) => (
                              <div key={t._id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <QueueCard token={t} />
                                </div>
                                {t.status === "skipped" && (
                                  <Button
                                    size="sm" variant="ghost"
                                    onClick={() => handleRecall(t._id)}
                                    loading={recallingId === t._id}
                                    style={{ flexShrink: 0, color: "var(--accent)", fontSize: 12 }}
                                  >
                                    ↩ Recall
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {activeTab === "analytics" && (
          <div className="animate-fadein">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, marginBottom: 4 }}>Analytics</h2>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Live insights into your queue performance today.</p>
            </div>
            <AnalyticsDashboard orgId={org._id || org.id} stats={stats} />
          </div>
        )}

        {/* ══ SETTINGS TAB ══ */}
        {activeTab === "settings" && (
          <div className="animate-fadein" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 600 }}>
            <Card>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>
                Organization Settings
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
                Changes reflect immediately on the public queue page.
              </p>

              {settingsSuccess && (
                <div style={{ marginBottom: 18 }}>
                  <Alert type="success">✅ Settings saved and applied live!</Alert>
                </div>
              )}

              <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Input label="Organization / Institute Name" required
                  value={settingsForm.orgName}
                  onChange={(v) => setSettingsForm(p => ({ ...p, orgName: v }))}
                  placeholder="Organization name" />
                <Input label="Department Name" required
                  value={settingsForm.department}
                  onChange={(v) => setSettingsForm(p => ({ ...p, department: v }))}
                  placeholder="Department name" />
                <Input label="Service Center / Counter" required
                  value={settingsForm.serviceCenter}
                  onChange={(v) => setSettingsForm(p => ({ ...p, serviceCenter: v }))}
                  placeholder="Counter / service center name" />
                <div>
                  <Input label="Official Email Domain (for Authorized Priority)"
                    value={settingsForm.officialEmailDomain}
                    onChange={(v) => setSettingsForm(p => ({ ...p, officialEmailDomain: v }))}
                    placeholder="e.g. jainuniversity.ac.in" />
                  <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>
                    Users with emails from this domain can use Authorized Priority via OTP.
                  </p>
                </div>
                <div style={{ padding: "12px 16px", background: "var(--stone)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)" }}>Organization Type: </span>
                  <strong style={{ color: "var(--accent)" }}>
                    {ORG_TYPE_ICONS[org.orgType]} {org.orgType?.charAt(0).toUpperCase() + org.orgType?.slice(1)}
                  </strong>
                  <span style={{ color: "var(--text-faint)", fontSize: 11.5, display: "block", marginTop: 2 }}>
                    Organization type cannot be changed after registration.
                  </span>
                </div>
                <Button type="submit" loading={settingsSaving} style={{ alignSelf: "flex-start" }}>
                  Save Settings
                </Button>
              </form>
            </Card>
            {/* ── Display Board Link ── */}
            <Card style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>📺 Display Board</div>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 14 }}>
                Open the TV display board for this queue — designed for large screens in waiting areas.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  href={`/display/${orgId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "8px 16px", borderRadius: "var(--radius-sm)",
                    background: "var(--accent)", color: "#fff",
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}
                >
                  Open Display Board ↗
                </a>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/display/${orgId}`); toast.success("Display URL copied!"); }}
                  style={{ padding: "8px 14px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border)", background: "var(--stone)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                >
                  📋 Copy Link
                </button>
              </div>
            </Card>

            {/* ── Staff & Counters ── */}
            <Card>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, marginBottom: 6 }}>
                Staff & Counters
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
                Each counter staff member can log in at <code style={{ background: "var(--stone)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>/counter/login</code> and manage their counter independently.
              </p>

              {/* Create new staff */}
              <form onSubmit={handleCreateStaff} style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24, padding: 16, background: "var(--stone)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Add Counter Staff
                </div>
                <Input
                  label="Counter Name"
                  value={newStaff.counterName}
                  onChange={(v) => setNewStaff((p) => ({ ...p, counterName: v }))}
                  placeholder="e.g. Counter 1, Billing Desk"
                  required
                />
                <Input
                  label="Username"
                  value={newStaff.username}
                  onChange={(v) => setNewStaff((p) => ({ ...p, username: v }))}
                  placeholder="e.g. counter1"
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={newStaff.password}
                  onChange={(v) => setNewStaff((p) => ({ ...p, password: v }))}
                  placeholder="Minimum 6 characters"
                  required
                />
                <Button type="submit" loading={creatingStaff} style={{ alignSelf: "flex-start" }}>
                  + Add Staff
                </Button>
              </form>

              {/* Staff list */}
              {staffLoading ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)" }}>Loading…</div>
              ) : staffList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No staff members yet. Add one above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                    {staffList.length} Staff Member{staffList.length !== 1 ? "s" : ""}
                  </div>
                  {staffList.map((s) => (
                    <div key={s._id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)", background: "var(--white)",
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>🪑 {s.counterName}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                          @{s.username} · Login at /counter/login
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteStaff(s._id, s.counterName)}
                        style={{
                          padding: "5px 12px", borderRadius: "var(--radius-sm)",
                          border: "1.5px solid var(--red)", background: "var(--red-light)",
                          color: "var(--red)", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

// ── Priority Request Card ──────────────────────────────────────────────────────
function PriorityRequestCard({ token, onApprove, onReject, approving, rejecting }) {
  const cfg = PRIORITY_LABELS[token.priority] || {};
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  return (
    <div style={{
      border: `1.5px solid ${cfg.color || "var(--border)"}`,
      borderRadius: "var(--radius-sm)",
      background: cfg.bg || "var(--white)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${cfg.color}30`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{cfg.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
              {token.name}
              <span style={{ marginLeft: 8, fontSize: 12, fontFamily: "'DM Serif Display', serif", color: cfg.color }}>
                {token.tokenDisplay}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {cfg.label} priority request
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button
            size="sm" variant="success"
            onClick={onApprove}
            loading={approving}
            disabled={rejecting}
          >
            ✓ Approve
          </Button>
          <Button
            size="sm" variant="danger"
            onClick={onReject}
            loading={rejecting}
            disabled={approving}
          >
            ✗ Reject
          </Button>
        </div>
      </div>

      {/* Verification details */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Senior Citizen details */}
        {token.priority === "senior" && (
          <>
            {token.verificationData?.dob && (
              <div style={{ fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>Date of Birth: </span>
                <strong>{new Date(token.verificationData.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>
              </div>
            )}
            {token.verificationData?.govIdFilename ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Government ID:</span>
                <a
                  href={`${API_URL}/uploads/priority-docs/${token.verificationData.govIdFilename}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12.5, fontWeight: 600, color: "var(--blue)",
                    padding: "3px 10px", background: "var(--blue-light)",
                    borderRadius: 99, textDecoration: "none",
                  }}
                >
                  📄 View Document
                </a>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No ID document uploaded</div>
            )}
          </>
        )}

        {/* Emergency details */}
        {token.priority === "emergency" && (
          <>
            {token.verificationData?.emergencyReason && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>Reason for Emergency:</div>
                <div style={{
                  fontSize: 13, background: "var(--white)", padding: "8px 12px",
                  borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                  lineHeight: 1.5,
                }}>
                  {token.verificationData.emergencyReason}
                </div>
              </div>
            )}
            {token.verificationData?.medicalDocFilename ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Medical Document:</span>
                <a
                  href={`${API_URL}/uploads/priority-docs/${token.verificationData.medicalDocFilename}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12.5, fontWeight: 600, color: "var(--red)",
                    padding: "3px 10px", background: "var(--red-light)",
                    borderRadius: 99, textDecoration: "none",
                  }}
                >
                  📄 View Document
                </a>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>No medical document uploaded</div>
            )}
          </>
        )}

        <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
          Requested {new Date(token.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          {" · "}If rejected, the user will be placed in the normal queue.
        </div>
      </div>
    </div>
  );
}
