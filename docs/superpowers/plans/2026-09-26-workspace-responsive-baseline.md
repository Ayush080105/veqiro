# Workspace responsive / theme pass — baseline and results

Companion to `2026-09-26-workspace-responsive-nav-chat-theme.md` (Task 8). Everything below was observed in a real browser (Chrome DevTools, local dev server, the documented local dev user) — not inferred from code.

Widths exercised: 320–360 (dialog height stress), 375, 768, 1100, 1440. Themes: Light, Dark, and System (emulated OS scheme).

## Method

- **Overflow probe:** every route loaded in a hidden same-origin iframe at the target width; any element whose right edge passes the viewport (outside an intentional scroller) is reported. Run over Lex, Maya, Rex, Sage, Scout at 375 — Overview, Work, Memory, Integrations, plus Maya Actions/Approvals/Automations.
- **Theme probe:** same iframes, `dark` class toggled, flagging large wrong-colour slabs and text below 2.2:1 contrast. Run over Maya, Lex, Rex, Sage, Scout, Vega workspaces, the employee directory and the team room. Its two "low contrast" reports (Vega captions, a breadcrumb label) were probe artifacts — `oklab()` colours it misparsed — and were checked by hand: real contrast is high.
- **Hands-on:** screenshots and DOM measurements for header, sheet, Chat page, dock, dialogs, integrations, calendar.

## Baseline findings (before) → result (after)

| Surface | Before | After |
|---|---|---|
| Employee switcher (header ⇕ icon) | Opening it threw `Base UI: MenuGroupRootContext is missing` → whole page "Something went sideways." | Opens; six employees + Team room; identity block is now the trigger. Guarded by a static test. |
| Header at 375 (Maya) | Overflowed: chat and theme icons pushed off-screen, name hidden | Fits: ☰ · console · avatar + "Maya · <module>" · chat · theme. Credits moved into the ☰ sheet. |
| Header at 768 / 1440 | Fine | Fine; adds Console menu and Employees back link |
| Chat page (`/chat`) | Composer floated mid-page (y=495 of 900), big dead area; visiting it silently saved the dock as "closed" | Composer pinned (y=900); saved preference untouched (`null`) |
| Chat on desktop | Only a thin right column; no way to open full-width | Dock (resizable 320–720), Expand ⤢ to full page, Chat in the module rail, "Dock chat" to return; draft survives every switch |
| 1024–1279 (lg–xl) | Rail + 360px dock left ~456px for the module | Dock floats over the module (400px), module stays 892px at 1100; Esc closes; default closed for first-time visitors here |
| Dialogs on short screens | Top-up dialog at 360×260: top −21, bottom 281 > 260, not scrollable, no max-height | Within viewport (22→238), scrolls, `max-height: 100dvh − 2rem` at the primitive |
| Maya Work tabs | Tabs and create buttons wrapped awkwardly | Tabs scroll sideways if needed; create buttons take their own row on phones |
| Approvals "Review in chat" | Plain text, no link | Real button → dock or Chat page |
| Memory graph on touch | `touch-action: none` on a 460px block trapped page scrolling | Vertical swipes scroll the page on touch; drag-pan/wheel unchanged with a mouse |
| Team room header | Single exit | Same Console menu as a workspace |
| Integrations inside an agent | Generic plug icon; X/LinkedIn (native OAuth) shown wrong; "Connect" left the workspace | Same cards and real coloured logos as Settings; connect/disconnect in place; logos sit on a light tile in dark mode |
| Maya calendar "today" marker (dark) | White text on warm-white fill, ≈1:1 | 17.2:1 dark, 16.5:1 light |
| Status chips (Maya posts/gallery), Rex type chips, Sage links, dashboard rows, billing/usage banners | Light-only pastel colours / `bg-white` | Theme tokens |
| Sidebar wordmark (dark) | Dark ink on dark background | Mark + text wordmark |
| `<html>` console error | Hydration mismatch warning on every load | `suppressHydrationWarning` (next-themes requirement) |

## Not changed on purpose

Overflow at 375 was already clean on every probed route — the shell's earlier responsive work held. Left alone: white text on coloured agent avatars, brand colours, white tiles behind logos/images, black scrims on media, Rex's fixed chart palette, the black X brand mark.

## Known limits

- Only the routes above were probed automatically; the rest were reviewed by reading code plus targeted screenshots.
- No agent had chat history or documents in the dev database, so message-card layouts inside the 340px dock and Lex's "Ask about this document" flow were verified by code path, not on data.
- On very short screens the dialog's close ✕ scrolls with the content (Esc and outside tap still close).
