"use client";
import { useEffect } from "react";
import { TimeTravelProvider } from "@/components/NavBar";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Apply theme on mount — client only, no SSR mismatch
  useEffect(() => {
    try {
      const t = localStorage.getItem("nf_theme");
      if (t === "dark") document.documentElement.classList.add("dark");
    } catch { /* ignore */ }
  }, []);

  return <TimeTravelProvider>{children}</TimeTravelProvider>;
}
