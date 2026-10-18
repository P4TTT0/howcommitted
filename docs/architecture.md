# Architecture

Scaffolding is in place (Next.js, Tailwind, Biome, Vitest, Playwright, CI). `domain/`, `github/` and the API routes are implemented. The solo vertical slice works end to end: landing search (`features/search`), `/{login}` (`features/experience`) and a scene sequencer (`features/sequencer`) playing the timeline (year blocks under the running total line) driven by real history, then the heatmap, then the end card (`features/scenes`). `/lab` keeps the generated profile for playback work outside production. GitHub sign-in works (see Auth). Versus plays through the same sequencer outside production (see Scenes and the sequencer); share is not built yet.

## Stack

| Piece | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) + TypeScript on Vercel | Server routes keep the GitHub token off the client; preview deploys per PR |
| Cache | Upstash Redis | Shared cache across serverless instances; also used for rate limits and locks |
| Math | d3-scale, d3-shape | Math only; rendering stays in our hands |
| Rendering | SVG / Canvas | Enough for flat 2D blocks and lines |
| Animation | GSAP | Precise timeline control |
| Audio | Tone.js | Its Transport clock syncs visuals and sound |
| Styling | Tailwind CSS v4 | Utility CSS with design tokens, no runtime |
| Tooling | pnpm, Biome, Vitest, Playwright | |

Not in the MVP (deliberate scope decision): Three.js/WebGL, a database, a global state library.

## Folder structure

```
src/app/              Thin Next routes only
  page.tsx            Landing
  [...users]/page.tsx /torvalds = solo; /a/b/c = versus (404 until it exists)
  [...users]/opengraph-image.tsx (planned)
  api/user/[login]/       Exact-login preview, rate limited per IP
  api/history/[login]/    Full profile history (cache, coalescing, quota)
  api/auth/github/        Sign-in start; callback/ finishes it
  api/auth/signout/       POST, clears the session cookie
  lab/page.tsx            Playback lab: previews and local dev only, 404 in production
src/domain/           Pure TS types and metrics
src/github/           Server-only GraphQL client, queries, cache
src/playback/         One clock driving GSAP and Tone.js (clock.ts), pure scheduling
                      helpers (aggregate, schedule, pitch), sound/ engine
src/features/         search (landing lookup), experience (/{login} states), sequencer (scene
                      contract, player, shared plan model), scenes (registry, one folder per
                      scene), stats, versus
src/ui/               Shared presentational components
public/sounds/        Kenney CC0 chip samples as .ogg with .mp3 fallback, CREDITS.md
e2e/                  Playwright
.github/              workflows/ci.yml, pull_request_template.md, ISSUE_TEMPLATE (planned)
.env.example          Required env vars
biome.json            Lint and format config
LICENSE               MIT
```

GitHub usernames cannot contain "/", so path segments map unambiguously to users.

Reserved logins: `lab` and `api` collide with app routes (static routes win over the catch-all), so those users cannot be opened at `/{login}`. `parseSoloLogin` rejects them explicitly (404) and the landing search refuses them before any request. Add a name to `RESERVED_LOGINS` in `domain/login.ts` whenever a top-level route is added.

Client flow: the landing click calls `unlockAudio()` (`playback/unlock.ts`) and navigates client-side, so the AudioContext stays running on `/{login}`, which then starts by itself. A fresh load (shared link, reload) shows the start button first. The history is fetched on intent only (see [product.md](product.md)); the preview alone never costs a generation. Auto start needs a one-shot intent recorded only by the landing click (`features/experience/intent.ts`, sessionStorage); back/forward, reloads and shared links show the start button even when audio is still unlocked. Tone.js loads lazily on the landing (`preloadAudio` on input focus) and is started synchronously inside the click. `features/sequencer/model/historyPlan.ts` maps `History` to the scene plan: daily calendar contributions (public and shared private) drive the line, the calendar's yearly totals drive the displayed total and year blocks, and contributions a year's calendar total has beyond its daily detail become one explicit unattributed step at the end of that year (dashed segment, label, soft cue, note), never scaled or spread across days.

### Scenes and the sequencer

`features/sequencer` plays an ordered list of scenes on the one `PlaybackClock`, then the finale. The clock is re-armed per scene (`clock.loadScene`), so there is a single Transport, status stream and visibility handler for the whole run. The sequencer owns the start gate, the sound engine, the controls (pause, previous/next scene, speed, mute, cancel and their keyboard shortcuts), the progress bar with clickable scene ticks, the explore phase and the hand-off from one scene to the next. Speed goes through the clock, so sound and visuals always scale together. A scene never owns any of that.

A scene is a `SceneDefinition` (`sequencer/types.ts`): `{ id, label, create(data) }`. `create` receives `SceneData` (`login`, the history `model` with the plan, calendar year blocks and notes, and the full `history` when available) and returns `null` to be skipped, or a `SceneInstance`: `duration`, `bpm`, `view` (static markup that fills the stage and is correct in its finished state) and `mount(root, runtime)`. `mount` runs once the view is in the DOM: schedule sound with `runtime.clock.at`, drive visuals from `runtime.clock.onFrame` (or `drive` for a paused GSAP timeline), read `runtime.sound()` and `runtime.reducedMotion`, and return a cleanup. No timers or loops of its own (rule 3). A scene that throws while being built is skipped.

To add a scene (3 to 5):

1. Create `features/scenes/<id>/` with the view, a `mount`, pure helpers and colocated tests, and export a `SceneDefinition` from `index.tsx`.
2. Add one import line and one entry line to `SCENES` in `features/scenes/registry.ts`, where it plays. Nothing else changes, not the sequencer.
3. Preview it alone at `/lab?scene=<id>`.

The final poster owns the single `FINALE` line in the registry (`render(data, { replay })`) and the `features/scenes/finale/` folder. Today it is the end card. Shared plan code (`Plan`, `planFromHistory`, formatting, the lab's fake profile) lives in `features/sequencer/model/`, so the contract imports nothing from a specific scene.

Versus (2 to 5 developers, outside production) reuses the sequencer unchanged apart from one seam: `SceneData.versus?`, the developers in the order they were added (`login` plus `HistoryPlan`), with the solo fields describing the first one. `registry.ts` exports `VERSUS_SCENES` (`versus-race`: cumulative contributions as bars in fixed lanes on one shared timeline, never re-sorted, no leader or rank) and `VERSUS_FINALE` (`versus-finale`: a side-by-side summary and the fixed line). `features/versus/VersusExperience` loads the histories on intent, builds that `SceneData` and mounts the `Sequencer`; the solo scenes are untouched and the versus scenes return `null` without `versus`.

### Scene checklist

- **Data.** `SceneData` holds `login`; `model` (`HistoryPlan` from `planFromHistory`: the daily calendar `plan`, calendar `yearBlocks`, first/last year, honest `note`, `privateContributions`); and `history`, the full API payload (languages, totals, repo flags, per-year heatmap), or `null` in the lab. Scenes read it and never fetch. Count contributions, never commits, and keep the "+N not attributed to a day" and private-share notes honest. Needing `history` in the lab: return `null` from `create`, or build the scene from `model` only.
- **Size.** `view` fills the stage (`absolute inset-0` of the box above the controls). The landing's no-scroll rule does not apply, but the stage must fit the viewport on a portrait phone and a landscape desktop: size type from `vw`/`dvh`, not breakpoints. The view is static, correct in its finished state; if `mount` measures the DOM, re-measure on resize and disconnect the observer in the cleanup.
- **Sound.** Always `runtime.sound()?.` (it can be null: samples failed, lab). Schedule with `clock.at` on the grid, aggregated (no sound per commit), never before the Play gesture (the sequencer starts the clock after it). Honor `runtime.reducedMotion`.
- **Explore.** A finished scene holds; the sequencer never moves on by itself. Going back or jumping to an already played scene lands there too: `mount` runs, the clock is put at the end without sound, then the optional `explore(root, runtime)` runs. Make the chart interactive there (pointer and keyboard, every exact value readable by assistive tech, for example a focusable element with `aria-valuetext`) and return a cleanup. No sound and no timers; pointer readouts are instant DOM updates, anything that moves goes through the clock. Call `stopPropagation` on arrow keys inside a focused chart, since the same keys change scene. Without `explore` the scene just shows its final state. `timeline` and `heatmap` are the reference implementations.
- **Mount.** Build everything that can throw first and schedule sound last: a throwing `mount` is logged in development and the scene is dropped, but it must not leave subscriptions behind. Return a cleanup for everything else. No timers or loops of your own.
- **Tests.** `create` is a plain function: call it with a `SceneData` (for example `labSceneData()` or a `HistoryPlan` built from `src/test-support/historyFixture`) and assert the `duration`, and that it returns `null` when there is nothing to show. Keep the timing and layout maths in pure helpers with tests, as `timeline/years.ts` does.
- **Lab.** `/lab?scene=<id>` plays one scene on the generated profile; an unknown id warns in the console and plays all. The e2e spec derives the scene count from the progress ticks, so nothing to bump.

Rules:

1. `domain/` is pure: no React, no fetch, no Next.
2. `github/` never reaches the browser. It starts with `import "server-only"`, so importing it client-side fails the build. The token is protected by design.
3. `playback/` owns the single clock. Components never animate on their own clock.
4. Tests are colocated (`streaks.ts` next to `streaks.test.ts`).

This is deliberately not full hexagonal: there is a single data source. A `gitlab/` sibling could be added later without touching `domain/`.

## Data pipeline

GitHub GraphQL with a server token. Costs measured live in October 2026 against a 16-year profile.

| Step | Query | Cost | Time |
|------|-------|------|------|
| Preview | `user(login){login name avatarUrl createdAt contributionsCollection{contributionYears}}`. Exact lookup, no search API | 1 point | ~0.6 s |
| Contributions | One request per contribution year, in parallel (concurrency cap ~6): totals (commits, PRs, reviews, issues, restricted/private count) and the calendar from a full-year window, plus, from four quarter windows, `commitContributionsByRepository(maxRepositories:100){contributions(first:100){nodes{occurredAt commitCount}}}`, summed by date for true commits per day | 1 point each | ~1.8 s each |
| Repos | `repositories(ownerAffiliations:OWNER, isFork:false, privacy:PUBLIC, orderBy CREATED_AT, first:100)`, paginated, with `createdAt`, `stargazerCount`, `languages(first:10 by SIZE)` | 1 point | ~2.2 s |

For the measured year (2023), summed daily commits matched `totalCommitContributions` exactly (4,458).

Profile cost is about contribution years + 2 points, so about 280 uncached profiles per hour for a 16-year profile, and about 500 for an 8-year profile (per 5,000-point token).

Public repositories only: the repos query filters `privacy: PUBLIC`, so no token (a visitor's or the server PAT) can put a private repository's name, dates, stars or languages in the shared cache. No other query reads repository details.

### Gotchas

- A single 16-year query timed out (502 after about 11 s). GitHub kills requests over 10 s and deducts extra points. Hence one request per year.
- `contributionsCollection` `from`/`to` spans at most 1 year.
- `contributionCalendar` counts all contribution types (2023 example: calendar 4,924 vs commits 4,458). Never label it as commits.
- Per-repo daily nodes cap at 100 per `contributionsCollection` window, so a repo with commits on more than 100 days in a year was under-counted (torvalds 2024: 888 summed vs 2,888 official). Each year is therefore fetched as 4 quarters in one query (same 1-point cost), with totals and calendar from a full-year alias.
- `maxRepositories` caps at 100 repos per quarter window, so a repo outside the top 100 in a quarter can still cause a mismatch. Compare summed daily commits against the official total; if they differ, show the real total with a notice.
- Live check (2026-10-17): for torvalds, mngobbi and gaearon in 2016, 2023 and 2025, the sum of the in-range calendar `contributionCount` equals `contributionCalendar.totalContributions` exactly (for example gaearon 2016: 7,009 = 7,009; mngobbi 2025: 1,002 = 1,002), and the calendar returned no days outside the requested year with a full-year `from`/`to`. `fetchYear` still drops days outside the year defensively, and the "not attributed to a day" step stays as a safety net.
- Private contributions appear only if the user enabled sharing them. They are inside the calendar's daily counts and total (as an unknown type); never invent their dates or types. The experience plays the calendar, so `restrictedContributionsCount` is only used to state the private share honestly.

### History response (contributions)

Each year of `History` carries the experience's data from the calendar: `dailyContributions: {date, count}[]` (days with at least one contribution) and `totalContributions` (the calendar's own yearly total). `History.totalContributions` sums them and each `yearBlocks` entry is `{year, contributions}`. The public-commit data (`dailyCommits`, `reconciliation`, `totals.commits` and the PR/review/issue/private breakdown) stays in the payload for later scenes, but the line, counter, year blocks and milestones no longer depend on it.

### GraphQL limits

| Limit | Value |
|-------|-------|
| Primary | 5,000 points/hour per user token |
| Secondary | 2,000 points/minute |
| Concurrency | 100 concurrent requests |
| Timeout | 10 s |

## Caching

Upstash Redis, with a versioned key prefix.

| Data | TTL | Reason |
|------|-----|--------|
| User preview | 24 h | Changes rarely, cheap to refresh |
| Past years | 30 days | The past does not change |
| Current year | 6 h fresh, kept 7 days | Still changing. After 6 h it is served stale and refreshed after the response (`after()`); the current year is also fetched when the cached preview does not list it. A year cached before it ended is refreshed after Jan 1, and a failed refresh pauses refreshes for 5 min |
| Repos | 24 h | New repos are infrequent |
| "User not found" | 1 h | Negative cache |

Key format (bumping the version in `cache.ts` invalidates cached data; v2 dropped entries with truncated daily commits; v3 added the calendar total per year (`totalContributions`), so older entries without it are never read. Lock, breaker and quota keys are versioned separately and stay `v1`):

- `v3:user:{login}`
- `v3:year:{login}:{year}`
- `v4:repos:{login}` (v4 because v3 entries came from a query without the public-only filter)

Logins are lowercased in keys. Supporting keys: `v3:missing:{login}` (negative cache, 1 h), `v3:failed:{login}` (last failed generation, 30 s), `v1:lock:{login}` (coalescing lock, 75 s, released with a compare-and-delete script), `v1:budget:server` (last token budget for the circuit breaker) and `v1:quota:*` (quota counters and rate limits). The optional `CACHE_KEY_PREFIX` env var is prepended to every key (for example `preview:v3:user:{login}`).

## Quota and rate limits

- Cached profiles are free and unlimited for everyone.
- Anonymous visitors get 2 cold generations per day. The optional `QUOTA_COLD_PER_DAY` env var overrides it (a whole number; 0 turns anonymous cold runs off): previews set it higher for testing, production keeps the default. A generation is cold only when no year and no repos are cached (a cached preview does not count, so preview then history is still charged); completing partial data or refreshing a year is free. A failed generation refunds the run, except for unknown users, so probing logins is not free. Each identity is charged first and checked after, and everything is rolled back when either is over its limit, so concurrent requests cannot exceed the limit. Cold attempts are also limited per IP per minute. Only after the runs are used is the GitHub sign-in prompt shown, never upfront.
- Identity: the signed `hc_visitor` cookie (HMAC with `QUOTA_COOKIE_SECRET`, at least 32 characters) plus the client IP. The IP comes from `x-real-ip`, then `x-vercel-forwarded-for`, then `x-forwarded-for`, validated as an IP. IPv6 clients are keyed by their /64. Requests with no usable IP count against the cookie only for cold runs and share stricter preview and cold-attempt limits. Visitors behind a shared IP (offices, CGNAT) share its daily runs. The header trust above assumes Vercel; self-hosting needs a trusted proxy that sets `x-real-ip` itself.
- The cookie and IP quota is a soft gate (bypassable by clearing cookies or using a VPN). The global circuit breaker is the hard gate.
- Signed-in visitors skip the anonymous quota and use their own token (5,000 points/hour each) for cold generations of other people's profiles; they skip the coalescing lock (their result is never shared, so queueing others behind it would only add waiting), and what their token fetches is never written to the shared cache (it may see data an anonymous visitor cannot), so a cold profile fetched this way is not cached for anyone. Their own profile is the exception: it is fetched with the server token (so it is under the breaker) and cached as usual. Uncached previews still use the server token. A failure of a visitor's own token is never cached for others.
- Global circuit breaker: when the server token's remaining points drop below 20%, anonymous cold generations and uncached previews stop (cache only, plus the sign-in prompt). It protects the server token only: a signed-in visitor is not stopped by it, and their own token's budget and rate limits never open or close it nor reach the shared failure marker.
- The breaker reads `rateLimit { cost remaining limit resetAt }` from every GitHub response, keeps the lowest value reported per window, and opens at once on a rate limit error (reset time from GitHub, or 60 s). It closes again once the reported window resets. Open and close transitions are logged.
- Request coalescing: a Redis lock ensures simultaneous requests for the same uncached profile trigger one fetch. Other requests poll the lock with 0.5 to 2 s jittered backoff, then read the cache (or the leader's failure, kept for 30 s so nobody retries a failing upstream). One 50 s deadline covers waiting and fetching; past it, or with under 5 s left when a waiter wins the lock, they answer `degraded` (503). `maxDuration` of the history route is 60 s.
- A cold generation stops launching years and aborts in-flight requests on the first rate limit or timeout. Years that already landed stay cached, so a retry only pays for the rest.
- Per-IP rate limit on preview lookups (30 per minute).
- Results are typed and never thrown to the route: `login_required` (401), `degraded` (503, reasons `circuit_open`, `busy`, `store_down`), `rate_limited` (429), `timeout` (504), `upstream_error` (502), `not_found` (404). Redis failures fail closed for cold generations (`store_down`); cache read errors count as misses and cache write errors never lose a good result.
- The history response also carries `reposTruncated` when the owner has more repositories than the 10 pages we read. Each generation logs one JSON line (status, source, years, ms, remaining, cost).
- When degraded, show a playful message (for example "GitHub needs a breather"). Nothing breaks.
- Never pool tokens from multiple accounts; it violates GitHub terms.

## Auth

"Sign in with GitHub", public data only (no extra scopes). No database. The token lives in an encrypted httpOnly cookie.

Gate copy: "Free runs used. Sign in with GitHub to keep going — it uses your own quota, and we only read public data."

It appears only after the free runs are used (the `login_required` 401), never upfront, as one small link (`features/experience/SignInLink.tsx`) on the failed screen.

### Flow

1. `GET /api/auth/github?returnTo=/ada` mints a random `state`, stores it with the return path in a sealed `hc_oauth` cookie (HttpOnly, SameSite=Lax, 10 minutes, path `/api/auth`) and redirects to GitHub's authorize URL. No `scope` and no `redirect_uri` are sent: public data only, and GitHub uses the callback registered on the app.
2. `GET /api/auth/github/callback` verifies `state` against the cookie in constant time before anything else (a mismatch, a missing or an expired cookie is a 400 and the code is never redeemed), exchanges the code server side, looks up the token's owner (`GET /user`), and stores token and login in the sealed `hc_session` cookie. It then redirects to the return path. Denied access, a failed exchange or an unknown owner returns to the page with no session.
3. `POST /api/auth/signout` revokes the token at GitHub (`DELETE /applications/{client_id}/token`, basic auth with the app credentials; best effort with a 3 s timeout, never blocks or fails the sign-out, never logs the token), clears `hc_session` and redirects. It refuses a cross-site `Origin`, and a request with no `Origin` unless `Sec-Fetch-Site` is `same-origin`.

Both the start and the callback are rate limited per IP (10 per minute, 3 for requests with no usable IP; Upstash sliding window like the other limits), before anything reaches GitHub, so a replayed state cannot make the server hammer GitHub's token endpoint.

### Privacy: the viewer's own profile

The session stores the viewer's login. When the requested login equals it (case-insensitive), the history is fetched with the server token, never the visitor's, so owner-only data (for example private contribution counts the owner has not made public) cannot reach the shared cache; the visitor still skips the anonymous quota, and the breaker applies as for any server-token fetch. A session without a stored login counts as anonymous.

`returnTo` only accepts a same-origin path made of URL-safe characters, not starting with `//` and not under `/api/`; anything else becomes `/` (checked at sign-in and again at the callback).

### Session cookie

`hc_session` holds the visitor's own GitHub token, sealed with AES-256-GCM (`github/seal.ts`, `node:crypto`: no extra dependency, and cookies are only handled by Node route handlers). The key is derived with HKDF from `AUTH_COOKIE_SECRET` per purpose, the purpose is bound as additional authenticated data, and the expiry lives inside the ciphertext, so a tampered, truncated, expired or cross-purpose value is rejected. HttpOnly, SameSite=Lax, Secure in production, 7 days. The token never reaches the browser, a response body or a log line, and each request only ever uses the token in its own cookie (tokens are never pooled).

A token GitHub rejects (revoked, expired) clears the cookie and the request is served as anonymous, never a 500: cached data, or the anonymous quota, or the sign-in prompt again. A missing `AUTH_COOKIE_SECRET` with a session cookie present is logged and treated as anonymous.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_OAUTH_CLIENT_ID` | Client id of the GitHub OAuth app |
| `GITHUB_OAUTH_CLIENT_SECRET` | Its client secret (server only) |
| `AUTH_COOKIE_SECRET` | Encrypts the session and state cookies. At least 32 characters, random, different from `QUOTA_COOKIE_SECRET`. Rotating it signs everyone out |

Production uses an OAuth app whose callback URL is `https://www.howcommitted.com/api/auth/github/callback` (the apex redirects to `www`, and the state cookie is host-bound, so sign-in must start and finish on `www`). Preview deployments need their own OAuth app, since Vercel preview URLs vary: register it with the callback of a stable preview alias (or a branch URL) and give previews that app's credentials and their own `AUTH_COOKIE_SECRET`. A preview must never hold the production OAuth secret.

## Environments

- A Vercel preview deployment per PR acts as staging. There is no separate staging environment.
- Production safety net: Vercel instant rollback.
- Preview deployments must use separate env vars: their own GitHub token and a separate Upstash database (or key prefix), so previews never burn the production quota or pollute the production cache.
