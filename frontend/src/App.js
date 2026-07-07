import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./App.css";

import Home from "./pages/Home";
import Register from "./pages/Register";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import PublicQueue from "./pages/PublicQueue";
import DisplayBoard from "./pages/DisplayBoard";
import CounterLogin from "./pages/CounterLogin";
import CounterDashboard from "./pages/CounterDashboard";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("queuezen_token");
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

function CounterProtectedRoute({ children }) {
  const token = localStorage.getItem("queuezen_staff_token");
  if (!token) return <Navigate to="/counter/login" replace />;
  return children;
}

// Apply org theme globally based on stored org data
function ThemeApplier() {
  useEffect(() => {
    try {
      const org = JSON.parse(localStorage.getItem("queuezen_org") || "null");
      if (org?.orgType) {
        document.documentElement.setAttribute("data-theme", org.orgType);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } catch {
      // ignore
    }
  }, []);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeApplier />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            borderRadius: 10,
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
          },
          success: { iconTheme: { primary: "var(--green)", secondary: "#fff" } },
          error:   { iconTheme: { primary: "var(--red)",   secondary: "#fff" } },
          duration: 4000,
        }}
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/queue/:orgId" element={<PublicQueue />} />
        <Route path="/display/:orgId" element={<DisplayBoard />} />
        <Route path="/counter/login" element={<CounterLogin />} />
        <Route
          path="/counter/dashboard"
          element={
            <CounterProtectedRoute>
              <CounterDashboard />
            </CounterProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
