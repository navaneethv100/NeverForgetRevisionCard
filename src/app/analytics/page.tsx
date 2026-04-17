"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavBar, { useTimeTravel } from "@/components/NavBar";
import { Icon } from "@iconify/react";

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

function StatCard({
  icon,
  iconColor,
  num,
  numColor,
  label,
  sub,
}: {
  icon: string;
  iconColor: string;
  num: string | number;
  numColor?: string;
  label: string;
  sub: string;
}) {
  return (
    <div
      style={{
        background: "var(--nf-card)",
        border: "1px solid var(--nf-border)",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        boxShadow: "var(--nf-shadow)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--nf-shadow-lg)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--nf-shadow)";
      }}
    >
      <Icon icon={icon} width={22} style={{ color: iconColor, marginBottom: 4 }} />
      <div
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: "clamp(1.6rem,4vw,2rem)",
          fontWeight: 700,
          lineHeight: 1,
          color: numColor || "var(--nf-text)",
        }}
      >
        {num}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--nf-text-3)", marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: "0.68rem", color: "var(--nf-text-4)", marginTop: 1 }}>{sub}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { simulateDate, ready } = useTimeTravel();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("nf_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    try {
      const url = simulateDate ? `/api/dashboard?simulate_date=${simulateDate}` : "/api/dashboard";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("nf_token");
        localStorage.removeItem("nf_user");
        router.push("/login");
        return;
      }
      const d: DashboardData = await res.json();
      setData(d);
      localStorage.setItem("nf_streak", String(d.streak_days));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router, simulateDate]);

  useEffect(() => {
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
    if (ready) fetchData();
  }, [fetchData, ready]);

  // Contextual tip
  let showTip = false;
  let tipText = "";
  if (data) {
    if (data.streak_days >= 7) {
      showTip = true;
      tipText = `You've studied ${data.streak_days} days in a row — amazing consistency! Keep your streak alive by doing even one session per day.`;
    } else if (data.retention_rate < 60) {
      showTip = true;
      tipText = "Your retention rate is below 60%. Try shorter, more frequent sessions to strengthen memory pathways.";
    } else if (data.due_today === 0) {
      showTip = true;
      tipText = "You're all caught up for today! Consider adding more content to expand your syllabus coverage.";
    } else if (data.cards_at_risk > 0 && data.days_to_exam !== null && data.days_to_exam > 14) {
      showTip = true;
      tipText = `You have ${data.cards_at_risk} at-risk cards. Review them in a focused session to bring retention back up before your exam.`;
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <div style={{ maxWidth: 768, margin: "0 auto", padding: "0 16px 48px" }}>

        {/* Page title */}
        <div style={{ marginTop: 24, marginBottom: 24 }}>
          <h2
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "clamp(1.4rem, 4vw, 1.75rem)",
              fontWeight: 700,
              color: "var(--nf-text)",
              margin: "0 0 4px",
            }}
          >
            Analytics
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--nf-text-3)", margin: 0 }}>
            Your learning progress at a glance
          </p>
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div className="ls-ic-spin" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
        )}

        {!loading && data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Exam countdown card */}
            {data.user.exam_date && (
              <div
                style={{
                  background: "linear-gradient(135deg, #1460d2, #257AF3)",
                  borderRadius: 16,
                  padding: 20,
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Glow overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(ellipse at 80% -40%, rgba(255,255,255,0.12) 0%, transparent 55%)",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <p
                    style={{
                      color: "rgba(219,234,254,1)",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: 4,
                      margin: "0 0 4px",
                    }}
                  >
                    Exam Countdown
                  </p>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                    <div
                      style={{
                        fontSize: "clamp(2rem,8vw,3rem)",
                        fontWeight: 700,
                        lineHeight: 1,
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {data.days_to_exam ?? "—"}
                    </div>
                    <div style={{ paddingBottom: 4 }}>
                      <p style={{ color: "white", fontWeight: 600, fontSize: "1rem", margin: "0 0 2px" }}>
                        {data.user.exam_name || "days remaining"}
                      </p>
                      <p style={{ color: "rgba(219,234,254,0.8)", fontSize: "0.75rem", margin: 0 }}>
                        {new Date(data.user.exam_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  {data.days_to_exam !== null && data.days_to_exam <= 14 && data.cards_at_risk > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(255,255,255,0.15)",
                        borderRadius: 8,
                        padding: "8px 12px",
                      }}
                    >
                      <Icon icon="hugeicons:alert-02" width={16} style={{ color: "white", flexShrink: 0 }} />
                      <span style={{ color: "white", fontSize: "0.75rem", fontWeight: 500 }}>
                        {data.cards_at_risk} cards at risk — consider Exam Sprint mode
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}
              className="sm:grid-cols-4"
            >
              <StatCard
                icon="hugeicons:flash-card"
                iconColor="var(--nf-primary)"
                num={data.total_cards}
                label="Total Cards"
                sub={`${data.due_today} due today`}
              />
              <StatCard
                icon="hugeicons:brain"
                iconColor="#8b5cf6"
                num={`${data.retention_rate}%`}
                numColor="var(--nf-primary)"
                label="Avg Retention"
                sub={
                  data.retention_rate >= 80
                    ? "Looking strong"
                    : data.retention_rate >= 60
                    ? "On track"
                    : "Needs attention"
                }
              />
              <StatCard
                icon="hugeicons:fire-01"
                iconColor="#f97316"
                num={data.streak_days}
                numColor="#f97316"
                label="Day Streak"
                sub={`Best: ${data.longest_streak || 0} days`}
              />
              <StatCard
                icon="hugeicons:checkmark-circle-01"
                iconColor="#10b981"
                num={data.reviews_today || 0}
                numColor="#10b981"
                label="Reviewed Today"
                sub={`${data.total_review_days || 0} days studied`}
              />
            </div>

            {/* Syllabus Coverage */}
            <div
              style={{
                background: "var(--nf-card)",
                border: "1px solid var(--nf-border)",
                borderRadius: 16,
                padding: "20px 24px",
                boxShadow: "var(--nf-shadow)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--nf-text)", margin: "0 0 2px" }}>
                    Syllabus Coverage
                  </h3>
                  <p style={{ fontSize: "0.75rem", color: "var(--nf-text-4)", margin: 0 }}>
                    Retention rate per subject
                  </p>
                </div>
                <button
                  onClick={() => router.push("/cards")}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: "var(--nf-primary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  All Cards →
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {data.subject_coverage.map((s) => {
                  const pct = Math.min(100, s.retention_pct);
                  const barColor =
                    s.status === "strong"
                      ? "#10b981"
                      : s.status === "on_track"
                      ? "#3b82f6"
                      : s.status === "behind"
                      ? "#f59e0b"
                      : "#ef4444";
                  const badgeStyle: React.CSSProperties =
                    s.status === "strong"
                      ? { background: "var(--nf-green-bg)", color: "var(--nf-green-text)" }
                      : s.status === "on_track"
                      ? { background: "var(--nf-blue-bg)", color: "var(--nf-blue-text)" }
                      : s.status === "behind"
                      ? { background: "var(--nf-yellow-bg)", color: "var(--nf-yellow-text)" }
                      : { background: "var(--nf-red-bg)", color: "var(--nf-red-text)" };
                  const badgeLabel =
                    s.status === "strong"
                      ? "Strong"
                      : s.status === "on_track"
                      ? "On Track"
                      : s.status === "behind"
                      ? "Behind"
                      : "Critical";

                  return (
                    <div key={s.subject} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nf-text)" }}>
                            {s.subject}
                          </span>
                          {s.total_cards > 0 && (
                            <span
                              style={{
                                ...badgeStyle,
                                fontSize: "0.68rem",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              {badgeLabel}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--nf-text-4)" }}>
                            {s.total_cards === 0 ? "No cards yet" : `${s.total_cards} cards`}
                          </span>
                          {s.total_cards > 0 && (
                            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nf-text)" }}>
                              {s.retention_pct}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          background: "var(--nf-card-alt)",
                          borderRadius: 999,
                          height: 6,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 999,
                            width: `${pct}%`,
                            background: barColor,
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* At-Risk Section */}
            {data.cards_at_risk > 0 && (
              <div
                style={{
                  background: "var(--nf-card)",
                  border: "1px solid var(--nf-border)",
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: "var(--nf-shadow)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <Icon icon="hugeicons:alert-02" width={22} style={{ color: "var(--nf-error-text)" }} />
                  <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--nf-text)", margin: 0 }}>
                    Cards At Risk
                  </h3>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--nf-text-2)", marginBottom: 16 }}>
                  {data.cards_at_risk} card{data.cards_at_risk !== 1 ? "s are" : " is"} at risk of being forgotten
                  before your exam. Use Sprint mode to revise all at-risk cards in one focused session.
                </p>
                <button
                  onClick={() => router.push("/session?mode=sprint")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#ef4444",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    padding: "10px 20px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon icon="hugeicons:rocket-01" width={16} /> Start Exam Sprint
                </button>
              </div>
            )}

            {/* Contextual tip */}
            {showTip && (
              <div
                style={{
                  background: "var(--nf-info-bg)",
                  border: "1px solid var(--nf-info-border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <Icon icon="hugeicons:idea-01" width={18} style={{ color: "var(--nf-info-text)", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: "0.875rem", color: "var(--nf-info-text)", margin: 0 }}>{tipText}</p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
