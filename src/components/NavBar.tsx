"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("nf_theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    try {
      const user = JSON.parse(localStorage.getItem("nf_user") || "{}");
      setUserName(user.name || "");
    } catch {}
  }, []);

  function toggleTheme() {
    const isDark = !dark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("nf_theme", isDark ? "dark" : "light");
  }

  function logout() {
    localStorage.removeItem("nf_token");
    localStorage.removeItem("nf_user");
    router.push("/login");
  }

  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/add", label: "Add Content" },
    { href: "/cards", label: "My Cards" },
  ];

  return (
    <nav className="sticky top-0 z-50" style={{ background: "var(--nf-card)", borderBottom: "1px solid var(--nf-border)", boxShadow: "var(--nf-shadow-sm)" }}>
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "linear-gradient(135deg, #3955d4 0%, #6c47ff 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <span style={{ color: "#f0c040", fontSize: 17, fontWeight: 900, lineHeight: 1, marginTop: -1 }}>∞</span>
          </div>
          <span className="text-lg font-bold nf-logo" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>NeverForget</span>
        </Link>

        <div className="flex items-center gap-1 flex-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={pathname === href
                ? { background: "var(--nf-primary-soft)", color: "var(--nf-primary)" }
                : { color: "var(--nf-text-3)" }}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {userName && (
            <span className="text-sm hidden sm:block" style={{ color: "var(--nf-text-3)" }}>{userName}</span>
          )}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
            style={{ color: "var(--nf-text-3)" }}
            title="Toggle theme"
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            )}
          </button>
          <button
            onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "var(--nf-text-3)", border: "1px solid var(--nf-border)" }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
