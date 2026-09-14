# Veqiro Console Design System

## Direction

Veqiro console uses a Notion-polished operating UI: warm paper canvas, white or charcoal work surfaces, quiet hairlines, restrained blue for structural actions, and Veqiro color only for agent/status personality.

The console is an app surface, so scanability wins over spectacle. Pages should feel like a calm workspace where the agents' output is the interesting part.

## Color Decisions

- `--background`: app canvas.
- `--card`, `--popover`, `--sidebar`: raised or persistent surfaces.
- `--foreground`, `--muted-foreground`: primary and supporting text.
- `--primary`: primary button fill only: near-black in light mode, warm white in dark mode.
- `--ring`: blue focus signal, following Notion's single dependable blue action/focus cue.
- `--accent`: low-emphasis hover/selected fill; blue-tinted in light mode, white-tinted in dark mode.
- `--destructive`, `--chart-*`, `--vq-*`: semantic status, charts, and small Veqiro personality accents.
- `--vq-line`, `--vq-line-2`: default separators and card borders.
- `--vq-shadow-sm`, `--vq-shadow`, `--vq-shadow-lg`: soft elevation only.
- `--vq-r-sm`, `--vq-r`, `--vq-r-lg`, `--vq-r-xl`: 8/12/16/20px radius scale.

Light mode defaults to `system` through `next-themes`; dark mode is a warm charcoal version of the same system, not an inverted novelty theme.

## Shape Decisions

Notion's lesson is restrained rounding, not round everything.

- Page shell, full-width bands, tables, dividers: square.
- Sidebar rows, utility buttons, inputs, dropdown items: 8px.
- Cards, KPI tiles, content panels: 12px.
- Modals, sheets, large empty states: 16px.
- Pills: badges, tiny status chips, segmented controls, and marketing-style CTAs only.

Default rule: a `div` is not rounded unless it is a surfaced component, an interactive row, or a contained state. Nested cards stay banned.

## Button Decisions

- Primary button: light mode black with white text; dark mode warm white with near-black text.
- Secondary button: neutral card surface, hairline border, normal foreground text.
- Ghost button: transparent until hover; uses muted fill on hover.
- Destructive button: red text with red-tinted fill, never full red unless confirming a destructive action.
- Icon button: 8px or circular only when the control itself is an icon-only utility.

Blue is no longer the default button fill. It remains the focus/link/selection cue so the UI feels Notion-polished without becoming a Notion clone.

## Typography

- Body: `font-body`, default app reading and forms.
- Headings: `font-head`, confident but calm.
- Mono: `font-mono`, only for measurement, IDs, dates, tiny metadata, or code-like values.
- Keep letter spacing normal in new UI. Use weight, size, and spacing for hierarchy.

## Components

- Buttons use `primary` for the main action and neutral surfaces for secondary actions.
- Cards use 12px radius, hairline borders, and at most one soft shadow.
- Sidebar rows use icon plus label, clear active state, and stable collapsed tooltips.
- Inputs stay tighter than cards, with visible labels and clear focus rings.
- Charts use the shared `chart-*` tokens and must remain readable in both themes.

## Phase Rules

- Reuse existing `apps/main/src/components/ui` primitives before adding anything new.
- Add a variant only after at least two call sites need it.
- No nested cards, decorative gradients, or raw component-level hex values in new console work.
- Every phase ships light and dark mode together.
