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
3. **Start.** A "Listen" button (or the preview row). On a direct visit to `/{login}` the start button is the big "How Committed?". The click is the user gesture that also unlocks audio, then it navigates to `/{login}`.
4. **Fetch on intent, not on preview.** The preview lookup is the only request while typing. The history is fetched on that click (or on the start button of a direct visit to `/{login}`), never before, to protect the anonymous quota of 2 cold generations a day. Loading is a designed moment, not a spinner.
5. **Scenes.** The animation plays through the scenes below.
6. **Final poster.** Actions: Share, Challenge someone (adds a user and goes to versus), Replay.

## Scenes

| # | Scene | Content |
|---|-------|---------|
| 1 | Year blocks | Block height = calendar contributions of the year; block color = year identity |
| 2 | Cumulative line | Cumulative contributions with repo-creation flags. In versus: bar chart race |
| 3 | Heatmap | Weekday by week. Same calendar data as the line; label it "contributions", never commits |
| 4 | Language mosaic | Proportional blocks, top 5 plus "other". Label: languages of owned repos, not per-commit |
| 5 | Big numbers | Four giant numbers: commits, PRs, reviews, issues |
| - | Final poster | Summary, fixed line "Contributions are not productivity. This is rhythm, not value.", actions |

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

## Decisions

- Radar chart rejected: mismatched scales, and it reads as a performance review, violating the core principle.
- The experience plays all contributions from the GitHub calendar, public and private (private only when the user shares them on their profile). Commits alone left most employed developers empty, because their work lives in private repositories (a profile with 1,912 calendar contributions had 6 public commits). The calendar mixes contribution types, so the counter's unit is always "contributions", never "commits". Public commit data is still fetched for later scenes (big numbers, PRs, reviews, issues) but does not drive the line, counter, year blocks or milestones. The end card states the private share honestly ("Includes N private contributions.") when it is above zero, and the empty state says private contributions appear only if the user shares them.
- Contributions not attributed to a day are shown as an explicit step, never spread across days: if a year's summed daily contributions differ from the calendar's yearly total, the difference is one dashed step at the end of its year with the label "+N not attributed to a day" and a soft, distinct sound cue, and a note says so. With the calendar this should be rare. Counter and year blocks end on the calendar totals. If the daily detail ever exceeds a yearly total it is not scaled down: the calendar total wins and the year is flagged. A milestone crossed inside a step fires at the step.
- Exact-username lookup instead of fuzzy search: GitHub's user search API allows only 30 requests/minute.
