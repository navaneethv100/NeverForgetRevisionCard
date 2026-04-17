import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeverForget — UPSC Revision OS",
  description: "Spaced repetition flashcards for UPSC preparation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('nf_theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
