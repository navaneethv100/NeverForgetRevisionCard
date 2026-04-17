"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { Icon } from "@iconify/react";

interface DashData {
  total_cards: number;
  due_today: number;
  subject_coverage: Array<{ subject: string; total_cards: number }>;
  streak_days: number;
}

export default function LibraryPage() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("nf_token");
    if (!token) { router.push("/login"); return; }
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");

    fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.status === 401) { router.push("/login"); return null; } return r.json(); })
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, [router]);

  const subjects = data?.subject_coverage.filter((s) => s.total_cards > 0).length ?? 0;

  const steps = data
    ? [
        { label: `${data.total_cards} cards generated` },
        { label: `${subjects} subject${subjects !== 1 ? "s" : ""} covered` },
        { label: "Spaced repetition scheduled" },
        { label: `${data.due_today} card${data.due_today !== 1 ? "s" : ""} due today` },
      ]
    : [
        { label: "Cards generated" },
        { label: "Subjects covered" },
        { label: "Spaced repetition scheduled" },
        { label: "Ready to practice" },
      ];

  return (
    <div style={{ minHeight: "100svh", background: "var(--nf-bg)", display: "flex", flexDirection: "column" }}>
      <NavBar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "52px 16px 44px" }}>

        {/* Hero icon */}
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <div className="ls-hero-glow" />
          <div style={{ position: "relative", zIndex: 1, width: 56, height: 56, borderRadius: "50%", background: "#4F5BD5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 5px var(--nf-bg), 0 0 0 7px #4F5BD5" }}>
            <Icon icon="hugeicons:library" width={26} />
          </div>
        </div>

        <p style={{ fontFamily: "'Lato', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "var(--nf-text-3)", margin: "0 0 6px" }}>
          Your library
        </p>
        <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.5rem)", fontWeight: 600, color: "var(--nf-text)", margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
          {data ? "All set and ready to go" : "Loading your cards…"}
        </h2>

        {/* Card with all steps done */}
        <div style={{ position: "relative", width: 270, height: 340, margin: "40px auto 0" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(79,91,213,0.25)", transform: "rotate(-4deg) translate(-6px, 4px)" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(79,91,213,0.25)", transform: "rotate(3deg) translate(4px, 2px)" }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(79,91,213,0.55)", background: "var(--nf-card)", overflow: "hidden" }}>
            <div style={{
              position: "absolute", left: 0, right: 0, top: 0,
              display: "flex", flexDirection: "column",
              transform: `translateY(calc(50% - ${3 * 72 + 36}px))`,
            }}>
              {steps.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, height: 72, padding: "0 28px", flexShrink: 0 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(79,91,213,0.8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓</div>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", color: "var(--nf-text-3)", textAlign: "left" }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ pointerEvents: "none", position: "absolute", inset: 0, background: "linear-gradient(to bottom, var(--nf-card) 0%, transparent 32%, transparent 68%, var(--nf-card) 100%)" }} />
          </div>
        </div>

        {/* CTAs */}
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/session")}
            style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.95rem", fontWeight: 600, background: "var(--nf-primary)", color: "#fff", border: "none", borderRadius: 14, padding: "14px 40px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(79,91,213,0.25)" }}
          >
            <Icon icon="hugeicons:play" width={18} />
            Start Practice
          </button>
          <button
            onClick={() => router.push("/cards")}
            style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.875rem", fontWeight: 500, background: "transparent", color: "var(--nf-text-3)", border: "1.5px solid var(--nf-border)", borderRadius: 14, padding: "12px 32px", cursor: "pointer" }}
          >
            Manage Cards
          </button>
        </div>
      </div>
    </div>
  );
}
