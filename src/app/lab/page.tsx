import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Timeline } from "@/features/timeline/Timeline";

export const metadata: Metadata = {
  title: "Lab | Committed",
  robots: { index: false, follow: false },
};

// Read per request so the check follows the deployment, not the build.
export const dynamic = "force-dynamic";

/** Playback lab: available locally and in Vercel previews, never in production. */
export default function LabPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <Timeline />;
}
