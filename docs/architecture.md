# Architecture

Nothing here is implemented yet.

## Stack

| Piece | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) + TypeScript on Vercel | Server routes keep the GitHub token off the client; preview deploys per PR |
| Cache | Upstash Redis | Shared cache across serverless instances; also used for rate limits and locks |
| Math | d3-scale, d3-shape | Math only; rendering stays in our hands |
| Rendering | SVG / Canvas | Enough for flat 2D blocks and lines |
| Animation | GSAP | Precise timeline control |
| Audio | Tone.js | Its Transport clock syncs visuals and sound |
| Styling | Tailwind CSS v4 | |
| Tooling | pnpm, Biome, Vitest, Playwright | |

Excluded: Three.js/WebGL, a database, a global state library.

## Folder structure

```
src/app/              Thin Next routes only
  page.tsx            Landing
  [...users]/page.tsx /torvalds = solo, /a/b/c = versus
  [...users]/opengraph-image.tsx
  api/                Route handlers
src/domain/           Pure TS types and metrics
src/github/           Server-only GraphQL client, queries, cache
src/playback/         One clock driving GSAP and Tone.js (sound/ inside)
src/features/         timeline, stats, versus
src/ui/               Shared presentational components
public/sounds/        .ogg with .mp3 fallback
e2e/                  Playwright
.github/              workflows/ci.yml, ISSUE_TEMPLATE, pull_request_template.md (planned)
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

The summed daily commits matched the official `totalCommitContributions` exactly (4458) in the measured profile.

Profile cost is about contribution years + 2 points, so roughly 500 uncached profiles per hour per 5,000-point token.

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
| User preview | 24 h | |
| Past years | 30 days | The past does not change |
| Current year | 6 h | Still changing |
| Repos | 24 h | |
| "User not found" | 1 h | Negative cache |

## Quota and rate limits

- Cached profiles are free and unlimited for everyone.
- Anonymous visitors get 2 cold (uncached) generations per day, tracked by cookie and IP with `@upstash/ratelimit`. Only after that is the GitHub sign-in prompt shown, never upfront.
- Signed-in visitors use their own token (5,000 points/hour each). Profiles they fetch populate the shared cache.
- Global circuit breaker: when the server token's remaining points drop below 20%, anonymous cold generations stop (cache only, plus the sign-in prompt).
- Request coalescing: a Redis lock ensures simultaneous requests for the same uncached profile trigger one fetch.
- Per-IP rate limit on preview lookups.
- When degraded, show a playful message (for example "GitHub needs a breather"). Nothing breaks.
- Never pool tokens from multiple accounts; it violates GitHub terms.

## Auth

"Sign in with GitHub", public data only (no extra scopes). No database. The token lives in an encrypted httpOnly cookie.

Gate copy: "Free runs used. Sign in with GitHub to keep going — it uses your own quota, and we only read public data."

## Environments

- A Vercel preview deployment per PR acts as staging. There is no separate staging environment.
- Production safety net: Vercel instant rollback.
- Preview deployments must use separate env vars: their own GitHub token and a separate Upstash database (or key prefix), so previews never burn the production quota or pollute the production cache.
