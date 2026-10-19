# Design

## Aesthetic: Kinetic Poster

Flat color blocks, giant kinetic typography, numbers as protagonists. It avoids the generic AI look. The direction is Wrapped-adjacent (kinetic poster); its main risk is reading as a Wrapped clone, so typography and restraint differentiate it.

## Landing

The landing is the question, "How committed is @[username]?", set as a Signal yellow poster. The question is the brand: there is no giant title above it, only a small "Committed" wordmark top-left.

- The username input sits inside the sentence. It inherits the display font, has no box, only an ink bottom border that turns Ultramarine and thicker on focus (never color alone). The visible label is the sentence itself ("How committed"), and the accessible name continues it ("is GitHub username").
- Two intentional lines on desktop ("How committed" / "is @name?"), three on phones ("How" / "committed" / "is @name?", the last at 0.55em). Words never break by accident.
- The empty field types example usernames, one letter at a time. It stops on focus or typing and stays static under `prefers-reduced-motion`.
- Lookup states are one compact Martian Mono line under the sentence. A found user is a single pressable row (avatar, name, `@login`, active years) that starts the experience like the main button.
- "Play" (with a small play triangle) is the one call to action, with a one-line description beside it. It is the only filled element when active, so it reads as the thing to press. Disabled (no user yet) it is transparent with a dashed ink border: same size, full contrast, no opacity.
- Signature: top-right "Made by @P4TTT0", GitHub and LinkedIn links, and a cumulative line that draws itself once along the bottom (static under reduced motion).
- Every button and link has a pointer, a hover (flip to Ultramarine or Ink), a pressed state and the shared focus ring, from `src/ui/classes.ts`.
- Two layouts. On landscape screens at least 1024px wide, the landing is two columns: the question, "Play" and the description on the left, and the found developer on the right as a large card (square avatar, name in Big Shoulders, `@login` and active years in Martian Mono). The whole card is a button that starts like "Play", and it wipes in from the left. The right column is the home of the player(s): the versus rivals will join it. It stays empty until someone is found. On phones, portrait tablets and short landscape screens the layout stays stacked, with the compact preview row under the question.
- The landing never scrolls, at any size: type is sized from width and height, and the bottom line gives way first.
- Rivals: a "+ vs" control under the found developer (right column on wide screens, under the preview row elsewhere) adds up to four rivals after the same exact-username lookup, as removable pills with a P2..P5 swatch. Pills are compact on phones so the landing still never scrolls with five developers.

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
- Playwright checks each scene at multiple viewports in CI (planned; exact set defined when CI is built).
