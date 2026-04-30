"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/* ── Types ── */
interface Team {
  id: string;
  name: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  email: string;
  role: string;
}

interface TeamDetail extends Team {
  members: TeamMember[];
}

function getAuth() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

/* ════════════ Create Team Modal ════════════ */
function CreateTeamModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const auth = getAuth();
    if (!auth) return;

    setLoading(true);
    setError("");

    try {
      // Auto-create org if org name provided
      let organizationId = "";
      if (orgName.trim()) {
        // For now, we create team with the org name as description context
        // since org creation endpoint isn't exposed yet
      }

      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || `Team: ${name.trim()}`,
          organizationId: organizationId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create team");
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
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
          Create Team
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
          Create a new team to collaborate on repositories.
        </p>

        {error && (
          <div style={{
            background: "rgba(244,63,94,0.1)",
            border: "1px solid rgba(244,63,94,0.3)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "#FB7185",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "6px", color: "var(--text-secondary)" }}>
              Team Name *
            </label>
            <input
              className="input-field"
              placeholder="e.g. Frontend Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, marginBottom: "6px", color: "var(--text-secondary)" }}>
              Description
            </label>
            <input
              className="input-field"
              placeholder="What does this team work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════ Team Detail Panel ════════════ */
function TeamDetailPanel({ teamId, onBack }: { teamId: string; onBack: () => void }) {
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const auth = getAuth();
      if (!auth) return;
      try {
        const res = await fetch(`/api/teams/${teamId}`, { headers: auth });
        if (res.ok) {
          const data = await res.json();
          setTeam(data.team);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [teamId]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px" }}>
      <div className="spinner" />
      <p style={{ marginTop: "16px", color: "var(--text-tertiary)" }}>Loading team details...</p>
    </div>
  );

  if (!team) return (
    <div style={{ textAlign: "center", padding: "60px", color: "var(--text-tertiary)" }}>
      <p>Team not found.</p>
      <button className="btn-secondary" onClick={onBack} style={{ marginTop: "16px" }}>← Back to Teams</button>
    </div>
  );

  const ROLE_COLORS: Record<string, string> = {
    owner: "status-ready",
    admin: "status-indexed",
    member: "status-created",
  };

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", color: "var(--text-accent)", cursor: "pointer", fontSize: "14px", marginBottom: "24px", padding: 0 }}
      >
        ← Back to Teams
      </button>

      {/* Team Header */}
      <div className="glass-card" style={{ padding: "32px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
              👥 {team.name}
            </h2>
            <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
              Created {new Date(team.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
            {team.members?.length || 0} member{(team.members?.length || 0) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Members */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "20px" }}>Team Members</h3>

        {(!team.members || team.members.length === 0) ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: "14px" }}>No members yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {team.members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "var(--gradient-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}>
                    {member.email[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{member.email}</span>
                </div>
                <span className={`status-badge ${ROLE_COLORS[member.role] || "status-created"}`}>
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════ MAIN PAGE ════════════ */
export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const fetchTeams = async () => {
    const auth = getAuth();
    if (!auth) {
      router.push("/");
      return;
    }
    try {
      const res = await fetch("/api/teams", { headers: auth });
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams || []);
      } else if (res.status === 401) {
        router.push("/");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeams(); }, []);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-logo" onClick={() => router.push("/")} style={{ cursor: "pointer" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#tg)" />
            <path d="M8 14L12 10L16 14L12 18Z" fill="white" opacity="0.9" />
            <path d="M14 10L18 6L22 10L18 14Z" fill="white" opacity="0.6" />
            <defs><linearGradient id="tg" x1="0" y1="0" x2="28" y2="28"><stop stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
          </svg>
          Gitdocify
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn-secondary" onClick={() => router.push("/")} style={{ padding: "6px 16px", fontSize: "13px" }}>← Dashboard</button>
          <button className="btn-secondary" onClick={() => router.push("/settings")} style={{ padding: "6px 16px", fontSize: "13px" }}>⚙ Settings</button>
        </div>
      </nav>

      <main className="page-container">
        {selectedTeamId ? (
          <TeamDetailPanel teamId={selectedTeamId} onBack={() => setSelectedTeamId(null)} />
        ) : (
          <>
            {/* Header */}
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 className="page-title">Teams</h1>
                <p className="page-subtitle">
                  {teams.length === 0
                    ? "Create a team to start collaborating on repositories"
                    : `${teams.length} team${teams.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                + Create Team
              </button>
            </div>

            {/* Loading state */}
            {loading ? (
              <div className="repo-grid">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton" style={{ height: "120px" }} />
                ))}
              </div>
            ) : teams.length === 0 ? (
              /* Empty state */
              <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-tertiary)" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>👥</div>
                <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>
                  No teams yet
                </h3>
                <p style={{ fontSize: "14px", maxWidth: "400px", margin: "0 auto" }}>
                  Create a team to collaborate with others on repository analysis and documentation.
                </p>
              </div>
            ) : (
              /* Team cards grid */
              <div className="repo-grid">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="glass-card animate-fade-in"
                    style={{ padding: "24px", cursor: "pointer" }}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <h3 style={{ fontSize: "18px", fontWeight: 600 }}>
                        👥 <span style={{ color: "var(--text-accent)" }}>{team.name}</span>
                      </h3>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
                      📅 Created {new Date(team.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchTeams}
        />
      )}
    </>
  );
}
