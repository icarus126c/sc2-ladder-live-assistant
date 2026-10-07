# Design decisions

- Mode: extension. Keep the existing control page, preview/apply distinction, OBS routes, user text, positions and live data.
- Audience: streamers editing on desktop and viewers watching a 1920 × 1080 broadcast.
- Reference: mashirozx/arknights-ui at `8fb68d35992467c0cca9de953c5bd6227c316b97`; local reference screenshot inspected during development.
- Visual language: Rhodes Island operational display. Dark translucent ship environment, white typography, small yellow markers, rectangular panels and clipped technical borders.
- Palette: `#14191e`, `#42484d`, `#f5c928`, `#f1f1ed`.
- Typography: existing local Microsoft YaHei / sans-serif stack, bold titles and narrow tracking for English labels; no external font request.
- Spacing: 8 px base; scene panel padding 48 px; thin 1–2 px rules; square corners; restrained shadows.
- Motion: immediate keyboard feedback, 100 ms pose transition; reduced-motion disables the pose motion.
- Dials (variance / motion / density / asset dependence / fidelity): 3 / 2 / 6 / 8 / 10. Confine changes to the new theme and the style maker; keep reference art local and data legible.
- Real assets: `public/assets/arknights-logo-v1.png`, `arknights-chen-v1.png`, `arknights-background-v1.png`, `arknights-cover-v1.png`. Provenance and rights are recorded in README.md.
- AI maker: use the existing form spacing, buttons and colors. Show a generated candidate before adoption. Installation and applying to live output remain separate actions.
