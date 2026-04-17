"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { UPSC_SYLLABUS_CLIENT } from "@/lib/syllabus-client";

type Tab = "text" | "url" | "youtube";
type Phase = "input" | "loading" | "preview";
type StepState = "idle" | "active" | "done";

interface FlashCard { front: string; hint: string; back: string; }
interface MCQ { question: string; options: Record<string, string>; correct_option: string; explanation: string; }
interface PreviewData {
  subject: string; topic: string; concept: string;
  flashcards: FlashCard[]; mcqs: MCQ[];
  raw_content: string; source_type: string; source_url?: string;
  video_id?: string; video_title?: string; content_source?: string;
}

const STEPS: Record<Tab, { text: string; sub: string }[]> = {
  text: [
    { text: "Reading your content", sub: "Parsing and preparing text" },
    { text: "Classifying subject & topic", sub: "AI is analysing the content domain" },
    { text: "Generating flashcards", sub: "Creating active recall questions" },
    { text: "Generating MCQs", sub: "Building UPSC-pattern questions" },
  ],
  url: [
    { text: "Fetching webpage", sub: "Extracting clean text from URL" },
    { text: "Classifying subject & topic", sub: "AI is analysing the content domain" },
    { text: "Generating flashcards", sub: "Creating active recall questions" },
    { text: "Generating MCQs", sub: "Building UPSC-pattern questions" },
  ],
  youtube: [
    { text: "Analysing video", sub: "Extracting transcript or metadata" },
    { text: "Classifying subject & topic", sub: "AI is analysing the content domain" },
    { text: "Generating flashcards", sub: "Creating active recall questions" },
    { text: "Generating MCQs", sub: "Building UPSC-pattern questions" },
  ],
};

function extractYtId(url: string): string | null {
  const m = url.match(/(?:v=|\/v\/|youtu\.be\/|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function AddPage() {
  const router = useRouter();
  const topRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [ytUrl, setYtUrl] = useState("");
  const [ytPreviewId, setYtPreviewId] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("input");
  const [progress, setProgress] = useState(0);
  const [stepStates, setStepStates] = useState<StepState[]>(["idle", "idle", "idle", "idle"]);
  const [activeStepText, setActiveStepText] = useState("");
  const [activeStepSub, setActiveStepSub] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const [editIdx, setEditIdx] = useState<{ type: "fc" | "mcq"; idx: number } | null>(null);
  const [editForm, setEditForm] = useState<Partial<FlashCard & MCQ>>({});

  const token = typeof window !== "undefined" ? localStorage.getItem("nf_token") : null;

  useEffect(() => {
    if (!token) { router.push("/login"); return; }
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
  }, [token, router]);

  useEffect(() => {
    const id = extractYtId(ytUrl);
    setYtPreviewId(id);
  }, [ytUrl]);

  function startLoadingAnimation(t: Tab) {
    const steps = STEPS[t];
    setProgress(0);
    setStepStates(["idle", "idle", "idle", "idle"]);
    let idx = 0;
    const PCTS = [12, 38, 62, 85];
    function advance() {
      if (idx >= steps.length) return;
      setProgress(PCTS[idx]);
      setActiveStepText(steps[idx].text);
      setActiveStepSub(steps[idx].sub);
      setStepStates((prev) => prev.map((s, i) => {
        if (i < idx) return "done";
        if (i === idx) return "active";
        return "idle";
      }));
      idx++;
    }
    advance();
    intervalRef.current = setInterval(advance, 5000);
  }

  function stopLoadingAnimation() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(100);
    setStepStates(["done", "done", "done", "done"]);
  }

  async function handleGenerate() {
    setError("");
    setPreview(null);
    setSaved(false);
    setShowTranscript(false);
    setPhase("loading");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
    startLoadingAnimation(tab);

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
      stopLoadingAnimation();
      await new Promise((r) => setTimeout(r, 400));
      setPreview(data);
      setPhase("preview");
    } catch (e: unknown) {
      stopLoadingAnimation();
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("input");
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

  function handleCancel() {
    setPreview(null);
    setError("");
    setShowTranscript(false);
    setPhase("input");
  }

  function openEdit(type: "fc" | "mcq", idx: number) {
    if (type === "fc") {
      const fc = preview!.flashcards[idx];
      setEditForm({ front: fc.front, hint: fc.hint, back: fc.back });
    } else {
      const mcq = preview!.mcqs[idx];
      setEditForm({ question: mcq.question, options: { ...mcq.options }, correct_option: mcq.correct_option, explanation: mcq.explanation });
    }
    setEditIdx({ type, idx });
  }

  function saveEdit() {
    if (!editIdx || !preview) return;
    if (editIdx.type === "fc") {
      setPreview({ ...preview, flashcards: preview.flashcards.map((c, i) => i === editIdx.idx ? { front: editForm.front || "", hint: editForm.hint || "", back: editForm.back || "" } : c) });
    } else {
      setPreview({ ...preview, mcqs: preview.mcqs.map((c, i) => i === editIdx.idx ? { question: editForm.question || "", options: (editForm.options as Record<string,string>) || c.options, correct_option: editForm.correct_option || c.correct_option, explanation: editForm.explanation || "" } : c) });
    }
    setEditIdx(null);
  }

  function removeCard(type: "flashcard" | "mcq", idx: number) {
    if (!preview) return;
    if (type === "flashcard") setPreview({ ...preview, flashcards: preview.flashcards.filter((_, i) => i !== idx) });
    else setPreview({ ...preview, mcqs: preview.mcqs.filter((_, i) => i !== idx) });
  }

  const canGenerate = phase === "input" && (
    (tab === "text" && text.length >= 20) ||
    (tab === "url" && url.length > 5) ||
    (tab === "youtube" && ytUrl.length > 10)
  );

  const totalCards = preview ? preview.flashcards.length + preview.mcqs.length : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* Scroll anchor */}
        <div ref={topRef} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--nf-text)" }}>
            Add Content
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--nf-text-3)" }}>
            Paste text, a URL, or a YouTube link — AI generates study cards instantly
          </p>
        </div>

        {/* ── INPUT PHASE ── */}
        {phase === "input" && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
            {/* Tab bar */}
            <div className="flex border-b" style={{ borderColor: "var(--nf-border)" }}>
              {(["text", "url", "youtube"] as const).map((t) => (
                <button key={t} onClick={() => { setTab(t); setError(""); }}
                  className="flex-1 py-3 text-sm font-medium border-b-2 transition-all"
                  style={tab === t
                    ? { borderBottomColor: "var(--nf-accent)", color: "var(--nf-accent)" }
                    : { borderBottomColor: "transparent", color: "var(--nf-text-3)" }}>
                  {t === "text" ? "📝 Paste Text" : t === "url" ? "🔗 Website URL" : "▶️ YouTube"}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-3">
              {tab === "text" && (
                <div>
                  <label className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--nf-text-3)" }}>
                    Your Notes / Coaching Material
                  </label>
                  <textarea rows={8}
                    placeholder="Paste your coaching notes, NCERT paragraphs, newspaper articles — anything you want to revise later…"
                    value={text} onChange={(e) => setText(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                    style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
                  <p className="text-xs mt-1" style={{ color: "var(--nf-text-4)" }}>{text.length} chars {text.length < 20 && text.length > 0 ? "— need at least 20" : ""}</p>
                </div>
              )}

              {tab === "url" && (
                <div>
                  <label className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--nf-text-3)" }}>Website URL</label>
                  <input type="url" placeholder="https://www.thehindu.com/…"
                    value={url} onChange={(e) => setUrl(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
                  <p className="text-xs mt-1.5" style={{ color: "var(--nf-text-3)" }}>
                    Works with The Hindu, PIB, Wikipedia, government websites.
                  </p>
                </div>
              )}

              {tab === "youtube" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--nf-text-3)" }}>YouTube Video URL</label>
                    <input type="url" placeholder="https://www.youtube.com/watch?v=…"
                      value={ytUrl} onChange={(e) => setYtUrl(e.target.value)}
                      className="mt-2 w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
                    <p className="text-xs mt-1.5" style={{ color: "var(--nf-text-3)" }}>
                      Works with any UPSC lecture video — auto-detects transcript.
                    </p>
                  </div>
                  {/* Live embed preview — only shown in input phase */}
                  {ytPreviewId && (
                    <div className="rounded-xl overflow-hidden nf-fadein-up" style={{ border: "1px solid var(--nf-border)" }}>
                      <div style={{ position: "relative", paddingTop: "56.25%" }}>
                        <iframe
                          src={`https://www.youtube.com/embed/${ytPreviewId}`}
                          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "var(--nf-error-bg)", color: "var(--nf-error-text)", border: "1px solid var(--nf-error-border)" }}>
                  ⚠️ {error}
                </div>
              )}

              <button onClick={handleGenerate} disabled={!canGenerate}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: canGenerate ? "var(--nf-primary)" : "var(--nf-text-4)", cursor: canGenerate ? "pointer" : "not-allowed" }}>
                {tab === "text" ? "Generate Study Cards →" : tab === "url" ? "Fetch & Generate Cards →" : "Extract & Generate Cards →"}
              </button>
            </div>
          </div>
        )}

        {/* ── LOADING PHASE ── */}
        {phase === "loading" && (
          <div className="rounded-2xl p-8 nf-fadein-up" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow-lg)" }}>
            {/* Brain icon with ping */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl nf-pulse"
                  style={{ background: "var(--nf-card-alt)", border: "2px solid var(--nf-primary)" }}>
                  🧠
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full nf-ping"
                  style={{ background: "#10b981" }} />
              </div>
            </div>

            {/* Step text */}
            <p className="text-base text-center font-semibold mb-1" style={{ color: "var(--nf-text)", fontFamily: "'Bricolage Grotesque', sans-serif" }}>{activeStepText}</p>
            <p className="text-sm text-center mb-5" style={{ color: "var(--nf-text-3)" }}>{activeStepSub}</p>

            {/* Progress bar */}
            <div className="w-full rounded-full overflow-hidden mb-6" style={{ height: "6px", background: "var(--nf-card-alt)" }}>
              <div className="h-full rounded-full nf-shimmer-bar transition-all duration-700"
                style={{ width: `${progress}%` }} />
            </div>

            {/* Steps checklist */}
            <div className="space-y-3 max-w-xs mx-auto">
              {STEPS[tab].map((step, i) => {
                const state = stepStates[i];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span style={{ width: 20, textAlign: "center", flexShrink: 0 }}>
                      {state === "done" && <span style={{ color: "#10b981" }}>✓</span>}
                      {state === "active" && <span className="nf-spin text-sm" style={{ color: "var(--nf-primary)" }}>⟳</span>}
                      {state === "idle" && <span style={{ color: "var(--nf-text-4)" }}>○</span>}
                    </span>
                    <span className="text-sm transition-all" style={{
                      color: state === "done" ? "#10b981" : state === "active" ? "var(--nf-primary)" : "var(--nf-text-4)",
                      textDecoration: state === "done" ? "line-through" : "none",
                      fontWeight: state === "active" ? 600 : 400,
                    }}>
                      {step.text}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-center mt-6" style={{ color: "var(--nf-text-4)" }}>
              This usually takes 15–30 seconds
            </p>
          </div>
        )}

        {/* ── PREVIEW PHASE ── */}
        {phase === "preview" && preview && (
          <div className="space-y-4 nf-fadein-up">

            {/* YouTube embed — shown once, only here in preview */}
            {preview.video_id && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
                <div style={{ position: "relative", paddingTop: "56.25%" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${preview.video_id}`}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--nf-text)" }}>
                    {preview.video_title}
                  </p>
                  <span className="nf-badge shrink-0" style={{
                    background: preview.content_source === "transcript" ? "var(--nf-green-bg)" : preview.content_source === "audio" ? "var(--nf-blue-bg)" : "var(--nf-yellow-bg)",
                    color: preview.content_source === "transcript" ? "var(--nf-green-text)" : preview.content_source === "audio" ? "var(--nf-blue-text)" : "var(--nf-yellow-text)",
                  }}>
                    {preview.content_source === "transcript" ? "📝 Transcript" : preview.content_source === "audio" ? "🎵 Audio" : "ℹ️ Metadata"}
                  </span>
                </div>
              </div>
            )}

            {/* Transcript / Source Content */}
            {preview.raw_content && preview.raw_content.length > 50 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
                <button
                  onClick={() => setShowTranscript((s) => !s)}
                  className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-medium transition-all"
                  style={{ color: "var(--nf-text-2)" }}>
                  <span className="flex items-center gap-2">
                    <span>📄</span>
                    <span>{preview.source_type === "youtube" ? "Video Transcript" : "Source Content"}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-normal"
                      style={{ background: "var(--nf-card-alt)", color: "var(--nf-text-3)" }}>
                      {preview.raw_content.split(/\s+/).length.toLocaleString()} words
                    </span>
                  </span>
                  <span style={{ color: "var(--nf-text-4)", fontSize: 12 }}>{showTranscript ? "▲ Hide" : "▼ Show"}</span>
                </button>
                {showTranscript && (
                  <div className="px-5 pb-5 nf-fadein-up" style={{ borderTop: "1px solid var(--nf-border)" }}>
                    <div className="mt-4 max-h-80 overflow-y-auto pr-1">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--nf-text-2)" }}>
                        {preview.raw_content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Classification */}
            <div className="rounded-2xl p-4" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--nf-text-3)" }}>Classified As</p>
                <span className="nf-badge nf-badge-warning">AI Generated — Verify & Edit</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nf-text-3)" }}>Subject</label>
                  <select value={preview.subject}
                    onChange={(e) => setPreview((p) => p ? { ...p, subject: e.target.value, topic: UPSC_SYLLABUS_CLIENT[e.target.value]?.[0] || p.topic } : p)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none font-medium"
                    style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-accent)" }}>
                    {Object.keys(UPSC_SYLLABUS_CLIENT).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nf-text-3)" }}>Topic</label>
                  <select value={preview.topic}
                    onChange={(e) => setPreview((p) => p ? { ...p, topic: e.target.value } : p)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}>
                    {(UPSC_SYLLABUS_CLIENT[preview.subject] || []).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nf-text-3)" }}>Concept</label>
                  <input value={preview.concept}
                    onChange={(e) => setPreview((p) => p ? { ...p, concept: e.target.value } : p)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none italic"
                    style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text-2)" }} />
                </div>
              </div>
            </div>

            {/* Flashcards */}
            {preview.flashcards.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--nf-text)" }}>
                  ⚡ Flashcards <span className="nf-badge nf-badge-flashcard">{preview.flashcards.length}</span>
                </h3>
                <div className="space-y-3">
                  {preview.flashcards.map((fc, i) => (
                    <div key={i} className="rounded-xl nf-fadein-up" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)", animationDelay: `${i * 60}ms` }}>
                      {editIdx?.type === "fc" && editIdx.idx === i ? (
                        <div className="p-4 space-y-2">
                          <FieldInput label="Question" value={editForm.front || ""} onChange={(v) => setEditForm({ ...editForm, front: v })} multiline />
                          <FieldInput label="Hint" value={editForm.hint || ""} onChange={(v) => setEditForm({ ...editForm, hint: v })} />
                          <FieldInput label="Answer" value={editForm.back || ""} onChange={(v) => setEditForm({ ...editForm, back: v })} multiline />
                          <div className="flex gap-2 pt-1">
                            <button onClick={saveEdit} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#059669" }}>Save</button>
                            <button onClick={() => setEditIdx(null)} className="px-4 py-1.5 rounded-lg text-xs" style={{ color: "var(--nf-text-3)" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="nf-badge nf-badge-flashcard text-xs">Flashcard {i + 1}</span>
                            <div className="flex gap-1">
                              <button onClick={() => openEdit("fc", i)} className="text-xs px-2 py-1 rounded transition-all"
                                style={{ color: "var(--nf-text-3)" }}>✎ Edit</button>
                              <button onClick={() => removeCard("flashcard", i)} className="text-xs px-2 py-1 rounded transition-all"
                                style={{ color: "var(--nf-error-text)" }}>✕</button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nf-text-3)" }}>Question</p>
                              <p className="text-sm font-medium" style={{ color: "var(--nf-text)" }}>{fc.front}</p>
                            </div>
                            {fc.hint && (
                              <div>
                                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nf-text-3)" }}>Hint</p>
                                <p className="text-xs italic" style={{ color: "var(--nf-text-2)" }}>{fc.hint}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nf-text-3)" }}>Answer</p>
                              <p className="text-sm" style={{ color: "var(--nf-text-2)" }}>{fc.back}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MCQs */}
            {preview.mcqs.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--nf-text)" }}>
                  📋 MCQs <span className="nf-badge nf-badge-mcq">{preview.mcqs.length}</span>
                </h3>
                <div className="space-y-3">
                  {preview.mcqs.map((mcq, i) => (
                    <div key={i} className="rounded-xl nf-fadein-up" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)", animationDelay: `${i * 60}ms` }}>
                      {editIdx?.type === "mcq" && editIdx.idx === i ? (
                        <div className="p-4 space-y-2">
                          <FieldInput label="Question" value={editForm.question || ""} onChange={(v) => setEditForm({ ...editForm, question: v })} multiline />
                          {(["A","B","C","D"] as const).map((k) => (
                            <FieldInput key={k} label={`Option ${k}`}
                              value={(editForm.options as Record<string,string>)?.[k] || ""}
                              onChange={(v) => setEditForm({ ...editForm, options: { ...(editForm.options as Record<string,string>), [k]: v } })} />
                          ))}
                          <div>
                            <p className="text-xs mb-1 uppercase tracking-wider" style={{ color: "var(--nf-text-3)" }}>Correct Option</p>
                            <select value={editForm.correct_option || "A"}
                              onChange={(e) => setEditForm({ ...editForm, correct_option: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}>
                              {["A","B","C","D"].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <FieldInput label="Explanation" value={editForm.explanation || ""} onChange={(v) => setEditForm({ ...editForm, explanation: v })} multiline />
                          <div className="flex gap-2 pt-1">
                            <button onClick={saveEdit} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#059669" }}>Save</button>
                            <button onClick={() => setEditIdx(null)} className="px-4 py-1.5 rounded-lg text-xs" style={{ color: "var(--nf-text-3)" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="nf-badge nf-badge-mcq text-xs">MCQ {i + 1}</span>
                            <div className="flex gap-1">
                              <button onClick={() => openEdit("mcq", i)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--nf-text-3)" }}>✎ Edit</button>
                              <button onClick={() => removeCard("mcq", i)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--nf-error-text)" }}>✕</button>
                            </div>
                          </div>
                          <p className="text-sm font-medium mb-3" style={{ color: "var(--nf-text)" }}>{mcq.question}</p>
                          <div className="grid grid-cols-1 gap-1.5 mb-3">
                            {Object.entries(mcq.options).map(([k, v]) => (
                              <div key={k} className="text-xs px-3 py-2 rounded-lg" style={{
                                background: k === mcq.correct_option ? "var(--nf-correct-bg)" : "var(--nf-input-bg)",
                                color: k === mcq.correct_option ? "var(--nf-correct-text)" : "var(--nf-text-2)",
                                border: `1px solid ${k === mcq.correct_option ? "var(--nf-correct-border)" : "var(--nf-input-border)"}`,
                                fontWeight: k === mcq.correct_option ? 600 : 400,
                              }}>
                                <span className="font-semibold">{k}.</span> {v}
                              </div>
                            ))}
                          </div>
                          {mcq.explanation && (
                            <p className="text-xs italic" style={{ color: "var(--nf-text-3)" }}>
                              💡 {mcq.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add blank card buttons */}
            <div className="flex gap-2">
              <button onClick={() => {
                if (!preview) return;
                const newIdx = preview.flashcards.length;
                setPreview((p) => p ? { ...p, flashcards: [...p.flashcards, { front: "", hint: "", back: "" }] } : p);
                setEditForm({ front: "", hint: "", back: "" });
                setEditIdx({ type: "fc", idx: newIdx });
              }}
                className="flex-1 py-2.5 rounded-xl text-sm transition-all"
                style={{ border: "1px dashed var(--nf-border)", color: "var(--nf-text-3)" }}>
                + Add Flashcard
              </button>
              <button onClick={() => {
                if (!preview) return;
                const newIdx = preview.mcqs.length;
                setPreview((p) => p ? { ...p, mcqs: [...p.mcqs, { question: "", options: { A: "", B: "", C: "", D: "" }, correct_option: "A", explanation: "" }] } : p);
                setEditForm({ question: "", options: { A: "", B: "", C: "", D: "" }, correct_option: "A", explanation: "" });
                setEditIdx({ type: "mcq", idx: newIdx });
              }}
                className="flex-1 py-2.5 rounded-xl text-sm transition-all"
                style={{ border: "1px dashed var(--nf-border)", color: "var(--nf-text-3)" }}>
                + Add MCQ
              </button>
            </div>

            {/* Generate more */}
            <button onClick={handleGenerateMore} disabled={generatingMore}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)", color: "var(--nf-text-2)" }}>
              {generatingMore ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="nf-spin">⟳</span> Generating more cards…
                </span>
              ) : "Generate More Cards from Same Content"}
            </button>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "var(--nf-error-bg)", color: "var(--nf-error-text)", border: "1px solid var(--nf-error-border)" }}>
                ⚠️ {error}
              </div>
            )}

            {/* Save / done */}
            <div className="flex gap-3">
              {!saved ? (
                <button onClick={handleSave} disabled={saving || totalCards === 0}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "#059669" }}>
                  {saving ? "Saving…" : `Save All ${totalCards} Cards to My Revision`}
                </button>
              ) : (
                <button onClick={() => router.push("/")}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white nf-fadein-up"
                  style={{ background: "#059669" }}>
                  ✓ Saved! Go to Dashboard →
                </button>
              )}
              <button onClick={handleCancel}
                className="px-5 py-3 rounded-xl text-sm transition-all"
                style={{ background: "var(--nf-card-alt)", color: "var(--nf-text-2)", border: "1px solid var(--nf-border)" }}>
                ← Back
              </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

function FieldInput({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const s: React.CSSProperties = { background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" };
  return (
    <div>
      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nf-text-3)" }}>{label}</p>
      {multiline
        ? <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={s} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={s} />
      }
    </div>
  );
}
