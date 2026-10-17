# Architecture

Scaffolding is in place (Next.js, Tailwind, Biome, Vitest, Playwright, CI). `domain/`, `github/` and the API routes are implemented. `playback/` and `features/timeline/` hold the playback spike, reachable at `/lab` outside production; the product pages are not built yet.

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
  [...users]/page.tsx /torvalds = solo, /a/b/c = versus
  [...users]/opengraph-image.tsx
  api/user/[login]/       Exact-login preview, rate limited per IP
  api/history/[login]/    Full profile history (cache, coalescing, quota)
  lab/page.tsx            Playback lab: previews and local dev only, 404 in production
src/domain/           Pure TS types and metrics
src/github/           Server-only GraphQL client, queries, cache
src/playback/         One clock driving GSAP and Tone.js (clock.ts), pure scheduling
                      helpers (aggregate, schedule, pitch), sound/ engine
src/features/         timeline, stats, versus
src/ui/               Shared presentational components
public/sounds/        CC0 samples as .ogg (.mp3 fallback planned), CREDITS.md
e2e/                  Playwright
.github/              workflows/ci.yml, pull_request_template.md, ISSUE_TEMPLATE (planned)
.env.example          Required env vars
biome.json            Lint and format config
LICENSE               MIT
```

GitHub usernames cannot contain "/", so path segments map unambiguously to users.

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
| Contributions | One request per contribution year, in parallel (concurrency cap ~6): totals (commits, PRs, reviews, issues, restricted/private count) plus `commitContributionsByRepository(maxRepositories:100){contributions(first:100){nodes{occurredAt commitCount}}}`, summed by date for true commits per day | 1 point each | ~1.8 s each |
| Repos | `repositories(ownerAffiliations:OWNER, isFork:false, orderBy CREATED_AT, first:100)`, paginated, with `createdAt`, `stargazerCount`, `languages(first:10 by SIZE)` | 1 point | ~2.2 s |

For the measured year (2023), summed daily commits matched `totalCommitContributions` exactly (4,458).

Profile cost is about contribution years + 2 points, so about 280 uncached profiles per hour for a 16-year profile, and about 500 for an 8-year profile (per 5,000-point token).

### Gotchas

- A single 16-year query timed out (502 after about 11 s). GitHub kills requests over 10 s and deducts extra points. Hence one request per year.
- `contributionsCollection` `from`/`to` spans at most 1 year.
- `contributionCalendar` counts all contribution types (2023 example: calendar 4,924 vs commits 4,458). Never label it as commits.
- `maxRepositories` caps at 100 repos per year. Compare summed daily commits against the official total; if they differ, show the real total with a notice.
- Private contributions appear only if the user enabled sharing them. Show as "+N private"; never invent their dates.

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

Key format (a prefix bump is a full invalidation):

- `v1:user:{login}`
- `v1:year:{login}:{year}`
- `v1:repos:{login}`

Logins are lowercased in keys. Supporting keys: `v1:missing:{login}` (negative cache, 1 h), `v1:failed:{login}` (last failed generation, 30 s), `v1:lock:{login}` (coalescing lock, 75 s, released with a compare-and-delete script), `v1:budget:server` (last token budget for the circuit breaker) and `v1:quota:*` (quota counters and rate limits). The optional `CACHE_KEY_PREFIX` env var is prepended to every key (for example `preview:v1:user:{login}`).

## Quota and rate limits

- Cached profiles are free and unlimited for everyone.
- Anonymous visitors get 2 cold generations per day. A generation is cold only when no year and no repos are cached (a cached preview does not count, so preview then history is still charged); completing partial data or refreshing a year is free. A failed generation refunds the run, except for unknown users, so probing logins is not free. Each identity is charged first and checked after, and everything is rolled back when either is over its limit, so concurrent requests cannot exceed the limit. Cold attempts are also limited per IP per minute. Only after the runs are used is the GitHub sign-in prompt shown, never upfront.
- Identity: the signed `hc_visitor` cookie (HMAC with `QUOTA_COOKIE_SECRET`, at least 32 characters) plus the client IP. The IP comes from `x-real-ip`, then `x-vercel-forwarded-for`, then `x-forwarded-for`, validated as an IP. IPv6 clients are keyed by their /64. Requests with no usable IP count against the cookie only for cold runs and share stricter preview and cold-attempt limits. Visitors behind a shared IP (offices, CGNAT) share its daily runs. The header trust above assumes Vercel; self-hosting needs a trusted proxy that sets `x-real-ip` itself.
- The cookie and IP quota is a soft gate (bypassable by clearing cookies or using a VPN). The global circuit breaker is the hard gate.
- Signed-in visitors use their own token (5,000 points/hour each). Profiles they fetch populate the shared cache.
- Global circuit breaker: when the server token's remaining points drop below 20%, anonymous cold generations and uncached previews stop (cache only, plus the sign-in prompt).
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

## Environments

- A Vercel preview deployment per PR acts as staging. There is no separate staging environment.
- Production safety net: Vercel instant rollback.
- Preview deployments must use separate env vars: their own GitHub token and a separate Upstash database (or key prefix), so previews never burn the production quota or pollute the production cache.
