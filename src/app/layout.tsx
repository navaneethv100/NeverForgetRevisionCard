import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeverForget — UPSC Revision OS",
  description: "Spaced repetition flashcards for UPSC preparation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem('nf_theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`
        }} />
        {children}
      </body>
    </html>
  );
}
