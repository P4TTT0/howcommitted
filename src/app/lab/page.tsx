import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLabEnabled } from "@/features/timeline/labGate";
import { Timeline } from "@/features/timeline/Timeline";

export const metadata: Metadata = {
  title: "Lab | Committed",
  robots: { index: false, follow: false },
};

// Read per request so the check follows the deployment, not the build.
export const dynamic = "force-dynamic";

/** Playback lab: available locally and in Vercel previews, closed otherwise. */
export default function LabPage() {
  if (!isLabEnabled(process.env)) notFound();
  return <Timeline />;
}
