"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { Icon } from "@iconify/react";

interface PreviewData {
  total: number;
  subjects: string[];
}

export default function AudioPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"select" | "generating" | "done">("select");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [cardCount, setCardCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("revision-audio.mp3");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1.5);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    fetchPreview();
  }, []);

  useEffect(() => {
    fetchCardCount();
  }, [selectedSubject]);

  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function fetchPreview() {
    const token = localStorage.getItem("nf_token");
    if (!token) { router.push("/login"); return; }
    try {
      const res = await fetch("/api/cards", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data: PreviewData = await res.json();
      setSubjects(data.subjects || []);
      setCardCount(data.total || 0);
    } catch {
      setError("Failed to load cards");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCardCount() {
    const token = localStorage.getItem("nf_token");
    if (!token) return;
    try {
      const url = selectedSubject
        ? `/api/cards?subject=${encodeURIComponent(selectedSubject)}`
        : "/api/cards";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCardCount(data.total || 0);
      }
    } catch { /* ignore */ }
  }

  const estimatedMinutes = Math.max(1, Math.round((cardCount * 20) / 60));

  async function handleGenerate() {
    if (cardCount === 0) return;
    setError("");
    setGenerating(true);
    setPhase("generating");
    setProgress(0);

    // Simulate progress since we can't get real progress from a single fetch
    const estimatedMs = cardCount * 2000; // ~2s per card for TTS
    const step = 100 / (estimatedMs / 300);
    progressInterval.current = setInterval(() => {
      setProgress((p) => Math.min(p + step, 92));
    }, 300);

    try {
      const token = localStorage.getItem("nf_token");
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: selectedSubject || undefined,
        }),
      });

      if (progressInterval.current) clearInterval(progressInterval.current);

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(data.error || "Generation failed");
      }

      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+?)"/);
      if (match) setFilename(match[1]);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setProgress(100);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate audio");
      setPhase("select");
    } finally {
      setGenerating(false);
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
  }

  function handleDownload() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = filename;
    a.click();
  }

  function handleReset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setPhase("select");
    setProgress(0);
    setError("");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 48px" }}>

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
            Revision Audio
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--nf-text-3)", margin: 0 }}>
            Generate a podcast-style audio to revise on the go
          </p>
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div className="ls-ic-spin" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
        )}

        {!loading && phase === "select" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* How it works */}
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
              <Icon icon="hugeicons:headphones" width={18} style={{ color: "var(--nf-info-text)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: "0.84rem", color: "var(--nf-info-text)", lineHeight: 1.55 }}>
                <strong>How it works:</strong> We read each question aloud, pause for you to think, then reveal the answer. Perfect for commuting or walking.
              </div>
            </div>

            {/* Subject filter */}
            <div
              style={{
                background: "var(--nf-card)",
                border: "1px solid var(--nf-border)",
                borderRadius: 16,
                padding: 20,
                boxShadow: "var(--nf-shadow)",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--nf-text-2)",
                  marginBottom: 8,
                }}
              >
                Select Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
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
                  cursor: "pointer",
                }}
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Preview card */}
            <div
              style={{
                background: "var(--nf-card)",
                border: "1px solid var(--nf-border)",
                borderRadius: 16,
                padding: 20,
                boxShadow: "var(--nf-shadow)",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 16 }}>
                <div>
                  <div
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: "2rem",
                      fontWeight: 700,
                      color: "var(--nf-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {Math.min(cardCount, 100)}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--nf-text-4)", marginTop: 4 }}>
                    cards{cardCount > 100 ? " (max 100)" : ""}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: "2rem",
                      fontWeight: 700,
                      color: "var(--nf-text)",
                      lineHeight: 1,
                    }}
                  >
                    ~{estimatedMinutes}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--nf-text-4)", marginTop: 4 }}>
                    minutes
                  </div>
                </div>
              </div>

              {cardCount === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--nf-text-3)" }}>
                  No cards found. Try a different subject or add some cards first.
                </p>
              ) : (
                <button
                  onClick={handleGenerate}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "14px 36px",
                    borderRadius: 14,
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "#fff",
                    background: "linear-gradient(135deg, #4F5BD5 0%, #6c47ff 100%)",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Poppins', sans-serif",
                    boxShadow: "0 4px 20px rgba(79,91,213,0.35)",
                  }}
                >
                  <Icon icon="hugeicons:headphones" width={20} />
                  Generate Audio
                </button>
              )}
            </div>

            {error && (
              <div
                style={{
                  background: "var(--nf-error-bg)",
                  border: "1px solid var(--nf-error-border)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  fontSize: "0.84rem",
                  color: "var(--nf-error-text)",
                  textAlign: "center",
                }}
              >
                {error}
              </div>
            )}
          </div>
        )}

        {phase === "generating" && (
          <div
            style={{
              background: "var(--nf-card)",
              border: "1px solid var(--nf-border)",
              borderRadius: 16,
              padding: "40px 24px",
              boxShadow: "var(--nf-shadow)",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <Icon
                icon="hugeicons:headphones"
                width={48}
                style={{ color: "var(--nf-primary)" }}
                className="nf-pulse"
              />
            </div>
            <h3
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "1.15rem",
                fontWeight: 600,
                color: "var(--nf-text)",
                margin: "0 0 8px",
              }}
            >
              Generating your audio...
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--nf-text-3)", margin: "0 0 24px" }}>
              Converting {Math.min(cardCount, 100)} cards to speech. This may take a minute.
            </p>

            {/* Progress bar */}
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: "var(--nf-card-alt)",
                overflow: "hidden",
                maxWidth: 360,
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: 999,
                  width: `${progress}%`,
                  background: "var(--nf-primary)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--nf-text-4)", marginTop: 8 }}>
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {phase === "done" && audioUrl && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Success card */}
            <div
              style={{
                background: "var(--nf-card)",
                border: "1px solid var(--nf-border)",
                borderRadius: 16,
                padding: "32px 24px",
                boxShadow: "var(--nf-shadow)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  boxShadow: "0 0 0 10px rgba(16,185,129,0.1), 0 0 0 20px rgba(16,185,129,0.05)",
                }}
              >
                <Icon icon="hugeicons:checkmark-circle-01" width={32} style={{ color: "#fff" }} />
              </div>
              <h3
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: "var(--nf-text)",
                  margin: "0 0 4px",
                }}
              >
                Audio Ready!
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--nf-text-3)", margin: "0 0 24px" }}>
                {Math.min(cardCount, 100)} cards &middot; ~{estimatedMinutes} min
              </p>

              {/* Audio player */}
              <div
                style={{
                  background: "var(--nf-input-bg)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  marginBottom: 12,
                }}
              >
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  style={{ width: "100%", height: 40 }}
                  onLoadedMetadata={() => {
                    if (audioRef.current) audioRef.current.playbackRate = speed;
                  }}
                />
              </div>

              {/* Speed controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20 }}>
                <span style={{ fontSize: "0.75rem", color: "var(--nf-text-4)", marginRight: 4 }}>Speed:</span>
                {[1, 1.25, 1.5, 1.75, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSpeed(s);
                      if (audioRef.current) audioRef.current.playbackRate = s;
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      border: speed === s ? "1.5px solid var(--nf-primary)" : "1.5px solid var(--nf-border)",
                      background: speed === s ? "var(--nf-primary-soft)" : "transparent",
                      color: speed === s ? "var(--nf-primary)" : "var(--nf-text-3)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button
                  onClick={handleDownload}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "13px 28px",
                    borderRadius: 12,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#fff",
                    background: "linear-gradient(135deg, #4F5BD5 0%, #6c47ff 100%)",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Poppins', sans-serif",
                    boxShadow: "0 4px 16px rgba(79,91,213,0.3)",
                  }}
                >
                  <Icon icon="hugeicons:download-04" width={18} />
                  Download MP3
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "13px 28px",
                    borderRadius: 12,
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "var(--nf-text-2)",
                    background: "var(--nf-input-bg)",
                    border: "1.5px solid var(--nf-border)",
                    cursor: "pointer",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  <Icon icon="hugeicons:refresh" width={18} />
                  New Audio
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
