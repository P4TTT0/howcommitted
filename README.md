<img width="1280" height="400" alt="banner-how-committed" src="https://github.com/user-attachments/assets/f1181e1a-e2ff-4ed4-8855-872c59f4fcf1" />


Your contribution history as an audio-visual experience. [howcommitted.com](https://www.howcommitted.com/)

## Philosophy

**CONTRIBUTIONS != PRODUCTIVITY.** Committed shows rhythm and habits, never value. Versus is a game, not a job ranking. Full statement: [docs/product.md](docs/product.md#core-principle).

## Status

Scaffolded. The app builds with design tokens, fonts and CI in place; there are no features yet.

## Stack

Next.js (App Router) and TypeScript on Vercel, Upstash Redis cache, d3-scale/d3-shape for math, SVG/Canvas, GSAP for animation, Tone.js for audio, Tailwind CSS v4, pnpm, Biome, Vitest, Playwright. Rationale in [docs/architecture.md](docs/architecture.md).

## Development

Requires Node 22 (see `.nvmrc`) and pnpm.

```bash
pnpm install
pnpm dev
```

Other commands are listed in [AGENTS.md](AGENTS.md#commands). Copy `.env.example` to `.env.local` for the GitHub and Upstash variables.

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
