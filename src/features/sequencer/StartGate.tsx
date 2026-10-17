import type { ReactNode } from "react";
import { StartButton } from "@/ui/StartButton";

export type StartPhase = "start" | "loading" | "running";

type StartGateProps = {
  phase: StartPhase;
  /** The scene starts by itself; show `starting` instead of the button. */
  autoStart: boolean;
  failed: boolean;
  starting: ReactNode;
  caption: string;
  onBegin: () => void;
};

/** Overlay in front of the scene until it is playing. */
export function StartGate({
  phase,
  autoStart,
  failed,
  starting,
  caption,
  onBegin,
}: StartGateProps) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-paper p-4 pb-20">
      {autoStart && !failed ? (
        starting
      ) : (
        <>
          <StartButton onClick={onBegin} disabled={phase === "loading"} />
          <p className="max-w-prose text-center font-mono text-xs">
            {phase === "loading" ? "Loading sound" : caption}
          </p>
        </>
      )}
      {failed && (
        <p role="alert" className="font-mono text-xs">
          Playback could not start. Try again.
        </p>
      )}
    </div>
  );
}
