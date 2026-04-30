"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [maskedKey, setMaskedKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkApiKey();
  }, []);

  async function checkApiKey() {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/"); return; }

    try {
      const res = await fetch("/api/settings/api-key", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConfigured(data.configured);
        setMaskedKey(data.maskedKey || "");
      }
    } catch (e) {
      console.error("Failed to check API key:", e);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setLoading(true);
    setMessage("");

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/settings/api-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("✓ API key saved and encrypted successfully");
        setConfigured(true);
        setMaskedKey(data.maskedKey);
        setApiKey("");
      } else {
        setMessage(`✗ ${data.error}`);
      }
    } catch {
      setMessage("✗ Failed to save API key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <nav className="navbar">
        <div className="nav-logo" onClick={() => router.push("/")} style={{ cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#sg)" />
            <path d="M8 14L12 10L16 14L12 18Z" fill="white" opacity="0.9" />
            <path d="M14 10L18 6L22 10L18 14Z" fill="white" opacity="0.6" />
            <defs><linearGradient id="sg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
          </svg>
          Gitdocify
        </div>
        <button className="btn-secondary" onClick={() => router.push("/")} style={{ padding: "6px 16px", fontSize: "13px" }}>
          ← Dashboard
        </button>
      </nav>

      <main className="page-container" style={{ maxWidth: "640px" }}>
        <div className="page-header">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your NVIDIA NIM API key for AI-powered features.</p>
        </div>

        <div className="glass-card" style={{ padding: "32px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
            NVIDIA NIM API Key
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
            Your API key is encrypted with AES-256-GCM before storage. It&apos;s used to generate
            embeddings and AI completions using NVIDIA's platform.
          </p>

          {configured && (
            <div style={{
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ color: "#34D399", fontSize: "16px" }}>✓</span>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 500, color: "#34D399" }}>
                  API key configured
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-tertiary)", fontFamily: "'JetBrains Mono', monospace" }}>
                  {maskedKey}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSave}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "6px", color: "var(--text-secondary)" }}>
              {configured ? "Update API Key" : "Enter API Key"}
            </label>
            <input
              className="input-field"
              type="password"
              placeholder="nvapi-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ marginBottom: "16px" }}
            />

            {message && (
              <p style={{
                fontSize: "13px",
                marginBottom: "16px",
                color: message.startsWith("✓") ? "#34D399" : "#FB7185",
              }}>
                {message}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !apiKey.trim()}
            >
              {loading ? "Encrypting..." : "Save API Key"}
            </button>
          </form>

          <div style={{ marginTop: "24px", padding: "16px", background: "var(--bg-primary)", borderRadius: "var(--radius-md)" }}>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", lineHeight: 1.8 }}>
              🔐 <strong>Security:</strong> Your key is encrypted with AES-256-GCM using a server-side secret.
              Neither Gitdocify nor its operators can see your plaintext key.<br />
              💡 <strong>Get a key:</strong>{" "}
              <a href="https://build.nvidia.com" target="_blank" rel="noopener" style={{ color: "var(--text-accent)" }}>
                NVIDIA NIM → Create API Key
              </a>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
