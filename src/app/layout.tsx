import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeverForget — UPSC Revision OS",
  description: "Spaced repetition flashcards for UPSC preparation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
