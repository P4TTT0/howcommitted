# Product

## Vision

Committed turns your commit history into a chronological audio-visual animation with the satisfaction of an incremental game: every commit adds up, every streak climbs, every milestone pops.

It is an experience, not a professional metrics dashboard and not a narrative. Visuals and sound are both premium.

Principle: COMMITS != PRODUCTIVITY. Committed shows rhythm and habits, never value. See [AGENTS.md](../AGENTS.md).

## Experience flow

1. **Landing.** One centered search. Exact-username lookup with avatar preview, debounced.
2. **Add developers.** A "+ vs" control adds more search columns, up to 5 developers. One developer is solo; two or more is versus. There is no mode toggle.
3. **Prefetch.** Selecting a user starts fetching their data.
4. **Start.** A big "How Committed?" button. The click is the user gesture that also unlocks audio.
5. **Scenes.** The animation plays through the scenes below.
6. **Final poster.** Actions: Share, Challenge someone (adds a user and goes to versus), Replay.

## Scenes

| # | Scene | Content |
|---|-------|---------|
| 1 | Year blocks | Block height = commits; block color = year identity |
| 2 | Cumulative line | Cumulative commits with repo-creation flags. In versus: bar chart race |
| 3 | Heatmap | Weekday by week |
| 4 | Language mosaic | Proportional blocks, top 5 plus "other". Label: languages of owned repos, not per-commit |
| 5 | Big numbers | Four giant numbers: commits, PRs, reviews, issues |
| - | Final poster | Summary, fixed line "Commits are not productivity. This is rhythm, not value.", actions |

## Controls

- Pause, skip scene, mute.
- Progress bar with scene ticks.
- Shared links never autoplay.

## MVP scope

- Solo and versus (up to 5) for any public GitHub user.
- The five scenes and final poster above.
- Sound and motion as described in [design.md](design.md).
- Share card and Open Graph image.
- Caching, quota handling, and optional GitHub sign-in as described in [architecture.md](architecture.md).

## Out of scope for the MVP

- Pre-AI vs Post-AI milestone and global industry comparison. A possible later add-on, not core.
- Hourly heatmap. It needs per-commit timestamps.
- WebGL / Three.js.
