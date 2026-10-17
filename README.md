# Committed

Your commit history as an audio-visual animation, with the satisfaction of an incremental game.

Committed turns a GitHub commit history into a chronological animation: every commit adds up, every streak climbs, every milestone pops. It is an experience, not a professional metrics dashboard and not a narrative. Sound is addictive and satisfying (sample-based, incremental, Balatro-like); visuals are poster-grade. Enter one GitHub username to see a solo run, or add up to five to compare rhythms in versus mode.

Site: howcommitted.com

## Philosophy

**COMMITS != PRODUCTIVITY.** Committed shows rhythm and habits, never value. Versus is a game, not a job ranking. Full statement: [docs/product.md](docs/product.md#core-principle).

## Status

Design phase. There is no code yet; the repository currently contains only documentation.

## Stack

Next.js (App Router) and TypeScript on Vercel, Upstash Redis cache, d3-scale/d3-shape for math, SVG/Canvas, GSAP for animation, Tone.js for audio, Tailwind CSS v4, pnpm, Biome, Vitest, Playwright. Rationale in [docs/architecture.md](docs/architecture.md).

## Documentation

| Doc | Contents |
|-----|----------|
| [docs/product.md](docs/product.md) | Vision, experience flow, scenes, MVP scope |
| [docs/design.md](docs/design.md) | Aesthetic, typography, colors, motion and sound, prohibitions |
| [docs/architecture.md](docs/architecture.md) | Stack, structure, data pipeline, caching, quotas, auth |
| [AGENTS.md](AGENTS.md) | Rules for contributors and AI coding agents |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Workflow, branches, commits, pull requests |

## License

[MIT](LICENSE)
