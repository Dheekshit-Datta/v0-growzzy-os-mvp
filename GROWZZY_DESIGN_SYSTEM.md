# Growzzy OS Design System

This is the visual-language contract. `GROWZZY_APP_REDESIGN_SPEC.md` defines what screens exist; this defines how they look.

## Feeling

Calm, spacious, near-monochrome. Most surfaces are warm off-white, white, near-black text, and muted grey. Color appears in two places only:

- status pills
- one brand accent

Primary CTAs are near-black, not blue. Blue is for links, active states, focus, and subtle accents.

Dark theme is out of scope for v1.

## Tokens

```css
:root {
  --bg-app: #F7F6F4;
  --bg-surface: #FFFFFF;
  --bg-hover: #F1F0EE;
  --bg-active: #EDECEA;
  --bg-inset: #FBFBFA;

  --text-primary: #1D1D1B;
  --text-secondary: #6B6B68;
  --text-muted: #9B9B97;
  --text-faint: #B8B8B4;

  --border-subtle: #ECEBE8;
  --border-strong: #DEDDD9;

  --accent: #1F57F5;
  --accent-weak: #EAF0FE;

  --btn-primary-bg: #1E1E1C;
  --btn-primary-text: #FFFFFF;

  --status-good-bg: #E4F1E7;
  --status-good-text: #3F8F5B;
  --status-info-bg: #E6EEF8;
  --status-info-text: #5A7CA8;
  --status-warn-bg: #F6EEDA;
  --status-warn-text: #A8842C;
  --status-bad-bg: #F7E5E4;
  --status-bad-text: #B24A44;
  --status-neutral-bg: #EFEEEC;
  --status-neutral-text: #8A8A86;

  --shadow-card: 0 1px 2px rgba(30,30,28,0.04);
  --shadow-popover: 0 8px 28px rgba(30,30,28,0.12), 0 2px 6px rgba(30,30,28,0.06);
  --shadow-window: 0 24px 60px rgba(40,40,60,0.18);
}
```

## Type Scale

- display: 32px / 1.1 / 600, KPI numbers
- h1: 22px / 1.25 / 600, page titles
- h2: 17px / 1.3 / 600, section headers
- body: 14px / 1.45 / 400
- body-medium: 14px / 1.45 / 500
- label: 13px / 1.4 / 400
- caption: 12px / 1.35 / 400
- overline: 11px / 1.3 / 500 / uppercase / 0.06em tracking

Numbers in KPIs and tables use `tabular-nums`.

## Dimensions

- `--radius-window`: 18px
- `--radius-card`: 14px
- `--radius-input`: 10px
- `--radius-pill`: 999px
- `--radius-avatar`: 8px
- `--row-height`: 48px
- `--sidebar-width`: 244px
- `--page-pad`: 28px

## Component Rules

- Buttons: primary is near-black; secondary is white with a subtle border; icon buttons are ghost.
- Cards: white surface, hairline border only when needed, low warm shadow.
- Inputs: warm inset background, subtle border, blue focus ring.
- Tables: 48px rows, faint dividers, muted headers, status pills.
- KPI tiles: no heavy card chrome, tabular numbers, tiny quiet sparklines.
- Sidebar: active item is warm grey pill, not saturated blue.
- Popovers: rounded card, warm shadow, quick-action chips.

## Hard Rules

1. No extra saturated colors outside status pills and the accent.
2. Whitespace before borders.
3. One type scale.
4. Tabular numbers for changing/columnar numbers.
5. Honest empty states only.
6. Restyling must not change publish, sync, or action logic.
