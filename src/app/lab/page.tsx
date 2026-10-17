import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LabScenes } from "@/features/experience/LabScenes";
import { isLabEnabled } from "@/features/experience/labGate";

export const metadata: Metadata = {
  title: "Lab | Committed",
  robots: { index: false, follow: false },
};

// Read per request so the check follows the deployment, not the build.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ scene?: string | string[] }> };

/**
 * Playback lab: available locally and in Vercel previews, closed otherwise.
 * `/lab?scene=<id>` previews a single scene.
 */
export default async function LabPage({ searchParams }: Props) {
  if (!isLabEnabled(process.env)) notFound();
  const { scene } = await searchParams;
  return <LabScenes sceneId={typeof scene === "string" ? scene : undefined} />;
}
