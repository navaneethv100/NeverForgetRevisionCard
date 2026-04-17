"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar, { useTimeTravel } from "@/components/NavBar";
import { Suspense } from "react";
import { Icon } from "@iconify/react";

interface SessionCard {
  card_id: number;
  card_type: string;
  front: string | null;
  hint: string | null;
  back: string | null;
  options: Record<string, string> | null;
  correct_option: string | null;
  explanation: string | null;
  subject: string;
  topic: string;
  concept: string;
  retrievability: number;
  review_count: number;
}

const RATINGS = [
  { key: "again", icon: "hugeicons:face-unhappy", label: "Forgot", bg: "var(--nf-again-bg)", border: "var(--nf-again-border)", text: "var(--nf-again-text)" },
  { key: "hard",  icon: "hugeicons:face-sad",     label: "Hard",   bg: "var(--nf-hard-bg)",  border: "var(--nf-hard-border)",  text: "var(--nf-hard-text)"  },
  { key: "good",  icon: "hugeicons:face-happy",   label: "Good",   bg: "var(--nf-good-bg)",  border: "var(--nf-good-border)",  text: "var(--nf-good-text)"  },
  { key: "easy",  icon: "hugeicons:rocket-01",    label: "Easy",   bg: "var(--nf-easy-bg)",  border: "var(--nf-easy-border)",  text: "var(--nf-easy-text)"  },
];

function SessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSprint = searchParams.get("mode") === "sprint";
  const cardIds = searchParams.get("card_ids");
  const { simulateDate, ready } = useTimeTravel();

  const [cards, setCards] = useState<SessionCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [cardKey, setCardKey] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [reviewMessage, setReviewMessage] = useState("");
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [lastRating, setLastRating] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [mcqResult, setMcqResult] = useState<"correct" | "wrong" | null>(null);

  const confettiPieces = useMemo(() => {
    const colors = ["#f59e0b","#10b981","#3b82f6","#ec4899","#8b5cf6","#f97316","#ef4444","#06b6d4"];
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      left: `${(i * 31 + 7) % 100}%`,
      delay: `${(i * 0.09) % 2}s`,
      duration: `${2.4 + (i * 0.17) % 1.4}s`,
      w: [10, 7, 12, 8][i % 4],
      h: [7, 12, 6, 10][i % 4],
    }));
  }, []);

  const fetchSession = useCallback(async () => {
    const token = localStorage.getItem("nf_token");
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    try {
      const base = isSprint ? "/api/session/sprint" : "/api/session/today";
      const params = new URLSearchParams();
      if (simulateDate) params.set("simulate_date", simulateDate);
      if (cardIds) params.set("card_ids", cardIds);
      const endpoint = `${base}${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem("nf_token"); localStorage.removeItem("nf_user"); router.push("/login"); return; }
      const data = await res.json();
      setCards(data.cards || []);
    } finally {
      setLoading(false);
    }
  }, [router, isSprint, simulateDate, cardIds]);

  useEffect(() => {
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
    if (ready) fetchSession();
  }, [fetchSession, ready]);

  useEffect(() => {
    setStartTime(Date.now());
    setShowAnswer(false);
    setShowHint(false);
    setSelectedOption(null);
    setReviewMessage("");
    setLastRating(null);
    setCelebrate(false);
    setMcqResult(null);
  }, [currentIdx]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (exiting) return;
      if (e.key === "Escape") { router.push("/"); return; }
      if (!showAnswer) {
        if (e.code === "Space") { e.preventDefault(); setShowAnswer(true); }
        return;
      }
      const map: Record<string, string> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      if (map[e.key] && !submitting) handleRating(map[e.key]);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, submitting, currentIdx, exiting]);

  function animateAdvance(cb: () => void) {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => {
      cb();
      setCardKey((k) => k + 1);
      setExiting(false);
    }, 300);
  }

  function handleOptionSelect(key: string) {
    if (selectedOption) return;
    setSelectedOption(key);
    setShowAnswer(true);
    const isCorrect = key === card.correct_option;
    setMcqResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1100);
    }
  }

  async function handleRating(rating: string) {
    if (submitting || exiting) return;
    setSubmitting(true);
    setLastRating(rating);
    const card = cards[currentIdx];
    const responseTimeMs = Date.now() - startTime;
    try {
      const token = localStorage.getItem("nf_token");
      const res = await fetch(`/api/session/review/${card.card_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rating, response_time_ms: responseTimeMs }),
      });
      const data = await res.json();
      setStats((s) => ({ ...s, [rating]: s[rating as keyof typeof s] + 1 }));
      setReviewMessage(data.message || "");
      setTimeout(() => {
        setSubmitting(false);
        if (currentIdx + 1 >= cards.length) {
          setExiting(true);
          setTimeout(() => setDone(true), 300);
        } else {
          animateAdvance(() => setCurrentIdx((i) => i + 1));
        }
      }, 500);
    } catch {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen />;

  if (done || (cards.length === 0 && !loading)) {
    const total = stats.again + stats.hard + stats.good + stats.easy;
    const streak = Number(typeof window !== "undefined" ? localStorage.getItem("nf_streak") || 0 : 0);
    return (
      <div style={{ minHeight: "100vh", background: "var(--nf-bg)", overflow: "hidden", position: "relative" }}>
        {/* Confetti */}
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10 }}>
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              style={{
                position: "absolute",
                top: 0,
                left: p.left,
                width: p.w,
                height: p.h,
                borderRadius: p.id % 3 === 0 ? "50%" : 2,
                background: p.color,
                animation: `nf-confetti-fall ${p.duration} ${p.delay} ease-in both`,
              }}
            />
          ))}
        </div>

        <NavBar />
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 20px 60px", textAlign: "center", position: "relative", zIndex: 20 }}>

          {/* Green checkmark circle */}
          <div
            className="nf-pop-in"
            style={{
              width: 88, height: 88, borderRadius: "50%",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 28px",
              boxShadow: "0 0 0 14px rgba(16,185,129,0.12), 0 0 0 28px rgba(16,185,129,0.06), 0 8px 32px rgba(16,185,129,0.3)",
            }}
          >
            <Icon icon="hugeicons:checkmark-circle-01" width={48} style={{ color: "#fff" }} />
          </div>

          {/* Streak */}
          {streak > 0 && (
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                background: "rgba(249,115,22,0.09)", border: "1.5px solid rgba(249,115,22,0.2)",
                borderRadius: 999, padding: "8px 18px", marginBottom: 20,
                animation: "nf-streak-pop 0.5s 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
              }}
            >
              <Icon icon="hugeicons:fire-01" width={20} className="nf-fire-anim" style={{ color: "#f97316" }} />
              <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: "0.95rem", color: "#ea6c0a" }}>
                {streak} day streak!
              </span>
              <Icon icon="hugeicons:fire-01" width={20} className="nf-fire-anim" style={{ color: "#f97316", animationDelay: "0.18s" }} />
            </div>
          )}

          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--nf-text)", margin: "0 0 8px", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
            {cards.length === 0 ? "All caught up!" : "Session complete"}
          </h2>
          <p style={{ fontSize: "0.9rem", color: "var(--nf-text-3)", margin: "0 0 32px", fontWeight: 400 }}>
            {total > 0 ? `You reviewed ${total} card${total !== 1 ? "s" : ""}` : "No cards were due today."}
          </p>

          {total > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 36 }}>
              {RATINGS.map(({ key, label, border, text }) => (
                <div key={key} style={{ borderRadius: 18, padding: "16px 8px", textAlign: "center", border: `1.5px solid ${border}` }}>
                  <p style={{ fontSize: "1.35rem", fontWeight: 700, color: text, margin: "0 0 2px", fontFamily: "'Poppins', sans-serif" }}>
                    {stats[key as keyof typeof stats]}
                  </p>
                  <p style={{ fontSize: "0.72rem", fontWeight: 600, color: text, margin: 0 }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push("/")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 40px", borderRadius: 14, fontSize: "1rem", fontWeight: 600,
              color: "#fff", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none", cursor: "pointer", fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 20px rgba(16,185,129,0.35)",
            }}
          >
            Continue
            <Icon icon="hugeicons:arrow-right-01" width={18} />
          </button>
        </div>
      </div>
    );
  }

  const card = cards[currentIdx];
  if (!card) return <LoadingScreen />;
  const progress = Math.round((currentIdx / cards.length) * 100);
  const isFlashcard = card.card_type === "flashcard";
  const hasNext1 = currentIdx + 1 < cards.length;
  const hasNext2 = currentIdx + 2 < cards.length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>

      {/* ── Correct answer celebration ── */}
      {celebrate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div className="nf-celebrate" style={{ width: 120, height: 120, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 20px rgba(16,185,129,0.15), 0 0 0 40px rgba(16,185,129,0.07)" }}>
            <Icon icon="hugeicons:checkmark-circle-01" width={56} style={{ color: "#fff" }} />
          </div>
        </div>
      )}

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px 96px", display: "flex", flexDirection: "column", height: "100dvh", boxSizing: "border-box" }}>

        {/* ── Top bar: progress + close ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--nf-text-3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon icon={isSprint ? "hugeicons:rocket-01" : "hugeicons:book-open-02"} width={13} />
                {isSprint ? "Exam Sprint" : "Daily Review"}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--nf-text-4)", fontVariantNumeric: "tabular-nums" }}>
                {currentIdx + 1} / {cards.length}
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 999, background: "var(--nf-card-alt)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 999, width: `${progress}%`, background: "var(--nf-primary)", transition: "width 0.5s ease" }} />
            </div>
          </div>
          <button
            onClick={() => router.push("/")}
            style={{ width: 34, height: 34, borderRadius: 10, border: "1.5px solid var(--nf-border)", background: "var(--nf-card)", color: "var(--nf-text-3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <Icon icon="hugeicons:cancel-01" width={15} />
          </button>
        </div>

        {/* ── Card stack ── */}
        <div style={{ position: "relative", flex: 1, minHeight: 0, paddingBottom: hasNext2 ? 28 : hasNext1 ? 14 : 0, marginBottom: 12 }}>
          {hasNext2 && (
            <div style={{ position: "absolute", bottom: 0, left: 28, right: 28, height: 52, borderRadius: 20, background: "var(--nf-card)", border: "2px solid var(--nf-border)", boxShadow: "0 4px 14px rgba(0,0,0,0.06)", zIndex: 1 }} />
          )}
          {hasNext1 && (
            <div style={{ position: "absolute", bottom: hasNext2 ? 14 : 0, left: 14, right: 14, height: 52, borderRadius: 21, background: "var(--nf-card)", border: "2px solid var(--nf-border)", boxShadow: "0 6px 20px rgba(0,0,0,0.08)", zIndex: 2 }} />
          )}

          {isFlashcard ? (
            /* ── Flashcard with flip animation ── */
            <div
              key={cardKey}
              className={exiting ? "nf-card-exit" : "nf-card-enter"}
              onClick={() => { if (!showAnswer) setShowAnswer(true); }}
              style={{ position: "relative", zIndex: 10, height: "100%", cursor: !showAnswer ? "pointer" : "default" }}
            >
              <div className="nf-flip-container">
                <div className={`nf-flip-inner${showAnswer ? " flipped" : ""}`}>
                  {/* Front — Question */}
                  <div className="nf-flip-front" style={{ padding: "24px 24px 28px", background: "var(--nf-card)", border: "2px solid var(--nf-border)", boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-text-4)" }}>
                        {card.subject}
                      </span>
                      {card.hint && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowHint((s) => !s); }}
                          style={{ width: 30, height: 30, borderRadius: 9, border: `1.5px solid ${showHint ? "var(--nf-info-border)" : "var(--nf-border)"}`, background: showHint ? "var(--nf-info-bg)" : "transparent", color: showHint ? "var(--nf-info-text)" : "var(--nf-text-3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
                        >
                          <Icon icon="hugeicons:idea-01" width={15} />
                        </button>
                      )}
                    </div>
                    {showHint && card.hint && (
                      <div className="nf-fadein-up" style={{ fontSize: "0.82rem", lineHeight: 1.55, padding: "10px 14px", borderRadius: 10, marginBottom: 20, background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)", textAlign: "center" }}>
                        {card.hint}
                      </div>
                    )}
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(1rem, 3vw, 1.15rem)", fontWeight: 500, lineHeight: 1.55, color: "var(--nf-text)", margin: 0, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "-0.01em" }}>
                      {card.front}
                    </p>
                    <p style={{ fontSize: "0.72rem", textAlign: "center", marginTop: 16, color: "var(--nf-text-4)" }}>
                      Tap to flip
                    </p>
                  </div>

                  {/* Back — Answer */}
                  <div className="nf-flip-back" style={{ padding: "24px 24px 28px", background: "var(--nf-card)", border: "2px solid var(--nf-border)", boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-text-4)" }}>
                        {card.subject}
                      </span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--nf-primary)", background: "var(--nf-primary-soft)", padding: "4px 10px", borderRadius: 8 }}>
                        Answer
                      </span>
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(0.85rem, 2.5vw, 1rem)", fontWeight: 500, lineHeight: 1.55, color: "var(--nf-text-3)", margin: "0 0 20px", textAlign: "center", letterSpacing: "-0.01em" }}>
                        {card.front}
                      </p>
                      <div style={{ width: "100%", height: 1, background: "var(--nf-border)", marginBottom: 20 }} />
                      <p style={{ fontSize: "1.05rem", lineHeight: 1.65, color: "var(--nf-text)", margin: 0, fontFamily: "'Lato', sans-serif", textAlign: "center" }}>
                        {card.back}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── MCQ card with flip animation ── */
            <div
              key={cardKey}
              className={exiting ? "nf-card-exit" : "nf-card-enter"}
              style={{ position: "relative", zIndex: 10, height: "100%" }}
            >
              <div className="nf-flip-container">
                <div className={`nf-flip-inner${showAnswer ? " flipped" : ""}`}>
                  {/* Front — Question + Options */}
                  <div className="nf-flip-front" style={{ padding: "24px 24px 28px", background: "var(--nf-card)", border: "2px solid var(--nf-border)", boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-text-4)" }}>
                        {card.subject}
                      </span>
                      {card.hint && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowHint((s) => !s); }}
                          style={{ width: 30, height: 30, borderRadius: 9, border: `1.5px solid ${showHint ? "var(--nf-info-border)" : "var(--nf-border)"}`, background: showHint ? "var(--nf-info-bg)" : "transparent", color: showHint ? "var(--nf-info-text)" : "var(--nf-text-3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
                        >
                          <Icon icon="hugeicons:idea-01" width={15} />
                        </button>
                      )}
                    </div>
                    {showHint && card.hint && (
                      <div className="nf-fadein-up" style={{ fontSize: "0.82rem", lineHeight: 1.55, padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)", textAlign: "center" }}>
                        {card.hint}
                      </div>
                    )}
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.05rem)", fontWeight: 500, lineHeight: 1.5, color: "var(--nf-text)", margin: "0 0 20px", textAlign: "center", letterSpacing: "-0.01em" }}>
                      {card.front}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {Object.entries(card.options || {}).map(([key, val]) => (
                        <button key={key} disabled={!!selectedOption}
                          onClick={() => handleOptionSelect(key)}
                          style={{ background: "transparent", border: "1.5px solid var(--nf-border)", color: "var(--nf-text)", width: "100%", textAlign: "left", padding: "11px 16px", borderRadius: 12, fontSize: "0.875rem", cursor: selectedOption ? "default" : "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "'Lato', sans-serif" }}>
                          <span style={{ fontWeight: 700, flexShrink: 0, fontFamily: "'Poppins', sans-serif" }}>{key}.</span>
                          <span style={{ flex: 1 }}>{val}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Back — Result + Explanation */}
                  <div className="nf-flip-back" style={{ padding: "24px 24px 28px", background: "var(--nf-card)", border: "2px solid var(--nf-border)", boxShadow: "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--nf-text-4)" }}>
                        {card.subject}
                      </span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: mcqResult === "correct" ? "var(--nf-correct-text)" : "var(--nf-wrong-text)", background: mcqResult === "correct" ? "var(--nf-correct-bg)" : "var(--nf-wrong-bg)", padding: "4px 10px", borderRadius: 8 }}>
                        {mcqResult === "correct" ? "Correct" : "Wrong"}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(0.82rem, 2.2vw, 0.92rem)", fontWeight: 500, lineHeight: 1.45, color: "var(--nf-text-3)", margin: "0 0 16px", textAlign: "center", letterSpacing: "-0.01em" }}>
                      {card.front}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: card.explanation ? 16 : 0 }}>
                      {Object.entries(card.options || {}).map(([key, val]) => {
                        let optStyle: React.CSSProperties = { background: "transparent", border: "1.5px solid var(--nf-border)", color: "var(--nf-text-3)" };
                        if (key === card.correct_option) optStyle = { background: "transparent", border: "2px solid var(--nf-correct-border)", color: "var(--nf-correct-text)" };
                        else if (key === selectedOption) optStyle = { background: "transparent", border: "2px solid var(--nf-wrong-border)", color: "var(--nf-wrong-text)" };
                        return (
                          <div key={key} style={{ ...optStyle, padding: "10px 14px", borderRadius: 12, fontSize: "0.84rem", display: "flex", alignItems: "center", gap: 10, fontFamily: "'Lato', sans-serif" }}>
                            <span style={{ fontWeight: 700, flexShrink: 0, fontFamily: "'Poppins', sans-serif" }}>{key}.</span>
                            <span style={{ flex: 1 }}>{val}</span>
                            {key === card.correct_option && <Icon icon="hugeicons:checkmark-circle-01" width={15} style={{ flexShrink: 0 }} />}
                            {key === selectedOption && key !== card.correct_option && <Icon icon="hugeicons:cancel-circle" width={15} style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </div>
                    {card.explanation && (
                      <div style={{ padding: "12px 14px", borderRadius: 12, fontSize: "0.84rem", lineHeight: 1.55, color: "var(--nf-text-2)", border: "1px solid var(--nf-border)", background: "var(--nf-input-bg)" }}>
                        <span style={{ fontWeight: 700 }}>Explanation: </span>{card.explanation}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isFlashcard && !showAnswer && (
          <p style={{ fontSize: "0.72rem", textAlign: "center", marginTop: 14, color: "var(--nf-text-4)" }}>
            Tap card or press <kbd style={{ padding: "2px 8px", borderRadius: 6, fontFamily: "monospace", border: "1px solid var(--nf-border)", color: "var(--nf-text-3)" }}>Space</kbd> to flip
          </p>
        )}

        {showAnswer && reviewMessage && (
          <p className="nf-fadein-up" style={{ fontSize: "0.78rem", textAlign: "center", marginTop: 14, color: "var(--nf-text-3)" }}>
            {reviewMessage}
          </p>
        )}
      </main>

      {/* ── Bottom rating bar — slides up when answer shown ── */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: mcqResult === "correct"
            ? "var(--nf-correct-bg)"
            : mcqResult === "wrong"
            ? "var(--nf-wrong-bg)"
            : "var(--nf-card)",
          borderTop: `1.5px solid ${mcqResult === "correct" ? "var(--nf-correct-border)" : mcqResult === "wrong" ? "var(--nf-wrong-border)" : "var(--nf-border)"}`,
          padding: "12px 16px 20px",
          transform: showAnswer ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0, 0, 0.2, 1), background 0.3s ease, border-color 0.3s ease",
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {RATINGS.map(({ key, label, bg, border, text }) => (
            <button
              key={key}
              onClick={() => handleRating(key)}
              disabled={submitting}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 6px",
                borderRadius: 16,
                background: bg,
                border: `1.5px solid ${border}`,
                color: text,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting && lastRating !== key ? 0.4 : 1,
                transform: submitting && lastRating === key ? "scale(0.94)" : "scale(1)",
                transition: "opacity 0.15s, transform 0.15s",
              }}
            >
              <span style={{ fontSize: "0.78rem", fontWeight: 500, color: text, fontFamily: "'Poppins', sans-serif", letterSpacing: "0.01em" }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SessionContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }} className="nf-pulse">
          <Icon icon="hugeicons:brain" width={48} style={{ color: "#8b5cf6" }} />
        </div>
        <p style={{ color: "var(--nf-text-3)", fontSize: "0.9rem" }}>Loading session…</p>
      </div>
    </div>
  );
}
