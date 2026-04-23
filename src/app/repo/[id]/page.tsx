"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

/* ─── Types ─── */
interface Repository {
  id: string; name: string; owner: string; repoUrl: string; status: string;
  primaryLanguage: string | null; totalFiles: number | null; totalChunks: number | null;
  totalSizeBytes: number | null; readmeContent: string | null; architectureContent: string | null;
  createdAt: string; updatedAt: string; errorMessage: string | null;
}
interface Job { id: string; type: string; status: string; progress: number | null; errorMessage: string | null; createdAt: string; }
interface SearchResult { filePath: string; startLine: number; endLine: number; symbolType: string | null; symbolName: string | null; language: string | null; content: string; score: number; }
interface ChatMessage { role: "user" | "assistant"; content: string; }

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Created", CLONED: "Cloned", STRUCTURED: "Structured", INDEXED: "Indexed",
  DOCS_GENERATED: "Docs Ready", READY: "Ready", FAILED: "Failed",
};

export default function RepoDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [repoJobs, setRepoJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<"overview" | "search" | "tutor" | "docs">("overview");
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => { if (id) fetchRepo(); }, [id]);

  async function fetchRepo() {
    try {
      const res = await fetch(`/api/repos/${id}`, { headers: authHeaders });
      if (!res.ok) { router.push("/"); return; }
      const data = await res.json();
      setRepo(data.repository);
      setRepoJobs(data.jobs);
    } catch { router.push("/"); }
    finally { setLoading(false); }
  }

  // Poll while processing
  useEffect(() => {
    if (!repo) return;
    const processing = !["READY", "FAILED"].includes(repo.status);
    if (!processing) return;
    const i = setInterval(fetchRepo, 4000);
    return () => clearInterval(i);
  }, [repo?.status]);

  if (loading) return <div className="page-container"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!repo) return null;

  const isIndexed = ["INDEXED", "DOCS_GENERATED", "READY"].includes(repo.status);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={() => router.push("/")} style={{ cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="8" fill="url(#rg)" /><path d="M8 14L12 10L16 14L12 18Z" fill="white" opacity="0.9" /><path d="M14 10L18 6L22 10L18 14Z" fill="white" opacity="0.6" /><defs><linearGradient id="rg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs></svg>
          Gitdocify
        </div>
        <button className="btn-secondary" onClick={() => router.push("/")} style={{ padding: "6px 16px", fontSize: "13px" }}>← Dashboard</button>
      </nav>

      <main className="page-container">
        {/* ── Header ── */}
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <h1 className="page-title">{repo.owner}/{repo.name}</h1>
            <span className={`status-badge status-${repo.status.toLowerCase()}`}>{STATUS_LABELS[repo.status]}</span>
          </div>
          <p className="page-subtitle">{repo.repoUrl}</p>
          {repo.errorMessage && (
            <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "var(--radius-md)", fontSize: "13px", color: "#FB7185" }}>
              {repo.errorMessage}
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "32px" }}>
          {[
            { label: "Language", value: repo.primaryLanguage || "—" },
            { label: "Files", value: repo.totalFiles?.toLocaleString() || "—" },
            { label: "Chunks", value: repo.totalChunks?.toLocaleString() || "—" },
            { label: "Size", value: repo.totalSizeBytes ? `${(repo.totalSizeBytes / 1024).toFixed(0)} KB` : "—" },
          ].map((s) => (
            <div key={s.label} className="glass-card" style={{ padding: "16px", textAlign: "center" }}>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "4px" }}>{s.label}</p>
              <p style={{ fontSize: "20px", fontWeight: 700 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid var(--border-default)", paddingBottom: "0" }}>
          {(["overview", "search", "tutor", "docs"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t !== "overview" && !isIndexed}
              style={{
                padding: "10px 20px", border: "none", borderBottom: tab === t ? "2px solid var(--accent-blue)" : "2px solid transparent",
                background: "transparent", color: tab === t ? "var(--text-primary)" : "var(--text-tertiary)",
                fontWeight: tab === t ? 600 : 400, fontSize: "14px", cursor: isIndexed || t === "overview" ? "pointer" : "not-allowed",
                opacity: !isIndexed && t !== "overview" ? 0.4 : 1, transition: "all 0.2s ease",
              }}
            >
              {t === "overview" ? "Overview" : t === "search" ? "🔍 Search" : t === "tutor" ? "🤖 AI Tutor" : "📄 Docs"}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {tab === "overview" && <OverviewTab jobs={repoJobs} />}
        {tab === "search" && isIndexed && <SearchTab repoId={repo.id} authHeaders={authHeaders} />}
        {tab === "tutor" && isIndexed && <TutorTab repoId={repo.id} authHeaders={authHeaders} />}
        {tab === "docs" && isIndexed && <DocsTab repo={repo} />}
      </main>
    </>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ jobs }: { jobs: Job[] }) {
  return (
    <div>
      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Pipeline Jobs</h3>
      {jobs.length === 0 ? (
        <p style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>No jobs yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {jobs.map((j) => (
            <div key={j.id} className="glass-card" style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: "14px" }}>{j.type}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: "12px", marginLeft: "8px" }}>
                  {new Date(j.createdAt).toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                {j.progress !== null && j.status === "RUNNING" && (
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{j.progress}%</span>
                )}
                <span className={`status-badge status-${j.status.toLowerCase()}`}>{j.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Search Tab ─── */
function SearchTab({ repoId, authHeaders }: { repoId: string; authHeaders: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/intelligence/${repoId}/search?q=${encodeURIComponent(query)}`, { headers: authHeaders });
      if (res.ok) { const data = await res.json(); setResults(data.results); }
    } catch { /* handle error */ }
    finally { setSearching(false); }
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <input className="input-field" placeholder="Search code semantically... e.g. 'authentication middleware'" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="btn-primary" disabled={searching} style={{ whiteSpace: "nowrap" }}>{searching ? "..." : "Search"}</button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {results.map((r, i) => (
          <div key={i} className="glass-card animate-fade-in" style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span className="code-ref-pill">{r.filePath}:L{r.startLine}-{r.endLine}</span>
              <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>Score: {r.score}</span>
            </div>
            {r.symbolName && <p style={{ fontSize: "13px", color: "var(--text-accent)", marginBottom: "8px" }}>{r.symbolType}: {r.symbolName}</p>}
            <pre style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "var(--radius-md)", fontSize: "12px", overflow: "auto", maxHeight: "200px", color: "var(--text-secondary)" }}>
              {r.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tutor Tab ─── */
function TutorTab({ repoId, authHeaders }: { repoId: string; authHeaders: Record<string, string> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setStreaming(true);

    try {
      const res = await fetch(`/api/tutor/${repoId}/chat`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId }),
      });

      // Get session ID from header
      const newSessionId = res.headers.get("X-Session-Id");
      if (newSessionId) setSessionId(newSessionId);

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let fullText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullText };
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 320px)" }}>
      {/* Chat messages */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🤖</div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>AI Code Tutor</h3>
            <p style={{ fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
              Ask questions about this codebase. Every answer is grounded in the actual code with file and line citations.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "chat-user" : "chat-assistant"} style={{ whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.7 }}>
            {m.content || <span className="skeleton" style={{ display: "inline-block", width: 80, height: 16 }} />}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ display: "flex", gap: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-default)" }}>
        <input
          className="input-field"
          placeholder="Ask about the codebase..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={streaming}
        />
        <button type="submit" className="btn-primary" disabled={streaming || !input.trim()}>
          {streaming ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

/* ─── Docs Tab ─── */
function DocsTab({ repo }: { repo: Repository }) {
  const [docTab, setDocTab] = useState<"readme" | "architecture">("readme");
  const content = docTab === "readme" ? repo.readmeContent : repo.architectureContent;

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {(["readme", "architecture"] as const).map((t) => (
          <button key={t} onClick={() => setDocTab(t)}
            style={{
              padding: "6px 16px", border: docTab === t ? "1px solid var(--accent-blue)" : "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)", background: docTab === t ? "rgba(59,130,246,0.15)" : "transparent",
              color: docTab === t ? "var(--text-accent)" : "var(--text-secondary)", fontSize: "13px", fontWeight: 500, cursor: "pointer",
            }}>
            {t === "readme" ? "📄 README" : "🏗️ Architecture"}
          </button>
        ))}
      </div>

      {content ? (
        <div className="glass-card" style={{ padding: "32px", whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.8 }}>
          {content}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-tertiary)" }}>
          <p>Documentation is being generated...</p>
        </div>
      )}
    </div>
  );
}
