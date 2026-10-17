"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  checkInput,
  LOOKUP_DEBOUNCE_MS,
  type LookupState,
  lookupLogin,
  lookupMessage,
  type PreviewUser,
} from "@/features/search/lookup";
import { actionClass, focusRing, pressable } from "@/ui/classes";
import { swatchClass } from "./palette";
import { MAX_DEVELOPERS } from "./parseVersusLogins";
import { addRival } from "./rivals";

type RivalsRowProps = {
  /** The developer in the question: P1. */
  main: PreviewUser;
  rivals: readonly PreviewUser[];
  onChange: (rivals: PreviewUser[]) => void;
  /** Start with the rival input open (arriving from "Challenge someone"). */
  initialOpen?: boolean;
};

const DUPLICATE = "Already in the lineup.";
const FULL = `Up to ${MAX_DEVELOPERS} developers.`;

/**
 * The versus rivals: removable pills in the versus palette (P2..P5) and a
 * "+ vs" control that opens an input. A rival is added with Enter after the
 * same exact-username preview lookup the question uses; nothing else is
 * fetched. Enter never reaches the surrounding form, so it cannot start Play.
 */
export function RivalsRow({
  main,
  rivals,
  onChange,
  initialOpen = false,
}: RivalsRowProps) {
  const [open, setOpen] = useState(initialOpen);
  const [value, setValue] = useState("");
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const removeRefs = useRef(new Map<string, HTMLButtonElement>());
  const full = 1 + rivals.length >= MAX_DEVELOPERS;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const check = checkInput(value);
    if (check.kind === "empty") {
      setState({ kind: "idle" });
      return;
    }
    if (check.kind === "invalid" || check.kind === "reserved") {
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
  }, [value]);

  function close() {
    setOpen(false);
    setValue("");
    setNote(null);
  }

  function commit() {
    if (state.kind !== "found") {
      setNote(value.trim() === "" ? null : "Wait for the match first.");
      return;
    }
    const result = addRival(
      main.login,
      rivals.map((rival) => rival.login),
      state.user.login,
    );
    if (result.kind === "duplicate") {
      setNote(DUPLICATE);
      return;
    }
    if (result.kind === "full") {
      setNote(FULL);
      return;
    }
    onChange([...rivals, state.user]);
    close();
    // The input is gone: keep the keyboard on this row. When the lineup is
    // now full "+ vs" is gone too, so land on the newest pill's remove.
    const newest = state.user.login.toLowerCase();
    setTimeout(() => {
      (addRef.current ?? removeRefs.current.get(newest))?.focus();
    }, 0);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.nativeEvent.isComposing) return;
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  const message =
    note ??
    (state.kind === "found"
      ? `Found @${state.user.login}. Press Enter to add.`
      : lookupMessage(state as Exclude<LookupState, { kind: "found" }>));

  return (
    <div className="flex flex-col gap-1 font-mono text-xs wide:gap-2">
      <ul
        className="flex flex-wrap items-center gap-1.5 wide:gap-2"
        aria-label="Rivals"
      >
        {rivals.map((rival, index) => (
          <li
            key={rival.login.toLowerCase()}
            className="flex min-h-8 items-center gap-2 border-2 border-ink bg-paper pr-0.5 pl-2 wide:min-h-9 wide:pr-1"
          >
            <span
              aria-hidden="true"
              className={`size-3 shrink-0 ${swatchClass(index + 1)}`}
            />
            {/* biome-ignore lint/performance/noImgElement: a 24px remote avatar needs no optimizer */}
            <img
              src={rival.avatarUrl}
              alt=""
              width={24}
              height={24}
              className="hidden size-6 shrink-0 bg-paper object-cover wide:block"
            />
            <span className="max-w-[10ch] truncate wide:max-w-[12ch]">
              @{rival.login}
            </span>
            <button
              type="button"
              aria-label={`Remove @${rival.login}`}
              ref={(node) => {
                const key = rival.login.toLowerCase();
                if (node) removeRefs.current.set(key, node);
                else removeRefs.current.delete(key);
              }}
              onClick={() => {
                onChange(rivals.filter((other) => other !== rival));
                // Next pill's remove button, else "+ vs".
                const next = rivals[index + 1];
                setTimeout(() => {
                  (next
                    ? removeRefs.current.get(next.login.toLowerCase())
                    : addRef.current
                  )?.focus();
                }, 0);
              }}
              className={`inline-flex size-7 items-center justify-center hover:bg-ink wide:size-9 hover:text-paper ${pressable} ${focusRing}`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
        {!open && !full && (
          <li>
            <button
              type="button"
              ref={addRef}
              onClick={() => setOpen(true)}
              className={`${actionClass} min-h-9`}
            >
              + vs
            </button>
          </li>
        )}
        {open && (
          <li className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setNote(null);
              }}
              onKeyDown={onKeyDown}
              aria-label="Rival login"
              aria-describedby="rival-status"
              placeholder="@rival"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`min-h-9 w-32 border-2 border-ink bg-paper px-2 outline-none focus:border-block-ultramarine ${focusRing}`}
            />
            <button
              type="button"
              aria-label="Cancel adding a rival"
              onClick={close}
              className={`inline-flex size-9 items-center justify-center border-2 border-ink hover:bg-ink hover:text-paper ${pressable} ${focusRing}`}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        )}
      </ul>
      <p
        id="rival-status"
        role="status"
        className="line-clamp-2 min-h-0 empty:hidden"
      >
        {open ? message : ""}
      </p>
    </div>
  );
}
