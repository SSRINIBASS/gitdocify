"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MonitoringDashboard from "@/components/MonitoringDashboard";

function getAuth() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export default function MonitoringPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.push("/");
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) return null;

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo" onClick={() => router.push("/")} style={{ cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#mg)" />
            <path d="M8 14L12 10L16 14L12 18Z" fill="white" opacity="0.9" />
            <path d="M14 10L18 6L22 10L18 14Z" fill="white" opacity="0.6" />
            <defs>
              <linearGradient id="mg" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#3B82F6" />
                <stop offset="1" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
          Gitdocify
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn-secondary" onClick={() => router.push("/")} style={{ padding: "6px 16px", fontSize: "13px" }}>← Dashboard</button>
        </div>
      </nav>

      <main className="page-container">
        <div className="page-header" style={{ marginBottom: "32px" }}>
          <h1 className="page-title">System Metrics</h1>
          <p className="page-subtitle">Real-time system monitoring and health</p>
        </div>
        <MonitoringDashboard />
      </main>
    </>
  );
}
