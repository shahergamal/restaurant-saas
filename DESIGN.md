# Design System: Sufra (سُفرة)

Character: a calm, warm control room for a busy restaurant. Dense numbers, quiet chrome, orange only where action or urgency lives.

Source: extracted from the 7 reference screens (dashboard, orders, kitchen, inventory, reports, tables, food cost). Colors were sampled from the screenshots. Tokens live in `apps/web/app/globals.css` (`:root`) and are mapped in `apps/web/tailwind.config.ts` under the same names.

## Color
- `--bg` #F8F7F5: warm off-white canvas; pure white would flatten the white cards.
- `--surface` #FFFFFF: cards, tables, panels.
- `--surface-muted` #F4F3F1: search field, inactive pills, progress tracks.
- `--border` #EDEBE7: 1px card and row separators; the only separation language besides a whisper shadow.
- `--sidebar` #191919 / `--sidebar-text` #EDEDED / `--sidebar-muted` #9A9A9A: dark rail anchors navigation and keeps the content area light.
- `--text` #141414 / `--text-muted` #6E6B66 / `--text-subtle` #9C9890: three levels; muted carries labels and timestamps.
- `--accent` #F8651D (hover #E85710, soft #FEF1E8, soft-2 #FFF7F1): signature orange. Used for the primary action of a screen, the active nav item, the brand, chart series 1 and "occupied". Never decorative.
- `--success` #12936D (soft #E6F6F0), table "available" #238A4B: positive deltas, in-stock, available.
- `--danger` #E5484D (soft #FDEEEE): critical stock, delayed orders, needs-attention.
- `--warning` #F08A24 (soft #FFF4E6): low stock, in-progress.
- `--info` #4AA4F7 (soft #EAF4FE): time metrics (prep time).
- `--violet` #6B55E9 (soft #EFEDFD): cleaning state, revenue icon.
- `--teal` #42B39A (soft #E5F6F2): active orders icon.
- `--neutral` #807F80: out of service.
- Chart palette (categorical, in order): accent, success, info/blue #3B82F6, violet #7C6CF0, neutral #B9B7B3. A muted companion series uses #F9C9A8 (takeaway beside dine-in).

## Typography
- Family: IBM Plex Sans Arabic for Arabic (spec 10), Inter for Latin glyphs. Inter is listed first so Latin digits and words keep the reference look; Arabic glyphs fall through to Plex.
- Scale (px): 11 / 12 / 13 / 14 / 16 / 18 / 22 / 28 / 34. Page titles 28 bold; card titles 16–18 semibold; KPI values 22–28 bold; table text 13; meta 11–12.
- Weights: 400 body, 500 labels and nav, 600 card titles, 700 KPI values and page titles.
- Numbers use tabular figures in tables and KPIs. Users can switch Latin/Arabic-Indic digits.

## Spacing
- Base unit 4px; scale 4 / 8 / 12 / 16 / 20 / 24 / 32.
- Page gutter 24px; card padding 16–20px; gap between cards 16px; row height in tables 52–64px.
- Dense inside cards, generous between them.

## Shape & elevation
- Radii: 8px pills, badges and small buttons; 10px nav items, inputs and buttons; 12px cards; 999px status dots and count chips.
- Separation: 1px `--border` plus `--shadow-card` (0 1px 2px rgb(20 16 10 / 4%)). Primary buttons carry `--shadow-accent` (0 6px 14px -6px rgb(248 101 29 / 55%)).

## Motion
- 120ms for hover/press, 200ms for panels and tabs, ease-out. Live updates (kitchen tickets) fade in. Respect `prefers-reduced-motion`.

## Components
- Button: primary (accent fill, white text, accent shadow) · secondary (white, 1px accent border, accent text) · ghost (no border, muted text, surface-muted on hover) · destructive (danger text, ghost by default, filled only inside a confirm dialog).
- Pill tabs: active = accent fill + white text + count chip (white/20%); inactive = white with border, count chip in surface-muted.
- StatCard: icon tile (40px, rounded 10px, colored fill per metric) + label (13 muted) + value (22–28 bold) + delta line (arrow, colored %, "vs …" muted).
- StatusBadge: soft background + matching text + leading icon/dot, 11–12px, radius 8.
- Table: header 12px muted on white, rows separated by `--border`, actions via a kebab menu.
- InsightCard: `--accent-soft` background, accent title, body muted, one primary action.
- Sidebar: 240px, dark; nav item 44px high, radius 10; active = accent fill + accent shadow; count badge 20px accent circle.
- Empty, loading (skeleton) and error states exist for every data block.

## Voice
- Arabic first, Saudi business tone, short and direct. English mirrors the reference copy.
- Buttons are verbs ("أنشئ أمر شراء" / "Create Purchase Order"). Sentence case in English except page titles.
- Errors say what happened and what to do next; never show raw codes.
