import * as Tone from "tone";

const BASE_URL = "/sounds/";

/** Fade applied when a voice is cut, to avoid clicks. */
const CUT_FADE_SECONDS = 0.02;

export type SampleFormat = "ogg" | "mp3";

/** Vorbis when the browser can decode it, MP3 otherwise. */
export function pickFormat(
  canPlayType: (type: string) => string,
): SampleFormat {
  return canPlayType('audio/ogg; codecs="vorbis"') === "" ? "mp3" : "ogg";
}

/** Loads named samples as ogg, or mp3 when the browser cannot decode ogg. */
export function loadSamples(
  names: readonly string[],
): Promise<Tone.ToneAudioBuffers> {
  const format = pickFormat((type) =>
    document.createElement("audio").canPlayType(type),
  );
  const urls = Object.fromEntries(
    names.map((name) => [name, `${name}.${format}`]),
  );
  return new Promise((resolve, reject) => {
    const buffers = new Tone.ToneAudioBuffers({
      urls,
      baseUrl: BASE_URL,
      onload: () => resolve(buffers),
      onerror: (error) => reject(error),
    });
  });
}

export type Pool = Tone.ToneBufferSource[];

export type SamplePlay = {
  time: number;
  /** Playback-rate multiplier; 1 plays the recording as recorded. */
  rate: number;
  db: number;
};

/**
 * Plays a fresh one-shot source. Every hit is a new `ToneBufferSource`; a
 * reused `Player` breaks when a long sample is still ringing at its next
 * scheduled start. `limit` is the voice limit: past it, the oldest voice in
 * the pool is cut.
 */
export function playSample(
  pool: Pool,
  limit: number,
  out: Tone.ToneAudioNode,
  buffer: Tone.ToneAudioBuffer,
  { time, rate, db }: SamplePlay,
): void {
  if (pool.length >= limit) pool.shift()?.stop(time);
  const source = new Tone.ToneBufferSource({
    url: buffer,
    playbackRate: rate,
    fadeOut: CUT_FADE_SECONDS,
    onended: () => {
      const index = pool.indexOf(source);
      if (index !== -1) pool.splice(index, 1);
      source.dispose();
    },
  });
  source.connect(out);
  pool.push(source);
  source.start(time, 0, undefined, Tone.dbToGain(db));
}

export function disposePools(pools: Record<string, Pool>): void {
  for (const pool of Object.values(pools)) {
    for (const voice of pool) voice.dispose();
    pool.length = 0;
  }
}

/** Stops every voice in every pool at `time`; the source fade avoids clicks. */
export function stopPools(pools: Record<string, Pool>, time: number): void {
  for (const pool of Object.values(pools)) {
    for (const voice of pool) voice.stop(time);
    pool.length = 0;
  }
}
