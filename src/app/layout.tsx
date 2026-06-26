import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Biomechanik-Lab · Beschreibungs-Lab",
  description:
    "Datengetriebene Übungen: Gesehenes mit eigenen Worten fachlich beschreiben und sokratisches KI-Feedback erhalten.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
