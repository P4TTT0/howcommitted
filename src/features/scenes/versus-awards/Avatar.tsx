"use client";

import { useState } from "react";

/**
 * The developer's GitHub avatar in a circle, over their initial in a paper
 * circle: if the picture fails to load, the initial is what shows.
 */
export function Avatar({ login }: { login: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      aria-hidden="true"
      className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper font-display text-[22px] font-black uppercase leading-none text-ink"
    >
      {login.charAt(0)}
      {!failed && (
        // biome-ignore lint/performance/noImgElement: a 40px remote avatar needs no optimizer
        <img
          src={`https://github.com/${encodeURIComponent(login)}.png?size=80`}
          alt=""
          width={40}
          height={40}
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
