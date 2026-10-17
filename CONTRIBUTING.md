# Contributing

Read [AGENTS.md](AGENTS.md) first. It holds the project rules; this file only covers the workflow.

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
