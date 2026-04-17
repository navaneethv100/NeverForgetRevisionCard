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

const RATINGS = [
  {
    key: "again",
    emoji: "😵",
    label: "Forgot",
    desc: "Didn't remember",
    keyHint: "1",
    bg: "var(--nf-again-bg)",
    border: "var(--nf-again-border)",
    text: "var(--nf-again-text)",
  },
  {
    key: "hard",
    emoji: "😓",
    label: "Hard",
    desc: "Barely got it",
    keyHint: "2",
    bg: "var(--nf-hard-bg)",
    border: "var(--nf-hard-border)",
    text: "var(--nf-hard-text)",
  },
  {
    key: "good",
    emoji: "😊",
    label: "Good",
    desc: "Got it right",
    keyHint: "3",
    bg: "var(--nf-good-bg)",
    border: "var(--nf-good-border)",
    text: "var(--nf-good-text)",
  },
  {
    key: "easy",
    emoji: "🚀",
    label: "Easy",
    desc: "Way too easy",
    keyHint: "4",
    bg: "var(--nf-easy-bg)",
    border: "var(--nf-easy-border)",
    text: "var(--nf-easy-text)",
  },
];

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
  const [lastRating, setLastRating] = useState<string | null>(null);

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
    setLastRating(null);
  }, [currentIdx]);

  // Keyboard shortcuts: Space = show answer, 1/2/3/4 = rate
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!showAnswer) {
        if (e.code === "Space") { e.preventDefault(); setShowAnswer(true); }
        return;
      }
      const map: Record<string, string> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      if (map[e.key] && !submitting) submitRating(map[e.key]);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnswer, submitting, currentIdx]);

  async function submitRating(rating: string) {
    if (submitting) return;
    setSubmitting(true);
    setLastRating(rating);
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
      }, 700);
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
          <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--nf-text)" }}>
            {cards.length === 0 ? "All done for today!" : "Session Complete!"}
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--nf-text-3)" }}>
            {total > 0 ? `You reviewed ${total} card${total !== 1 ? "s" : ""}` : "No cards were due today."}
          </p>
          {total > 0 && (
            <div className="grid grid-cols-4 gap-3 mb-8">
              {RATINGS.map(({ key, emoji, label, bg, text }) => (
                <div key={key} className="rounded-2xl p-4 text-center" style={{ background: bg }}>
                  <p className="text-2xl mb-1">{emoji}</p>
                  <p className="text-xl font-bold" style={{ color: text }}>{stats[key as keyof typeof stats]}</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: text }}>{label}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => router.push("/")}
            className="px-8 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--nf-primary)" }}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const card = cards[currentIdx];
  const progress = Math.round((currentIdx / cards.length) * 100);
  const isFlashcard = card.card_type === "flashcard";

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 py-6">

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--nf-text-3)" }}>
            <span className="font-medium">{isSprint ? "🚀 Exam Sprint" : "📚 Daily Review"}</span>
            <span>{currentIdx + 1} / {cards.length}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--nf-card-alt)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "var(--nf-primary)" }} />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow-lg)" }}>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="nf-badge nf-badge-new">{card.subject}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--nf-card-alt)", color: "var(--nf-text-3)" }}>
              {card.topic}
            </span>
            <span className={`nf-badge ${isFlashcard ? "nf-badge-flashcard" : "nf-badge-mcq"}`}>
              {isFlashcard ? "⚡ Flashcard" : "📋 MCQ"}
            </span>
            {card.review_count === 0 && (
              <span className="nf-badge" style={{ background: "var(--nf-primary-soft)", color: "var(--nf-primary)" }}>New</span>
            )}
          </div>

          {/* Question */}
          <p className="text-xl font-semibold leading-snug" style={{ color: "var(--nf-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            {card.front}
          </p>

          {isFlashcard ? (
            <>
              {/* Hint toggle */}
              {!showAnswer && card.hint && (
                <button onClick={() => setShowHint((s) => !s)}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)" }}>
                  {showHint ? "Hide hint" : "💡 Show hint"}
                </button>
              )}
              {showHint && card.hint && (
                <div className="text-sm px-4 py-3 rounded-xl nf-fadein-up"
                  style={{ background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)" }}>
                  💡 {card.hint}
                </div>
              )}

              {/* Show answer / answer reveal */}
              {!showAnswer ? (
                <button onClick={() => setShowAnswer(true)}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "var(--nf-primary)", color: "#fff" }}>
                  Show Answer
                  <span className="ml-2 text-xs opacity-60 font-normal">Space</span>
                </button>
              ) : (
                <div className="rounded-xl p-4 nf-fadein-up"
                  style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)" }}>
                  <p className="text-xs uppercase tracking-wider mb-2 font-medium" style={{ color: "var(--nf-text-3)" }}>Answer</p>
                  <p className="text-base leading-relaxed" style={{ color: "var(--nf-text)" }}>{card.back}</p>
                </div>
              )}
            </>
          ) : (
            /* MCQ options */
            <div className="space-y-2">
              {Object.entries(card.options || {}).map(([key, val]) => {
                let s: React.CSSProperties = { background: "var(--nf-opt-bg)", border: "1px solid var(--nf-opt-border)", color: "var(--nf-text)" };
                if (selectedOption) {
                  if (key === card.correct_option) s = { background: "var(--nf-correct-bg)", border: "1px solid var(--nf-correct-border)", color: "var(--nf-correct-text)" };
                  else if (key === selectedOption) s = { background: "var(--nf-wrong-bg)", border: "1px solid var(--nf-wrong-border)", color: "var(--nf-wrong-text)" };
                }
                return (
                  <button key={key} disabled={!!selectedOption}
                    onClick={() => { setSelectedOption(key); setShowAnswer(true); }}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all disabled:cursor-default"
                    style={s}>
                    <span className="font-bold mr-2">{key}.</span>{val}
                    {selectedOption && key === card.correct_option && <span className="float-right">✓</span>}
                  </button>
                );
              })}
              {showAnswer && card.explanation && (
                <div className="mt-1 p-4 rounded-xl text-sm nf-fadein-up"
                  style={{ background: "var(--nf-info-bg)", color: "var(--nf-info-text)", border: "1px solid var(--nf-info-border)" }}>
                  <span className="font-semibold">Explanation: </span>{card.explanation}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rating buttons — shown after answer revealed */}
        {showAnswer && (
          <div className="mt-5 nf-fadein-up">
            <p className="text-xs text-center uppercase tracking-wider font-medium mb-3"
              style={{ color: "var(--nf-text-3)" }}>
              How well did you remember?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {RATINGS.map(({ key, emoji, label, desc, keyHint, bg, border, text }) => (
                <button key={key}
                  onClick={() => submitRating(key)}
                  disabled={submitting}
                  className="flex flex-col items-center gap-1 py-4 px-2 rounded-2xl transition-all active:scale-95 disabled:opacity-40"
                  style={{
                    background: bg,
                    border: `1.5px solid ${border}`,
                    color: text,
                    opacity: submitting && lastRating !== key ? 0.4 : 1,
                    transform: submitting && lastRating === key ? "scale(0.96)" : undefined,
                  }}>
                  <span className="text-2xl leading-none">{emoji}</span>
                  <span className="text-sm font-bold mt-1">{label}</span>
                  <span className="text-xs opacity-70">{desc}</span>
                  <kbd className="mt-1.5 text-xs px-2 py-0.5 rounded font-mono"
                    style={{ background: border, opacity: 0.7 }}>
                    {keyHint}
                  </kbd>
                </button>
              ))}
            </div>

            {/* Next interval message */}
            {reviewMessage && (
              <p className="text-xs text-center mt-3 nf-fadein-up" style={{ color: "var(--nf-text-3)" }}>
                {reviewMessage}
              </p>
            )}
          </div>
        )}

        {/* Keyboard hint when answer not shown */}
        {!showAnswer && (
          <p className="text-xs text-center mt-4" style={{ color: "var(--nf-text-4)" }}>
            Press <kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ border: "1px solid var(--nf-border)", color: "var(--nf-text-3)" }}>Space</kbd> to reveal answer
          </p>
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
