# Growzzy OS — Design System (Syncro-matched)

The exact visual language for the app, matched to the approved reference dashboard. This is the aesthetic contract: colors, typography, spacing, radii, shadows, and the precise structure of KPI cards, charts, and tables. Implement as CSS variables / Tailwind theme tokens and use everywhere — no ad-hoc colors or sizes. `GROWZZY_APP_REDESIGN_SPEC.md` defines *what sections exist*; this defines *exactly how they look*.

## The look

Clean, light, professional SaaS. **Green is the primary accent** — used for charts, positive trends, active states, and progress. White surfaces on a very light grey canvas, generously rounded cards, soft borders, roomy spacing. Positive/negative trend pills (green/red) and load-level pills (green/amber/red) are the only other color. Primary utility buttons (Export-type) are near-black; the green is the brand/data accent. Nothing cramped, nothing loud.

---

## Color tokens

```css
:root {
  /* Canvas & surfaces */
  --bg-canvas:     #F4F5F4;   /* app background behind cards */
  --bg-surface:    #FFFFFF;   /* cards, sidebar, tables */
  --bg-hover:      #F3F4F3;   /* row/nav hover */
  --bg-active:     #ECF6EF;   /* selected nav — faint green tint */
  --bg-inset:      #F7F8F7;   /* search fields, chart wells */

  /* Text */
  --text-primary:  #1A1C1A;   /* headings, KPI numbers, names */
  --text-secondary:#5E635E;   /* body values, cells */
  --text-muted:    #8B908B;   /* labels, icons, sub-text */
  --text-faint:    #A9AEA9;   /* uppercase column/group headers */

  /* Green accent scale */
  --green-600:     #2FA85A;   /* primary accent, active */
  --green-500:     #3DBE6B;   /* chart bars (completed), progress */
  --green-300:     #A7E3BE;   /* chart bars (pending / lighter series) */
  --green-100:     #E4F5EA;   /* accent tint bg, active nav */

  /* Borders */
  --border-subtle: #EBEDEB;   /* card hairline, row divider */
  --border-strong: #DCE0DC;   /* input borders */

  /* Semantic (trend + load pills) */
  --up-bg:   #E4F5EA;  --up-text:   #2FA85A;   /* +12% */
  --down-bg: #FBE7E5;  --down-text: #D3564C;   /* -3.2% */

  --load-low-bg:    #E4F5EA;  --load-low-text:    #2FA85A;
  --load-med-bg:    #FBF0DA;  --load-med-text:    #B8892B;
  --load-high-bg:   #FBE7E5;  --load-high-text:   #D3564C;

  /* Campaign status pills (Growzzy-specific, same recipe) */
  --status-live-bg:   #E4F5EA;  --status-live-text:   #2FA85A;
  --status-learn-bg:  #E7EFFB;  --status-learn-text:  #4B79C7;
  --status-paused-bg: #FBF0DA;  --status-paused-text: #B8892B;
  --status-reject-bg: #FBE7E5;  --status-reject-text: #D3564C;
  --status-draft-bg:  #EFF0EF;  --status-draft-text:  #83887F;

  /* Near-black utility button (Export/primary action) */
  --btn-dark-bg:   #1D1F1D;  --btn-dark-text: #FFFFFF;

  /* Shadows — soft, low */
  --shadow-card:  0 1px 2px rgba(20,25,20,0.04);
  --shadow-pop:   0 8px 28px rgba(20,25,20,0.10), 0 2px 6px rgba(20,25,20,0.05);
}
```

Single theme (light). No dark mode for v1.

---

## Typography (exact scale from the reference)

Inter. Do not use sizes off this table.

| Token | px / line-height | weight | use |
|---|---|---|---|
| `kpi` | 30px / 1.15 | 700 | KPI numbers ("185", "142h 40m") |
| `h1` | 20px / 1.25 | 600 | page title ("Dashboard") |
| `section` | 16px / 1.3 | 600 | card titles ("Task overview") |
| `body` | 14px / 1.45 | 400 | table cells, values |
| `body-medium` | 14px / 1.45 | 500 | names, active nav, buttons |
| `label` | 13px / 1.4 | 400 | KPI labels, sub-text, nav |
| `caption` | 12px / 1.35 | 400 | table headers, helper text, axis |
| `pill` | 12px / 1 | 600 | trend %, load-level, status pills |
| `overline` | 11px / 1.3 | 600, uppercase, 0.05em tracking, `--text-faint` | group nav labels ("MAIN MENU") |

- KPI numbers and all table numbers: `font-variant-numeric: tabular-nums`.
- Headings: `letter-spacing: -0.01em`.

---

## Spacing, radii, sizing (measured to match)

```css
/* 4px scale: 4 8 12 16 20 24 28 32 40 */
--radius-card:   14px;   /* KPI cards, chart card, table card */
--radius-pill:   999px;  /* trend pills, load pills, avatars */
--radius-input:  10px;   /* inputs, buttons, dropdowns */
--radius-chip:   8px;    /* small tiles, date cells */

--sidebar-width: 212px;
--kpi-card-pad:  18px;
--card-pad:      20px;
--card-gap:      16px;   /* gap between cards */
--row-height:    52px;   /* table rows — roomy like the reference */
--page-pad:      24px;
```

---

## Component recipes (exact to reference)

### Sidebar (212px, white)
- **Logo row:** small brand mark + "Growzzy" wordmark, ~18px, top.
- **Group label** ("MAIN MENU"): `overline` token, generous top margin.
- **Nav item:** 16px line icon + `label` text, `--text-secondary`. Hover `--bg-hover`. **Active = `--bg-active` (faint green) pill + `--green-600` icon + `--text-primary` text.**
- Second group ("WORKSPACES") = workspace switcher list.
- Bottom cluster: Template / Archive / Help & Docs.
- **User card pinned bottom:** avatar + name + email (`caption`, muted) + a small chevron/settings control, inside a subtle rounded container.

### Top bar
- Left: page title (`h1`) + optional breadcrumb.
- Right: overlapping avatar stack + a **Share/secondary** button (white + border).
- Below it, a control row: a **date-range pill** ("Last 30 days", `--bg-inset`, calendar icon) on the left, **Export** (near-black button) on the right.

### KPI card (4 across, equal width)
- White, `--radius-card`, `--border-subtle` hairline, `--kpi-card-pad`.
- Top row: 14px icon + `label` (muted) on the left, a `⋯` menu on the right.
- **Big number** (`kpi` token) + a **trend pill** to its right (green `--up-*` for positive, red `--down-*` for negative, `pill` token, e.g. "+12%").
- Sub-label below (`caption`, muted): "Task finished last month" style.
- Map to Growzzy: **Spend · Conversions · Cost/Result · ROAS** (or **Active Campaigns**).

### Chart card (≈2/3 width)
- Header: `section` title + one-line muted subtitle on the left; a **segmented toggle** (Daily / Monthly / Yearly) + a **chart-type dropdown** ("Bar chart") on the right.
- **Bars:** two-tone green — solid `--green-500` for the primary series (e.g. Spend), light `--green-300` (optionally striped) for the secondary series (e.g. Conversions). Rounded bar tops. Faint horizontal gridlines, muted axis labels (`caption`). Legend as small dot + label above the plot.
- Map to Growzzy: **Spend & results over time** (monthly bars), or spend line — same visual treatment.

### Side widget card (≈1/3 width, next to chart)
- The reference uses a calendar/schedule. Growzzy uses this slot for the **Needs Attention / Today's Recommendations** feed: `section` title, then stacked recommendation cards (icon + title + time/meta + small avatars or a severity dot), each row like the reference's meeting cards.

### Table card ("Workload overview" → "Campaigns")
- Header: `section` title + muted subtitle on the left; **search field** (`--bg-inset`, rounded) + **Filters** button on the right.
- Column headers: `caption`, `--text-muted`, sortable chevron on active column, single `--border-subtle` underline.
- Rows: `--row-height`, checkbox (on hover/select) + avatar/logo `--radius-pill` + `body-medium` name, other cells `body` `--text-secondary`, a **pill** column (load level → campaign status), `⋯` menu at the end.
- Map columns to Growzzy: Name · Platform · Spend · Conversions · CPA/ROAS · Status pill · ⋯.

### Pills (trend, load, status)
- `pill` token, `--radius-pill`, ~`2px 9px` padding, tint bg + darker text from the tokens above. Color + word always.

### Buttons
- **Primary/Export:** `--btn-dark-bg` near-black, white text, `--radius-input`.
- **Secondary/Share:** white + `--border-strong` + `--text-primary`.
- **Accent action** (e.g. New Campaign): can use `--green-600` fill if a green CTA is wanted — this is the one place green-as-button is allowed.
- Icon buttons: ghost, `--text-muted`, hover `--bg-hover`.

---

## Mapping every section to this layout

- **Dashboard** = the reference exactly: KPI row (4) → chart card + recommendations widget (2/3 + 1/3) → campaigns table.
- **Campaigns** = the "Workload overview" table pattern, full width, with the search+Filters header.
- **Creative Studio** = same card system; generate panel + preview as two cards side by side.
- **AI Advisor** = recommendation cards in the side-widget style, full width; Action Log as a table card.
- **Reports** = KPI row + chart card + table, same tokens.
- **Settings** = white cards, left sub-nav, same type scale.

## Rules

1. Green is the accent — charts, progress, positive trends, active nav, optional green CTA. No second saturated hue except the red/amber semantic pills.
2. One type scale (table above). No off-scale sizes.
3. `tabular-nums` on every number in a card or column.
4. Whitespace and the 16px card gap do the separating; hairline borders only on cards/rows.
5. Honest empty states — never fake rows to show off the layout.
6. Purely presentational — do not change publish/sync/action logic while restyling.
