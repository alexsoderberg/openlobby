# 0028. Running order redesign: light tokens, fonts, Top bar, group colour and Orange rule
Status: Accepted (2026-11-21), amended 2026-11-21: dark theme only. Section 16 replaces the light palette and parts of sections 1 to 9, 12 to 14. Implements REQ-0029 (Decided). The user's decisions of 2026-11-21 are in sections 12 and 16.
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

Genre colour tokens (`--genre-*`, `--size-genre-*`) and `--color-cover-scrim` are removed in PR5a (section 7). The three `--color-genre-*` tokens of the hero are removed in PR5b.

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
- **Removed from the UI in every place:** tint, background pattern, genre icon, 3D motif, accent stripe, cover. Each screen drops its `GenreFrame` in its own PR, as plain markup. The component `GenreFrame.tsx` is deleted in PR5a. The theme data of `genreThemes.ts` and `public/genre-art/` are fully deleted in PR5b, when the hero (their last user) stopped using them.
- **Game cover:** removed (REQ-0026 Amendment 2026-11-25, ADR 0026 Amendment 2026-11-25): no upload, no storage, no `coverVersion` or `gameCoverVersion`. The cover rows are deleted by migration 0012.
- **Game logo:** not in running order blocks. The small block size and its token are removed with the old grid in PR3a. The regular (2.5 rem) and large (4 rem) sizes stay. The logo box and the Monogram are squares.
- **Landing hero (ADR 0015).** The hero cards use the neutral look and are unlit (`MeshBasicMaterial`, ADR 0015 Amendment 2026-11-24): no pointer light, no ambient or point light. The genre motif shapes (the motif part of `heroScene.ts` and `MotifDescriptor` in `hero.ts`) and the glow of `heroCycle.ts` are removed in PR5b, because glow is not allowed (REQ-0029 item 1). Only the glow goes: the 1.5 s full hold stays (`fullSeconds` in `heroCycle.ts`, the step of the full card). The full card holds one extra step and is marked by a text-colour edge, not orange (user, 2026-11-24). three.js stays for depth, perspective, tilt and float (REQ-0029 ASSUMPTION, item 8). `heroCycle.ts` is the lobby fill cycle, not a genre cycle, so the rest of it stays.

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
| PR5b | Landing headline in `--font-heading`, hero restyled and unlit (section 7), landing width `--width-landing` 72rem, two-column hero from 60rem and steps in 1, 2 and 4 columns, last token and dead CSS cleanup, `--color-online` and the three `--color-genre-*` tokens removed, `genreThemes.ts` and `public/genre-art/` deleted. Done 2026-11-24. |

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
| `genres/genreContrast.test.ts`, `accentStripe.test.ts`, `GenreFrame.test.tsx` | Deleted with their code. | PR5a |
| `genres/genreThemes.test.ts` | Deleted with its code. | PR5b |
| `features/landing/heroCycle.test.ts` | Glow assertions removed. | PR5b |

### 15. Dead code and where it is deleted
| Code | Replaced by | Deleted in |
|---|---|---|
| `features/shell/GroupRail.tsx`, `GroupContextMenu.tsx`, `.group-rail` CSS, `--size-rail`; `dashboard/GroupStrip.tsx`, `ui/GroupIcon.tsx`, `.group-strip` and `.group-icon` CSS, `--size-group-icon` (16.12 item 1) | Top bar (section 3) | PR1b |
| `features/shell/TabBar.tsx` (merged into `TopBar.tsx`) | One nav | PR1b |
| Radius, shadow, glass and the glow, sweep, grain, meter, flash and icon motion tokens (section 2) | Flat tokens | PR1a |
| `--color-accent`, `--color-focus`, `--color-danger-bg` and the other removed colours (section 1) | Orange rule, ink focus | PR1a |
| Space Grotesk and Inter `@font-face`, files, `OFL-SpaceGrotesk.txt`, `OFL-Inter.txt` | Big Shoulders Display, Archivo | PR1a |
| `styles/goldRule.test.ts` | `orangeRule.test.ts` | PR1a |
| `dashboard/NextUpCard.tsx`, `DayList.tsx`, `ThisWeek.tsx`, their tests, `.side-layout` use on the Dashboard | `NextUpBand`, `RunningOrder`, legend | PR2 |
| `hooks/useStoredChoice.ts`, its test and its export (its only user was the This week toggle) | None | PR2 |
| `calendar/week.ts` | Moved to `runningOrder/week.ts` | PR2 |
| `calendar/` (`WeekTimeGrid`, `TimeGrid`, `TimeGridDay`, `TimeBlock`, `DayPills`, `gridGeometry`, `useGridTop`, index and their tests); `styles/timeGrid.test.ts`; `--size-hour`, `--size-grid-height`, `--size-grid-title`, `--size-grid-gutter`, `--size-game-logo-small` | `RunningOrder` | PR3a |
| `GenreFrame` in `GroupCard` and `LobbyList` | Plain markup | PR3b |
| `GenreFrame` in `LobbyDetails` | Plain markup | PR4 |
| `GenreFrame` in `GameImageField` | Plain frame | PR5a |
| `genres/GenreFrame.tsx`, `--genre-*`, `--size-genre-*`, `--color-cover-scrim` | None | PR5a |
| `genres/genreThemes.ts` (the theme data, `GenreTheme`, `themeForGenre`), `public/genre-art/`, `--color-genre-*` (the three hero accents) | None; `GenreName` and `GENRE_OPTIONS` stay | PR5b |
| Hero motif shapes (`heroScene.ts`, `MotifDescriptor`), the glow of `heroCycle.ts` (the 1.5 s full hold stays as `fullSeconds`), `--color-online`, the hero's light objects (ambient and point lights, pointer light) | Neutral unlit hero card | PR5b |
| Round Avatar and the rounded `GameLogo` box | Squares | PR1a |
| i18n keys whose last user is deleted (for example `calendarDayPillsLabel`) | None | Same PR as the code (ADR 0013) |

## 16. Amendment 2026-11-21: dark theme
DECISION, user, 2026-11-21. After the light build of PR1a the user said: "Dark mode is mandatory." Three dark mockups were shown, and the user chose option 1 "Stage" (warm charcoal, signal orange): "We like this design. Go with it. Accent colours we can discuss later." The layout decisions of sections 3 to 5, 8 and 13 stay. Where this section and the earlier text differ, this section wins.

Replaced: section 1 (palette and names), section 2 (radius and shadow bullets), section 3 (phone top bar colour), section 4 (block colour and outline, legend, Now line), section 5 (text on group fills), section 6 (Orange rule), section 7 (square logo box), section 9 (Avatar), section 12 item 2, section 13 (PR4), and the test rows of section 14 named in 16.9.

### 16.1 One theme: dark
- Dark only. `color-scheme: dark` on `:root`. No light values and no `dark:` variants (ADR 0023).
- A light theme may come later as a second set of values for the same token names. No component changes then.

### 16.2 Colour tokens
Declared in `:root` of `frontend/src/styles/global.css`. The names are the architect's. The values are the user's (option 1).

| Token | Value | Use |
|---|---|---|
| `--color-ground` | `#161412` | page background |
| `--color-surface` | `#201d1a` | Next up band, panels, Create frame, dialog, Dropdown list panel, phone Tab bar, text fields |
| `--color-raised` | `#2b2723` | hover of buttons, the highlighted option, avatars and monograms, toasts |
| `--color-rule` | `#332f2a` | dividers only (a meter track is `--color-raised`) |
| `--color-rule-strong` | `#4b453f` | decorative panel edges (1 px), never a control |
| `--color-control-line` | `#7a7268` | the border of a control: text field, Dropdown trigger, secondary button (1 px). At least 3:1 on ground (3.88), surface (3.54) and raised (3.13), WCAG 1.4.11 |
| `--color-text` | `#f2ede5` | text, icons, the focus outline, the outline of my own block, fills of selected controls and meters (for example the view toggle thumb and the meter fill) |
| `--color-muted` | `#aaa298` | secondary text |
| `--color-signal` | `#ff6a2b` | the Orange rule (16.4) only. It is the one accent token: a new accent changes only this value and the list in 16.4 stays |
| `--color-on-signal` | `#161412` | text and icons on the signal fill, Top bar text and tab underline |
| `--color-danger` | `#ff7a85` | danger text and danger border |
| `--color-scrim` | `rgb(0 0 0 / 0.6)` | Create frame and dialog scrim. ASSUMPTION: not in the mockups; the UI/UX expert checks it in the browser |
| `--color-group-1` to `--color-group-6` | `#6f97f7`, `#4fbf7f`, `#e0b83a`, `#ec7aa6`, `#3dbab5`, `#a98be8` | group colour (section 5) |
| `--color-on-group` | `#161412` | text on every group fill |

Contrast (the user's check): text 15.8:1 on ground; muted at least 5.9:1 on ground, surface and raised; signal 6.4:1 on ground; danger 7.3:1 on ground; text on group fills 6.5 to 9.7:1. Rule: every text colour on a surface in the table is at least 4.5:1. `styles/tokens.test.ts` checks it, and checks that `--color-control-line` is at least 3:1 on ground, surface and raised.

Names replaced (sections 1 and 2 used the light names):

| Earlier name | Now |
|---|---|
| `--color-ink` as text | `--color-text` |
| `--color-ink` on a signal or group fill | `--color-on-signal`, `--color-on-group` |
| `--color-ink` as a control border | `--color-control-line` |
| `--color-ink-soft` | `--color-muted` |
| `--color-orange` | `--color-signal` |
| `--color-wash` | `--color-raised` |
| `--color-surface` (white) | `--color-surface` (dark value) |

The other names of section 1 keep their meaning (ground, rule, danger, group colours), with the new values. `--color-focus` stays removed.

### 16.3 Surfaces, borders, focus, buttons
- No shadows. Floating panels (Create frame, dialog, Dropdown list panel, toast, phone Tab bar) are separated by their surface and a 1 px `--color-rule-strong` border.
- Controls (text fields, Dropdown trigger, secondary button) have a 1 px `--color-control-line` border, which meets 3:1 against the ground, surface and raised (WCAG 1.4.11). `--color-rule-strong` is for decorative panel edges only.
- Focus: `:focus-visible` is a 2 px `--color-text` outline with a 2 px offset, on every element. Focus is never signal. Inside the Top bar it is `--color-on-signal` (16.11 item 1).
- Checkboxes and radios: `accent-color: var(--color-text)`.
- Buttons. Primary: signal fill, on-signal text, no colour change on hover, press is a transform. Secondary: surface fill, control-line border, text; hover raised. Ghost: no border, text; hover raised. Danger: no fill, danger border and text; hover raised. Icon-only buttons follow the same rules.

### 16.4 Orange rule (replaces section 6)
`--color-signal` is used for these seven things and nothing else:
1. The Top bar background, at every width. Option 1 shows the orange bar on phones too, so this replaces the ground bar under 760 px (section 3 and REQ-0029 item 3). Text on it is `--color-on-signal`.
2. The primary button fill.
3. The Now line, and the marker of today (the bar under the day name).
4. The Next up band: the "Next up" eyebrow and the countdown or "Running" label. This is the only place where signal is text.
5. The active tab: an underline in `--color-on-signal` on the Top bar; the active item of the phone Tab bar has a signal fill with on-signal text.
6. A full role slot: a check icon in signal and the count in text colour. The check icon carries the meaning; signal alone never does.
7. My own avatar in a player list: signal fill, on-signal initials.

Rules:
- Signal is never text except in item 4. Elsewhere it is a fill or an icon. Measured: signal on surface 5.9:1 (architect's calculation; the token test checks it).
- Dropdown lists use no signal. The selected option has a check mark and a 2 px edge at its left in text colour. The highlighted option has the raised fill. This changes REQ-0029 item 9 (section 12, item 2).
- Counts, the admin marker, the Monogram and the joined marks are text colour.
- Group colours are never used for states or focus.
- Test `styles/orangeRule.test.ts` replaces the Gold rule test: `--color-signal` as `color` only in the Next up band selectors (item 4); as a background only in the selectors of items 1 to 3 and 5 to 7; the focus rule uses `--color-text`.

### 16.5 Radius (replaces the radius part of section 2)
- Two tokens only, in `:root`: `--radius: 8px` and `--radius-sm: 4px`. The ADR 0023 names `--radius-panel`, `--radius-popover`, `--radius-control`, `--radius-badge` and `--radius-chip` are removed. `--radius` takes the first three; `--radius-sm` takes the last two.
- `--radius` (8 px): Next up band, panels and Group cards, Create frame, dialog, Dropdown list panel (its phone sheet has the top corners), toast, all buttons, text fields, Dropdown trigger, the items of the phone Tab bar. The bar itself is square (16.11 item 7).
- `--radius-sm` (4 px): running order blocks, Game chips, tags, the admin marker, Monograms, avatars, the game logo box, colour swatches.
- Rule: every `border-radius` in `global.css` and in `ui/` class lists is `var(--radius)` or `var(--radius-sm)`. No literal value, no percentage, no pill. Native controls keep their own rounding. Icon-only buttons are not round (this replaces the round icon button of ADR 0021).

### 16.6 Shadows, glass, gradients
- No `box-shadow`, `text-shadow`, `drop-shadow`, `backdrop-filter`, glow or sheen. The Now line's outline is a 4 px `--color-ground` bar under the 2 px signal bar.
- No blended gradient. Ruled lines may use `repeating-linear-gradient` with hard stops, such as the hour lines of the running order track. This is a permanent exception for ruled lines, not a temporary one. Blended gradients stay forbidden. `styles/flat.test.ts` keeps this rule.

### 16.7 Running order blocks, legend, Now line (sections 4 and 5)
- Block: fill `--color-group-N`, text `--color-on-group`, radius `--radius-sm`. A lobby the caller has joined has a 2 px `--color-text` outline set inside the block (`outline-offset: -2px`, so it cannot overlap a neighbour) and the text "you". The text carries the meaning, not the outline alone.
- Legend: "You are in" swatch is a 2 px text-colour outline with no fill.
- Now line: 2 px signal over a 4 px ground bar, `aria-hidden`, as section 4 says.
- The text on group fills is `--color-on-group` in every group. The earlier "white, or ink on group 3" is replaced. The group name rule of section 5 stays.

### 16.8 Next up band, Top bar, Avatar, lobby page
- Next up band: `--color-surface` fill, text colour, eyebrow and countdown in signal (16.4 item 4). Its primary button is the signal fill.
- Top bar: signal background at every width; the Wordmark and the tabs in `--color-on-signal`; the active tab has the underline of 16.4 item 5. The avatar of me on the Top bar has a `--color-ground` fill and text-colour initials.
- Avatar, Monogram, game logo box: a square with `--radius-sm` corners. Initials in `--font-heading`, `--color-raised` fill, text colour. A Discord picture (ADR 0018) fills the same square. This replaces the square-only wording of section 9 and the square of section 7.
- Lobby page (REQ-0029 item 6 changes): the Seat boxes are dropped. The lobby page keeps the player list as it is built today (role group headings with the role icon and count; rows with the avatar, the name, the "You" tag and the preferred roles note), the role slots (16.4 item 6 for a full one), and the "Change seat" and "Leave lobby" buttons. There is no button per seat. Icons stay where they are today.

### 16.9 Other rules changed
- Section 12, item 2 and section 13 (PR4): as 16.4 and 16.8.
- Section 14: `styles/tokens.test.ts` checks the values and contrast of 16.2; `styles/orangeRule.test.ts` checks 16.4; `styles/flat.test.ts` allows only the two radius tokens in `border-radius`, forbids shadows, glass and blended gradients, and allows ruled hard-stop gradients; `ui/Button.test.tsx` and `ui/Toast.test.tsx` check the colours of 16.3 and 16.8. The other rows of section 14 stand.
- ADR 0027 (the panel is a white surface with a 2 px ink border), and the 2026-11-21 sections of ADRs 0018, 0021 and 0023 name light values or round shapes. This section replaces them. Their pointers already say so; they are not edited.

### 16.10 Alternatives considered
- Light and dark theme together. Rejected: the user made dark mandatory. A light theme later reuses the names (16.1).
- Keep `--color-orange` as the token name. Rejected: the name would be wrong once the accent changes.
- A shadow on floating panels. Rejected: a border separates them, and no shadows are allowed.
- Signal for text in general (counts, links). Rejected: it keeps the accent rare and readable only on the Next up band.
- A hover colour token for the primary button. Rejected (YAGNI): it has no colour change.

### 16.11 Rulings on the PR1a build (2026-11-21)
DECISION, architect, on the deviations the UI/UX expert built. Each one amends the rule it names.
1. **Focus on the Top bar (amends 16.3).** Inside the Top bar the focus outline is `--color-on-signal` (`#161412`, 6.4:1 on signal). The text colour on signal is about 2.5:1, below the 3:1 of WCAG 1.4.11. Selector: `.top-bar :focus-visible` only. The test covers it. Focus is still never signal.
2. **Highlighted Dropdown option (amends 16.4).** On a fine pointer the highlighted option has the raised fill and a 2 px `--color-text` ring; the ring is the keyboard focus. Raised alone is about 1.1:1 against the surface, too little. On touch sheets only the raised fill is shown: touch has no keyboard focus, and the check mark shows the selection.
3. **Radius on layers and on the sheet (amends 16.5).** `border-radius` may also be `inherit`, and only on pseudo-element, hover and pattern layers and on the cover image, inside a box that has a token radius. Such a layer follows its box. The phone bottom sheet has square bottom corners: `var(--space-0)` (zero) on the bottom, `var(--radius)` on the top. `styles/flat.test.ts` accepts exactly `var(--radius)`, `var(--radius-sm)`, `var(--space-0)`, and `inherit` in the layer selectors.
4. **Genre motif and cover hover, temporary until PR5a.** `--genre-motif-opacity` goes from 0.12 to 0.08: muted text over the motifs measured 4.15 to 4.44:1 at 0.12. The game-cover hover is opaque. Both are removed with `GenreFrame` in PR5a (section 15). No new genre visual is added in the meantime.
5. **Ruled hour-line gradient of the old week grid (16.6).** Allowed as the permanent exception for hard-stop repeating gradients. It goes with the grid in PR3a. The running order track may use the same form. No blended gradient.
6. **`--color-online` (landing glow).** Not in the 16.2 table, and not added to it. It stays in PR1a and is removed in PR5b with the hero, as section 1 and section 15 already say. It is not used by any new element.
7. **Phone Tab bar corners (amends 16.5, accepted from the UI/UX expert).** The phone Tab bar stays edge to edge with square corners. Only its items take `--radius`. The bar is fixed to the bottom and side edges of the window, so rounded corners would show the page through the screen edge. The approved option 1 mockup draws it the same way.

Temporary tokens, with the PR that deletes them: `--color-online` (PR5b), `--genre-motif-opacity` and the game-cover hover (PR5a), the genre tokens (PR5a), the three hero `--color-genre-*` tokens (PR5b). Section 15 is the list of what is deleted where.

### 16.12 Rulings on the PR1b build (2026-11-21)
DECISION, architect, on the deviations the UI/UX expert built for the Top bar. Each one amends the section it names.
1. **Group strip deleted in PR1b (amends section 15).** The reviewer found that `GroupStrip` on Home was still a second nav on phones. So `GroupStrip`, `ui/GroupIcon`, `.group-icon`, `.group-strip` and `--size-group-icon` are all deleted in PR1b, as section 15 first planned. Section 15's row for `--size-group-icon` moves from PR2 to PR1b. Between PR1b and PR2 Home has no group strip; the groups are reached through the Groups tab, as REQ-0029 item 3 allows. PR2 gives Home its running order and links. Accepted.
2. **Top bar z-index (amends section 3). The header does not get 60.** A header at `z-index: 60` puts the Top bar above the scrim (40) and the Create frame (50) at every width. The Top bar is part of the page and is dimmed like it, and the Tab bar stays above the scrim (60) as before this PR. Rule: the Top bar is `--z-top-bar: 10`, `position: sticky` from 760 px only. Under 760 px it has no `position: sticky` and no z-index. Its nav, the Tab bar, is then `position: fixed` in the page's stacking context and sits at its own z-index 60. A sticky header would make its own stacking context and would cap the Tab bar, which is why the phone Top bar scrolls away with the page. This gives up the sticky phone bar of the option 1 mockup. DECISION, to be shown to the user with the PR. The one-nav rule of section 3 is kept, so the Tab bar cannot move out of the header.
3. **No skip link (pre-existing, not a PR1b blocker).** The rail had no skip link either. Focus on navigation moves to `main`. A skip link is a separate small task for WCAG 2.4.1, to be recorded in the backlog by the product owner. Delivered 2026-11-25 in the final fixes PR on `redesign-preview` (backlog T1).
4. **Avatar link without `aria-current` on `/profile` (accepted).** The You tab carries `aria-current`, so the page has one current link.
5. **Header "+" through a render prop on the AppShell children (accepted).** `AppShell` keeps the one `CreateFrame` (section 3). `GroupListPage` receives the opener through the render prop. No second frame and no context.
6. **Group context menu removed, with "Invite people" (accepted).** No requirement needs it. REQ-0029 (the Top bar requirements) removes the right-click menu on a group icon and the right-click invite path, and the Invite popover opens only from the Group view header's Invite button. The menu had one item. ADR 0023 point 5 and its PR F (the `DropdownMenu` for `GroupContextMenu`) are cancelled with it.
7. **Active desktop tab: bold with a 3 px `--color-on-signal` underline drawn by `::after` (accepted, with a limit).** This is the underline of section 16.4 item 5. The weight is the token `--font-weight-tab-active` (700), so no component writes a weight. The bold weight must not move the other tabs: the nav keeps its width when the active tab changes, checked at 760 px and 1280 px.
8. **Focus order of the Top bar (WCAG 2.4.3, accepted with a limit).** The DOM order is Wordmark, nav, avatar. On a desktop this is the visual order. On a phone the nav is at the bottom of the window, so Tab goes Wordmark, then the tabs at the bottom, then the avatar at the top right, then the page. No single DOM order fits both widths. `order` and CSS `reading-flow` do not change focus order in every browser (`reading-flow` needs Chrome 137 or later), so neither is used. The sequence is still complete, consistent and operable on both widths, so 2.4.3 holds. Limit: if a keyboard test shows that a user loses their place on the phone, the phone fix is a second avatar or a change of the nav position, decided by the architect. Accepted for PR1b.

### Removed from the Top bar build in PR1b
- `--size-rail`, `.group-rail`, `GroupRail.tsx`, `GroupContextMenu.tsx`, `TabBar.tsx` (merged into `TopBar.tsx`), `GroupStrip`, `ui/GroupIcon`, `.group-icon`, `.group-strip` and `--size-group-icon` (item 1).

### 16.13 Rulings on the PR2 build (2026-11-22)
DECISION, user, 2026-11-22, after seeing PR2 live: items 1 and 3 below. The rest are the architect's rulings. Each one amends the section it names.
1. **Desktop axis (amends section 4, "Axis" rule). DECISION, user.** Wide screens show at most 16 hours beside the day names (`--running-order-wide-hours: 16`). An hour is never narrower than 4.5rem (`--size-running-order-hour-min`). Visible hours = min(16, floor(track width / 4.5rem)), so a narrow desktop shows fewer hours. The rest of the 00:00 to 24:00 axis scrolls sideways inside the component, as on phones. "Fit 00:00 to 24:00" is withdrawn.
2. **Opening position (amends section 4, "Opening position"). Architect.** Let `v` be the visible hours.
   - From 12 visible hours up: the window starts at the earliest start hour of the lobbies that have not ended, but never later than 08:00. Then start = min(earliest hour, 08:00, 24 − v), so the window never runs past 24:00. If no lobby has not ended, the start is the current hour, clamped the same way.
   - Below 12 visible hours: the view opens at the first lobby that has not ended, or at now, clamped to 24 − v.
   - With the whole day visible (v = 24) it opens at 00:00.
3. **Today keeps its axis and Now line (amends section 4, "Empty day"). DECISION, user.** Today with no lobby shows its axis and the Now line, with "Nothing booked" inside the track. Other empty days stay one line with no axis.
4. **Blocks narrower than 6rem (amends section 4, "Block"). Architect.** The label is kept (clipped with an ellipsis), with the start time and the spots. The time range and the group name are dropped. The group name stays in the accessible name and in the legend. This replaces "under 6 rem the label is hidden".
5. **Spots (amends section 4, "Block"). Architect.** Blocks show spots as "4/5" at every width. The accessible name keeps "4/5 players".
6. **Band heading and region (amends section 16.8, Next up band). Architect.** The eyebrow is one heading: "Next up, in 2 h 11 min", or "Next up, running" while the lobby runs (glossary: Running replaces the countdown). The band is a region named "Next up" with `aria-label`.
7. **Midnight crossing (amends section 4, "Midnight"). Architect.** A block that crosses midnight shows its times without dates ("22:00–02:00") and a chevron icon that marks the continuation. Its accessible name has the full dates. The chevron is an `Icon`, from the existing set or added there (ADR 0021).
8. **`RunningOrder` props and temporary duplication (amends section 4, "Components"). Architect.** Props are `heading`, `days` and `now`. `onCreateOn` waits for PR3a. Until PR3a, `runningOrder/index.ts` also exports `dayAfter` and `Span` for `calendar/`, and `calendar/gridGeometry.ts` keeps its own copy of the segment logic. Accepted as a temporary duplication of two copies, deleted in PR3a. No third copy.
9. **Hover (amends section 4). Architect.** A block rises 2 px on hover with a fine pointer only (`@media (hover: hover) and (pointer: fine)`), by transform alone. The hover tint on empty future time belongs to PR3a.
10. **Band role slots and meta line (amends section 16.8). Architect.** The band's role slots keep the existing badge look (icon, name, count; the full slot follows 16.4 item 6). The band meta line shows the group name.

### 16.14 Rulings on the PR3a build (2026-11-22)
DECISION, architect, on the deviations the UI/UX expert built for the Group view's create actions. Each one amends the section it names.
1. **`onCreateOn` signature (amends section 4, "Components"). ACCEPTED.** `onCreateOn?: (start: Date, origin: HTMLElement) => void`. The pointer route needs a time; the Create frame needs an element to grow from and return focus to. The day comes from `start`. Both routes pass the day's Create lobby button as `origin`.
2. **Empty future days keep their axis in the Group view (amends section 4, "Empty day"). ACCEPTED.** REQ-0029 item 12 needs empty future time to be a hover and click target, so a Group view day with no lobby and a future date keeps its axis on desktop and phone, with "Nothing booked" inside the track. Only when `onCreateOn` is given. Home is unchanged (16.13 item 3). Past empty days stay one line.
3. **Default and pointer start today (amends section 4 and 12, item 1). ACCEPTED, with an extension.** The default start is the next half hour strictly after now (12:00 gives 12:30). The pointer route rounds down to the half hour as before, but never to a time at or before now: it takes the next half hour instead. No start is ever in the past (`lobby_in_past`). From 23:30 today there is no next half hour today, so today has no button and no pointer area.
4. **Heading level and action slot (amends section 4, "Components"; 16.13 item 8). ACCEPTED.** Props are `heading`, `headingLevel?: 2 | 3` (default 2; the Group view uses 3 under its "Lobbies" h2), `action?: ReactNode`, `days`, `now` and `onCreateOn?`. The heading text is `aria-live="polite"`, so a week change is announced. `action` (the "Next week" control) is rendered outside that live element, so its label is not announced.
5. **Track height (amends section 4, "Desktop"). ACCEPTED.** The desktop track uses `min-height`, not `height`, so a day row grows to hold the Create lobby button in the name column. The lane count still sets the minimum row height, and no block is clipped.
6. **Hover tint on future time (amends section 4, "Empty future time, pointer"). ACCEPTED.** The tint covers all of a day's future time, as REQ-0029 item 12 asks ("the hover state of a control"). It is a solid token fill (`--color-raised`) at the opacity of its layer, not a gradient, and only with a fine pointer. It is not a preview of the 2-hour slot. Past parts and past days have no tint.

No change to the glossary: the "Running order" row already covers the Group view's Calendar view.

### 16.15 Rulings on the PR3b build (2026-11-23)
DECISION, architect, on the review of the PR3b build and the decisions the user took for it. Each item amends the section it names.
1. **Create lobby button in the Group view header (amends section 3 and REQ-0029 item 5; not 16.12 item 5). ACCEPTED as built.** `Lobbies` (`features/lobbies/Lobbies.tsx`) owns the create state: the Create frame, its origin, the chosen view and the loaded upcoming lobbies. Its `renderHeader` prop receives two parts that `Lobbies` builds itself, `createButton` and `upcomingCount`. `GroupDetails` (`features/groups/GroupDetails.tsx`) only places them in `GroupHeader`, next to Invite. The builder's claim that this is the pattern of 16.12 item 5 is not accepted as the basis: there the state is in the parent (`AppShell`) and the child receives an opener. Here the child keeps its state and the parent receives it as output.
   - Rule: a component may hand its own controls and counts to a parent's header through a render prop, when those controls use state the component owns. The parent gets `ReactNode` and numbers only. It never gets state, setters, the popover or the create function, and it never calls the create functions itself.
   - Alternatives weighed. (a) Lift the create state, the view and the upcoming lobbies to `GroupDetails` and pass an open function down. Rejected for now: `handleCreated` needs `view`, so the view moves too, and a page component would own a form. More props and more state for the same result (KISS). (b) Put the button in the lobbies heading row. Rejected: REQ-0029 item 5 places it in the page header.
   - Review check: `Lobbies` must not import anything from `GroupDetails`, and `GroupDetails` must not hold create state. `renderHeader` stays required, because the header position is part of the Group view. If a second consumer appears, the rule above still holds.
2. **The Group feed is not in PR3b (amends the PR3b row of section 15). DECISION, user, 2026-11-23.** The Group feed UI is not built yet (F-036). Its restyle moves out of PR3b and is done when F-036 is built, with the rules of section 16 (tokens, flat surfaces, no shadows, the Orange rule). Until then the side column of the Group view holds the Member list and "Leave group" only.
3. **The initials Avatar stays in Member list rows (amends section 16.8 and the glossary "Avatar" row). DECISION, user, 2026-11-23.** Each Member list row keeps `Avatar` with the initials of the name. The Avatar is the slot for the Discord picture of ADR 0018: when that is built, `PersonAvatar` takes the same place in the same row, and the row layout does not change. The picture is not built now (YAGNI).
4. **"Make group admin" is an Icon-only button (amends the glossary "Icon-only button" use, and section 16.3). DECISION, user, 2026-11-23. ACCEPTED as built.** `MakeGroupAdminAction` uses `IconButton` (`ui/IconButton.tsx`) with the `makeAdmin` Icon, the label "Make group admin" and the member's name as subject. So the accessible name is the label plus the subject. Mouse and keyboard show the label as Tooltip; touch shows the label beside the Icon. The action still asks first in the Confirm dialog (`MakeGroupAdminDialog`), and the list refreshes only after the dialog closes, as built.
   - Open, not blocking: the glossary row "Icon-only button" says "For secondary actions only (edit, copy)". A role change is not one of those examples. The architect adds "make admin" to that row in `CLAUDE.md` in a separate docs change. The reviewer does not block PR3b on the wording.

## Amendments made with this ADR
Each amended ADR carries a pointer section "Amendment 2026-11-21 (ADR 0028)". The rule of this ADR wins where they differ. ADRs 0014, 0015, 0016, 0018, 0021, 0023, 0026 and 0027.
