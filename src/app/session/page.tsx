"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "@/components/NavBar";
import { Suspense } from "react";

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

function SessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSprint = searchParams.get("mode") === "sprint";

  const [cards, setCards] = useState<SessionCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [reviewMessage, setReviewMessage] = useState("");
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });

  const token = typeof window !== "undefined" ? localStorage.getItem("nf_token") : null;

  const fetchSession = useCallback(async () => {
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    try {
      const endpoint = isSprint ? "/api/session/sprint" : "/api/session/today";
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setCards(data.cards || []);
    } finally {
      setLoading(false);
    }
  }, [token, router, isSprint]);

  useEffect(() => {
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    setStartTime(Date.now());
    setShowAnswer(false);
    setShowHint(false);
    setSelectedOption(null);
    setReviewMessage("");
  }, [currentIdx]);

  async function submitRating(rating: string) {
    if (submitting) return;
    setSubmitting(true);
    const card = cards[currentIdx];
    const responseTimeMs = Date.now() - startTime;

    try {
      const res = await fetch(`/api/session/review/${card.card_id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ rating, response_time_ms: responseTimeMs }),
      });
      const data = await res.json();
      setStats((s) => ({ ...s, [rating]: s[rating as keyof typeof s] + 1 }));
      setReviewMessage(data.message || "");

      setTimeout(() => {
        if (currentIdx + 1 >= cards.length) {
          setDone(true);
        } else {
          setCurrentIdx((i) => i + 1);
        }
        setSubmitting(false);
      }, 600);
    } catch {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen />;

  if (done || (cards.length === 0 && !loading)) {
    const total = stats.again + stats.hard + stats.good + stats.easy;
    return (
      <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
        <NavBar />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--nf-text)" }}>
            {cards.length === 0 ? "All done for today!" : "Session Complete!"}
          </h2>
          {total > 0 && (
            <div className="grid grid-cols-4 gap-3 my-6">
              {[
                { label: "Forgot", val: stats.again, color: "var(--nf-again-text)", bg: "var(--nf-again-bg)" },
                { label: "Hard", val: stats.hard, color: "var(--nf-hard-text)", bg: "var(--nf-hard-bg)" },
                { label: "Good", val: stats.good, color: "var(--nf-good-text)", bg: "var(--nf-good-bg)" },
                { label: "Easy", val: stats.easy, color: "var(--nf-easy-text)", bg: "var(--nf-easy-bg)" },
              ].map(({ label, val, color, bg }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg }}>
                  <p className="text-xl font-bold" style={{ color }}>{val}</p>
                  <p className="text-xs mt-0.5" style={{ color }}>{label}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => router.push("/")}
            className="mt-2 px-8 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--nf-primary)" }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const card = cards[currentIdx];
  const progress = Math.round(((currentIdx) / cards.length) * 100);
  const isFlashcard = card.card_type === "flashcard";

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-2" style={{ color: "var(--nf-text-3)" }}>
            <span>{isSprint ? "🚀 Exam Sprint" : "Daily Review"}</span>
            <span>{currentIdx + 1} / {cards.length}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--nf-card-alt)" }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "var(--nf-primary)" }} />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow-lg)" }}>
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="nf-badge nf-badge-new">{card.subject}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--nf-card-alt)", color: "var(--nf-text-3)" }}>{card.topic}</span>
            <span className={`nf-badge ${isFlashcard ? "nf-badge-flashcard" : "nf-badge-mcq"}`}>
              {isFlashcard ? "Flashcard" : "MCQ"}
            </span>
          </div>

          {/* Question */}
          <p className="text-lg font-semibold leading-snug" style={{ color: "var(--nf-text)" }}>
            {card.front}
          </p>

          {isFlashcard ? (
            <>
              {/* Hint */}
              {!showAnswer && card.hint && (
                <button onClick={() => setShowHint((s) => !s)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)" }}>
                  {showHint ? "Hide Hint" : "Show Hint"}
                </button>
              )}
              {showHint && card.hint && (
                <div className="text-sm px-4 py-3 rounded-xl" style={{ background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)" }}>
                  💡 {card.hint}
                </div>
              )}

              {/* Show Answer */}
              {!showAnswer ? (
                <button onClick={() => setShowAnswer(true)}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "var(--nf-primary-soft)", color: "var(--nf-primary)", border: "1px solid rgba(57,85,212,0.15)" }}>
                  Show Answer
                </button>
              ) : (
                <div className="rounded-xl p-4" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)" }}>
                  <p className="text-sm" style={{ color: "var(--nf-text)" }}>{card.back}</p>
                </div>
              )}
            </>
          ) : (
            /* MCQ */
            <div className="space-y-2">
              {Object.entries(card.options || {}).map(([key, val]) => {
                let style: React.CSSProperties = { background: "var(--nf-opt-bg)", border: "1px solid var(--nf-opt-border)", color: "var(--nf-text)" };
                if (selectedOption) {
                  if (key === card.correct_option) style = { background: "var(--nf-correct-bg)", border: "1px solid var(--nf-correct-border)", color: "var(--nf-correct-text)" };
                  else if (key === selectedOption) style = { background: "var(--nf-wrong-bg)", border: "1px solid var(--nf-wrong-border)", color: "var(--nf-wrong-text)" };
                }
                return (
                  <button key={key} disabled={!!selectedOption}
                    onClick={() => { setSelectedOption(key); setShowAnswer(true); }}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={style}>
                    <span className="font-semibold mr-2">{key}.</span>{val}
                  </button>
                );
              })}
              {showAnswer && card.explanation && (
                <div className="mt-2 p-4 rounded-xl text-sm" style={{ background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)" }}>
                  <span className="font-semibold">Explanation: </span>{card.explanation}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Review message */}
        {reviewMessage && (
          <div className="mt-3 text-center text-xs" style={{ color: "var(--nf-text-3)" }}>{reviewMessage}</div>
        )}

        {/* Rating buttons */}
        {showAnswer && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            {[
              { key: "again", label: "Forgot", sub: "0-1 min", cls: "nf-rating-again" },
              { key: "hard", label: "Struggled", sub: "1-3 min", cls: "nf-rating-hard" },
              { key: "good", label: "Good", sub: "3-10 min", cls: "nf-rating-good" },
              { key: "easy", label: "Easy", sub: "10+ min", cls: "nf-rating-easy" },
            ].map(({ key, label, sub, cls }) => (
              <button key={key} onClick={() => submitRating(key)} disabled={submitting}
                className={`nf-rating ${cls} disabled:opacity-50`}>
                <span className="font-semibold">{label}</span>
                <span className="text-xs opacity-70">{sub}</span>
              </button>
            ))}
          </div>
        )}
      </main>
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
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4 nf-pulse">🧠</div>
        <p style={{ color: "var(--nf-text-3)" }}>Loading session…</p>
      </div>
    </div>
  );
}
