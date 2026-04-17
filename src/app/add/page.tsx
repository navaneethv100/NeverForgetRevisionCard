"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { UPSC_SYLLABUS_CLIENT } from "@/lib/syllabus-client";
import { Icon } from "@iconify/react";

type Tab = "text" | "url" | "youtube";
type Phase = "input" | "loading" | "success" | "preview";

interface FlashCard { front: string; hint: string; back: string; }
interface MCQ { question: string; options: Record<string, string>; correct_option: string; explanation: string; }
interface PreviewData {
  subject: string; topic: string; concept: string;
  flashcards: FlashCard[]; mcqs: MCQ[];
  raw_content: string; source_type: string; source_url?: string;
  video_id?: string; video_title?: string; content_source?: string;
}

const STEPS = [
  "Analyzing your content",
  "Identifying key topics",
  "Creating flashcards",
  "Finalizing your set",
];

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
  const [activeStep, setActiveStep] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const [editIdx, setEditIdx] = useState<{ type: "fc" | "mcq"; idx: number } | null>(null);
  const [editForm, setEditForm] = useState<Partial<FlashCard & MCQ>>({});

  useEffect(() => {
    if (!editIdx) return;
    const id = `edit-${editIdx.type}-${editIdx.idx}`;
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, [editIdx]);

  useEffect(() => {
    const token = localStorage.getItem("nf_token");
    if (!token) { router.push("/login"); return; }
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");

    const params = new URLSearchParams(window.location.search);
    const autoTab = params.get("tab") as Tab | null;
    const isAuto = params.get("auto") === "1";

    // Non-auto: just set the tab
    if (autoTab && ["text", "url", "youtube"].includes(autoTab) && !isAuto) {
      setTab(autoTab as Tab);
      return;
    }

    // Auto-mode: skip input screen, go straight to processing
    if (!autoTab || !["text", "url", "youtube"].includes(autoTab) || !isAuto) return;

    const stored = sessionStorage.getItem("nf_modal_input");
    if (!stored) return;
    sessionStorage.removeItem("nf_modal_input");

    let input: { type: string; content?: string; url?: string };
    try { input = JSON.parse(stored); } catch { return; }

    const t = autoTab as Tab;
    setTab(t);
    setPhase("loading");
    setActiveStep(0);

    let stepIdx = 0;
    intervalRef.current = setInterval(() => {
      stepIdx++;
      if (stepIdx < STEPS.length) setActiveStep(stepIdx);
    }, 5000);

    (async () => {
      try {
        let endpoint = "", body: Record<string, string> = {};
        if (t === "text") { endpoint = "/api/ingest/text"; body = { text: input.content || "" }; }
        else if (t === "url") { endpoint = "/api/ingest/url"; body = { url: input.url || "" }; }
        else { endpoint = "/api/ingest/youtube"; body = { url: input.url || "" }; }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Processing failed");
        if (intervalRef.current) clearInterval(intervalRef.current);
        await new Promise((r) => setTimeout(r, 400));
        setPreview(data);
        setPhase("success");
      } catch (e: unknown) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }, [router]);

  useEffect(() => {
    const id = extractYtId(ytUrl);
    setYtPreviewId(id);
  }, [ytUrl]);

  function startLoadingAnimation() {
    setActiveStep(0);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx++;
      if (idx < STEPS.length) setActiveStep(idx);
    }, 5000);
  }

  function stopLoadingAnimation() {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }

  async function handleGenerate() {
    setError("");
    setPreview(null);
    setSaved(false);
    setShowTranscript(false);
    setPhase("loading");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
    startLoadingAnimation();

    try {
      let endpoint = "", body = {};
      if (tab === "text") { endpoint = "/api/ingest/text"; body = { text }; }
      else if (tab === "url") { endpoint = "/api/ingest/url"; body = { url }; }
      else { endpoint = "/api/ingest/youtube"; body = { url: ytUrl }; }

      const token = localStorage.getItem("nf_token");
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
      setPhase("success");
    } catch (e: unknown) {
      stopLoadingAnimation();
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function handleStartRevision() {
    if (!preview) { router.push("/session"); return; }
    if (!saved) {
      setSaving(true);
      try {
        const token = localStorage.getItem("nf_token");
        const res = await fetch("/api/ingest/save", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(preview),
        });
        if (res.ok) {
          setSaved(true);
          const data = await res.json();
          if (data.card_ids?.length) {
            router.push(`/session?card_ids=${data.card_ids.join(",")}`);
            return;
          }
        }
      } catch { /* still navigate */ }
      finally { setSaving(false); }
    }
    router.push("/session");
  }

  async function handleGenerateMore() {
    if (!preview) return;
    setGeneratingMore(true);
    try {
      const existingQ = [
        ...preview.flashcards.map((f) => f.front),
        ...preview.mcqs.map((m) => m.question),
      ];
      const token = localStorage.getItem("nf_token");
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
      const token = localStorage.getItem("nf_token");
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
    setError("");
    if (preview) {
      setPhase("success");
    } else {
      setPreview(null);
      setShowTranscript(false);
      setPhase("input");
    }
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
      if (!editForm.front?.trim() || !editForm.back?.trim()) {
        removeCard("flashcard", editIdx.idx);
        setEditIdx(null);
        return;
      }
      setPreview({ ...preview, flashcards: preview.flashcards.map((c, i) => i === editIdx.idx ? { front: editForm.front!.trim(), hint: editForm.hint?.trim() || "", back: editForm.back!.trim() } : c) });
    } else {
      const opts = editForm.options as Record<string, string> | undefined;
      if (!editForm.question?.trim()) {
        removeCard("mcq", editIdx.idx);
        setEditIdx(null);
        return;
      }
      setPreview({ ...preview, mcqs: preview.mcqs.map((c, i) => i === editIdx.idx ? { question: editForm.question!.trim(), options: opts || c.options, correct_option: editForm.correct_option || c.correct_option, explanation: editForm.explanation?.trim() || "" } : c) });
    }
    setEditIdx(null);
  }

  function cancelEdit() {
    if (!editIdx || !preview) { setEditIdx(null); return; }
    // Remove the card if it was newly added and left blank
    if (editIdx.type === "fc") {
      const card = preview.flashcards[editIdx.idx];
      if (!card.front && !card.back) removeCard("flashcard", editIdx.idx);
    } else {
      const card = preview.mcqs[editIdx.idx];
      if (!card.question) removeCard("mcq", editIdx.idx);
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

  /* ── Success screen ── */
  if (phase === "success" && preview) {
    const successSteps = [
      `${preview.flashcards.length} flashcard${preview.flashcards.length !== 1 ? "s" : ""} created`,
      `${preview.mcqs.length} MCQ${preview.mcqs.length !== 1 ? "s" : ""} created`,
      "Spaced repetition scheduled",
      `${totalCards} cards ready to practice`,
    ];
    return (
      <div style={{ minHeight: "100svh", background: "var(--nf-bg)", display: "flex", flexDirection: "column" }}>
        <NavBar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "52px 16px 44px" }}>

          {/* Hero icon — static, green tint */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <div className="ls-hero-glow" />
            <div style={{ position: "relative", zIndex: 1, width: 56, height: 56, borderRadius: "50%", background: "#10b981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 5px var(--nf-bg), 0 0 0 7px #10b981" }}>
              <Icon icon="hugeicons:checkmark-circle-01" width={28} />
            </div>
          </div>

          <p style={{ fontFamily: "'Lato', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "var(--nf-text-3)", margin: "0 0 6px" }}>
            Cards are ready
          </p>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.5rem)", fontWeight: 600, color: "var(--nf-text)", margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
            Your revision set is prepared
          </h2>

          {/* Card stack — all done */}
          <div style={{ position: "relative", width: 270, height: 340, margin: "40px auto 0" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(16,185,129,0.25)", transform: "rotate(-4deg) translate(-6px, 4px)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(16,185,129,0.25)", transform: "rotate(3deg) translate(4px, 2px)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(16,185,129,0.5)", background: "var(--nf-card)", overflow: "hidden" }}>
              <div style={{
                position: "absolute", left: 0, right: 0, top: 0,
                display: "flex", flexDirection: "column",
                transform: `translateY(calc(50% - ${(successSteps.length - 1) * 72 + 36}px))`,
              }}>
                {successSteps.map((label, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, height: 72, padding: "0 28px", flexShrink: 0 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(16,185,129,0.8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓</div>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", color: "var(--nf-text-3)", textAlign: "left" }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ pointerEvents: "none", position: "absolute", inset: 0, background: "linear-gradient(to bottom, var(--nf-card) 0%, transparent 32%, transparent 68%, var(--nf-card) 100%)" }} />
            </div>
          </div>

          {/* CTAs */}
          <div style={{ marginTop: 36, display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <button
              onClick={() => setPhase("preview")}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.9rem", fontWeight: 600, background: "var(--nf-input-bg)", color: "var(--nf-text-2)", border: "1.5px solid var(--nf-border)", borderRadius: 14, padding: "14px 28px", cursor: "pointer" }}
            >
              Manage Flashcards
            </button>
            <button
              onClick={handleStartRevision}
              disabled={saving}
              style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.9rem", fontWeight: 600, background: "#10b981", color: "#fff", border: "none", borderRadius: 14, padding: "14px 28px", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(16,185,129,0.3)", opacity: saving ? 0.75 : 1 }}
            >
              <Icon icon="hugeicons:play" width={18} />
              {saving ? "Saving…" : "Start Practice"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Full-page loading screen (no card/shadow) ── */
  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100svh", background: "var(--nf-bg)", display: "flex", flexDirection: "column" }}>
        <NavBar />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "52px 16px 44px" }}>

          {error ? (
            /* ── Error state on processing screen ── */
            <>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--nf-error-bg)", border: "2px solid var(--nf-error-border)", color: "var(--nf-error-text)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <Icon icon="hugeicons:alert-02" width={26} />
              </div>
              <p style={{ fontFamily: "'Lato', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "var(--nf-text-3)", margin: "0 0 6px" }}>
                Something went wrong
              </p>
              <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(1.1rem, 4vw, 1.35rem)", fontWeight: 600, color: "var(--nf-text)", margin: "0 0 12px", lineHeight: 1.3 }}>
                Could not generate your cards
              </h2>
              <p style={{ fontFamily: "'Lato', sans-serif", fontSize: "0.875rem", color: "var(--nf-error-text)", background: "var(--nf-error-bg)", border: "1px solid var(--nf-error-border)", borderRadius: 12, padding: "10px 18px", maxWidth: 380, margin: "0 auto 28px" }}>
                {error}
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  onClick={() => { setError(""); setPhase("input"); }}
                  style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.9rem", fontWeight: 600, background: "var(--nf-primary)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", cursor: "pointer" }}
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push("/")}
                  style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.9rem", fontWeight: 500, background: "var(--nf-card-alt)", color: "var(--nf-text-2)", border: "1px solid var(--nf-border)", borderRadius: 12, padding: "12px 28px", cursor: "pointer" }}
                >
                  Back to Home
                </button>
              </div>
            </>
          ) : (
            /* ── Processing animation ── */
            <>
              {/* Hero icon with glow */}
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                <div className="ls-hero-glow" />
                <div style={{ position: "relative", zIndex: 1, width: 56, height: 56, borderRadius: "50%", background: "#4F5BD5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 5px var(--nf-bg), 0 0 0 7px #4F5BD5" }}>
                  <Icon icon="hugeicons:magic-wand-01" width={26} />
                </div>
              </div>

              <p style={{ fontFamily: "'Lato', sans-serif", fontSize: "0.875rem", fontWeight: 500, color: "var(--nf-text-3)", margin: "0 0 6px" }}>
                Just a moment…
              </p>
              <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: "clamp(1.2rem, 4vw, 1.5rem)", fontWeight: 600, color: "var(--nf-text)", margin: 0, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                Your revision is being prepared
              </h2>

              {/* Card stack illustration */}
              <div style={{ position: "relative", width: 270, height: 340, margin: "40px auto 0" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(79,91,213,0.25)", transform: "rotate(-4deg) translate(-6px, 4px)" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(79,91,213,0.25)", transform: "rotate(3deg) translate(4px, 2px)" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: 28, border: "2px dashed rgba(79,91,213,0.55)", background: "var(--nf-card)", overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", left: 0, right: 0, top: 0,
                    display: "flex", flexDirection: "column",
                    transform: `translateY(calc(50% - ${activeStep * 72 + 36}px))`,
                    transition: activeStep === 0 ? "none" : "transform 0.7s ease-out",
                  }}>
                    {STEPS.map((stepText, i) => {
                      const state = i < activeStep ? "done" : i === activeStep ? "active" : "pending";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, height: 72, padding: "0 28px", flexShrink: 0 }}>
                          {state === "done" ? (
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(79,91,213,0.8)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>✓</div>
                          ) : state === "active" ? (
                            <div className="ls-ic-spin" />
                          ) : (
                            <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2.5px solid rgba(79,91,213,0.3)", flexShrink: 0, boxSizing: "border-box" as const }} />
                          )}
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em", color: state === "active" ? "var(--nf-text)" : "var(--nf-text-3)" }}>
                            {stepText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ pointerEvents: "none", position: "absolute", inset: 0, background: "linear-gradient(to bottom, var(--nf-card) 0%, transparent 32%, transparent 68%, var(--nf-card) 100%)" }} />
                </div>
              </div>

              <p style={{ marginTop: 28, fontFamily: "'Lato', sans-serif", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--nf-text-4)" }}>
                Generating your cards
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* Scroll anchor */}
        <div ref={topRef} />

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Poppins', sans-serif", color: "var(--nf-text)" }}>
            {phase === "preview" ? "Manage Cards" : "Add Content"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--nf-text-3)" }}>
            {phase === "preview"
              ? `${totalCards} card${totalCards !== 1 ? "s" : ""} generated — edit, add more, or save`
              : "Paste text, a URL, or a YouTube link — AI generates study cards instantly"}
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
                  <span className="flex items-center justify-center gap-1.5">
                    <Icon icon={t === "text" ? "hugeicons:sticky-note-01" : t === "url" ? "hugeicons:link-01" : "hugeicons:youtube"} width={14} />
                    {t === "text" ? "Paste Text" : t === "url" ? "Website URL" : "YouTube"}
                  </span>
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
                <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: "var(--nf-error-bg)", color: "var(--nf-error-text)", border: "1px solid var(--nf-error-border)" }}>
                  <Icon icon="hugeicons:alert-02" width={16} style={{ flexShrink: 0 }} /> {error}
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
                    <span className="flex items-center gap-1">
                      <Icon icon={preview.content_source === "transcript" ? "hugeicons:sticky-note-01" : preview.content_source === "audio" ? "hugeicons:music-note-01" : "hugeicons:information-circle"} width={12} />
                      {preview.content_source === "transcript" ? "Transcript" : preview.content_source === "audio" ? "Audio" : "Metadata"}
                    </span>
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
                    <Icon icon="hugeicons:file-02" width={16} />
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
                  <Icon icon="hugeicons:flash" width={16} /> Flashcards <span className="nf-badge nf-badge-flashcard">{preview.flashcards.length}</span>
                </h3>
                <div className="space-y-3">
                  {preview.flashcards.map((fc, i) => (
                    <div key={i} className="rounded-xl nf-fadein-up" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)", animationDelay: `${i * 60}ms` }}>
                      {editIdx?.type === "fc" && editIdx.idx === i ? (
                        <div id={`edit-fc-${i}`} className="p-4 space-y-2">
                          <FieldInput label="Question" value={editForm.front || ""} onChange={(v) => setEditForm({ ...editForm, front: v })} multiline />
                          <FieldInput label="Hint" value={editForm.hint || ""} onChange={(v) => setEditForm({ ...editForm, hint: v })} />
                          <FieldInput label="Answer" value={editForm.back || ""} onChange={(v) => setEditForm({ ...editForm, back: v })} multiline />
                          <div className="flex gap-2 pt-1">
                            <button onClick={saveEdit} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: "#059669" }}>Save</button>
                            <button onClick={cancelEdit} className="px-4 py-1.5 rounded-lg text-xs" style={{ color: "var(--nf-text-3)" }}>Cancel</button>
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
                                style={{ color: "var(--nf-error-text)" }}><Icon icon="hugeicons:cancel-01" width={14} /></button>
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
                  <Icon icon="hugeicons:note-01" width={16} /> MCQs <span className="nf-badge nf-badge-mcq">{preview.mcqs.length}</span>
                </h3>
                <div className="space-y-3">
                  {preview.mcqs.map((mcq, i) => (
                    <div key={i} className="rounded-xl nf-fadein-up" style={{ background: "var(--nf-card-alt)", border: "1px solid var(--nf-border)", animationDelay: `${i * 60}ms` }}>
                      {editIdx?.type === "mcq" && editIdx.idx === i ? (
                        <div id={`edit-mcq-${i}`} className="p-4 space-y-2">
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
                            <button onClick={cancelEdit} className="px-4 py-1.5 rounded-lg text-xs" style={{ color: "var(--nf-text-3)" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="nf-badge nf-badge-mcq text-xs">MCQ {i + 1}</span>
                            <div className="flex gap-1">
                              <button onClick={() => openEdit("mcq", i)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--nf-text-3)" }}>✎ Edit</button>
                              <button onClick={() => removeCard("mcq", i)} className="text-xs px-2 py-1 rounded" style={{ color: "var(--nf-error-text)" }}><Icon icon="hugeicons:cancel-01" width={14} /></button>
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
                              <Icon icon="hugeicons:idea-01" width={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />{mcq.explanation}
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
                  <Icon icon="hugeicons:reload" width={14} className="nf-spin" /> Generating more cards…
                </span>
              ) : "Generate More Cards from Same Content"}
            </button>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: "var(--nf-error-bg)", color: "var(--nf-error-text)", border: "1px solid var(--nf-error-border)" }}>
                <Icon icon="hugeicons:alert-02" width={16} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {/* Save / done */}
            <div className="flex gap-3">
              {!saved ? (
                <button onClick={handleSave} disabled={saving || totalCards === 0}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "var(--nf-primary)", boxShadow: "0 2px 12px rgba(57,85,212,0.3)" }}>
                  {saving ? "Saving…" : `Save All ${totalCards} Cards to My Revision`}
                </button>
              ) : (
                <button onClick={() => router.push("/")}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white nf-fadein-up"
                  style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", boxShadow: "0 2px 14px rgba(16,185,129,0.4)" }}>
                  ✓ Saved! Go to Dashboard →
                </button>
              )}
              <button onClick={handleCancel}
                className="px-5 py-3 rounded-xl text-sm transition-all"
                style={{ background: "var(--nf-card-alt)", color: "var(--nf-text-2)", border: "1px solid var(--nf-border)" }}>
                ← Done
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
