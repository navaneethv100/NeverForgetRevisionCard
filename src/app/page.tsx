"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
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

type ModalType = "url" | "text" | "youtube" | null;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [urlInput, setUrlInput] = useState("");
  const [textInput, setTextInput] = useState("");
  const [ytInput, setYtInput] = useState("");
  const [modalError, setModalError] = useState("");

  const fetchDashboard = useCallback(async () => {
    const token = localStorage.getItem("nf_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true);
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
      const d: DashboardData = await res.json();
      setData(d);
      localStorage.setItem("nf_streak", String(d.streak_days));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
    fetchDashboard();
  }, [fetchDashboard]);

  // Mark today as done so NavBar can show the history icon
  useEffect(() => {
    if (data && data.due_today === 0) {
      localStorage.setItem("nf_done_today", new Date().toDateString());
    }
  }, [data]);

  function openModal(type: ModalType) {
    setModalError("");
    setModal(type);
  }

  function submitModal(type: ModalType) {
    setModalError("");
    if (type === "url") {
      if (!urlInput.trim()) { setModalError("Please enter a URL."); return; }
      sessionStorage.setItem("nf_modal_input", JSON.stringify({ type: "url", url: urlInput }));
      router.push("/add?tab=url&auto=1");
    } else if (type === "text") {
      if (!textInput.trim()) { setModalError("Please paste some text."); return; }
      sessionStorage.setItem("nf_modal_input", JSON.stringify({ type: "text", content: textInput }));
      router.push("/add?tab=text&auto=1");
    } else if (type === "youtube") {
      if (!ytInput.trim()) { setModalError("Please enter a YouTube URL."); return; }
      sessionStorage.setItem("nf_modal_input", JSON.stringify({ type: "youtube", url: ytInput }));
      router.push("/add?tab=youtube&auto=1");
    }
  }

  if (loading) {
    return (
      <div style={{ height: "100svh", display: "flex", flexDirection: "column", background: "var(--nf-bg)" }}>
        <NavBar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="ls-ic-spin" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isDone = data.due_today === 0;
  const isExamSprint = data.days_to_exam !== null && data.days_to_exam <= 14 && data.cards_at_risk > 0;

  let topGradient = "linear-gradient(135deg, #d946ef 0%, #f43f5e 30%, #fb923c 65%, #fbbf24 100%)";
  if (isDone) topGradient = "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)";
  else if (isExamSprint) topGradient = "linear-gradient(135deg, #ef4444 0%, #f97316 100%)";

  const subjectNames = (data.subject_coverage || [])
    .filter((s) => s.total_cards > 0)
    .slice(0, 3)
    .map((s) => s.subject)
    .join(", ");

  const minutes = data.estimated_session_minutes;

  const addOptionsGrid = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
      <InputCard
        icon="hugeicons:link-01"
        title="From a Link"
        sub="Any article or webpage"
        onClick={() => openModal("url")}
      />
      <InputCard
        icon="hugeicons:sticky-note-01"
        title="Paste Notes"
        sub="Text from your notes"
        onClick={() => openModal("text")}
      />
      <InputCard
        icon="hugeicons:youtube"
        title="YouTube"
        sub="Paste a video URL"
        onClick={() => openModal("youtube")}
      />
    </div>
  );

  return (
    <div style={{ minHeight: "100svh", background: "var(--nf-bg)", display: "flex", flexDirection: "column" }}>
      <NavBar />

      {/* Scrollable content area with bottom padding for fixed card */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 560,
          width: "100%",
          margin: "0 auto",
          padding: "28px 16px 180px",
          gap: 14,
        }}
      >
        {/* ── Heading ── */}
        <div style={{ textAlign: "center" }}>
          <h2
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: "clamp(1.15rem, 4vw, 1.45rem)",
              color: "var(--nf-text)",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
            }}
          >
            {isDone ? "All caught up — add something new" : "Turn any content into flashcards"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--nf-text-3)", margin: 0, lineHeight: 1.5 }}>
            {isDone
              ? "Your revision for today is done. Paste new material to grow your deck."
              : "Paste a link, your notes, or a YouTube video — AI builds your deck instantly."}
          </p>
        </div>

        {/* ── 3 input options — always visible ── */}
        {addOptionsGrid}
      </div>

      {/* ── Daily revision card — fixed 80px above bottom ── */}
      <div
        style={{
          position: "fixed",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 560,
          padding: "0 16px",
          zIndex: 40,
          pointerEvents: "auto",
        }}
      >
        {data.cards_at_risk > 0 && !isDone && (
          <div
            style={{
              borderRadius: 12,
              padding: "9px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--nf-warning-bg)",
              border: "1px solid var(--nf-warning-border)",
              marginBottom: 8,
            }}
          >
            <Icon icon="hugeicons:alert-02" width={16} style={{ color: "var(--nf-warning-text)", flexShrink: 0 }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--nf-warning-text)" }}>
              {data.cards_at_risk} card{data.cards_at_risk !== 1 ? "s are" : " is"} at risk — review them soon!
            </span>
          </div>
        )}
        <RevisionCard
          topGradient={topGradient}
          isExamSprint={isExamSprint}
          isDone={isDone}
          cardsAtRisk={data.cards_at_risk}
          dueToday={data.due_today}
          minutes={minutes}
          subjectNames={subjectNames}
          onClick={() => !isDone && router.push(isExamSprint ? "/session?mode=sprint" : "/session")}
        />
      </div>

      {/* ── Modals ── */}

      {modal === "url" && (
        <div className="qm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="qm-card">
            <button className="qm-close" onClick={() => setModal(null)}><Icon icon="hugeicons:cancel-01" width={16} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Icon icon="hugeicons:link-01" width={22} style={{ color: "var(--nf-text-2)" }} />
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--nf-text)", margin: 0 }}>Paste a link</h2>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--nf-text-3)", marginBottom: 20 }}>
              We&apos;ll extract the key ideas and build flashcards.
            </p>
            <input
              type="url"
              style={{ width: "100%", background: "var(--nf-input-bg)", border: "1.5px solid var(--nf-input-border)", borderRadius: 12, padding: "13px 16px", fontSize: "0.9rem", color: "var(--nf-text)", outline: "none", marginBottom: 14, boxSizing: "border-box" }}
              placeholder="https://example.com/article"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitModal("url"); }}
              autoFocus
            />
            {modalError && <p style={{ fontSize: "0.8rem", color: "#EF4444", marginBottom: 10, textAlign: "center" }}>{modalError}</p>}
            <button
              style={{ width: "100%", background: "#4F5BD5", color: "#fff", fontSize: "0.95rem", fontWeight: 600, padding: 14, borderRadius: 12, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => submitModal("url")}
            >
              Generate Flashcards →
            </button>
          </div>
        </div>
      )}

      {modal === "text" && (
        <div className="qm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="qm-card">
            <button className="qm-close" onClick={() => setModal(null)}><Icon icon="hugeicons:cancel-01" width={16} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Icon icon="hugeicons:sticky-note-01" width={22} style={{ color: "var(--nf-text-2)" }} />
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--nf-text)", margin: 0 }}>Paste your notes</h2>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--nf-text-3)", marginBottom: 20 }}>
              Paste any text and we&apos;ll generate revision cards from it.
            </p>
            <textarea
              rows={6}
              style={{ width: "100%", background: "var(--nf-input-bg)", border: "1.5px solid var(--nf-input-border)", borderRadius: 12, padding: "13px 16px", fontSize: "0.9rem", color: "var(--nf-text)", outline: "none", marginBottom: 14, boxSizing: "border-box", resize: "none", minHeight: 148 }}
              placeholder="Paste your notes, NCERT text, or coaching material here…"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              autoFocus
            />
            {modalError && <p style={{ fontSize: "0.8rem", color: "#EF4444", marginBottom: 10, textAlign: "center" }}>{modalError}</p>}
            <button
              style={{ width: "100%", background: "#4F5BD5", color: "#fff", fontSize: "0.95rem", fontWeight: 600, padding: 14, borderRadius: 12, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => submitModal("text")}
            >
              Generate Flashcards →
            </button>
          </div>
        </div>
      )}

      {modal === "youtube" && (
        <div className="qm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="qm-card">
            <button className="qm-close" onClick={() => setModal(null)}><Icon icon="hugeicons:cancel-01" width={16} /></button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Icon icon="hugeicons:youtube" width={22} style={{ color: "var(--nf-text-2)" }} />
              <h2 style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--nf-text)", margin: 0 }}>YouTube Video</h2>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--nf-text-3)", marginBottom: 20 }}>
              Paste a YouTube link and we&apos;ll extract key concepts from the video.
            </p>
            <input
              type="url"
              style={{ width: "100%", background: "var(--nf-input-bg)", border: "1.5px solid var(--nf-input-border)", borderRadius: 12, padding: "13px 16px", fontSize: "0.9rem", color: "var(--nf-text)", outline: "none", marginBottom: 14, boxSizing: "border-box" }}
              placeholder="https://www.youtube.com/watch?v=…"
              value={ytInput}
              onChange={(e) => setYtInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitModal("youtube"); }}
              autoFocus
            />
            {modalError && <p style={{ fontSize: "0.8rem", color: "#EF4444", marginBottom: 10, textAlign: "center" }}>{modalError}</p>}
            <button
              style={{ width: "100%", background: "#4F5BD5", color: "#fff", fontSize: "0.95rem", fontWeight: 600, padding: 14, borderRadius: 12, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => submitModal("youtube")}
            >
              Generate Flashcards →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Horizontal daily revision card ── */
function RevisionCard({
  topGradient, isExamSprint, isDone, cardsAtRisk, dueToday, minutes, subjectNames, onClick,
}: {
  topGradient: string; isExamSprint: boolean; isDone: boolean; cardsAtRisk: number;
  dueToday: number; minutes: number; subjectNames: string; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 20,
        overflow: "hidden",
        background: "var(--nf-card)",
        border: "1px solid var(--nf-border)",
        boxShadow: hovered
          ? "0 6px 24px rgba(0,0,0,0.12)"
          : "0 2px 10px rgba(0,0,0,0.06)",
        cursor: isDone ? "default" : "pointer",
        display: "flex",
        minHeight: 110,
        transform: !isDone && hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        userSelect: "none",
      }}
    >
      {/* Left gradient panel */}
      <div
        style={{
          width: 88,
          flexShrink: 0,
          background: topGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 68, height: 82 }}>
          <div style={{ position: "absolute", width: 52, height: 66, borderRadius: 8, top: "50%", left: "50%", background: "rgba(255,255,255,0.55)", transform: "translate(-50%,-50%) rotate(13deg) translate(10px, 5px)", boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }} />
          <div style={{ position: "absolute", width: 52, height: 66, borderRadius: 8, top: "50%", left: "50%", background: "rgba(255,255,255,0.78)", transform: "translate(-50%,-50%) rotate(6deg) translate(4px, 2px)", boxShadow: "0 4px 12px rgba(0,0,0,0.18)" }} />
          <div style={{ position: "absolute", width: 52, height: 66, borderRadius: 8, top: "50%", left: "50%", background: "rgba(255,255,255,0.97)", transform: "translate(-50%,-50%) rotate(-2deg)", boxShadow: "0 4px 12px rgba(0,0,0,0.2)", padding: "9px 8px", display: "flex", flexDirection: "column", gap: 5, boxSizing: "border-box" }}>
            <div style={{ height: 4, width: "78%", borderRadius: 3, background: "rgba(99,102,241,0.35)" }} />
            <div style={{ height: 3, width: "90%", borderRadius: 3, background: "rgba(139,92,246,0.22)" }} />
            <div style={{ height: 3, width: "62%", borderRadius: 3, background: "rgba(99,102,241,0.28)" }} />
            <div style={{ height: 4, width: "42%", borderRadius: 3, background: "rgba(99,102,241,0.45)", marginTop: 2 }} />
          </div>
        </div>
      </div>

      {/* Right text panel */}
      <div style={{ flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nf-text-4)", margin: "0 0 4px" }}>
          Daily Revision
        </p>
        <h3
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "0.95rem",
            fontWeight: 600,
            color: "var(--nf-text)",
            margin: "0 0 4px",
            lineHeight: 1.3,
          }}
        >
          {isDone
            ? "All caught up for today!"
            : isExamSprint
            ? `Exam sprint — ${cardsAtRisk} at-risk cards`
            : `${dueToday} card${dueToday !== 1 ? "s" : ""} due today`}
        </h3>
        <p style={{ fontSize: "0.78rem", color: "var(--nf-text-3)", margin: "0 0 10px", lineHeight: 1.4 }}>
          {isDone
            ? "Come back tomorrow for your next session."
            : isExamSprint
            ? "Focus on weak areas before the exam."
            : `Est. ${minutes} min${subjectNames ? ` · ${subjectNames}` : ""}`}
        </p>
        {!isDone && (
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: isExamSprint ? "#EA580C" : "#4F5BD5" }}>
            {isExamSprint ? "Start Sprint →" : "Start Revision →"}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Input option card ── */
function InputCard({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: string;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--nf-card)",
        border: `1px solid ${hovered ? "var(--nf-border-hover)" : "var(--nf-border)"}`,
        borderRadius: 14,
        padding: "14px 13px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 5,
        cursor: "pointer",
        transition: "border-color 0.14s, box-shadow 0.14s, transform 0.14s",
        boxShadow: hovered
          ? "0 6px 20px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.06)"
          : "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-2px)" : "none",
        textAlign: "left",
      }}
    >
      <Icon icon={icon} width={22} style={{ color: "var(--nf-text-2)" }} />
      <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--nf-text)" }}>{title}</span>
      <span style={{ fontSize: "0.68rem", color: "var(--nf-text-3)" }}>{sub}</span>
    </button>
  );
}
