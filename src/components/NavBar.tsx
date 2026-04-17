"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";

interface UserForm {
  name: string;
  exam_name: string;
  exam_date: string;
}

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [streak, setStreak] = useState(0);
  const [doneToday, setDoneToday] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>({ name: "", exam_name: "", exam_date: "" });
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [showStreak, setShowStreak] = useState(false);
  const [streakData, setStreakData] = useState<{ streak_days: number; longest_streak: number; total_review_days: number; reviews_today: number } | null>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
    const s = localStorage.getItem("nf_streak");
    if (s) setStreak(Number(s) || 0);
    const done = localStorage.getItem("nf_done_today");
    setDoneToday(done === new Date().toDateString());
  }, []);

  // Re-read streak + done state whenever pathname changes
  useEffect(() => {
    const s = localStorage.getItem("nf_streak");
    if (s) setStreak(Number(s) || 0);
    const done = localStorage.getItem("nf_done_today");
    setDoneToday(done === new Date().toDateString());
  }, [pathname]);

  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
    localStorage.setItem("nf_theme", isDark ? "dark" : "light");
  }

  async function openSettings() {
    setSettingsError("");
    // Fetch current user data
    const token = localStorage.getItem("nf_token");
    if (!token) { router.push("/login"); return; }
    try {
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("nf_token");
        localStorage.removeItem("nf_user");
        router.push("/login");
        return;
      }
      const d = await res.json();
      setUserForm({
        name: d.user?.name || "",
        exam_name: d.user?.exam_name || "",
        exam_date: d.user?.exam_date ? d.user.exam_date.split("T")[0] : "",
      });
    } catch {
      setUserForm({ name: "", exam_name: "", exam_date: "" });
    }
    setShowSettings(true);
  }

  async function saveSettings() {
    const token = localStorage.getItem("nf_token");
    if (!token) return;
    setSaving(true);
    setSettingsError("");
    try {
      const res = await fetch("/api/dashboard/user", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userForm.name,
          exam_date: userForm.exam_date || null,
          exam_name: userForm.exam_name,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setShowSettings(false);
    } catch {
      setSettingsError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function openStreak() {
    const token = localStorage.getItem("nf_token");
    if (!token) return;
    try {
      const res = await fetch("/api/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setStreakData({
          streak_days: d.streak_days,
          longest_streak: d.longest_streak,
          total_review_days: d.total_review_days,
          reviews_today: d.reviews_today,
        });
      }
    } catch { /* ignore */ }
    setShowStreak(true);
  }

  function signOut() {
    localStorage.removeItem("nf_token");
    localStorage.removeItem("nf_user");
    localStorage.removeItem("nf_streak");
    router.push("/login");
  }

  const isAnalytics = pathname === "/analytics";
  const isCards = pathname === "/cards";
  const isLibrary = pathname === "/library";

  const iconBtn = (active: boolean): React.CSSProperties => ({
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    cursor: "pointer",
    border: "none",
    background: active ? "var(--nf-primary-soft)" : "transparent",
    color: active ? "var(--nf-primary)" : "var(--nf-text-2)",
    transition: "background 0.15s",
    padding: 0,
  });

  return (
    <>
      <nav
        className="sticky top-0 z-50"
        style={{
          background: "var(--nf-card)",
          borderBottom: "1px solid var(--nf-border)",
          boxShadow: "var(--nf-shadow-sm)",
        }}
      >
        <div
          style={{
            width: "100%",
            padding: "0 20px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "linear-gradient(135deg, #3955d4 0%, #6c47ff 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ color: "#f0c040", fontSize: 17, fontWeight: 900, lineHeight: 1, marginTop: -1 }}>∞</span>
            </div>
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--nf-text-3)",
              }}
            >
              NeverForget
            </span>
          </Link>

          {/* Right icons */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

            {/* Streak */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <button
                style={{ ...iconBtn(false), color: "var(--nf-text-3)" }}
                title={`${streak} day streak`}
                onClick={openStreak}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>🔥</span>
              </button>
              {streak > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    background: "#f97316",
                    color: "#fff",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    lineHeight: 1,
                    minWidth: 13,
                    height: 13,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    pointerEvents: "none",
                    border: "1.5px solid var(--nf-card)",
                  }}
                >
                  {streak}
                </span>
              )}
            </div>

            {/* Reviewed today — only visible when daily session is complete */}
            {doneToday && (
              <button
                style={iconBtn(false)}
                title="Cards reviewed today"
                onClick={() => router.push("/cards")}
              >
                <Icon icon="hugeicons:checkmark-badge-01" width={18} />
              </button>
            )}

            {/* Analytics */}
            <button
              style={iconBtn(isAnalytics)}
              title="Analytics"
              onClick={() => router.push("/analytics")}
            >
              <Icon icon="hugeicons:analytics-01" width={18} />
            </button>

            {/* Cards / Library */}
            <button
              style={iconBtn(isLibrary || isCards)}
              title="My Cards"
              onClick={() => router.push("/library")}
            >
              <Icon icon="hugeicons:library" width={18} />
            </button>

            {/* Settings */}
            <button
              style={iconBtn(false)}
              title="Settings"
              onClick={openSettings}
            >
              <Icon icon="hugeicons:settings-01" width={18} />
            </button>

            {/* Dark mode toggle */}
            <button
              style={iconBtn(false)}
              title="Toggle theme"
              onClick={toggleTheme}
            >
              <Icon icon={dark ? "hugeicons:sun-03" : "hugeicons:moon-02"} width={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="qm-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="qm-card">
            <button className="qm-close" onClick={() => setShowSettings(false)}><Icon icon="hugeicons:cancel-01" width={16} /></button>

            <h3 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--nf-text)", margin: "0 0 4px" }}>
              Settings
            </h3>
            <p style={{ fontSize: "0.875rem", color: "var(--nf-text-3)", marginBottom: 24 }}>
              Update your exam details.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--nf-text-2)", marginBottom: 6 }}>
                  Your Name
                </label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  style={{
                    width: "100%",
                    background: "var(--nf-input-bg)",
                    border: "1.5px solid var(--nf-input-border)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: "0.9rem",
                    color: "var(--nf-text)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--nf-text-2)", marginBottom: 6 }}>
                  Exam Name
                </label>
                <input
                  type="text"
                  value={userForm.exam_name}
                  onChange={(e) => setUserForm({ ...userForm, exam_name: e.target.value })}
                  style={{
                    width: "100%",
                    background: "var(--nf-input-bg)",
                    border: "1.5px solid var(--nf-input-border)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: "0.9rem",
                    color: "var(--nf-text)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 500, color: "var(--nf-text-2)", marginBottom: 6 }}>
                  Exam Date
                </label>
                <input
                  type="date"
                  value={userForm.exam_date}
                  onChange={(e) => setUserForm({ ...userForm, exam_date: e.target.value })}
                  style={{
                    width: "100%",
                    background: "var(--nf-input-bg)",
                    border: "1.5px solid var(--nf-input-border)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: "0.9rem",
                    color: "var(--nf-text)",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {settingsError && (
              <p style={{ fontSize: "0.8rem", color: "#EF4444", marginTop: 10, textAlign: "center" }}>
                {settingsError}
              </p>
            )}

            <button
              onClick={saveSettings}
              disabled={saving}
              style={{
                width: "100%",
                background: "#4F5BD5",
                color: "#fff",
                fontSize: "0.95rem",
                fontWeight: 600,
                padding: "13px 14px",
                borderRadius: 12,
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                marginTop: 20,
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 4px" }}>
              <div style={{ flex: 1, height: 1, background: "var(--nf-border)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--nf-text-4)" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--nf-border)" }} />
            </div>

            <button
              onClick={signOut}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--nf-error-text)",
                fontSize: "0.9rem",
                fontWeight: 500,
                padding: "10px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Icon icon="hugeicons:logout-03" width={16} />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Streak Modal */}
      {showStreak && (
        <div
          className="qm-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowStreak(false); }}
        >
          <div className="qm-card" style={{ textAlign: "center" }}>
            <button className="qm-close" onClick={() => setShowStreak(false)}>
              <Icon icon="hugeicons:cancel-01" width={16} />
            </button>

            <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>
              <span style={{ fontSize: 44, lineHeight: 1 }}>🔥</span>
            </div>
            <h3 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--nf-text)", margin: "0 0 4px", fontFamily: "'Poppins', sans-serif" }}>
              {streakData?.streak_days ?? streak} day{(streakData?.streak_days ?? streak) !== 1 ? "s" : ""}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--nf-text-3)", margin: "0 0 24px" }}>
              {(streakData?.streak_days ?? streak) > 0 ? "Keep it going!" : "Review cards to start a streak!"}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--nf-input-bg)", borderRadius: 12, padding: "14px 8px" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--nf-text)" }}>
                  {streakData?.longest_streak ?? 0}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--nf-text-3)", marginTop: 2 }}>Longest Streak</div>
              </div>
              <div style={{ background: "var(--nf-input-bg)", borderRadius: 12, padding: "14px 8px" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--nf-text)" }}>
                  {streakData?.total_review_days ?? 0}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--nf-text-3)", marginTop: 2 }}>Days Reviewed</div>
              </div>
              <div style={{ background: "var(--nf-input-bg)", borderRadius: 12, padding: "14px 8px" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--nf-text)" }}>
                  {streakData?.reviews_today ?? 0}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--nf-text-3)", marginTop: 2 }}>Today</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
