"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

interface SubjectCoverage {
  subject: string;
  total_cards: number;
  retention_pct: number;
  status: string;
}

interface DashboardData {
  user: { id: number; name: string; exam_date: string | null; exam_name: string };
  days_to_exam: number | null;
  total_cards: number;
  due_today: number;
  new_cards: number;
  cards_at_risk: number;
  retention_rate: number;
  streak_days: number;
  longest_streak: number;
  total_review_days: number;
  reviews_today: number;
  estimated_session_minutes: number;
  subject_coverage: SubjectCoverage[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulateDate, setSimulateDate] = useState("");
  const [showExamModal, setShowExamModal] = useState(false);
  const [examForm, setExamForm] = useState({ name: "", exam_date: "", exam_name: "" });
  const [savingExam, setSavingExam] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("nf_token") : null;

  const fetchDashboard = useCallback(async (simDate?: string) => {
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    try {
      const url = simDate ? `/api/dashboard?simulate_date=${simDate}` : "/api/dashboard";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push("/login"); return; }
      const d = await res.json();
      setData(d);
      setExamForm({
        name: d.user.name || "",
        exam_date: d.user.exam_date ? d.user.exam_date.split("T")[0] : "",
        exam_name: d.user.exam_name || "UPSC Prelims",
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    // Init theme
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
    fetchDashboard();
  }, [fetchDashboard]);

  async function saveExamSettings() {
    setSavingExam(true);
    try {
      await fetch("/api/dashboard/user", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: examForm.name, exam_date: examForm.exam_date || null, exam_name: examForm.exam_name }),
      });
      setShowExamModal(false);
      fetchDashboard();
    } finally {
      setSavingExam(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!data) return null;

  const isExamSprint = data.days_to_exam !== null && data.days_to_exam <= 14 && data.cards_at_risk > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Header row */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--nf-text)" }}>
              Welcome back, {data.user.name.split(" ")[0]} 👋
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--nf-text-3)" }}>
              {data.user.exam_name || "UPSC Prelims"}
              {data.days_to_exam !== null && ` · ${data.days_to_exam} days to exam`}
            </p>
          </div>
          <button
            onClick={() => setShowExamModal(true)}
            className="text-sm px-4 py-2 rounded-xl transition-all"
            style={{ border: "1px solid var(--nf-border)", color: "var(--nf-text-2)", background: "var(--nf-card)" }}
          >
            Set Exam Date
          </button>
        </div>

        {/* At-risk banner */}
        {data.cards_at_risk > 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--nf-warning-bg)", border: "1px solid var(--nf-warning-border)" }}>
            <span className="text-xl">⚠️</span>
            <span className="text-sm font-medium" style={{ color: "var(--nf-warning-text)" }}>
              {data.cards_at_risk} card{data.cards_at_risk !== 1 ? "s are" : " is"} at risk — retention below 60%. Review them soon!
            </span>
          </div>
        )}

        {/* Today's session card */}
        <div className="rounded-2xl p-6 nf-lift" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--nf-text)" }}>
                {data.due_today === 0 ? "All done for today! 🎉" : isExamSprint ? "🚀 Exam Sprint Mode" : "Today's Session"}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--nf-text-3)" }}>
                {data.due_today === 0
                  ? "No cards due. Come back tomorrow."
                  : isExamSprint
                  ? `${data.cards_at_risk} at-risk cards · Exam in ${data.days_to_exam} days`
                  : `${data.due_today} cards · ~${data.estimated_session_minutes} min`}
              </p>
            </div>
            {data.due_today > 0 && (
              <button
                onClick={() => router.push(isExamSprint ? "/session?mode=sprint" : "/session")}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: isExamSprint ? "#ef4444" : "var(--nf-primary)" }}
              >
                {isExamSprint ? "Start Sprint" : "Start Revision"}
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Cards" value={data.total_cards} icon="🃏" />
          <StatCard label="Retention" value={`${data.retention_rate}%`} icon="🧠" />
          <StatCard label="Streak" value={`${data.streak_days} 🔥`} icon="" subtitle={`Longest: ${data.longest_streak}`} />
          <StatCard label="Today" value={data.reviews_today} icon="✅" subtitle="reviews" />
        </div>

        {/* Subject coverage */}
        <div className="rounded-2xl p-6" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
          <h2 className="text-base font-semibold mb-4" style={{ color: "var(--nf-text)" }}>Subject Coverage</h2>
          <div className="space-y-3">
            {data.subject_coverage.map((s) => (
              <SubjectBar key={s.subject} data={s} />
            ))}
          </div>
        </div>

        {/* Time travel */}
        <div className="rounded-2xl p-4" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)" }}>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--nf-text-3)" }}>Time Travel (testing)</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={simulateDate}
              onChange={(e) => setSimulateDate(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
            />
            <button
              onClick={() => fetchDashboard(simulateDate)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{ background: "var(--nf-primary-soft)", color: "var(--nf-primary)" }}
            >
              Simulate
            </button>
            {simulateDate && (
              <button
                onClick={() => { setSimulateDate(""); fetchDashboard(); }}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ color: "var(--nf-text-3)" }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Exam modal */}
      {showExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--nf-overlay)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)" }}>
            <h3 className="text-base font-semibold" style={{ color: "var(--nf-text)" }}>Exam Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--nf-text-2)" }}>Your Name</label>
                <input type="text" value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--nf-text-2)" }}>Exam Name</label>
                <input type="text" value={examForm.exam_name} onChange={(e) => setExamForm({ ...examForm, exam_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--nf-text-2)" }}>Exam Date</label>
                <input type="date" value={examForm.exam_date} onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowExamModal(false)} className="flex-1 py-2 rounded-xl text-sm"
                style={{ border: "1px solid var(--nf-border)", color: "var(--nf-text-2)" }}>Cancel</button>
              <button onClick={saveExamSettings} disabled={savingExam} className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: "var(--nf-primary)" }}>{savingExam ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, subtitle }: { label: string; value: string | number; icon: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl p-4 nf-lift" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
      <p className="text-xs font-medium mb-1" style={{ color: "var(--nf-text-3)" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: "var(--nf-text)" }}>{icon} {value}</p>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--nf-text-4)" }}>{subtitle}</p>}
    </div>
  );
}

function SubjectBar({ data }: { data: SubjectCoverage }) {
  const colors: Record<string, string> = {
    strong: "var(--nf-bar-strong)",
    on_track: "var(--nf-bar-on-track)",
    behind: "var(--nf-bar-behind)",
    critical: "var(--nf-bar-critical)",
  };
  const badgeClass: Record<string, string> = {
    strong: "nf-badge-strong",
    on_track: "nf-badge-on-track",
    behind: "nf-badge-behind",
    critical: "nf-badge-critical",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--nf-text)" }}>{data.subject}</span>
          <span className={`nf-badge ${badgeClass[data.status] || "nf-badge-new"}`}>{data.status.replace("_", " ")}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--nf-text-3)" }}>{data.total_cards} cards</span>
          <span className="text-sm font-semibold" style={{ color: "var(--nf-text-2)" }}>{data.retention_pct}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--nf-card-alt)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${data.retention_pct}%`, background: colors[data.status] || "#ccc" }}
        />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="h-8 w-48 rounded-lg nf-pulse" style={{ background: "var(--nf-card-alt)" }} />
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 rounded-2xl nf-pulse" style={{ background: "var(--nf-card)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
