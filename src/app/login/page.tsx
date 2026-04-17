"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("nf_token")) {
      router.push("/");
    }
    // Apply saved theme
    const saved = localStorage.getItem("nf_theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body = tab === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      localStorage.setItem("nf_token", data.token);
      localStorage.setItem("nf_user", JSON.stringify(data.user));
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--nf-bg)" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold nf-logo" style={{ fontFamily: "'Poppins', sans-serif" }}>
            NeverForget
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--nf-text-3)" }}>UPSC Revision OS</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow-lg)" }}>
          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "var(--nf-card-alt)" }}>
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                style={tab === t
                  ? { background: "var(--nf-card)", color: "var(--nf-text)", boxShadow: "var(--nf-shadow-sm)" }
                  : { color: "var(--nf-text-3)" }}
              >
                {t === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "signup" && (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--nf-text-2)" }}>Name</label>
                <input
                  type="text"
                  required
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--nf-text-2)" }}>Email</label>
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--nf-text-2)" }}>Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--nf-input-bg)", border: "1px solid var(--nf-input-border)", color: "var(--nf-text)" }}
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "var(--nf-error-bg)", color: "var(--nf-error-text)", border: "1px solid var(--nf-error-border)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: loading ? "var(--nf-primary)" : "var(--nf-primary)" }}
            >
              {loading ? "Please wait…" : tab === "login" ? "Log In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const isDark = !dark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("nf_theme", isDark ? "dark" : "light");
  }
  return (
    <button onClick={toggle} className="fixed bottom-6 right-6 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: "var(--nf-card)", border: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow-lg)", color: "var(--nf-text-2)" }}>
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}
