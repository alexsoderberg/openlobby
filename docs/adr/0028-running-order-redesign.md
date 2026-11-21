# 0028. Running order redesign: light tokens, fonts, Top bar, group colour and Orange rule
Status: Accepted (2026-11-21). Implements REQ-0029 (Decided). The user's decisions of 2026-11-21 are in section 12.
Amends: ADR 0014, 0015, 0016, 0018, 0021, 0023, 0026 and 0027 (each has an "Amendment 2026-11-21" pointer). Where they differ, this ADR wins.

## Context
REQ-0029 (concept A, decided 2026-11-21) replaces the dark theme, the Group rail, the column week grid, the Next up card and the genre look. The whole change is in the frontend. It has no API change, no new service, no new database table and no new runtime dependency: the fonts are self-hosted files, as `frontend/public/fonts/README.md` already does for Space Grotesk and Inter.

The ADR is needed because it changes the design tokens, the fonts, the navigation model and the orange and group colour rules for every module, and because it supersedes visual parts of ADR 0016 and 0026.

## Decision

### 1. Colour tokens (one light theme)
Names are the architect's (REQ-0029 item 1). They are declared in `:root` of `frontend/src/styles/global.css`.

| Token | Value | Use |
|---|---|---|
| `--color-ground` | `#F4F4F1` | page background |
| `--color-surface` | `#FFFFFF` | panels, Create frame, dialog, Dropdown list panel, phone Tab bar, secondary button fill |
| `--color-ink` | `#15171A` | text, control borders, focus ring, Top bar text, toast surface, Next up band |
| `--color-ink-soft` | `#4A4F57` | secondary text |
| `--color-rule` | `#D5D6D1` | dividers only, never a control border |
| `--color-orange` | `#FF5B1F` | the Orange rule (section 6) only |
| `--color-danger` | `#B42318` | danger button fill and error text |
| `--color-wash` | `rgb(21 23 26 / 0.06)` | hover and highlighted option (ink wash) |
| `--color-scrim` | `rgb(21 23 26 / 0.45)` | Create frame and dialog scrim |
| `--color-group-1` to `--color-group-6` | `#2D4FE0`, `#0B7A55`, `#F2B705`, `#00727A`, `#6B3FA0`, `#A3267A` | group colour (section 5) |

Text colour on each fill: ink on orange; white (`--color-surface`) on danger and on groups 1, 2, 4, 5 and 6; ink on group 3. Measured contrast: ink on ground 16.3:1; ink-soft on ground 7.5:1; white on danger 6.6:1; ink on orange 5.8:1; orange on ground 2.8:1 and on white 3.1:1 (so not text); white on groups 1, 2, 4, 5, 6 between 5.3:1 and 7.4:1; ink on group 3 9.9:1. Groups 4 to 6 are accepted by the user (section 12). The danger value is a candidate that the UI expert confirms on contrast.

Replacements of the dark tokens (every component uses the new name; the rename is one mechanical change in PR1a):

| Old | New |
|---|---|
| `--color-bg` | `--color-ground` |
| `--color-text`, `--color-on-accent` | `--color-ink` |
| `--color-muted`, `--color-muted-themed` | `--color-ink-soft` |
| `--color-border`, `--color-card-edge` | `--color-rule` (dividers) or `--color-ink` (controls) |
| `--color-accent` | `--color-orange`, only for the Orange rule uses; any other use becomes ink or wash |
| `--color-accent-tint`, `--color-row-hover` | `--color-wash` |
| `--color-scrollbar-thumb` | `--color-ink-soft` |
| `--color-focus` | removed: the focus rule uses `--color-ink` |
| `--color-danger-bg` | removed: alerts are a surface with an ink border and danger text |
| `--color-bg-raised`, `--color-surface` (the dark translucent value), `--color-page-wash`, `--color-chrome`, `--color-popover-top`, `--color-accent-line`, `--color-frost`, `--color-highlight`, `--color-shade`, `--color-sheen`, `--color-button-*` | removed |
| `--color-online` | removed in PR5b with the hero |

Genre colour tokens (`--color-genre-*`, `--genre-*`, `--size-genre-*`) and `--color-cover-scrim` are removed in PR5a (section 7).

### 2. Other tokens
- **Radius.** Every `--radius-*` token is removed. No `border-radius` in `global.css` or in `ui/` class lists. Native controls keep their own rounding. Test: `styles/flat.test.ts`.
- **Shadows and glass.** Every `--shadow-*` and `--blur-glass` is removed. No `box-shadow`, `text-shadow`, `drop-shadow`, `backdrop-filter` or gradient background. The Create frame and the dialog have no shadow. The Now line's ink outline is a 4 px ink bar under the 2 px orange bar, not a shadow.
- **Motion.** The duration and easing tokens of the transform and opacity motions that remain are kept (page change, Create frame, dialog, scrim, popover fade, press, reveal and stagger of the landing and the Group list). The tokens of glow, sweep, light, grain, meter, flash and icon motion are removed (`--duration-button-glow`, `--duration-button-hover`, `--duration-button-follow`, `--scale-button-*`, `--opacity-button-glow-pressed`, `--stop-button-*`, `--duration-meter`, `--duration-flash`, `--flash-offset`, `--duration-icon`, `--duration-rise`, `--rise-offset`). Rule: transitions animate transform and opacity only (`styles/motion.test.ts`). Colour changes on hover and focus are instant.
- **Fonts.** `--font-heading: "Big Shoulders Display", system-ui, sans-serif`. `--font-text: "Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. `--font-sans` is renamed to `--font-text` (24 uses). Space Grotesk and Inter are removed. No serif font exists in the code today (none is declared), so no serif file goes.
- **Font files** in `frontend/public/fonts/`, latin subset, woff2, from `npm pack` of `@fontsource/big-shoulders-display` and `@fontsource/archivo` at one pinned version each (same method as the README):
  - Big Shoulders Display, weights 800 and 900, with `OFL-BigShouldersDisplay.txt`.
  - Archivo, weights 400, 600 and 700, with `OFL-Archivo.txt`.
  - `@font-face` with `font-display: optional`. A file that is not ready in time leaves the fallback in place, so nothing shifts when it loads (REQ-0029 item 2). The files come from the frontend container; no request goes to a third party.
  - The README table is updated in PR1a. No font package becomes a runtime dependency.
- **Case.** Headings, the Wordmark and times are uppercase by CSS, not by the text.

### 3. Shell: the Top bar replaces the Group rail
- **One nav in the DOM.** `frontend/src/features/shell/TopBar.tsx` renders the Wordmark, the three links Home, Groups and You (`aria-current` on the active one), and the avatar with the display name. From 760 px it is the top bar: orange, full width, height `--size-top-bar`. Under 760 px CSS moves the same nav to the bottom as the Tab bar (`position: fixed`, three items, the active one orange with ink text). `TabBar.tsx` is merged into `TopBar.tsx` in PR1b. Two navs would give screen readers two landmarks with the same links.
- **Removed.** `GroupRail.tsx`, `GroupContextMenu.tsx`, the right-click invite on a group icon, the group icons and the separator. The Invite popover opens only from the Invite button of the Group view header (REQ-0029 item 3).
- **Create group "+".** On `/groups` only: in the Group list header on wide screens, and the floating "+" above the Tab bar on phones. Both open the one `CreateFrame` owned by `AppShell`; its state does not change.
- **Main area.** `.shell__main` keeps `--width-app` (100 rem), centred below the Top bar; text blocks keep `--width-measure`.
- **Phone top.** A ground-coloured bar with the Wordmark and the avatar. No Group strip.

### 4. Running order: the one week view
A new module `frontend/src/runningOrder/` replaces `frontend/src/calendar/` (deleted in PR3a). It contains:
- `RunningOrder.tsx`: the component. Props `days: WeekDay[]` (Monday to Sunday), `lobbies: RunningOrderLobby[]`, `now: Date`, and `onCreateOn?: (day: WeekDay) => void`. Home passes no `onCreateOn`, so no create action exists on Home. The Group view passes it.
- `RunningOrderDay.tsx` and `RunningOrderBlock.tsx`: rendering.
- `runningOrderLayout.ts`: pure functions (no React), unit tested.
- `week.ts`: moved from `calendar/` unchanged (Monday to Sunday arithmetic).

`RunningOrderLobby` is the lobby fields plus `groupId`, `groupName` and `href`. `DashboardLobby` already has `groupId` and `groupName`, and the Group view knows its group's name. No API change.

**Rules**
- **Axis 00:00 to 24:00, local time.** Desktop (760 px and wider): the track has `min-width: var(--size-running-order-min)` (48 rem) and fills the day's width. The component is the scroll container (`overflow-x: auto`), so the page never scrolls sideways. Phone: about 6 hours visible at once; the rest of the axis is reached by horizontal scroll inside the component. DECISION (user, 2026-11-21). The opening position follows the rule above.
- **Midnight.** Each lobby is split at local midnight into one segment per day. A segment that continues into the next day has a continue marker at its end; the next day's segment has a continued-from marker at its start. A lobby that started before Monday and is still running gets a segment from 00:00 on Monday.
- **Lanes.** The segments of one day are sorted by start. Each takes the lowest lane free at its start (greedy). The row height is the lane count times `--size-lane`. No block hides another.
- **Opening position.** On first display the component scrolls once to the first segment whose lobby has not ended, else to the current time (the REQ-0019 target rule on the time axis). Later data changes keep the scroll position.
- **Now line.** Only in today's row, only in the current week. `aria-hidden`. Its position is minutes since midnight over 1440. It updates each minute with the existing `useNow` hook. 2 px orange over a 4 px ink bar.
- **Empty day.** "Nothing booked" in one line, with no axis, on desktop and phone. A past day with no lobby is one line.
- **Block.** One `<a>` to the lobby page. Visible text: label, time range, spots and group name. Accessible name: the same, plus "you" when joined. Text is clipped with an ellipsis per line; under 6 rem wide the label is hidden and the time and spots stay (ASSUMPTION of REQ-0029, measured by the UI expert). A lobby the caller has joined has a 2 px ink border and the text "you".
- **Colour.** The block fill is `--color-group-N` (section 5), set through `data-group-color`. Text is white, or ink on group 3.
- **Legend** (Home only, in `features/dashboard/`): the groups with a block this week, as swatch and name, and "You are in" with the ink border swatch.
- **Not in the running order:** week navigation, a Day list, a view toggle, day pills, swipe between days, a Create lobby button on Home, a Home "+".

**Accessibility (one DOM for both widths; CSS decides the layout)**
- The running order is a `<section>` with its heading ("This week" on Home, the group's calendar heading in the Group view).
- The scroll region is focusable: `tabIndex={0}`, `role="region"`, and a label from the i18n catalog (ADR 0013). This lets a keyboard user scroll it (WCAG 2.1.1).
- Each day is a `<div role="group">` with an `aria-labelledby` pointing at its `<h3>` (weekday and date; `aria-current="date"` on today). Its lobbies are an `<ol>` of `<li>` each holding one `<a>`, in start-time order. Reading and Tab order are therefore day by day, lobby by lobby.
- The track, the axis labels, the Now line, the today marker and the bars are `aria-hidden`.
- **Empty future time, pointer (Group view only).** A plain element under the blocks, `aria-hidden` and not focusable, turns the pointer's x position into a start time rounded down to the half hour. End is start plus 2 hours. The Create lobby form opens with that date and start. Past parts have no hover and open nothing.
- **Empty future time, keyboard (Group view only).** One `<button>` per future day with the visible text "Create lobby" next to the day heading. It opens the Create lobby form with that date and a default start (the next half hour when the day is today, 18:00 otherwise). This is one Tab stop per day, not one per half hour (48 per day). DECISION (user, 2026-11-21). See section 12, item 1.

**Phone.** The same DOM. Each day is a band: its heading row, a track of its segments (`aria-hidden`) that shows about 6 hours at once and scrolls sideways inside the band to the full 00:00 to 24:00 axis. DECISION (user, 2026-11-21). Below it the lobbies as text rows (time, label, group name, spots). An empty day is one line.

### 5. Group colour
- `frontend/src/groupColor/` exports `groupColorIndex(groupId: string): number`, returning 1 to 6. Rule: 32-bit FNV-1a over the UTF-8 bytes of the group ID (offset basis `0x811c9dc5`, prime `0x01000193`, `Math.imul` and `>>> 0` on each step), then `(hash % 6) + 1`. The result is the same on every screen and device. It is never stored, has no API and no user choice.
- Used by the running order blocks and legend, the Group view square and the Group list square.
- Test `groupColor/groupColor.test.ts`: a fixed group ID gives one pinned index (the vector is computed when the test is written), and every result is 1 to 6.
- The group name is shown next to every colour (WCAG 1.4.1). The fills are decorative; the text carries the information. They are not tested to 3:1 against the ground: the yellow fill is 1.8:1 against white. This is a decision of this ADR.

### 6. The Orange rule (replaces the Gold rule)
A closed list. Orange is used for these and nothing else:
1. The Top bar background (text on it is ink).
2. The primary button background (ink text). Create lobby, the header "+" and the floating "+" are primary buttons.
3. The Now line, and the marker of today (underline under the day name).
4. The "Next up" eyebrow and the countdown or "Running" label, on the ink band only.
5. The active tab: an ink underline on the Top bar; an orange fill with ink text on the phone Tab bar.
6. A full role slot (ink text on it).

Rules:
- Orange is never text on the ground or a surface (2.8:1 and 3.1:1). Orange text exists only on the ink band (item 4).
- Dropdown list states use no orange: the selected option has a check mark and a 2 px ink edge; the highlighted option has the ink wash and the focus ring. This changes REQ-0029 item 9 (orange tint on the highlighted option), which is not in the list. DECISION (user, 2026-11-21). See section 12, item 2.
- Checkboxes and radios: `accent-color: var(--color-ink)`.
- Focus: `:focus-visible` is a 2 px ink outline with a 2 px offset, on every element. It passes 3:1 on ground and surface. Orange is never a focus colour.
- Counts are ink, with tabular figures. The admin marker, the Monogram and the joined marks are ink.
- Test `styles/orangeRule.test.ts` replaces `goldRule.test.ts` in PR1a: orange appears only in the selectors of the list above, orange is never a `color` outside the ink band, and the focus rule uses ink.

### 7. Genre look, covers and logos (ADR 0016 and 0026 visuals)
- **Data and API are unchanged.** `genre` stays stored and editable in the game form. `GenreName` and `GENRE_OPTIONS` stay.
- **Removed from the UI in every place:** tint, background pattern, genre icon, 3D motif, accent stripe, cover. Each screen drops its `GenreFrame` in its own PR, as plain markup. The component `GenreFrame.tsx` and the theme data of `genreThemes.ts` are deleted in PR5a.
- **Game cover:** shown nowhere. The upload, the storage and `coverVersion` stay (ADR 0026).
- **Game logo:** not in running order blocks. The small block size and its token are removed with the old grid in PR3a. The regular (2.5 rem) and large (4 rem) sizes stay. The logo box and the Monogram are squares.
- **Landing hero (ADR 0015).** The hero cards use the neutral look. The genre motif shapes (the motif part of `heroScene.ts` and `MotifDescriptor` in `hero.ts`) and the glow phase of `heroCycle.ts` (`glowSeconds`) are removed in PR5b, because glow is not allowed (REQ-0029 item 1). The 3D scene stays (REQ-0029 ASSUMPTION, item 8). `heroCycle.ts` is the lobby fill cycle, not a genre cycle, so the rest of it stays.

### 8. Layout rules that change (REQ-0025)
- **Main area:** below the Top bar, centred, at most 100 rem. The rail beside it is gone.
- **Side column:** the 98 rem breakpoint and `--width-aside` (19 rem) do not change. It is used by the Group view and the lobby page. The Home page has no side column: the Next up band is full width above the running order.
- **Main column:** on Home the running order; in the Group view the line-up, the players and the group cards.

### 9. Avatar
An Avatar is a square with its initials in `--font-heading`. `.initials-icon` loses its round shape in PR1a. The glossary row changes. ADR 0018 gets a pointer.

### 10. Consequences
- Frontend only. `docs/services.md` does not change.
- Every component that used an old token name is touched in PR1a (mechanical rename, section 1). Tests that pin old names are updated in the same PR.
- The mixed look between PRs is accepted by REQ-0029 (PR1a, PR1b, PR2, PR3a, PR3b, PR4 and PR5a each leave some screens in the old layout).
- The right-click invite path has no replacement, as REQ-0029 says.

### 11. Alternatives considered
- **Keep the dark theme and only recolour.** Rejected by the user; the REQ says the layouts must change.
- **Canvas or SVG for the running order.** Rejected. DOM links give keyboard and screen reader behaviour without extra code.
- **Store the group colour.** Rejected: derived, no choice, no API, and a stored value would need a migration.
- **Keep the rail with group icons.** Rejected by REQ-0029.
- **Top nav and Tab bar both in the DOM.** Rejected: duplicate landmarks and links. One nav moved by CSS.
- **The full 24 hours fitting the phone width.** Rejected by the user (section 12, item 4): about 6 hours are visible, and the rest is reached by horizontal scroll.
- **Shadow on the Create frame and the Now line outline.** Rejected: no shadows (item 9 of REQ-0029).
- **Arrow-key navigation through every empty slot.** Deferred (YAGNI). The keyboard route is one stop per future day (section 4).

### 12. Decisions of the user (2026-11-21)
All items are DECISION (user, 2026-11-21). They record the answers to the open points of the first draft of this ADR.
1. **Keyboard route to empty time (REQ-0029 item 12).** One Tab stop per future day: a "Create lobby" button with a default start time (the next half hour when the day is today, 18:00 otherwise). Not one stop per half hour. REQ-0029 item 12 is changed to match.
2. **Highlighted Dropdown option.** Ink wash, not orange. REQ-0029 item 9 is changed to match. Orange stays a closed list of six uses (section 6).
3. **Group colours 4 to 6** are accepted: teal `#00727A`, violet `#6B3FA0`, magenta `#A3267A`. The danger colour `#B42318` stays a candidate; the UI expert confirms it on contrast.
4. **Phone time axis.** About 6 hours are visible at once. The whole 00:00 to 24:00 axis is reached by horizontal scroll inside the component. The phone band opens at the current time, or at the first lobby that has not ended. REQ-0029 is aligned. The desktop axis is as in section 4.
5. **Landing hero.** Neutral cards. The genre motifs and the glow phase are removed in PR5b. The 3D scene stays.
6. **PR split.** Accepted: PR1a, PR1b, PR2, PR3a, PR3b, PR4, PR5a, PR5b, in that order (section 13). REQ-0029 Delivery is aligned.

REQ-0029 findings resolved in favour of this ADR:
- Finding 1 (highlighted option, item 9): ink wash (item 2 above).
- Finding 2 (shadow on the Create frame, item 1): no shadow. Section 2.
- Finding 3 (heroCycle is not dead code): the glow phase goes in PR5b; the lobby fill cycle stays. Section 7.
- Finding 4 (no serif token or font in the code): nothing to remove. Section 2.
- Finding 5 (motion): the compositor-only entrance motions that remain (Group cards, landing) are kept; colour transitions are not. Section 2.

### 13. PR split
DECISION (user, 2026-11-21): accepted. Order: PR1a, PR1b, PR2, PR3a, PR3b, PR4, PR5a, PR5b. Each one ships on its own. PR1 is split because it is a token rename across the app plus a navigation change; a single review of both would be too large (memory: small PRs).

| PR | Content (from REQ-0029 Delivery, plus this ADR) |
|---|---|
| PR1a | Tokens (section 1 and 2), mechanical rename, Orange rule mapping, flat rules (no radius, shadow or glass), motion trimmed, fonts swapped, Button, Dialog, Create frame, Dropdown list, toast, Alert and Avatar restyled. Tests in section 14. |
| PR1b | Top bar with tabs, `TabBar` merged into `TopBar`, Group rail and its context menu removed, "+" moved to the Group list header. Depends on PR1a. |
| PR2 | Home: Next up band, `runningOrder/` module, group colour module, legend, phone bands. Removes the dashboard's card, day list, group strip, toggle and `useStoredChoice`. The Group view keeps the old grid until PR3a. |
| PR3a | Group view Calendar view uses `RunningOrder` with `onCreateOn`; `calendar/` module deleted. |
| PR3b | Group view header, line-up list, members with Game chips, Group feed, Group cards without genre frame. |
| PR4 | Lobby page: large time block, seat boxes, side column for facts and settings, `GenreFrame` removed from the lobby details. |
| PR5a | Remaining pages (You page, game list, game form, Create lobby form); `GameImageField` plain frame; genre code and genre tokens deleted. |
| PR5b | Landing headline in `--font-heading`, hero restyled (section 7), last token and dead CSS cleanup, `--color-online` removed. |

### 14. Tests that guard the tokens and how they change
| Test | Change | PR |
|---|---|---|
| `styles/tokens.test.ts` | Rewritten for the light theme: ink, soft ink and danger on ground and surface at 4.5:1 or more; ink on orange; white and ink on each group token; no group colour equal to orange or danger; six group tokens distinct; `--font-heading` and `--font-text` values; the font files exist and are declared with `font-display: optional`; no Space Grotesk or Inter. | PR1a |
| `styles/goldRule.test.ts` | Replaced by `styles/orangeRule.test.ts` (section 6). | PR1a |
| `styles/flat.test.ts` (new) | No `border-radius`, `box-shadow`, `text-shadow`, `drop-shadow`, `backdrop-filter` or gradient in `global.css` and in `ui/` class strings. Extends the shadow rule of `ui/uiClasses.test.ts`, whose radius-token rule is removed. | PR1a |
| `styles/motion.test.ts` | Backdrop-filter assertion on `.topbar::before` removed. The composited-only transition rule stays. | PR1a |
| `styles/zIndex.test.ts` | Unchanged. If the Top bar gets a z-index token, it joins the order check. | PR1a, PR1b |
| `styles/scrollbar.test.ts`, `styles/popover.test.ts`, `styles/selectSheet.test.ts` | Token and shadow names updated. | PR1a |
| `ui/Button.test.tsx` | Glow assertions removed. Variant colours updated. | PR1a |
| `ui/Toast.test.tsx` | Ink surface and white text. | PR1a |
| `features/landing/heroContrast.test.ts` | Token names in PR1a; genre-free in PR5b. | PR1a, PR5b |
| `styles/runningOrder.test.ts` (new) | The axis min-width token, the scroll container is the component (`overflow-x: auto`), not the page. Replaces `styles/timeGrid.test.ts`. | PR2 (deleted old file in PR3a) |
| `runningOrder/runningOrderLayout.test.ts` (new) | Midnight split, the before-Monday segment, lanes for overlaps, the opening target, the Now line position. | PR2 |
| `runningOrder/RunningOrder.test.tsx` (new) | Links in start order per day; accessible name; "Nothing booked"; Now line hidden from the accessibility tree; no create button without `onCreateOn`; one create button per future day with it. | PR2, PR3a |
| `groupColor/groupColor.test.ts` (new) | Pinned index for a fixed group ID; range 1 to 6. | PR2 |
| `styles/spacing.test.ts` | The "Next up card spacing" block removed. | PR2 |
| `styles/groupCards.test.ts` | Breakpoints and tap size kept; fade-up keyframe (transform and opacity) kept. | PR3b |
| `calendar/*.test.*`, `styles/timeGrid.test.ts` | Deleted with the module. | PR3a |
| `dashboard/ThisWeek.test.tsx`, `Dashboard.test.tsx` | Rewritten for the band and the running order. | PR2 |
| `hooks/useStoredChoice.test.ts` | Deleted with the hook. | PR2 |
| `genres/genreContrast.test.ts`, `genreThemes.test.ts`, `accentStripe.test.ts`, `GenreFrame.test.tsx` | Deleted with their code. | PR5a |
| `features/landing/heroCycle.test.ts` | Glow assertions removed. | PR5b |

### 15. Dead code and where it is deleted
| Code | Replaced by | Deleted in |
|---|---|---|
| `features/shell/GroupRail.tsx`, `GroupContextMenu.tsx`, `.group-rail` CSS, `--size-rail`, `--size-group-icon` | Top bar (section 3) | PR1b |
| `features/shell/TabBar.tsx` (merged into `TopBar.tsx`) | One nav | PR1b |
| Radius, shadow, glass and the glow, sweep, grain, meter, flash and icon motion tokens (section 2) | Flat tokens | PR1a |
| `--color-accent`, `--color-focus`, `--color-danger-bg` and the other removed colours (section 1) | Orange rule, ink focus | PR1a |
| Space Grotesk and Inter `@font-face`, files, `OFL-SpaceGrotesk.txt`, `OFL-Inter.txt` | Big Shoulders Display, Archivo | PR1a |
| `styles/goldRule.test.ts` | `orangeRule.test.ts` | PR1a |
| `dashboard/NextUpCard.tsx`, `DayList.tsx`, `GroupStrip.tsx`, `ThisWeek.tsx`, their tests, `.side-layout` use on the Dashboard | `NextUpBand`, `RunningOrder`, legend | PR2 |
| `hooks/useStoredChoice.ts`, its test and its export (its only user was the This week toggle) | None | PR2 |
| `calendar/week.ts` | Moved to `runningOrder/week.ts` | PR2 |
| `calendar/` (`WeekTimeGrid`, `TimeGrid`, `TimeGridDay`, `TimeBlock`, `DayPills`, `gridGeometry`, `useGridTop`, index and their tests); `styles/timeGrid.test.ts`; `--size-hour`, `--size-grid-height`, `--size-grid-title`, `--size-grid-gutter`, `--size-game-logo-small` | `RunningOrder` | PR3a |
| `GenreFrame` in `GroupCard` and `LobbyList` | Plain markup | PR3b |
| `GenreFrame` in `LobbyDetails` | Plain markup | PR4 |
| `GenreFrame` in `GameImageField` | Plain frame | PR5a |
| `genres/GenreFrame.tsx`, the theme data of `genres/genreThemes.ts`, `public/genre-art/`, `--color-genre-*`, `--genre-*`, `--size-genre-*`, `--color-cover-scrim` | None | PR5a |
| Hero motif shapes (`heroScene.ts`, `MotifDescriptor`), glow phase of `heroCycle.ts`, `--color-online` | Neutral hero card | PR5b |
| Round Avatar and the rounded `GameLogo` box | Squares | PR1a |
| i18n keys whose last user is deleted (for example `calendarDayPillsLabel`) | None | Same PR as the code (ADR 0013) |

## Amendments made with this ADR
Each amended ADR carries a pointer section "Amendment 2026-11-21 (ADR 0028)". The rule of this ADR wins where they differ. ADRs 0014, 0015, 0016, 0018, 0021, 0023, 0026 and 0027.
