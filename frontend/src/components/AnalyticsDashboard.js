import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card } from "./UI";
import { getQueue } from "../utils/api";

const AMBER  = "#C07A3C";
const GREEN  = "#2D7A55";
const BLUE   = "#2558C4";
const RED    = "#C0392B";
const PURPLE = "#6D4FC4";

export default function AnalyticsDashboard({ orgId, stats }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    getQueue(orgId)
      .then(({ data }) => setTokens(data.queue || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId]);

  // ── Peak hours data ───────────────────────────────────────────────────────
  const peakHours = Array.from({ length: 24 }, (_, h) => ({
    hour: h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`,
    tokens: 0,
  }));
  tokens.forEach((t) => {
    const h = new Date(t.createdAt).getHours();
    peakHours[h].tokens += 1;
  });
  const peakHoursFiltered = peakHours.slice(7, 22);

  // ── Status breakdown (pie) ────────────────────────────────────────────────
  const pieData = [
    { name: "Completed", value: stats.completed || 0, color: GREEN },
    { name: "Waiting",   value: stats.waiting   || 0, color: AMBER },
    { name: "Skipped",   value: stats.skipped   || 0, color: RED },
    { name: "Serving",   value: stats.serving   || 0, color: BLUE },
  ].filter((d) => d.value > 0);

  // ── Priority breakdown ────────────────────────────────────────────────────
  const priorityCounts = { normal: 0, senior: 0, emergency: 0, authorized: 0 };
  tokens.forEach((t) => {
    if (priorityCounts[t.priority] !== undefined) priorityCounts[t.priority]++;
  });
  const priorityData = [
    { name: "Normal",             value: priorityCounts.normal,     color: "#A9A29B" },
    { name: "Senior Citizen",     value: priorityCounts.senior,     color: BLUE },
    { name: "Emergency",          value: priorityCounts.emergency,  color: RED },
    { name: "Auth. Priority",     value: priorityCounts.authorized, color: AMBER },
  ].filter((d) => d.value > 0);

  // ── Priority status breakdown (approved vs pending vs rejected) ───────────
  const priorityStatusCounts = { approved: 0, pending: 0, rejected: 0 };
  tokens.forEach((t) => {
    if (t.priority !== "normal" && priorityStatusCounts[t.priorityStatus] !== undefined) {
      priorityStatusCounts[t.priorityStatus]++;
    }
  });

  // ── Service efficiency ────────────────────────────────────────────────────
  const totalHandled = (stats.completed || 0) + (stats.skipped || 0);
  const efficiency   = totalHandled > 0 ? Math.round((stats.completed / totalHandled) * 100) : 0;
  const crowdLevel   = stats.waiting > 10 ? "High" : stats.waiting > 4 ? "Medium" : "Low";
  const crowdColor   = stats.waiting > 10 ? RED    : stats.waiting > 4 ? AMBER    : GREEN;

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ height: 220, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <Card style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No data yet</div>
        <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
          Analytics will appear once tokens start flowing through the queue.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Top KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {[
          { label: "Total Today",        value: stats.total || 0,          icon: "🎫", color: "var(--text)",   bg: "var(--stone)" },
          { label: "Service Efficiency", value: `${efficiency}%`,          icon: "⚙️", color: GREEN,           bg: "var(--green-light)" },
          { label: "Crowd Level",        value: crowdLevel,                 icon: "👥", color: crowdColor,      bg: "var(--accent-light)" },
          { label: "Avg Service Time",
            value: stats.avgServiceMinutes ? `${stats.avgServiceMinutes} min` : "—",
            icon: "⏱️", color: PURPLE, bg: "var(--purple-light)" },
          { label: "Avg Rating",
            value: stats.avgRating ? `${stats.avgRating} ★` : "—",
            icon: "⭐", color: AMBER, bg: "#fef3c7" },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} style={{
            background: bg, borderRadius: 12, padding: "18px 20px",
            border: "1px solid var(--border)",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 26, fontFamily: "'DM Serif Display', serif", color, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="analytics-charts-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Peak Hours Bar Chart */}
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Peak Hours</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Token activity by hour of day
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={peakHoursFiltered} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                formatter={(v) => [`${v} tokens`, "Activity"]}
              />
              <Bar dataKey="tokens" fill={AMBER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Status Pie Chart */}
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Token Status Breakdown</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Distribution of all tokens today
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={3} dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v, n) => [`${v} tokens`, n]}
                />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(v) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
              No data yet
            </div>
          )}
        </Card>
      </div>

      {/* ── Priority breakdown + Crowd monitor ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Priority breakdown */}
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Priority Breakdown</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            Tokens by priority type
          </div>
          {priorityData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {priorityData.map(({ name, value, color }) => {
                const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
                return (
                  <div key={name}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color }}>{name}</span>
                      <span style={{ color: "var(--text-muted)" }}>{value} tokens ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${pct}%`,
                        background: color, borderRadius: 99,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>
                );
              })}
              {/* Priority verification status */}
              {(priorityStatusCounts.approved + priorityStatusCounts.pending + priorityStatusCounts.rejected) > 0 && (
                <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    Priority Verification Status
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { label: "Approved", count: priorityStatusCounts.approved, color: GREEN },
                      { label: "Pending",  count: priorityStatusCounts.pending,  color: AMBER },
                      { label: "Rejected", count: priorityStatusCounts.rejected, color: RED },
                    ].filter(x => x.count > 0).map(({ label, count, color }) => (
                      <div key={label} style={{
                        flex: 1, textAlign: "center", padding: "8px 4px",
                        background: `${color}15`, borderRadius: 8,
                        border: `1px solid ${color}33`,
                      }}>
                        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color, lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No priority data yet</div>
          )}
        </Card>

        {/* Crowd density monitor */}
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Crowd Density Monitor</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
            Current queue pressure level
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%", margin: "0 auto 16px",
              background: `radial-gradient(circle, ${crowdColor}22, ${crowdColor}44)`,
              border: `4px solid ${crowdColor}`,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: crowdColor, lineHeight: 1 }}>
                {stats.waiting || 0}
              </div>
              <div style={{ fontSize: 10, color: crowdColor, fontWeight: 600 }}>waiting</div>
            </div>
            <div style={{
              display: "inline-block", padding: "5px 18px", borderRadius: 99,
              background: `${crowdColor}22`, border: `1.5px solid ${crowdColor}`,
              fontWeight: 700, fontSize: 14, color: crowdColor,
            }}>
              {crowdLevel} Crowd
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 16 }}>
              {[
                { label: "Low",    range: "0–4",   color: GREEN },
                { label: "Medium", range: "5–10",  color: AMBER },
                { label: "High",   range: "10+",   color: RED },
              ].map(({ label, range, color }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, margin: "0 auto 3px" }} />
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{range}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
