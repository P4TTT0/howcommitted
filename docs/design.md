# Design

## Aesthetic: Kinetic Poster

Flat color blocks, giant kinetic typography, numbers as protagonists. It deliberately avoids the generic AI look and the Spotify Wrapped cliche.

## Typography

| Role | Font | Use |
|------|------|-----|
| Display | Big Shoulders | Big numbers and headings only. Never small text |
| Text | Martian Mono | Labels and all small text |

Both are OFL-licensed and served from Google Fonts. No other fonts.

## Color

Neutrals: Paper `#F3F1EC`, Ink `#141414`.

### Block palette

One color per year, rotating, alternating dark and light. On milestones the block floods the full screen, synced with the sound hit.

| # | Name | Hex | Text | Contrast |
|---|------|-----|------|----------|
| 01 | Ultramarine | `#1F3BFF` | Paper | 5.95:1 |
| 02 | Safety | `#FF5B1F` | Ink | 5.94:1 |
| 03 | Forest | `#0B6B43` | Paper | 5.82:1 |
| 04 | Signal | `#FFD23F` | Ink | 12.76:1 |
| 05 | Violet | `#7A1FD1` | Paper | 6.32:1 |
| 06 | Pink | `#FF6FA8` | Ink | 7.10:1 |

### Versus palette

Fixed order. Color follows the developer, never the rank. Lines are drawn on Paper. Username pills act as the legend; direct labels at line ends are in Ink.

| Player | Name | Hex |
|--------|------|-----|
| P1 | Ultramarine | `#1F3BFF` |
| P2 | Hot pink | `#E0218A` |
| P3 | Mustard | `#A88000` |
| P4 | Forest | `#0B6B43` |
| P5 | Sky | `#1E88E5` |

Validated as colorblind-safe across all pairs on `#F3F1EC`: worst color-vision-deficiency delta E 12.1, worst normal-vision delta E 17.5, all lines at least 3:1 against the surface.

- Safety orange is excluded from versus: it is confused with pink and forest.
- Never put small text on Hot pink. It fails 4.5:1 with both Paper (3.91) and Ink (4.17).
- Not yet decided: in versus, the top block takes the color of the developer leading that year.

## Sound

Addictive, satisfying incremental sound. Reference: Balatro.

- Rising pitch on accumulation.
- Short percussive samples with slight random variation per repeat.
- A heavy payoff hit on milestones.
- Tight audio-visual sync.
- Audio aggregates by week or month and is quantized to tempo with a voice limit. Never one sound per raw commit.
- Recorded or curated samples, never default synths.
- Sound starts only after a user gesture. Mute is always visible.

## Motion

- Calm, precise drawing. Payoff moments explode; the contrast makes them land.
- Always pausable and skippable.
- Respect `prefers-reduced-motion`.
- Loading is part of the experience; no generic spinners.

## Prohibitions

- Gradients
- Glow, neon, glassmorphism, blur
- Generic soft cards, diffuse shadows, left-border accent cards
- Emoji and generic icon sets
- Any font besides the two chosen
- Tap-through vertical stories and "Your year in commits!" copy
- Invented percentiles
- Confetti
- Value judgments about developers
- Pie, 3D, and dual-axis charts
- Autoplaying sound
- Unskippable animation
- One sound per commit, or default synths
- Generic spinners

## Responsive

Requirement, not polish.

- Every scene is designed for portrait phone and landscape desktop.
- Type scales fluidly with its container, not at fixed breakpoints.
- Versus columns stack into pills on mobile.
- Playwright checks each scene at 3 viewports in CI (planned).
