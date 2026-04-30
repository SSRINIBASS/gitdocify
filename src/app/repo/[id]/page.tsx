"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ── Types ── */
interface Repo {
  id: string; name: string; owner: string; repoUrl: string; status: string;
  primaryLanguage: string | null; totalFiles: number | null; totalChunks: number | null;
  readmeContent: string | null; architectureContent: string | null;
  codeAnalysisJson: string | null; errorMessage: string | null;
  createdAt: string; updatedAt: string;
}
interface Job { id: string; type: string; status: string; progress: number; errorMessage: string | null; createdAt: string; }
interface SearchResult { filePath: string; startLine: number; endLine: number; symbolType: string | null; symbolName: string | null; language: string | null; content: string; score: number; }
interface ChatMessage { role: "user" | "assistant"; content: string; }
interface TreeNode { name: string; path: string; type: "file" | "dir"; children?: TreeNode[]; }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  CREATED: { label: "Created", color: "status-created" }, CLONED: { label: "Cloning", color: "status-cloned" },
  STRUCTURED: { label: "Structured", color: "status-structured" }, INDEXED: { label: "Indexed", color: "status-indexed" },
  DOCS_GENERATED: { label: "Docs Ready", color: "status-docs_generated" }, READY: { label: "Ready", color: "status-ready" },
  FAILED: { label: "Failed", color: "status-failed" },
};
const PIPELINE = ["CREATED", "CLONED", "STRUCTURED", "INDEXED", "DOCS_GENERATED", "READY"];

function getAuth() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/* ════════════ TABS ════════════ */

function OverviewTab({ repo, jobs: repoJobs }: { repo: Repo; jobs: Job[] }) {
  const stageIdx = PIPELINE.indexOf(repo.status);
  return (
    <div className="animate-fade-in">
      {/* Status Pipeline */}
      <div className="glass-card" style={{ padding: "24px", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px" }}>Processing Pipeline</h3>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {PIPELINE.map((s, i) => (
            <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "100%", height: "6px", borderRadius: "3px",
                background: i <= stageIdx ? (repo.status === "FAILED" ? "var(--accent-rose)" : "var(--gradient-primary)") : "var(--border-default)",
                transition: "all 0.5s ease",
              }} />
              <span style={{ fontSize: "10px", color: i <= stageIdx ? "var(--text-primary)" : "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: i === stageIdx ? 700 : 400 }}>
                {STATUS_CONFIG[s]?.label || s}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Language", value: repo.primaryLanguage || "Analyzing...", icon: "💻" },
          { label: "Files", value: repo.totalFiles ?? "—", icon: "📄" },
          { label: "Chunks", value: repo.totalChunks ?? "—", icon: "🧩" },
          { label: "Status", value: STATUS_CONFIG[repo.status]?.label || repo.status, icon: "📊" },
        ].map((s) => (
          <div key={s.label} className="glass-card" style={{ padding: "20px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>{s.icon}</div>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Error Message */}
      {repo.errorMessage && (
        <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "24px" }}>
          <strong style={{ color: "#FB7185" }}>Error:</strong>
          <p style={{ color: "#FB7185", fontSize: "13px", marginTop: "4px" }}>{repo.errorMessage}</p>
        </div>
      )}

      {/* Jobs */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>Job History</h3>
        {repoJobs.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>No jobs yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {repoJobs.map((j) => (
              <div key={j.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-sm)" }}>
                <span className={`status-badge status-${j.status.toLowerCase()}`} style={{ fontSize: "10px" }}>{j.status}</span>
                <span style={{ fontSize: "13px", fontWeight: 500 }}>{j.type}</span>
                {j.progress > 0 && j.progress < 100 && <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{j.progress}%</span>}
                <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-tertiary)" }}>{new Date(j.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilesTab({ repoId }: { repoId: string }) {
  const [tree, setTree] = useState<TreeNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const auth = getAuth();
      if (!auth) return;
      try {
        const res = await fetch(`/api/repos/${repoId}/structure`, { headers: auth });
        if (res.ok) { const d = await res.json(); setTree(d.tree || []); }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [repoId]);

  const toggle = (p: string) => setExpanded((prev) => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const renderNode = (node: TreeNode, depth: number = 0) => (
    <div key={node.path}>
      <div className="file-tree-item" style={{ paddingLeft: `${12 + depth * 20}px` }} onClick={() => node.type === "dir" && toggle(node.path)}>
        <span style={{ fontSize: "14px", width: "20px", textAlign: "center" }}>
          {node.type === "dir" ? (expanded.has(node.path) ? "📂" : "📁") : "📄"}
        </span>
        <span style={{ fontSize: "13px", color: node.type === "dir" ? "var(--text-primary)" : "var(--text-secondary)" }}>{node.name}</span>
      </div>
      {node.type === "dir" && expanded.has(node.path) && node.children?.map((c) => renderNode(c, depth + 1))}
    </div>
  );

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}><div className="spinner" /><p style={{ marginTop: "16px", color: "var(--text-tertiary)" }}>Loading file tree...</p></div>;
  if (!tree || tree.length === 0) return <p style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>No files available. Repository may still be processing.</p>;

  return <div className="glass-card animate-fade-in" style={{ padding: "16px", maxHeight: "600px", overflow: "auto" }}>{tree.map((n) => renderNode(n))}</div>;
}

function SearchTab({ repoId }: { repoId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;
    const auth = getAuth();
    if (!auth) return;
    setLoading(true); setSearched(true);
    try {
      const res = await fetch(`/api/intelligence/${repoId}/search?q=${encodeURIComponent(query.trim())}&limit=15`, { headers: auth });
      if (res.ok) { const d = await res.json(); setResults(d.results || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in">
      <form onSubmit={handleSearch} style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <input className="input-field" placeholder="Search code semantically... e.g. 'authentication middleware'" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn-primary" disabled={loading || query.trim().length < 2}>{loading ? "Searching..." : "Search"}</button>
      </form>

      {loading && <div style={{ textAlign: "center", padding: "40px" }}><div className="spinner" /></div>}

      {!loading && searched && results.length === 0 && <p style={{ textAlign: "center", padding: "40px", color: "var(--text-tertiary)" }}>No results found for &quot;{query}&quot;</p>}

      {results.map((r, i) => (
        <div key={i} className="glass-card" style={{ padding: "16px", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span className="code-ref-pill">{r.filePath}:{r.startLine}-{r.endLine}</span>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Score: {r.score}</span>
          </div>
          {r.symbolName && <div style={{ fontSize: "13px", color: "var(--text-accent)", marginBottom: "8px" }}>{r.symbolType && <span style={{ color: "var(--text-tertiary)" }}>{r.symbolType} </span>}{r.symbolName}</div>}
          <pre style={{ background: "rgba(0,0,0,0.3)", padding: "12px", borderRadius: "var(--radius-sm)", fontSize: "12px", overflow: "auto", maxHeight: "200px", lineHeight: 1.5 }}>
            <code>{r.content}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}

function TutorTab({ repoId }: { repoId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const auth = getAuth();
    if (!auth) return;
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/tutor/${repoId}/chat`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ question, sessionId }),
      });

      const newSessionId = res.headers.get("X-Session-Id");
      if (newSessionId) setSessionId(newSessionId);

      if (!res.body) { setMessages((prev) => [...prev, { role: "assistant", content: "Error: No response stream" }]); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantMsg = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMsg += decoder.decode(value, { stream: true });
        setMessages((prev) => { const n = [...prev]; n[n.length - 1] = { role: "assistant", content: assistantMsg }; return n; });
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: Failed to get response. Please try again." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: "500px" }}>
      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0", marginBottom: "16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎓</div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>AI Code Tutor</h3>
            <p style={{ fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>Ask questions about this codebase. Every answer is grounded in the actual code with file references.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "chat-user" : "chat-assistant"}>
            {m.role === "assistant" ? <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "..."}</ReactMarkdown></div> : m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} style={{ display: "flex", gap: "12px", paddingTop: "12px", borderTop: "1px solid var(--border-default)" }}>
        <input className="input-field" placeholder="Ask about this codebase..." value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} style={{ flex: 1 }} />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>{loading ? "..." : "Send"}</button>
      </form>
    </div>
  );
}

function DocsTab({ repo }: { repo: Repo }) {
  const [view, setView] = useState<"readme" | "architecture">("readme");
  const content = view === "readme" ? repo.readmeContent : repo.architectureContent;

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {(["readme", "architecture"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "8px 20px", borderRadius: "var(--radius-md)", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: "1px solid",
            background: view === v ? "var(--gradient-primary)" : "transparent",
            color: view === v ? "white" : "var(--text-secondary)",
            borderColor: view === v ? "transparent" : "var(--border-default)",
          }}>
            {v === "readme" ? "📄 README" : "🏗 Architecture"}
          </button>
        ))}
      </div>

      {content ? (
        <div className="glass-card" style={{ padding: "32px" }}>
          <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px", color: "var(--text-tertiary)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📝</div>
          <p>Documentation is being generated... Check back shortly.</p>
        </div>
      )}
    </div>
  );
}

function AnalysisTab({ repo }: { repo: Repo }) {
  const analysis = repo.codeAnalysisJson ? (() => { try { return JSON.parse(repo.codeAnalysisJson); } catch { return null; } })() : null;

  if (!analysis) return (
    <div className="animate-fade-in" style={{ textAlign: "center", padding: "60px", color: "var(--text-tertiary)" }}>
      <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔬</div>
      <p>Code analysis is being generated...</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {/* Quality */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>📊 Code Quality</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {Object.entries(analysis.quality || {}).map(([k, v]) => (
              <div key={k} style={{ fontSize: "13px" }}>
                <div style={{ color: "var(--text-tertiary)", marginBottom: "2px", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</div>
                <div style={{ fontWeight: 600, fontSize: "16px" }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dependencies */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>📦 Dependencies</h4>
          {analysis.dependencies?.directDependencies && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "6px" }}>Direct</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {(analysis.dependencies.directDependencies as string[]).slice(0, 12).map((d: string) => (
                  <span key={d} className="code-ref-pill">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tech Debt */}
        {analysis.debt && (
          <div className="glass-card" style={{ padding: "24px" }}>
            <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>🔧 Technical Debt</h4>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              <p>Debt Score: <strong>{analysis.debt.codeDebt ?? "—"}</strong></p>
              <p>Est. Fix Time: <strong>{analysis.debt.estimatedFixTime ?? "—"}h</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════ MAIN PAGE ════════════ */

const TABS = [
  { id: "overview", label: "Overview", icon: "📋" },
  { id: "files", label: "Files", icon: "📁" },
  { id: "search", label: "Search", icon: "🔍" },
  { id: "tutor", label: "AI Tutor", icon: "🎓" },
  { id: "docs", label: "Docs", icon: "📄" },
  { id: "analysis", label: "Analysis", icon: "🔬" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function RepoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [repo, setRepo] = useState<Repo | null>(null);
  const [repoJobs, setRepoJobs] = useState<Job[]>([]);
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);

  const fetchRepo = useCallback(async () => {
    const auth = getAuth();
    if (!auth) { router.push("/"); return; }
    try {
      const res = await fetch(`/api/repos/${id}`, { headers: auth });
      if (res.ok) {
        const d = await res.json();
        setRepo(d.repository);
        setRepoJobs(d.jobs || []);
      } else if (res.status === 401) { router.push("/"); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchRepo(); }, [fetchRepo]);

  // Poll while processing
  useEffect(() => {
    if (!repo) return;
    const processing = ["CREATED", "CLONED", "STRUCTURED", "INDEXED", "DOCS_GENERATED"].includes(repo.status);
    if (!processing) return;
    const interval = setInterval(fetchRepo, 5000);
    return () => clearInterval(interval);
  }, [repo, fetchRepo]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" />
    </div>
  );

  if (!repo) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <p style={{ color: "var(--text-tertiary)" }}>Repository not found</p>
      <button className="btn-secondary" onClick={() => router.push("/")}>← Dashboard</button>
    </div>
  );

  const statusCfg = STATUS_CONFIG[repo.status] || STATUS_CONFIG.CREATED;

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="nav-logo" onClick={() => router.push("/")} style={{ cursor: "pointer" }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="8" fill="url(#rg)" /><path d="M8 14L12 10L16 14L12 18Z" fill="white" opacity="0.9" /><path d="M14 10L18 6L22 10L18 14Z" fill="white" opacity="0.6" /><defs><linearGradient id="rg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs></svg>
            Gitdocify
          </div>
          <span style={{ color: "var(--text-tertiary)" }}>/</span>
          <span style={{ fontSize: "15px", fontWeight: 500 }}>{repo.owner}/<span style={{ color: "var(--text-accent)" }}>{repo.name}</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className={`status-badge ${statusCfg.color}`}>{statusCfg.label}</span>
          <button className="btn-secondary" onClick={() => router.push("/")} style={{ padding: "6px 16px", fontSize: "13px" }}>← Dashboard</button>
        </div>
      </nav>

      <main className="page-container">
        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "28px", borderBottom: "1px solid var(--border-default)", paddingBottom: "0" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 18px", fontSize: "13px", fontWeight: tab === t.id ? 600 : 400, cursor: "pointer",
              background: "transparent", border: "none", borderBottom: tab === t.id ? "2px solid var(--accent-blue)" : "2px solid transparent",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-tertiary)",
              transition: "all 0.2s ease",
            }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "overview" && <OverviewTab repo={repo} jobs={repoJobs} />}
        {tab === "files" && <FilesTab repoId={repo.id} />}
        {tab === "search" && <SearchTab repoId={repo.id} />}
        {tab === "tutor" && <TutorTab repoId={repo.id} />}
        {tab === "docs" && <DocsTab repo={repo} />}
        {tab === "analysis" && <AnalysisTab repo={repo} />}
      </main>
    </>
  );
}