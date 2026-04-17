"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";

interface Card {
  id: number;
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
  verified: boolean;
  status: string;
  retention_pct: number;
  review_count: number;
  created_at: string;
}

export default function CardsPage() {
  const router = useRouter();
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ subject: "", topic: "", status: "", search: "", sort: "newest" });
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("nf_token") : null;

  // Fetch all cards once — filtering is done client-side
  const fetchCards = useCallback(async () => {
    if (!token) { router.push("/login"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/cards", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setAllCards(data.cards || []);
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    const saved = localStorage.getItem("nf_theme");
    document.documentElement.classList.toggle("dark", saved === "dark");
    fetchCards();
  }, [fetchCards]);

  // Derive subjects from actual card data
  const subjects = useMemo(() =>
    [...new Set(allCards.map(c => c.subject))].sort(),
    [allCards]
  );

  // Derive topics for selected subject from actual card data
  const topics = useMemo(() =>
    filters.subject
      ? [...new Set(allCards.filter(c => c.subject === filters.subject).map(c => c.topic))].sort()
      : [],
    [allCards, filters.subject]
  );

  // Client-side filtering + sorting — instant, no re-fetch
  const cards = useMemo(() => {
    let result = [...allCards];

    if (filters.subject) result = result.filter(c => c.subject === filters.subject);
    if (filters.topic) result = result.filter(c => c.topic === filters.topic);
    if (filters.status) result = result.filter(c => c.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c =>
        c.front?.toLowerCase().includes(q) ||
        c.back?.toLowerCase().includes(q) ||
        c.concept?.toLowerCase().includes(q)
      );
    }

    if (filters.sort === "oldest") {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (filters.sort === "weakest") {
      result.sort((a, b) => a.retention_pct - b.retention_pct);
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [allCards, filters]);

  async function handleSaveEdit() {
    if (!editCard) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cards/${editCard.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          front: editForm.front,
          hint: editForm.hint,
          back: editForm.back,
          options: editForm.options,
          correct_option: editForm.correct_option,
          explanation: editForm.explanation,
          verified: editForm.verified,
        }),
      });
      if (res.ok) {
        setEditCard(null);
        fetchCards();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this card?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/cards/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllCards(prev => prev.filter(c => c.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(card: Card) {
    setEditCard(card);
    setEditForm({
      front: card.front || "",
      hint: card.hint || "",
      back: card.back || "",
      options: card.options || undefined,
      correct_option: card.correct_option || "",
      explanation: card.explanation || "",
      verified: card.verified,
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--nf-bg)" }}>
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "var(--nf-text)" }}>
            My Cards
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--nf-text-3)" }}>
            {loading ? "Loading…" : `${cards.length} of ${allCards.length} cards`}
          </p>
        </div>

        {/* Filters */}
        <div className="rounded-2xl p-4" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)" }}>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <select value={filters.subject}
              onChange={(e) => setFilters({ ...filters, subject: e.target.value, topic: "" })}
              className="pl-3 pr-8 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={filters.topic}
              onChange={(e) => setFilters({ ...filters, topic: e.target.value })}
              disabled={!filters.subject}
              className="pl-3 pr-8 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}>
              <option value="">All Topics</option>
              {topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="pl-3 pr-8 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}>
              <option value="">All Status</option>
              <option value="new">New</option>
              <option value="due">Due</option>
              <option value="weak">Weak</option>
              <option value="strong">Strong</option>
            </select>

            <select value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="pl-3 pr-8 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="weakest">Weakest</option>
            </select>

            <input type="text" placeholder="Search…" value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }} />
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-36 rounded-2xl nf-pulse" style={{ background: "var(--nf-card)" }} />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📭</div>
            <p className="font-medium" style={{ color: "var(--nf-text)" }}>No cards found</p>
            <p className="text-sm mt-1" style={{ color: "var(--nf-text-3)" }}>
              {allCards.length > 0
                ? "Try adjusting your filters."
                : <><button onClick={() => router.push("/add")} style={{ color: "var(--nf-primary)" }}>Add some content</button> to generate cards.</>
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map(card => (
              <CardItem key={card.id} card={card}
                onEdit={() => openEdit(card)}
                onDelete={() => handleDelete(card.id)}
                deleting={deleting === card.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      {editCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ background: "var(--nf-overlay)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 my-4" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)" }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: "var(--nf-text)" }}>
                Edit {editCard.card_type === "flashcard" ? "Flashcard" : "MCQ"}
              </h3>
              <button onClick={() => setEditCard(null)} style={{ color: "var(--nf-text-3)" }}>✕</button>
            </div>

            {editCard.card_type === "flashcard" ? (
              <div className="space-y-3">
                <FormField label="Question" value={editForm.front || ""} onChange={(v) => setEditForm({ ...editForm, front: v })} />
                <FormField label="Hint" value={editForm.hint || ""} onChange={(v) => setEditForm({ ...editForm, hint: v })} />
                <FormField label="Answer" value={editForm.back || ""} onChange={(v) => setEditForm({ ...editForm, back: v })} multiline />
              </div>
            ) : (
              <div className="space-y-3">
                <FormField label="Question" value={editForm.front || ""} onChange={(v) => setEditForm({ ...editForm, front: v })} multiline />
                {Object.entries(editForm.options || {}).map(([k, v]) => (
                  <FormField key={k} label={`Option ${k}`} value={v}
                    onChange={(val) => setEditForm({ ...editForm, options: { ...editForm.options!, [k]: val } })} />
                ))}
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--nf-text-3)" }}>Correct Option</label>
                  <select value={editForm.correct_option || ""}
                    onChange={(e) => setEditForm({ ...editForm, correct_option: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}>
                    {["A","B","C","D"].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <FormField label="Explanation" value={editForm.explanation || ""} onChange={(v) => setEditForm({ ...editForm, explanation: v })} multiline />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--nf-text-2)" }}>
              <input type="checkbox" checked={editForm.verified || false}
                onChange={(e) => setEditForm({ ...editForm, verified: e.target.checked })} />
              Mark as verified
            </label>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditCard(null)} className="flex-1 py-2 rounded-xl text-sm"
                style={{ border: "1px solid var(--nf-border)", color: "var(--nf-text-2)" }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: "var(--nf-primary)" }}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardItem({ card, onEdit, onDelete, deleting }: { card: Card; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  const statusColors: Record<string, string> = {
    new: "nf-badge-new", due: "nf-badge-due", weak: "nf-badge-weak", strong: "nf-badge-strong"
  };
  const retColor = card.retention_pct >= 70 ? "var(--nf-green-text)" : card.retention_pct >= 40 ? "var(--nf-yellow-text)" : "var(--nf-red-text)";

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 nf-lift" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-1.5 flex-wrap">
          <span className={`nf-badge ${card.card_type === "flashcard" ? "nf-badge-flashcard" : "nf-badge-mcq"}`}>
            {card.card_type === "flashcard" ? "Flashcard" : "MCQ"}
          </span>
          <span className={`nf-badge ${statusColors[card.status] || "nf-badge-new"}`}>{card.status}</span>
        </div>
        <span className="text-sm font-bold shrink-0" style={{ color: retColor }}>{card.retention_pct}%</span>
      </div>

      <p className="text-sm font-medium line-clamp-3 flex-1" style={{ color: "var(--nf-text)" }}>
        {card.front}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--nf-text-4)" }}>
          <span style={{ color: "var(--nf-text-3)" }}>{card.subject}</span>
          <span className="mx-1">›</span>
          <span>{card.topic}</span>
        </span>
        <div className="flex gap-1">
          <button onClick={onEdit} className="text-xs px-2.5 py-1 rounded-lg transition-all"
            style={{ background: "var(--nf-primary-soft)", color: "var(--nf-primary)" }}>Edit</button>
          <button onClick={onDelete} disabled={deleting} className="text-xs px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
            style={{ background: "var(--nf-error-bg)", color: "var(--nf-error-text)" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const style: React.CSSProperties = { background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" };
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--nf-text-3)" }}>{label}</label>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={style} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={style} />
      )}
    </div>
  );
}
