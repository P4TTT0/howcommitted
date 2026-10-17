"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FINALE, SCENES } from "@/features/scenes/registry";
import { Sequencer } from "@/features/sequencer/Sequencer";
import { labSceneData } from "./labData";

/**
 * The playback lab: the registered scenes driven by a generated profile.
 * `sceneId` previews one scene on its own; an unknown id plays them all.
 */
export function LabScenes({ sceneId }: { sceneId?: string }) {
  const router = useRouter();
  const data = useMemo(() => labSceneData(), []);
  const scenes = useMemo(() => {
    const only = SCENES.filter((scene) => scene.id === sceneId);
    if (sceneId && only.length === 0) {
      console.warn(
        `Unknown lab scene "${sceneId}". Playing all: ${SCENES.map((scene) => scene.id).join(", ")}.`,
      );
    }
    return only.length > 0 ? only : SCENES;
  }, [sceneId]);
  return (
    <Sequencer
      key={scenes.map((scene) => scene.id).join()}
      data={data}
      scenes={scenes}
      finale={FINALE}
      onCancel={() => router.push("/")}
      caption={`Lab. Generated profile, ${data.model.plan.years.length} years of contributions. Turn sound on.`}
    />
  );
}
