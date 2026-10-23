import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Big_Shoulders, Martian_Mono } from "next/font/google";
import { resolveSiteOrigin } from "@/og/origin";
import "./globals.css";

const bigShoulders = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-big-shoulders",
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian-mono",
  axes: ["wdth"],
});

const description = "Your contribution history as an audio-visual experience.";

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin(process.env)),
  applicationName: "How Committed",
  title: "How Committed",
  description,
  openGraph: {
    title: "How Committed",
    description,
    siteName: "How Committed",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "How Committed", description },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${martianMono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
