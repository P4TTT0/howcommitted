# Contributing

Read [AGENTS.md](AGENTS.md) first. It holds the project rules; this file covers setup and the workflow.

## Development

Requires Node 22 (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env.local` for the GitHub and Upstash variables. Other commands are listed in [AGENTS.md](AGENTS.md#commands).

## Stack

Next.js (App Router) and TypeScript on Vercel, Upstash Redis cache, d3-scale/d3-shape for math, SVG/Canvas, GSAP for animation, Tone.js for audio, Tailwind CSS v4, pnpm, Biome, Vitest, Playwright. Rationale in [docs/architecture.md](docs/architecture.md).

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/product.md](docs/product.md) | Vision, experience flow, scenes, MVP scope |
| [docs/design.md](docs/design.md) | Aesthetic, typography, colors, motion and sound, prohibitions |
| [docs/architecture.md](docs/architecture.md) | Stack, structure, data pipeline, caching, quotas, auth |
| [AGENTS.md](AGENTS.md) | Rules for contributors and AI coding agents |

## Workflow

1. Branch from `main`.
2. Commit in small, reviewable work units.
3. Open a pull request. Direct pushes to `main` are not allowed.
4. Merge by squash only. The PR title becomes the commit on `main`, so it must follow Conventional Commits.

Branches are deleted automatically after merge.

## Branch names

| Prefix | Use |
|--------|-----|
| `feat/` | New behavior |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `chore/` | Tooling, dependencies, config |

Example: `feat/year-blocks-scene`.

## Commits

Conventional Commits: `type(scope): summary`, for example `feat(playback): add shared transport clock`. Keep each commit a single reviewable unit.

## Pull requests

- Keep them short-lived and focused on one unit of work.
- A PR includes its tests and docs.
- CI must pass: Biome, typecheck, Vitest, build, Playwright.
- Visual or audio changes: review the Vercel preview deployment, not only the diff.
- Say what to review first and what is intentionally out of scope.
