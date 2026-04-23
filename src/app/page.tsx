"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* ─────────────── Types ─────────────── */
interface Repository {
  id: string;
  name: string;
  owner: string;
  repoUrl: string;
  status: string;
  primaryLanguage: string | null;
  totalFiles: number | null;
  totalChunks: number | null;
  createdAt: string;
}

/* ─────────────── Status Config ─────────────── */
const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  CREATED: { label: "Created", icon: "◯", color: "status-created" },
  CLONED: { label: "Cloning", icon: "⟳", color: "status-cloned" },
  STRUCTURED: { label: "Structured", icon: "▦", color: "status-structured" },
  INDEXED: { label: "Indexed", icon: "◈", color: "status-indexed" },
  DOCS_GENERATED: { label: "Docs Ready", icon: "◆", color: "status-docs_generated" },
  READY: { label: "Ready", icon: "✓", color: "status-ready" },
  FAILED: { label: "Failed", icon: "✗", color: "status-failed" },
};

/* ─────────────── Navbar ─────────────── */
function Navbar({
  onLogout,
  userEmail,
}: {
  onLogout: () => void;
  userEmail: string;
}) {
  const router = useRouter();
  return (
    <nav className="navbar">
      <div className="nav-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" fill="url(#navgrad)" />
          <path d="M8 14L12 10L16 14L12 18Z" fill="white" opacity="0.9" />
          <path d="M14 10L18 6L22 10L18 14Z" fill="white" opacity="0.6" />
          <defs>
            <linearGradient id="navgrad" x1="0" y1="0" x2="28" y2="28">
              <stop stopColor="#3B82F6" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
        Gitdocify
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button
          className="btn-secondary"
          onClick={() => router.push("/settings")}
          style={{ padding: "6px 16px", fontSize: "13px" }}
        >
          ⚙ Settings
        </button>
        <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
          {userEmail}
        </span>
        <button
          onClick={onLogout}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

/* ─────────────── Repo Card ─────────────── */
function RepoCard({ repo }: { repo: Repository }) {
  const router = useRouter();
  const status = STATUS_CONFIG[repo.status] || STATUS_CONFIG.CREATED;
  const isProcessing = ["CREATED", "CLONED", "STRUCTURED"].includes(repo.status);

  return (
    <div
      className="glass-card animate-fade-in"
      style={{ padding: "24px", cursor: "pointer" }}
      onClick={() => router.push(`/repo/${repo.id}`)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}>
            {repo.owner}/<span style={{ color: "var(--text-accent)" }}>{repo.name}</span>
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
            {repo.primaryLanguage || "Analyzing..."}
          </p>
        </div>
        <span className={`status-badge ${status.color}`}>
          {isProcessing && (
            <span style={{ display: "inline-block" }} className={isProcessing ? "animate-spin" : ""}>
              ⟳
            </span>
          )}
          {status.label}
        </span>
      </div>

      <div style={{ display: "flex", gap: "24px", fontSize: "13px", color: "var(--text-secondary)" }}>
        {repo.totalFiles !== null && (
          <span>📄 {repo.totalFiles} files</span>
        )}
        {repo.totalChunks !== null && (
          <span>🧩 {repo.totalChunks} chunks</span>
        )}
        <span>📅 {new Date(repo.createdAt).toLocaleDateString()}</span>
      </div>

      {/* Progress bar for processing */}
      {isProcessing && (
        <div style={{ marginTop: "16px" }}>
          <div style={{
            height: "3px",
            borderRadius: "2px",
            background: "var(--border-default)",
            overflow: "hidden",
          }}>
            <div
              className="animate-pulse-glow"
              style={{
                height: "100%",
                width: repo.status === "CLONED" ? "40%" : repo.status === "STRUCTURED" ? "60%" : "10%",
                background: "var(--gradient-primary)",
                borderRadius: "2px",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── Add Repo Modal ─────────────── */
function AddRepoModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    await onSubmit(url.trim());
    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="glass-card animate-slide-up"
        style={{ padding: "32px", width: "480px", maxWidth: "90vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
          Add Repository
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
          Enter a public GitHub repository URL to ingest and analyze.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            className="input-field"
            type="url"
            placeholder="https://github.com/owner/repository"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            style={{ marginBottom: "20px" }}
          />
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !url.trim()}
            >
              {loading ? "Ingesting..." : "Ingest Repository"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────── Auth Pages ─────────────── */
function AuthPage({
  onAuth,
}: {
  onAuth: (token: string, user: { id: string; email: string }) => void;
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onAuth(data.token, data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%),
                    radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.06) 0%, transparent 50%),
                    var(--bg-primary)`,
    }}>
      <div
        className="glass-card animate-slide-up"
        style={{ padding: "48px", width: "420px", maxWidth: "90vw" }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div className="nav-logo" style={{ justifyContent: "center", fontSize: "28px", marginBottom: "8px" }}>
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#authgrad)" />
              <path d="M8 14L12 10L16 14L12 18Z" fill="white" opacity="0.9" />
              <path d="M14 10L18 6L22 10L18 14Z" fill="white" opacity="0.6" />
              <defs>
                <linearGradient id="authgrad" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#3B82F6" />
                  <stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
            Gitdocify
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {isLogin ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(244, 63, 94, 0.1)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            marginBottom: "20px",
            fontSize: "13px",
            color: "#FB7185",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "6px", color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              className="input-field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "6px", color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              className="input-field"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: "100%", padding: "12px" }}
          >
            {loading ? "..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "var(--text-tertiary)" }}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--text-accent)", cursor: "pointer", fontWeight: 500, fontSize: "13px" }}
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ─────────────── Main Dashboard ─────────────── */
export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchRepos();
  }, [token]);

  async function fetchRepos() {
    setLoading(true);
    try {
      const res = await fetch("/api/repos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repositories);
      }
    } catch (err) {
      console.error("Failed to fetch repos:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleIngest(url: string) {
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ repoUrl: url }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to ingest repository");
        return;
      }

      setShowAddModal(false);
      await fetchRepos();
    } catch (err) {
      alert("Failed to ingest repository");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setRepos([]);
  }

  // Poll for status updates on processing repos
  useEffect(() => {
    if (!token) return;
    const hasProcessing = repos.some((r) =>
      ["CREATED", "CLONED", "STRUCTURED", "INDEXED", "DOCS_GENERATED"].includes(r.status)
    );
    if (!hasProcessing) return;

    const interval = setInterval(fetchRepos, 5000);
    return () => clearInterval(interval);
  }, [repos, token]);

  // Authenticated check
  if (!token || !user) {
    return (
      <AuthPage
        onAuth={(newToken, newUser) => {
          setToken(newToken);
          setUser(newUser);
        }}
      />
    );
  }

  return (
    <>
      <Navbar onLogout={handleLogout} userEmail={user.email} />

      <main className="page-container">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title">Repositories</h1>
            <p className="page-subtitle">
              {repos.length === 0 ? "Add your first GitHub repository to get started" : `${repos.length} repositories ingested`}
            </p>
          </div>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Repository
          </button>
        </div>

        {loading && repos.length === 0 ? (
          <div className="repo-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: "140px" }} />
            ))}
          </div>
        ) : repos.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "80px 20px",
            color: "var(--text-tertiary)",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📦</div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>
              No repositories yet
            </h3>
            <p style={{ fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
              Ingest a GitHub repository to start exploring code with AI-powered intelligence.
            </p>
          </div>
        ) : (
          <div className="repo-grid">
            {repos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddRepoModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleIngest}
        />
      )}
    </>
  );
}
