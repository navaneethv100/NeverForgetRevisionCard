"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, createContext, useContext } from "react";
import { Icon } from "@iconify/react";

interface UserForm {
  name: string;
  exam_name: string;
  exam_date: string;
}

// Time travel context so any page can read the simulated date
const TimeTravelContext = createContext<{ simulateDate: string | null; setSimulateDate: (d: string | null) => void; ready: boolean }>({ simulateDate: null, setSimulateDate: () => {}, ready: false });

export function useTimeTravel() {
  return useContext(TimeTravelContext);
}

export function TimeTravelProvider({ children }: { children: React.ReactNode }) {
  const [simulateDate, setSimulateDateState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Read from sessionStorage on client mount, then mark ready
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("nf_time_travel");
      if (saved) setSimulateDateState(saved);
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  function setSimulateDate(d: string | null) {
    setSimulateDateState(d);
    try {
      if (d) sessionStorage.setItem("nf_time_travel", d);
      else sessionStorage.removeItem("nf_time_travel");
    } catch { /* ignore */ }
  }

  return (
    <TimeTravelContext.Provider value={{ simulateDate, setSimulateDate, ready }}>
      {children}
    </TimeTravelContext.Provider>
  );
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { simulateDate, setSimulateDate } = useTimeTravel();
  const [timeTravelInput, setTimeTravelInput] = useState("");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
    const s = localStorage.getItem("nf_streak");
    if (s) setStreak(Number(s) || 0);
    const done = localStorage.getItem("nf_done_today");
    setDoneToday(done === new Date().toDateString());
  }, []);

  useEffect(() => {
    const s = localStorage.getItem("nf_streak");
    if (s) setStreak(Number(s) || 0);
    const done = localStorage.getItem("nf_done_today");
    setDoneToday(done === new Date().toDateString());
  }, [pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Sync time travel input with context
  useEffect(() => {
    setTimeTravelInput(simulateDate || "");
  }, [simulateDate]);

  function toggleTheme() {
    const isDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
    localStorage.setItem("nf_theme", isDark ? "dark" : "light");
  }

  async function openSettings() {
    setSidebarOpen(false);
    setSettingsError("");
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
    setSidebarOpen(false);
    router.push("/login");
  }

  function navigateTo(path: string) {
    setSidebarOpen(false);
    router.push(path);
  }

  function applyTimeTravel() {
    if (timeTravelInput) {
      setSimulateDate(timeTravelInput);
    }
    setSidebarOpen(false);
  }

  function resetTimeTravel() {
    setSimulateDate(null);
    setTimeTravelInput("");
    setSidebarOpen(false);
  }

  const isHome = pathname === "/";
  const isAnalytics = pathname === "/analytics";
  const isCards = pathname === "/cards";
  const isLibrary = pathname === "/library";
  const isAudio = pathname === "/audio";

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

  const navItems = [
    { label: "Home", icon: "hugeicons:home-04", path: "/", active: isHome },
    { label: "Analytics", icon: "hugeicons:analytics-01", path: "/analytics", active: isAnalytics },
    { label: "Cards", icon: "hugeicons:flash-card", path: "/cards", active: isCards },
    { label: "Revision Audio", icon: "hugeicons:headphones", path: "/audio", active: isAudio },
    { label: "My Library", icon: "hugeicons:library", path: "/library", active: isLibrary },
  ];

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
          {/* Left: burger + logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Burger menu */}
            <button
              style={iconBtn(false)}
              title="Menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon icon="hugeicons:menu-02" width={20} />
            </button>

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
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 800, lineHeight: 1, fontFamily: "'Poppins', sans-serif", letterSpacing: "-0.05em" }}>NF</span>
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
          </div>

          {/* Right: time travel indicator + streak + theme */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Time travel indicator */}
            {simulateDate && (
              <button
                onClick={() => { setSidebarOpen(true); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 999, border: "1.5px solid var(--nf-warning-border)",
                  background: "var(--nf-warning-bg)", color: "var(--nf-warning-text)",
                  fontSize: "0.7rem", fontWeight: 600, cursor: "pointer",
                  fontFamily: "'Poppins', sans-serif",
                }}
                title="Time traveling"
              >
                <Icon icon="hugeicons:time-02" width={13} />
                {simulateDate}
              </button>
            )}

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

            {/* Reviewed today */}
            {doneToday && (
              <button
                style={iconBtn(false)}
                title="Cards reviewed today"
                onClick={() => router.push("/cards")}
              >
                <Icon icon="hugeicons:checkmark-badge-01" width={18} />
              </button>
            )}

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

      {/* ── Sidebar overlay (LEFT side) ── */}
      {sidebarOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSidebarOpen(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "var(--nf-overlay)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            animation: "qmFadeIn 0.14s ease",
          }}
        >
          {/* Sidebar panel — left side */}
          <div
            className="nf-sidebar-enter"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 290,
              maxWidth: "85vw",
              background: "var(--nf-card)",
              borderRight: "1px solid var(--nf-border)",
              boxShadow: "8px 0 40px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Sidebar header */}
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--nf-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(135deg, #3955d4 0%, #6c47ff 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1, fontFamily: "'Poppins', sans-serif", letterSpacing: "-0.05em" }}>NF</span>
                </div>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--nf-text)" }}>
                  NeverForget
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: "none",
                  background: "transparent", color: "var(--nf-text-3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Icon icon="hugeicons:cancel-01" width={16} />
              </button>
            </div>

            {/* Nav items */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigateTo(item.path)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    background: item.active ? "var(--nf-primary-soft)" : "transparent",
                    color: item.active ? "var(--nf-primary)" : "var(--nf-text-2)",
                    fontSize: "0.9rem",
                    fontWeight: item.active ? 600 : 500,
                    fontFamily: "'Poppins', sans-serif",
                    textAlign: "left",
                    marginBottom: 2,
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  <Icon icon={item.icon} width={20} />
                  {item.label}
                </button>
              ))}

              <div style={{ height: 1, background: "var(--nf-border)", margin: "12px 14px" }} />

              {/* Settings */}
              <button
                onClick={openSettings}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  background: "transparent",
                  color: "var(--nf-text-2)",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  fontFamily: "'Poppins', sans-serif",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                <Icon icon="hugeicons:settings-01" width={20} />
                Settings
              </button>

              <div style={{ height: 1, background: "var(--nf-border)", margin: "12px 14px" }} />

              {/* Time Travel */}
              <div style={{ padding: "8px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Icon icon="hugeicons:time-02" width={18} style={{ color: "var(--nf-text-3)" }} />
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "var(--nf-text-2)" }}>
                    Time Travel
                  </span>
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--nf-text-4)", margin: "0 0 10px", lineHeight: 1.45 }}>
                  Jump to a future date to preview which cards will be due.
                </p>
                <input
                  type="date"
                  value={timeTravelInput}
                  onChange={(e) => setTimeTravelInput(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--nf-input-bg)",
                    border: "1.5px solid var(--nf-input-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: "0.82rem",
                    color: "var(--nf-text)",
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 8,
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={applyTimeTravel}
                    disabled={!timeTravelInput}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: "none",
                      background: timeTravelInput ? "var(--nf-primary)" : "var(--nf-input-bg)",
                      color: timeTravelInput ? "#fff" : "var(--nf-text-4)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: timeTravelInput ? "pointer" : "not-allowed",
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    Jump
                  </button>
                  {simulateDate && (
                    <button
                      onClick={resetTimeTravel}
                      style={{
                        flex: 1,
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "1.5px solid var(--nf-border)",
                        background: "transparent",
                        color: "var(--nf-text-2)",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      Back to today
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar footer: sign out */}
            <div style={{ padding: "12px 12px 20px", borderTop: "1px solid var(--nf-border)" }}>
              <button
                onClick={signOut}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  background: "var(--nf-error-bg)",
                  color: "var(--nf-error-text)",
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <Icon icon="hugeicons:logout-03" width={16} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

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
