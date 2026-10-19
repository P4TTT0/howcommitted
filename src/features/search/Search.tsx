"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { recordIntent } from "@/features/experience/intent";
import { versusPath } from "@/features/versus/parseVersusLogins";
import { RivalsRow } from "@/features/versus/RivalsRow";
import { rivalsFor } from "@/features/versus/rivals";
import { interaction } from "@/playback/sound/interaction";
import { preloadAudio, unlockAudio } from "@/playback/unlock";
import { actionClass } from "@/ui/classes";
import { StartButton } from "@/ui/StartButton";
import {
  canRetry,
  checkInput,
  LOOKUP_DEBOUNCE_MS,
  type LookupState,
  lookupLogin,
  lookupMessage,
  type PreviewUser,
} from "./lookup";
import { PlayerCard } from "./PlayerCard";
import { PlayerColumn } from "./PlayerColumn";
import { PreviewRow } from "./PreviewRow";
import { consumePrefill } from "./prefill";
import { useTypingPlaceholder } from "./useTypingPlaceholder";
import { useWideLayout } from "./useWideLayout";
import { parseVsParam } from "./vsParam";

const NUDGE = "Type a GitHub username first.";

function warmUpAudio() {
  void preloadAudio().catch(() => {});
}

/**
 * The landing question: "How committed is @[input]?". Debounced exact-username lookup with a preview. Only the
 * preview is fetched here; the history waits for the click (fetch on intent),
 * which also unlocks audio before navigating to the experience.
 */
export function Search({ versus = true }: { versus?: boolean }) {
  const router = useRouter();
  const [rivalPicks, setRivalPicks] = useState<PreviewUser[]>([]);
  const [value, setValue] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [openRivals, setOpenRivals] = useState(false);
  const { text: placeholder, example } = useTypingPlaceholder(
    value === "" && !focused,
  );
  const wide = useWideLayout();
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [fieldWidth, setFieldWidth] = useState<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the lookup on retry
  useEffect(() => {
    const check = checkInput(value);
    if (check.kind === "empty") {
      setState({ kind: "idle" });
      return;
    }
    if (check.kind === "invalid" || check.kind === "reserved") {
      // Stay quiet while typing; complain once the typing pauses.
      setState({ kind: "idle" });
      const timer = setTimeout(
        () =>
          setState(
            check.kind === "invalid"
              ? { kind: "invalid" }
              : { kind: "reserved", login: check.login },
          ),
        LOOKUP_DEBOUNCE_MS,
      );
      return () => clearTimeout(timer);
    }

    setState({ kind: "looking", login: check.login });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const next = await lookupLogin(check.login, controller.signal);
      if (next && !controller.signal.aborted) setState(next);
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, attempt]);

  const found = state.kind === "found" ? state.user : null;
  const rivalLogins = found
    ? rivalsFor(
        found.login,
        rivalPicks.map((rival) => rival.login),
      )
    : [];
  const rivals = rivalPicks.filter((rival) =>
    rivalLogins.includes(rival.login),
  );
  const rivalsRow =
    versus && found ? (
      <RivalsRow
        main={found}
        rivals={rivals}
        onChange={setRivalPicks}
        initialOpen={openRivals}
      />
    ) : null;

  // Back from a cancelled experience: the same developer, ready to go.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once on mount
  useEffect(() => {
    const challenged = parseVsParam(window.location.search, versus);
    if (challenged) {
      // "Challenge someone": this developer as P1, rival input ready.
      setValue(challenged);
      setOpenRivals(true);
      return;
    }
    const login = consumePrefill();
    if (login) setValue(login);
  }, []);

  // A found user is the likely next click: have the audio engine ready.
  useEffect(() => {
    if (found) warmUpAudio();
  }, [found]);

  async function start() {
    if (!found || starting) return;
    setStarting(true);
    interaction.click();
    // Called before any await so the click still counts as the user gesture.
    const unlocked = await unlockAudio();
    const logins = [found.login, ...rivalLogins];
    const path = versusPath(logins);
    if (unlocked) recordIntent(logins.join("/"));
    router.push(path);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Not found yet: say so politely instead of doing nothing silently.
    if (!found && state.kind === "idle") setNudge(true);
    void start();
  }

  const statusText =
    nudge && state.kind === "idle"
      ? NUDGE
      : lookupMessage(state as Exclude<LookupState, { kind: "found" }>);
  // The field is as wide as the name it shows: what was typed, else the full
  // example being typed. It changes once per name, with a short glide.
  const sizer = value || example;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `sizer` is the text being measured
  useLayoutEffect(() => {
    const node = sizerRef.current;
    if (!node) return;
    const measure = () => setFieldWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [sizer]);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col wide:flex-row wide:items-center wide:justify-between wide:gap-[4vw]"
    >
      <div className="flex min-w-0 flex-col gap-[clamp(10px,3dvh,28px)]">
        <div className="font-display text-[clamp(40px,min(12vw,16dvh),200px)] wide:text-[clamp(40px,min(7.5vw,16dvh),200px)] font-black uppercase leading-[0.86] max-sm:text-[max(24px,min(15.5vw,9dvh))]">
          <label
            id="ask-how"
            htmlFor="login"
            className="block whitespace-nowrap"
          >
            <span className="max-sm:block">How</span>{" "}
            <span className="max-sm:block">committed</span>
          </label>
          <span id="ask-rest" className="sr-only">
            is GitHub username
          </span>
          <span className="flex max-w-full items-baseline max-sm:text-[0.55em]">
            <span aria-hidden="true">is&nbsp;@</span>
            <span
              style={fieldWidth === null ? undefined : { width: fieldWidth }}
              className="inline-grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)] items-baseline motion-safe:transition-[width] motion-safe:duration-250 motion-safe:ease-out"
            >
              {/* Sizer: the field is as wide as what it shows, like part of the sentence. */}
              <span
                ref={sizerRef}
                aria-hidden="true"
                className="invisible w-max col-start-1 row-start-1 whitespace-pre pr-[0.04em]"
              >
                {sizer}
              </span>
              <input
                id="login"
                name="login"
                type="text"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setNudge(false);
                }}
                onFocus={() => {
                  setFocused(true);
                  warmUpAudio();
                }}
                onBlur={() => setFocused(false)}
                placeholder={placeholder}
                aria-labelledby="ask-how ask-rest"
                aria-describedby="lookup-status"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="col-start-1 row-start-1 w-0 min-w-full rounded-none border-0 border-b-[length:min(0.07em,8px)] border-ink bg-transparent p-0 font-[inherit] uppercase text-[inherit] caret-block-ultramarine outline-none placeholder:text-ink placeholder:opacity-40 focus:border-block-ultramarine focus:shadow-[0_3px_0_0_var(--color-block-ultramarine)]"
              />
            </span>
            <span aria-hidden="true">?</span>
          </span>
        </div>

        <div className={`font-mono text-sm ${found && wide ? "" : "min-h-14"}`}>
          <div className="flex flex-wrap items-center gap-3">
            {/* The live region stays outside the button; it is read, not shown, when found. */}
            <p
              id="lookup-status"
              role="status"
              className={found ? "sr-only" : "flex min-h-14 items-center"}
            >
              {found ? `Found @${found.login}` : statusText}
            </p>
            {found ? (
              wide ? null : (
                <div className="flex w-full flex-wrap items-start gap-x-3 gap-y-2">
                  <PreviewRow
                    user={found}
                    disabled={starting}
                    onStart={start}
                  />
                  {rivalsRow && (
                    <div className="min-w-48 flex-1">{rivalsRow}</div>
                  )}
                </div>
              )
            ) : (
              canRetry(state) && (
                <button
                  type="button"
                  onClick={() => {
                    interaction.click();
                    setAttempt((count) => count + 1);
                  }}
                  className={`${actionClass} min-h-11`}
                >
                  Try again
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <StartButton
            type="submit"
            tone="ink"
            size="cta"
            aria-disabled={!found || starting}
            aria-label={found ? `Play @${found.login}` : undefined}
            onPointerEnter={() => interaction.hover(0.5, "play")}
            onPointerLeave={() => interaction.leave()}
          >
            Play
          </StartButton>
          <p className="max-w-[48ch] font-mono text-[15px] leading-relaxed">
            Type a GitHub username. Their contribution history plays as sound
            and motion, year by year. Headphones on.
          </p>
        </div>
      </div>

      <PlayerColumn>
        {found && wide && (
          <>
            <PlayerCard user={found} disabled={starting} onStart={start} />
            {rivalsRow}
          </>
        )}
      </PlayerColumn>
    </form>
  );
}
