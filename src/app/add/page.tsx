"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { UPSC_SYLLABUS_CLIENT } from "@/lib/syllabus-client";

type Tab = "text" | "url" | "youtube";

interface FlashCard { front: string; hint: string; back: string; }
interface MCQ { question: string; options: Record<string, string>; correct_option: string; explanation: string; }
interface PreviewData {
  subject: string; topic: string; concept: string;
  flashcards: FlashCard[]; mcqs: MCQ[];
  raw_content: string; source_type: string; source_url?: string;
  video_id?: string; video_title?: string; content_source?: string;
}

export default function AddPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [editCard, setEditCard] = useState<{ type: string; idx: number } | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("nf_token") : null;

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, [token, router]);

  const LOADING_STEPS = [
    "Extracting content…",
    "Classifying with AI…",
    "Generating study cards…",
    "Finalizing preview…",
  ];

  async function handleGenerate() {
    setError("");
    setLoading(true);
    setLoadingStep(0);
    setPreview(null);
    setSaved(false);

    const stepInterval = setInterval(() => {
      setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 2000);

    try {
      let endpoint = "", body = {};
      if (tab === "text") { endpoint = "/api/ingest/text"; body = { text }; }
      else if (tab === "url") { endpoint = "/api/ingest/url"; body = { url }; }
      else { endpoint = "/api/ingest/youtube"; body = { url: ytUrl }; }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");
      setPreview(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  }

  async function handleGenerateMore() {
    if (!preview) return;
    setGeneratingMore(true);
    try {
      const existingQ = [
        ...preview.flashcards.map((f) => f.front),
        ...preview.mcqs.map((m) => m.question),
      ];
      const res = await fetch("/api/ingest/generate-more", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_content: preview.raw_content,
          subject: preview.subject,
          topic: preview.topic,
          concept: preview.concept,
          existing_questions: existingQ,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setPreview((p) => p ? {
        ...p,
        flashcards: [...p.flashcards, ...data.flashcards],
        mcqs: [...p.mcqs, ...data.mcqs],
      } : p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGeneratingMore(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ingest/save", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function removeCard(type: "flashcard" | "mcq", idx: number) {
    if (!preview) return;
    if (type === "flashcard") {
      setPreview({ ...preview, flashcards: preview.flashcards.filter((_, i) => i !== idx) });
    } else {
      setPreview({ ...preview, mcqs: preview.mcqs.filter((_, i) => i !== idx) });
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--nf-text)" }}>
            Add Content
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--nf-text-3)" }}>Paste text, a URL, or a YouTube link to generate flashcards</p>
        </div>

        {/* Source tabs */}
        <div className="rounded-2xl p-6" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
          <div className="flex gap-1 rounded-xl p-1 mb-5" style={{ background: "var(--nf-card-alt)" }}>
            {(["text", "url", "youtube"] as const).map((t) => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={tab === t
                  ? { background: "var(--nf-card)", color: "var(--nf-text)", boxShadow: "var(--nf-shadow-sm)" }
                  : { color: "var(--nf-text-3)" }}>
                {t === "text" ? "📝 Text" : t === "url" ? "🌐 URL" : "📺 YouTube"}
              </button>
            ))}
          </div>

          {tab === "text" && (
            <textarea
              rows={8}
              placeholder="Paste your notes, article content, or study material here (min 20 characters)…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
            />
          )}
          {tab === "url" && (
            <input
              type="url"
              placeholder="https://www.thehindu.com/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
            />
          )}
          {tab === "youtube" && (
            <div className="space-y-2">
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
              />
              <p className="text-xs" style={{ color: "var(--nf-text-3)" }}>
                Attempts to fetch transcript. Works best with English/Hindi UPSC lectures.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 px-4 py-3 rounded-xl text-sm" style={{ background: "var(--nf-error-bg)", color: "var(--nf-error-text)", border: "1px solid var(--nf-error-border)" }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || (!text && tab === "text") || (!url && tab === "url") || (!ytUrl && tab === "youtube")}
            className="mt-4 w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "var(--nf-primary)" }}
          >
            {loading ? "Processing…" : "Generate Flashcards"}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl p-8 text-center" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)" }}>
            <div className="text-4xl mb-4">🧠</div>
            <p className="text-sm font-medium" style={{ color: "var(--nf-text)" }}>{LOADING_STEPS[loadingStep]}</p>
            <div className="mt-4 space-y-2">
              {LOADING_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs justify-center"
                  style={{ color: i <= loadingStep ? "var(--nf-primary)" : "var(--nf-text-4)" }}>
                  <span>{i < loadingStep ? "✓" : i === loadingStep ? "⟳" : "○"}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && !loading && (
          <div className="space-y-4">
            {/* Classification */}
            <div className="rounded-2xl p-5" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--nf-text)" }}>Classification</h3>
              {preview.video_id && (
                <div className="mb-3 text-xs px-3 py-1.5 rounded-lg inline-block" style={{ background: "var(--nf-info-bg)", color: "var(--nf-info-text)" }}>
                  Source: {preview.content_source === "transcript" ? "📝 Transcript" : preview.content_source === "audio" ? "🎵 Audio" : "ℹ️ Metadata"}
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                {(["subject", "topic", "concept"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs mb-1 capitalize" style={{ color: "var(--nf-text-3)" }}>{field}</label>
                    {field !== "concept" ? (
                      <select
                        value={preview[field]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPreview((p) => p ? { ...p, [field]: val, ...(field === "subject" ? { topic: Object.values(UPSC_SYLLABUS_CLIENT)[0][0] } : {}) } : p);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                        style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
                      >
                        {field === "subject"
                          ? Object.keys(UPSC_SYLLABUS_CLIENT).map((s) => <option key={s} value={s}>{s}</option>)
                          : (UPSC_SYLLABUS_CLIENT[preview.subject] || []).map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (
                      <input
                        value={preview.concept}
                        onChange={(e) => setPreview((p) => p ? { ...p, concept: e.target.value } : p)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs outline-none"
                        style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Flashcards */}
            {preview.flashcards.length > 0 && (
              <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--nf-text)" }}>
                  Flashcards <span className="nf-badge nf-badge-flashcard ml-2">{preview.flashcards.length}</span>
                </h3>
                {preview.flashcards.map((fc, i) => (
                  <FlashcardPreview key={i} card={fc} index={i}
                    isEditing={editCard?.type === "fc" && editCard.idx === i}
                    onEdit={() => setEditCard({ type: "fc", idx: i })}
                    onDone={() => setEditCard(null)}
                    onRemove={() => removeCard("flashcard", i)}
                    onChange={(updated) => setPreview((p) => p ? { ...p, flashcards: p.flashcards.map((c, j) => j === i ? updated : c) } : p)}
                  />
                ))}
              </div>
            )}

            {/* MCQs */}
            {preview.mcqs.length > 0 && (
              <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--nf-text)" }}>
                  MCQs <span className="nf-badge nf-badge-mcq ml-2">{preview.mcqs.length}</span>
                </h3>
                {preview.mcqs.map((mcq, i) => (
                  <MCQPreview key={i} card={mcq} index={i}
                    onRemove={() => removeCard("mcq", i)}
                  />
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <button onClick={handleGenerateMore} disabled={generatingMore}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ border: "1px solid var(--nf-border)", color: "var(--nf-text-2)", background: "var(--nf-card)" }}>
                {generatingMore ? "Generating…" : "+ Generate More"}
              </button>
              {!saved ? (
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "var(--nf-primary)" }}>
                  {saving ? "Saving…" : `Save ${(preview.flashcards.length + preview.mcqs.length)} Cards`}
                </button>
              ) : (
                <button onClick={() => router.push("/")}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#10b981" }}>
                  ✓ Saved! Go to Dashboard
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FlashcardPreview({ card, index, isEditing, onEdit, onDone, onRemove, onChange }: {
  card: FlashCard; index: number; isEditing: boolean;
  onEdit: () => void; onDone: () => void; onRemove: () => void;
  onChange: (c: FlashCard) => void;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)" }}>
      {isEditing ? (
        <div className="space-y-2">
          <input value={card.front} onChange={(e) => onChange({ ...card, front: e.target.value })}
            placeholder="Question" className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
          <input value={card.hint} onChange={(e) => onChange({ ...card, hint: e.target.value })}
            placeholder="Hint" className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
          <textarea value={card.back} onChange={(e) => onChange({ ...card, back: e.target.value })}
            rows={3} placeholder="Answer" className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
            style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
          <button onClick={onDone} className="text-xs px-3 py-1 rounded-lg"
            style={{ background: "var(--nf-primary-soft)", color: "var(--nf-primary)" }}>Done</button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <span className="nf-badge nf-badge-flashcard text-xs">Flashcard {index + 1}</span>
            <p className="text-sm mt-1 font-medium" style={{ color: "var(--nf-text)" }}>{card.front}</p>
            {card.hint && <p className="text-xs mt-0.5" style={{ color: "var(--nf-text-3)" }}>Hint: {card.hint}</p>}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={onEdit} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--nf-text-3)" }}>Edit</button>
            <button onClick={onRemove} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--nf-error-text)" }}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MCQPreview({ card, index, onRemove }: { card: MCQ; index: number; onRemove: () => void }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="nf-badge nf-badge-mcq text-xs">MCQ {index + 1}</span>
          <p className="text-sm mt-1 font-medium" style={{ color: "var(--nf-text)" }}>{card.question}</p>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {Object.entries(card.options).map(([k, v]) => (
              <div key={k} className="text-xs px-2 py-1 rounded" style={{
                background: k === card.correct_option ? "var(--nf-correct-bg)" : "var(--nf-input-bg)",
                color: k === card.correct_option ? "var(--nf-correct-text)" : "var(--nf-text-3)",
                border: `1px solid ${k === card.correct_option ? "var(--nf-correct-border)" : "var(--nf-input-border)"}`,
              }}>
                <span className="font-medium">{k}.</span> {v}
              </div>
            ))}
          </div>
        </div>
        <button onClick={onRemove} className="text-xs px-2 py-1 rounded-lg shrink-0" style={{ color: "var(--nf-error-text)" }}>✕</button>
      </div>
    </div>
  );
}
