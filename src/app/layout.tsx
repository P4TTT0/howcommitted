import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Committed",
  description: "Your commit history as an audio-visual experience.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
