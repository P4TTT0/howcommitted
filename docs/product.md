# Product

## Vision

Committed turns your GitHub contribution history into a chronological audio-visual animation with the satisfaction of an incremental game: every contribution adds up, every streak climbs, every milestone pops.

It is an experience, not a professional metrics dashboard and not a narrative.

Quality bar: sound is addictive and satisfying (sample-based, incremental, Balatro-like); visuals are poster-grade.

## Core principle

CONTRIBUTIONS != PRODUCTIVITY. Committed shows rhythm and habits, never value.

- Versus is a game, not a job ranking.
- Copy describes habits ("night owl", "weekend dev", "longest streak"), never merit ("best", "most productive", "winner").
- The final screen and the share card always show: "Contributions are not productivity. This is rhythm, not value."

## Experience flow

1. **Landing.** The question "How committed is @[username]?" with the input inside the sentence. Exact-username lookup with a clickable avatar preview row, debounced (see [design.md](design.md#landing)).
2. **Add developers.** A "+ vs" control adds more search columns, up to 5 developers. One developer is solo; two or more is versus. There is no mode toggle.
3. **Start.** A "Play" button (or the preview row). On a direct visit to `/{login}` the start button is the big "Play". The click is the user gesture that also unlocks audio, then it navigates to `/{login}`.
4. **Fetch on intent, not on preview.** The preview lookup is the only request while typing. The history is fetched on that click (or on the start button of a direct visit to `/{login}`), never before, to protect the anonymous quota of 2 cold generations a day. Loading is a designed moment, not a spinner.
5. **Scenes.** The animation plays through the scenes below.
6. **Final poster.** Actions: Share, Challenge someone (adds a user and goes to versus), Replay.

## Scenes

Playback order lives in `features/scenes/registry.ts`. A scene with nothing to show is skipped.

### Solo

| # | Scene | Content |
|---|-------|---------|
| 1 | Timeline | Yearly blocks (height = calendar contributions of the year; color = year identity; the year in progress is dashed) under the running total line, with repo-creation flags and the big counter |
| 2 | Heatmap | Every year as a row of 53 week squares tinted in the year color, yearly totals on the right, plus a month strip (average per calendar month; "<Month> is your month." only when the history covers every calendar month). Same calendar data as the line; label it "contributions", never commits |
| 3 | Main repo | The public repo with the most commits in large type, the top five repos as bars, and one era tile per year (repo, language, commits). Commit data, labeled as commits |
| 4 | Week shape | Contributions folded onto the seven weekdays, plus a steady or bursty rhythm label |
| 5 | Records | Longest streak as a tick strip, plus habit tiles (busiest day, week, month and year, active days, longest quiet stretch) |
| 6 | Then vs now | Weekday shares of a past year against the last full year; the past year can be changed in explore. Needs at least two full years |
| 7 | Language mosaic | Proportional blocks, top 5 plus "other". Label: languages of owned repos, not per-commit |
| 8 | Big numbers | Four giant numbers: commits, PRs, reviews, issues |
| - | Final poster | Summary, fixed line "Contributions are not productivity. This is rhythm, not value.", actions, and three 9:16 share cards (poster, rhythm, eras) |

### Versus

| # | Scene | Content |
|---|-------|---------|
| 1 | Contribution race | Horizontal bars that grow on one shared timeline, each with the avatar at its tip; rows slide when one passes another, with no rank numbers or "winner" |
| 2 | Shared days | A calendar year split by who contributed each day: days everyone showed up, days at least one did, and the longest run together |
| 3 | Favorite languages | One card per developer with the languages of their own public repos, in the order added |
| 4 | Longest streaks | Each developer's longest streak and longest quiet stretch on one shared timeline, in the order added |
| 5 | Rhythm sync | Each developer's week shape side by side, plus the overlap for each pair |
| 6 | Awards | Habit titles per developer ("Longest streak", "Weekend regular", "Earliest start"), never a verdict |
| - | Final poster | The combined total, a block per developer (total, years, awards) and the fixed line, never ordered or compared |

## Controls

- Pause, previous and next scene, speed (0.5×, 1×, 1.5×, 2×, kept for the whole run), mute, and cancel (back to the landing).
- Scenes never advance on their own. A finished scene stays on screen to explore: its chart is interactive (pointer and keyboard show exact values) and a clear "Next" moves on. Going back or jumping to a scene already played lands in explore; it can be replayed.
- Progress bar with clickable scene ticks.
- Versus uses the same controls and explore phase, with its own scenes (see above); its final poster offers Replay and Search again.
- Keyboard: Space pause/resume, ← → previous/next scene, M mute, Esc cancel. Never while typing.
- Shared links never autoplay.

## MVP scope

- Solo and versus (up to 5) for any public GitHub user.
- The solo and versus scenes and final posters above.
- Sound and motion as described in [design.md](design.md).
- Share card and Open Graph image.
- Caching, quota handling, and optional GitHub sign-in as described in [architecture.md](architecture.md).

## Out of scope for the MVP

- Pre-AI vs Post-AI milestone and global industry comparison. A possible later add-on, not core.
- Hourly heatmap. It needs per-commit timestamps.
- WebGL / Three.js.

## Decisions

- Radar chart rejected: mismatched scales, and it reads as a performance review, violating the core principle.
- The experience plays all contributions from the GitHub calendar, public and private (private only when the user shares them on their profile). Commits alone left most employed developers empty, because their work lives in private repositories (a profile with 1,912 calendar contributions had 6 public commits). The calendar mixes contribution types, so the counter's unit is always "contributions", never "commits". Public commit data is still fetched for later scenes (big numbers, PRs, reviews, issues) but does not drive the line, counter, year blocks or milestones. The end card states the private share honestly ("Includes N private contributions.") when it is above zero, and the empty state says private contributions appear only if the user shares them.
- Contributions not attributed to a day are shown as an explicit step, never spread across days: if a year's summed daily contributions differ from the calendar's yearly total, the difference is one dashed step at the end of its year with the label "+N not attributed to a day" and a soft, distinct sound cue, and a note says so. With the calendar this should be rare. Counter and year blocks end on the calendar totals. If the daily detail ever exceeds a yearly total it is not scaled down: the calendar total wins and the year is flagged. A milestone crossed inside a step fires at the step.
- Exact-username lookup instead of fuzzy search: GitHub's user search API allows only 30 requests/minute.
