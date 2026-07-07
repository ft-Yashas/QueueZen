import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import QueueCard from "../components/QueueCard";
import { Card, Button, Input, Alert, Spinner, StatusBadge } from "../components/UI";
import { getQueue, joinQueue, getAIWaitEstimate, verifyOtp, getUploadUrl, submitFeedback } from "../utils/api";
import { connectToOrg, disconnectFromOrg } from "../utils/socket";
import toast from "react-hot-toast";

// Priority config per org type
const getPriorityOptions = (orgType) => {
  const base = [
    { value: "normal",     label: "Normal",              icon: "👤", color: "var(--text-muted)" },
    { value: "senior",     label: "Senior Citizen",      icon: "🧓", color: "var(--blue)" },
    { value: "authorized", label: "Authorized Priority", icon: "🔐", color: "var(--accent)" },
  ];
  if (orgType === "hospital") {
    return [
      base[0],
      base[1],
      { value: "emergency", label: "Emergency", icon: "🚨", color: "var(--red)" },
      base[2],
    ];
  }
  return base;
};

const ORG_TYPE_LABELS = {
  college: "College / University",
  business: "Business / Office",
  government: "Government Office",
  hospital: "Hospital / Healthcare",
};

const ORG_TYPE_ICONS = {
  college: "🎓",
  business: "🏢",
  government: "🏛️",
  hospital: "🏥",
};

export default function PublicQueue() {
  const { orgId } = useParams();
  const [org, setOrg] = useState(null);
  const [queue, setQueue] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Join form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState("normal");
  const [joining, setJoining] = useState(false);
  const [nameError, setNameError] = useState("");

  // Senior citizen fields
  const [dob, setDob] = useState("");
  const [govIdFile, setGovIdFile] = useState(null);

  // Emergency fields
  const [emergencyReason, setEmergencyReason] = useState("");
  const [medicalDocFile, setMedicalDocFile] = useState(null);

  // Authorized priority fields
  const [officialEmail, setOfficialEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // OTP verification state (after joining with authorized priority)
  const [otpInput, setOtpInput] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [demoOtp, setDemoOtp] = useState(null);

  const [myToken, setMyToken] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`qz_token_${orgId}`)); } catch { return null; }
  });

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  // Mobile responsive
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  const [aiEstimate, setAIEstimate] = useState(null);
  const [aiLoading, setAILoading] = useState(false);
  const socketRef = useRef(null);
  const lastAIPositionRef = useRef(null);
  const myTokenRef = useRef(myToken);

  useEffect(() => { myTokenRef.current = myToken; }, [myToken]);

  // ── Mobile detect ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Apply org theme ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (org?.orgType) {
      document.documentElement.setAttribute("data-theme", org.orgType);
    }
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, [org?.orgType]);

  // ── Notification sound ───────────────────────────────────────────────────────
  const playAlertSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, start, dur) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.4, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.start(start);
        osc.stop(start + dur);
      };
      playBeep(520, ctx.currentTime, 0.18);
      playBeep(660, ctx.currentTime + 0.22, 0.18);
      playBeep(800, ctx.currentTime + 0.44, 0.35);
    } catch (e) {
      console.warn("Audio not supported:", e);
    }
  };

  // ── Load ─────────────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    try {
      const { data } = await getQueue(orgId);
      setOrg(data.org);
      setQueue(data.queue || []);
      setStats(data.stats || {});
      // Sync myToken with fresh data from server to fix stale localStorage state
      const current = myTokenRef.current;
      if (current) {
        const fresh = (data.queue || []).find((t) => t._id === current._id);
        if (fresh) {
          setMyToken(fresh);
          localStorage.setItem(`qz_token_${orgId}`, JSON.stringify(fresh));
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError("Organization not found. Please check the link.");
      } else {
        setError("Failed to load queue. Please refresh.");
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // ── Socket ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    const socket = connectToOrg(orgId);
    socketRef.current = socket;

    socket.on("queueStatusChanged", ({ isQueueOpen }) => {
      setOrg((prev) => prev ? { ...prev, isQueueOpen } : prev);
    });

    socket.on("queueUpdated", ({ queue: q, stats: s }) => {
      setQueue(q || []);
      setStats(s || {});
      const current = myTokenRef.current;
      if (current) {
        const updated = (q || []).find((t) => t._id === current._id);
        if (updated) {
          setMyToken(updated);
          localStorage.setItem(`qz_token_${orgId}`, JSON.stringify(updated));
          if (updated.status === "serving" && current.status === "waiting") {
            playAlertSound();
            toast.success("🔔 It's your turn! Please proceed to the counter.", { duration: 8000 });
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("QueueZen", {
                body: `Your token ${updated.tokenDisplay} is now being served!`,
                icon: "/favicon.svg",
              });
            }
          }
          if (updated.priorityStatus !== current.priorityStatus) {
            setDemoOtp(null);
          }
        }
      }
    });

    return () => {
      disconnectFromOrg(orgId);
      socket.off("queueUpdated");
      socket.off("queueStatusChanged");
    };
  }, [orgId]);

  // ── AI wait estimate ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tokenId = myToken?._id;
    if (!tokenId || !orgId) return;

    const liveToken = queue.find((t) => t._id === tokenId);
    if (!liveToken || liveToken.status !== "waiting") {
      setAIEstimate(null);
      lastAIPositionRef.current = null;
      return;
    }

    const waiting = queue.filter((t) => t.status === "waiting");
    const pos = waiting.findIndex((t) => t._id === tokenId);
    if (pos === -1) return;
    if (lastAIPositionRef.current === pos && aiEstimate) return;

    lastAIPositionRef.current = pos;
    setAILoading(true);

    getAIWaitEstimate(orgId, tokenId)
      .then(({ data }) => {
        if (data.success && data.estimate) setAIEstimate(data.estimate);
        else setAIEstimate(null);
      })
      .catch(() => setAIEstimate(null))
      .finally(() => setAILoading(false));
  }, [orgId, myToken?._id, queue]);

  // ── Join queue ────────────────────────────────────────────────────────────────
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setNameError("Please enter your name."); return; }

    // Authorized priority email validation
    if (priority === "authorized") {
      if (!officialEmail.trim()) {
        setEmailError("Official email is required for Authorized Priority.");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(officialEmail)) {
        setEmailError("Please enter a valid email address.");
        return;
      }
    }

    setJoining(true);
    setNameError("");
    setEmailError("");

    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("phone", phone.trim());
      formData.append("priority", priority);

      if (priority === "senior") {
        if (dob) formData.append("dob", dob);
        if (govIdFile) formData.append("govIdFile", govIdFile);
      }
      if (priority === "emergency") {
        formData.append("emergencyReason", emergencyReason);
        if (medicalDocFile) formData.append("medicalDocFile", medicalDocFile);
      }
      if (priority === "authorized") {
        formData.append("officialEmail", officialEmail.trim());
      }

      const { data } = await joinQueue(orgId, formData);
      setMyToken(data.token);
      localStorage.setItem(`qz_token_${orgId}`, JSON.stringify(data.token));

      // Store demo OTP for authorized priority
      if (data.demoOtp) {
        setDemoOtp(data.demoOtp);
      }

      // Reset form
      setName(""); setPhone(""); setPriority("normal");
      setDob(""); setGovIdFile(null);
      setEmergencyReason(""); setMedicalDocFile(null);
      setOfficialEmail(""); setOtpInput("");

      const priorityLabel = priority === "authorized" ? "Authorized Priority" :
                            priority === "senior" ? "Senior Citizen" :
                            priority === "emergency" ? "Emergency" : "";
      toast.success(
        `Token ${data.token.tokenDisplay} issued!${priorityLabel ? ` (${priorityLabel} — pending verification)` : ""}`,
        { duration: 5000 }
      );
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to join queue.";
      toast.error(msg);
    } finally {
      setJoining(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) { toast.error("Please enter the OTP."); return; }
    setOtpVerifying(true);
    try {
      await verifyOtp(orgId, myToken._id, otpInput.trim());
      toast.success("Authorized Priority verified!");
      setDemoOtp(null);
      setOtpInput("");
    } catch (err) {
      toast.error(err.response?.data?.message || "OTP verification failed.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackRating) { toast.error("Please select a rating."); return; }
    setFeedbackSubmitting(true);
    try {
      await submitFeedback(orgId, myToken._id, feedbackRating, feedbackComment);
      setFeedbackDone(true);
      toast.success("Thank you for your feedback!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const leaveToken = () => {
    setMyToken(null);
    setDemoOtp(null);
    setOtpInput("");
    localStorage.removeItem(`qz_token_${orgId}`);
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const liveMyToken = myToken ? queue.find((t) => t._id === myToken._id) : null;
  const waitingQueue = queue.filter((t) => t.status === "waiting");
  const myPosition = liveMyToken?.status === "waiting"
    ? waitingQueue.findIndex((t) => t._id === liveMyToken._id)
    : -1;
  const serving = queue.find((t) => t.status === "serving");

  const priorityOptions = getPriorityOptions(org?.orgType);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size={40} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Card style={{ maxWidth: 400, textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", marginBottom: 8 }}>Oops!</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  const orgTypeLabel = ORG_TYPE_LABELS[org?.orgType] || "";
  const orgTypeIcon = ORG_TYPE_ICONS[org?.orgType] || "🏢";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar org={org} />

      {/* Closed queue banner */}
      {org && !org.isQueueOpen && (
        <div style={{
          background: "#ef4444", color: "#fff",
          textAlign: "center", padding: "10px 20px",
          fontSize: 14, fontWeight: 700, letterSpacing: 0.4,
        }}>
          🔒 This queue is currently closed. Please check back later.
        </div>
      )}

      {/* Serving banner */}
      {serving && (
        <div style={{
          background: "var(--green)", color: "#fff",
          textAlign: "center", padding: "9px 16px",
          fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.7)", animation: "blink 1.2s ease infinite" }} />
          Now Serving: <strong>{serving.tokenDisplay}</strong> — {serving.name}
        </div>
      )}

      <main style={{ flex: 1, maxWidth: 1100, margin: "0 auto", padding: "36px 24px", width: "100%" }}>

        {/* Org Header */}
        <div className="animate-fadeup" style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{
            display: "inline-flex", flexDirection: "column", alignItems: "center",
            background: "var(--white)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: "24px 36px",
            boxShadow: "var(--shadow-lg)",
            maxWidth: "100%",
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: 16, marginBottom: 12,
              background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, color: "#fff",
              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            }}>
              {orgTypeIcon}
            </div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 4 }}>
              {org?.orgName}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              {org?.department} · {org?.serviceCenter}
            </p>
            {org?.orgType && (
              <span style={{
                marginTop: 8, padding: "3px 10px", borderRadius: 99,
                background: "var(--accent-light)", color: "var(--accent)",
                fontSize: 11.5, fontWeight: 600,
              }}>
                {orgTypeIcon} {orgTypeLabel}
              </span>
            )}
            <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
              {[
                ["⏳", stats.waiting ?? 0, "Waiting"],
                ["✅", stats.serving ?? 0, "Serving"],
                ["🏁", stats.completed ?? 0, "Done today"],
              ].map(([icon, val, label]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>{val}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 500 }}>{icon} {label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>

          {/* Left — Join / My Token */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* My Token Card */}
            {liveMyToken ? (
              <Card className="animate-pop" style={{
                background: "linear-gradient(160deg, var(--white) 0%, var(--accent-light) 100%)",
                border: "1.5px solid var(--accent-mid)",
                padding: "28px 28px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                  Your Token
                </div>
                <div style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 80, lineHeight: 1, color: "var(--accent)", marginBottom: 10,
                  textShadow: "0 2px 16px rgba(0,0,0,0.08)",
                  letterSpacing: -2,
                }}>
                  {liveMyToken.tokenDisplay}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <StatusBadge status={liveMyToken.status} />
                </div>

                {/* Priority status badge */}
                {liveMyToken.priority !== "normal" && (
                  <div style={{ marginBottom: 12 }}>
                    <PriorityStatusBadge token={liveMyToken} />
                  </div>
                )}

                <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 16 }}>
                  {liveMyToken.status === "waiting" && myPosition >= 0 && (
                    <>{myPosition === 0 ? "You're next! 🎉" : <><strong>{myPosition}</strong> {myPosition === 1 ? "person" : "people"} ahead of you</>}</>
                  )}
                  {liveMyToken.status === "waiting" && myPosition < 0 && "You're in the queue"}
                  {liveMyToken.status === "serving" && "🔔 It's your turn! Please proceed to the service counter."}
                  {liveMyToken.status === "completed" && "✅ Service complete. Thank you for visiting!"}
                  {liveMyToken.status === "skipped" && "⏭ Your token was skipped. Please contact the counter."}
                </div>

                {/* OTP Verification panel for authorized priority */}
                {liveMyToken.priority === "authorized" &&
                  liveMyToken.priorityStatus === "pending" &&
                  liveMyToken.status === "waiting" && (
                  <div className="animate-slidedown" style={{
                    background: "var(--white)", border: "1.5px solid var(--accent-mid)",
                    borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 16, textAlign: "left",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                      🔐 Verify Authorized Priority
                    </div>

                    {demoOtp && (
                      <div style={{
                        background: "#fffbeb", border: "1px solid #f59e0b",
                        borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 12,
                        fontSize: 12.5,
                      }}>
                        <strong style={{ color: "#b45309" }}>⚠️ Demo Mode</strong>
                        <div style={{ color: "#92400e", marginTop: 2 }}>
                          OTP would normally be sent to <strong>{liveMyToken.verificationData?.officialEmail}</strong>
                          <br />
                          <span style={{ fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>Demo OTP: {demoOtp}</span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="one-time-code"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        style={{
                          flex: 1, padding: "9px 12px", borderRadius: "var(--radius-sm)",
                          border: "1.5px solid var(--border)", fontFamily: "monospace",
                          fontSize: 20, letterSpacing: 6, textAlign: "center",
                          background: "var(--white)",
                        }}
                      />
                      <Button
                        onClick={handleVerifyOtp}
                        loading={otpVerifying}
                        size="sm"
                        style={{ whiteSpace: "nowrap" }}
                      >
                        Verify
                      </Button>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
                      OTP valid for 10 minutes. Your position is reserved while verifying.
                    </p>
                  </div>
                )}

                {/* Pending admin verification notice */}
                {(liveMyToken.priority === "senior" || liveMyToken.priority === "emergency") &&
                  liveMyToken.priorityStatus === "pending" &&
                  liveMyToken.status === "waiting" && (
                  <div className="animate-slidedown" style={{
                    background: "var(--accent-light)", border: "1px solid var(--accent-mid)",
                    borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16,
                    fontSize: 12.5, color: "var(--accent)", textAlign: "left",
                  }}>
                    <strong>⏳ Priority Verification Pending</strong>
                    <div style={{ marginTop: 2, color: "var(--text-muted)" }}>
                      The admin is reviewing your {liveMyToken.priority === "senior" ? "Senior Citizen" : "Emergency"} priority request.
                      You remain in the queue — your position will be upgraded upon approval.
                    </div>
                  </div>
                )}

                {liveMyToken.priorityStatus === "rejected" && (
                  <div style={{
                    background: "var(--red-light)", border: "1px solid var(--red)",
                    borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16,
                    fontSize: 12.5, color: "var(--red)", textAlign: "left",
                  }}>
                    <strong>❌ Priority Request Rejected</strong>
                    <div style={{ marginTop: 2 }}>
                      Your priority request was not approved. You are now in the regular queue.
                    </div>
                  </div>
                )}

                {/* Wait estimate */}
                {liveMyToken.status === "waiting" && myPosition >= 0 && (() => {
                  const perPerson = stats.avgServiceMinutes || stats.avgWaitMinutes;
                  const fallbackBase = perPerson || 3;
                  const rawFallback = fallbackBase * (myPosition + 1);
                  const fallbackMin = Math.max(1, Math.round(rawFallback * 0.8));
                  const fallbackMax = Math.round(rawFallback * 1.2);
                  const displayMin = aiEstimate ? aiEstimate.minMinutes : fallbackMin;
                  const displayMax = aiEstimate ? aiEstimate.maxMinutes : fallbackMax;
                  const isLong = displayMin > 20;

                  return (
                    <div style={{
                      background: isLong ? "var(--red-light)" : "var(--white)",
                      border: `1px solid ${isLong ? "var(--red)" : "var(--border)"}`,
                      borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 16,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>⏱ Estimated Wait</span>
                        {aiLoading && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: "var(--accent)", animation: "blink 1.2s ease infinite" }}>
                            🤖 AI analyzing…
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontFamily: "'DM Serif Display', serif", fontSize: 26,
                        color: isLong ? "var(--red)" : "var(--accent)", lineHeight: 1, marginBottom: 2,
                      }}>
                        {displayMin}–{displayMax}{" "}
                        <span style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 400 }}>min</span>
                      </div>
                      {aiEstimate ? (
                        <>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
                            {aiEstimate.reasoning}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                            🤖 AI estimate
                            <span style={{
                              padding: "1px 6px", borderRadius: 99, fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                              background: aiEstimate.confidence === "high" ? "var(--green-light)" : aiEstimate.confidence === "medium" ? "var(--accent-light)" : "var(--red-light)",
                              color: aiEstimate.confidence === "high" ? "var(--green)" : aiEstimate.confidence === "medium" ? "var(--accent)" : "var(--red)",
                            }}>
                              {aiEstimate.confidence} confidence
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                          {myPosition === 0 ? "You're next!" : `${myPosition} ${myPosition === 1 ? "person" : "people"} ahead`}
                          {" · "}
                          {perPerson ? "🎯 Based on real service data" : "📊 Rough estimate (3 min/person)"}
                        </div>
                      )}
                      {isLong && (
                        <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 600, marginTop: 6 }}>
                          ⚠️ Long wait — feel free to step away and return closer to your turn.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Feedback for completed tokens */}
                {liveMyToken.status === "completed" && !liveMyToken.feedback?.rating && !feedbackDone && (
                  <div style={{
                    background: "var(--white)", border: "1.5px solid var(--accent-mid)",
                    borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 16, textAlign: "left",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                      ⭐ Rate Your Experience
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10, justifyContent: "center" }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFeedbackRating(star)}
                          style={{
                            fontSize: 28, background: "none", border: "none", cursor: "pointer",
                            opacity: star <= feedbackRating ? 1 : 0.3,
                            transition: "opacity 0.1s, transform 0.1s",
                            transform: star <= feedbackRating ? "scale(1.15)" : "scale(1)",
                            padding: "2px 4px",
                          }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Any comments? (optional)"
                      rows={2}
                      maxLength={300}
                      style={{
                        width: "100%", padding: "8px 10px", borderRadius: "var(--radius-sm)",
                        border: "1.5px solid var(--border)", fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13, resize: "none", background: "var(--stone)",
                        boxSizing: "border-box",
                      }}
                    />
                    <Button
                      onClick={handleSubmitFeedback}
                      loading={feedbackSubmitting}
                      disabled={!feedbackRating}
                      fullWidth
                      style={{ marginTop: 10 }}
                    >
                      Submit Feedback
                    </Button>
                  </div>
                )}

                {(feedbackDone || liveMyToken.feedback?.rating) && liveMyToken.status === "completed" && (
                  <div style={{
                    background: "var(--green-light)", border: "1px solid var(--green)",
                    borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16,
                    fontSize: 13, color: "var(--green)", textAlign: "center",
                  }}>
                    ✅ Thank you for your feedback!
                  </div>
                )}

                {(liveMyToken.status === "completed" || liveMyToken.status === "skipped") && (
                  <Button variant="ghost" onClick={leaveToken} fullWidth>
                    Join Queue Again
                  </Button>
                )}
              </Card>
            ) : (
              /* ── Join Form ── */
              <Card className="animate-fadeup" style={{
                background: "linear-gradient(145deg, var(--white) 0%, var(--cream) 100%)",
                padding: 32,
              }}>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 26, marginBottom: 6 }}>
                  Join the Queue
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                  Enter your details and select the appropriate priority.
                </p>

                <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Input
                    label="Full Name" required
                    value={name} onChange={(v) => { setName(v); setNameError(""); }}
                    placeholder="e.g. Yashas R"
                    error={nameError}
                  />
                  <Input
                    label="Phone (optional)"
                    value={phone} onChange={setPhone}
                    placeholder="For SMS notifications"
                    type="tel"
                  />

                  {/* Priority selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.3, textTransform: "uppercase" }}>
                      Priority
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {priorityOptions.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setPriority(p.value)}
                          style={{
                            padding: "9px 12px", borderRadius: "var(--radius-sm)",
                            border: `2px solid ${priority === p.value ? p.color : "var(--border)"}`,
                            background: priority === p.value ? "var(--accent-light)" : "var(--white)",
                            cursor: "pointer", fontSize: 13, fontWeight: 600,
                            color: priority === p.value ? p.color : "var(--text-muted)",
                            transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                            fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          {p.icon} {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Senior Citizen fields */}
                  {priority === "senior" && (
                    <div className="animate-slidedown" style={{
                      background: "var(--blue-light)", border: "1px solid var(--blue)",
                      borderRadius: "var(--radius-sm)", padding: 16,
                      display: "flex", flexDirection: "column", gap: 12,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--blue)" }}>
                        🧓 Senior Citizen Verification
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, display: "block", marginBottom: 5 }}>
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          max={new Date(Date.now() - 60 * 365.25 * 24 * 3600000).toISOString().split("T")[0]}
                          style={{
                            width: "100%", padding: "9px 12px", borderRadius: "var(--radius-sm)",
                            border: "1.5px solid var(--border)", fontFamily: "'DM Sans', sans-serif",
                            fontSize: 14, color: "var(--text)", background: "var(--white)",
                          }}
                        />
                      </div>
                      <FileUploadField
                        label="Government-issued ID (showing DOB)"
                        accept=".jpg,.jpeg,.png,.pdf"
                        file={govIdFile}
                        onChange={setGovIdFile}
                        hint="JPEG, PNG, or PDF · Max 5 MB"
                      />
                      <p style={{ fontSize: 11.5, color: "var(--blue)", lineHeight: 1.4 }}>
                        Your ID will be reviewed by the admin to verify Senior Citizen priority.
                      </p>
                    </div>
                  )}

                  {/* Emergency fields (hospital only) */}
                  {priority === "emergency" && (
                    <div className="animate-slidedown" style={{
                      background: "var(--red-light)", border: "1.5px solid var(--red)",
                      borderRadius: "var(--radius-sm)", padding: 16,
                      display: "flex", flexDirection: "column", gap: 12,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--red)" }}>
                        🚨 Emergency Priority Verification
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, display: "block", marginBottom: 5 }}>
                          Reason for Emergency <span style={{ color: "var(--red)" }}>*</span>
                        </label>
                        <textarea
                          value={emergencyReason}
                          onChange={(e) => setEmergencyReason(e.target.value)}
                          placeholder="Briefly describe the emergency situation..."
                          rows={3}
                          style={{
                            width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)",
                            border: "1.5px solid var(--border)", fontFamily: "'DM Sans', sans-serif",
                            fontSize: 13, resize: "vertical", background: "var(--white)",
                          }}
                        />
                      </div>
                      <FileUploadField
                        label="Medical Document (optional)"
                        accept=".jpg,.jpeg,.png,.pdf"
                        file={medicalDocFile}
                        onChange={setMedicalDocFile}
                        hint="Prescription, hospital note, or emergency letter · Max 5 MB"
                      />
                      <p style={{ fontSize: 11.5, color: "var(--red)", lineHeight: 1.4 }}>
                        Emergency priority requires admin approval. You will be moved up the queue once verified.
                      </p>
                    </div>
                  )}

                  {/* Authorized Priority fields */}
                  {priority === "authorized" && (
                    <div className="animate-slidedown" style={{
                      background: "var(--accent-light)", border: "1.5px solid var(--accent-mid)",
                      borderRadius: "var(--radius-sm)", padding: 16,
                      display: "flex", flexDirection: "column", gap: 12,
                    }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
                        🔐 Authorized Priority Verification
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, display: "block", marginBottom: 5 }}>
                          Official Organization Email <span style={{ color: "var(--red)" }}>*</span>
                        </label>
                        <input
                          type="email"
                          value={officialEmail}
                          onChange={(e) => { setOfficialEmail(e.target.value); setEmailError(""); }}
                          placeholder={
                            org?.officialEmailDomain
                              ? `name@${org.officialEmailDomain}`
                              : "name@organization.com"
                          }
                          style={{
                            width: "100%", padding: "9px 12px", borderRadius: "var(--radius-sm)",
                            border: `1.5px solid ${emailError ? "var(--red)" : "var(--border)"}`,
                            fontFamily: "'DM Sans', sans-serif", fontSize: 14, background: "var(--white)",
                          }}
                        />
                        {emailError && <p style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>{emailError}</p>}
                      </div>
                      <p style={{ fontSize: 11.5, color: "var(--accent)", lineHeight: 1.4 }}>
                        An OTP will be sent to your official email.
                        {org?.officialEmailDomain && ` Must be from @${org.officialEmailDomain}.`}
                        You can verify it after joining.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit" fullWidth size="lg" loading={joining}
                    disabled={!org?.isQueueOpen}
                    style={{ marginTop: 4 }}
                  >
                    {!org?.isQueueOpen ? "🔒 Queue is Closed" : joining ? "Getting your token..." : "Get My Token →"}
                  </Button>
                </form>
              </Card>
            )}

            {/* Service Info */}
            <Card className="animate-fadeup-3" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 14 }}>
                Service Information
              </div>
              {[
                [orgTypeIcon, "Organization", org?.orgName],
                ["🏢", "Department", org?.department],
                ["🪑", "Counter", org?.serviceCenter],
              ].map(([icon, label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{icon} {label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>🔢 Tokens issued today</span>
                <span style={{ fontWeight: 600 }}>{stats.total ?? 0}</span>
              </div>
            </Card>
          </div>

          {/* Right — Live Queue */}
          <Card className="animate-fadeup-2" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20 }}>Live Queue</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "blink 1.5s ease infinite" }} />
                Live
              </div>
            </div>

            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              {queue.filter(t => t.status === "waiting" || t.status === "serving").length === 0 ? (
                <div style={{ textAlign: "center", padding: "56px 0", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🎟️</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Queue is empty</div>
                  <div style={{ fontSize: 13 }}>Be the first to join!</div>
                </div>
              ) : (
                <div>
                  {serving && (
                    <div>
                      <div style={{ padding: "8px 20px 4px", fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: 0.7, background: "var(--green-light)" }}>
                        Now Serving
                      </div>
                      <div style={{ padding: "8px 12px" }}>
                        <QueueCard token={serving} isMe={liveMyToken?._id === serving._id} />
                      </div>
                    </div>
                  )}
                  {waitingQueue.length > 0 && (
                    <div>
                      <div style={{ padding: "8px 20px 4px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.7, background: "var(--cream)" }}>
                        Waiting ({waitingQueue.length})
                      </div>
                      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                        {waitingQueue.map((t, i) => (
                          <QueueCard key={t._id} token={t} isMe={liveMyToken?._id === t._id} position={i} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PriorityStatusBadge({ token }) {
  const configs = {
    senior: { label: "Senior Citizen", color: "var(--blue)", bg: "var(--blue-light)" },
    emergency: { label: "Emergency", color: "var(--red)", bg: "var(--red-light)" },
    authorized: { label: "Authorized Priority", color: "var(--accent)", bg: "var(--accent-light)" },
  };
  const c = configs[token.priority];
  if (!c) return null;

  const statusText =
    token.priorityStatus === "approved" ? "✓ Verified" :
    token.priorityStatus === "pending"  ? "⏳ Pending" :
    token.priorityStatus === "rejected" ? "✗ Rejected" : "";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.color,
    }}>
      {c.label}
      {statusText && <span style={{ opacity: 0.8 }}>· {statusText}</span>}
    </span>
  );
}

function FileUploadField({ label, accept, file, onChange, hint }) {
  const inputRef = useRef(null);
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.3, display: "block", marginBottom: 5 }}>
        {label}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${file ? "var(--green)" : "var(--border)"}`,
          borderRadius: "var(--radius-sm)",
          padding: "14px 16px",
          cursor: "pointer",
          background: file ? "var(--green-light)" : "var(--white)",
          textAlign: "center",
          transition: "all 0.15s",
        }}
      >
        <div style={{ fontSize: 20, marginBottom: 4 }}>{file ? "✅" : "📎"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: file ? "var(--green)" : "var(--text-mid)" }}>
          {file ? file.name : "Click to upload file"}
        </div>
        {hint && !file && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{hint}</div>}
        {file && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = ""; }}
            style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files[0] || null)}
      />
    </div>
  );
}
