# REQ-0029. Redesign: running order
Status: Implemented (2026-11-25, merged to `main` in PR #168)
Feature: F-001, F-002, F-003, F-004, F-010, F-017, F-025, F-028, F-029, F-030, F-032, F-038, F-039, F-041, F-043, F-044, F-045 (all EXTEND, presentation only; no new feature, see Related features)
Priority: Should

Decided by the user on 2026-11-21 ("run on concept A"). Concept A ("Running order") is the direction. The static mockups are `docs/design/running-order/home.html`, `group.html`, `lobby.html` and `style.css`, with screenshots `docs/design/running-order/shots/concept-a-*.png` (1440 px and 390 px). They are the design reference for layout and structure. Their light colours and sharp corners are replaced by the Amendment 2026-11-21 below.

The mockups are the reference for Home, the Group view and the lobby page only. Every other screen follows the same language (see "Other screens"). Items marked ASSUMPTION are the product owner's reading; the user may change them. Items marked DECISION (user, 2026-11-21) were answered by the user and are binding.

## Amendment 2026-11-21 (user decisions, binding)
The user saw the first build (PR 1a) in the light palette and rejected its colour scheme. Then three dark mockups were shown and the user chose option 1, "Stage": a warm charcoal dark theme with signal orange. The accent may change later. The changes are:
1. **Dark theme** (items 1, 1a and 3): the app is dark only. There is no light theme and no theme switch.
2. **Small radii** (item 1): 8 px on panels, buttons, text fields, the Next up band and the items of the phone Tab bar (the bar itself is square); 4 px on running-order blocks, tags, avatars, Monograms, game logo boxes and colour swatches. The sharp corners are dropped.
3. **Lobby page** (item 6): the seat boxes are dropped. The lobby page keeps the current player list, the role slots, "Change seat" and "Leave lobby".
4. **Icons**: the role icons and the other icons the app uses today stay. No criterion below removes an icon. Genre looks and genre icons stay removed (item 10).
5. **Authority**: the colour tokens, radii, Orange rule and component colours are set in ADR 0028 section 16 (Amendment 2026-11-21). This requirement follows it. Where they differ, ADR 0028 section 16 wins.

Everything else in this requirement stays as decided on 2026-11-21.

## Problem
The app has been reskinned twice (the dark luxury look of 2026-11-03 and the accent changes of REQ-0028). The user rejected the reskin as AI-generated and said that only the colours changed while the layouts stayed the same. The week view is a column grid that does not show how long lobbies are or how the groups' lobbies relate; the Group rail takes a column of the screen for icons; and the Next up card is a box beside the week. The user wants a real redesign of the structure and the look, with a clear visual idea that is not generic.

## User story
As a member, I want the week of all my groups to read like a running order, with each lobby as a block of its real length in its group's colour, and the next lobby as the first thing I see, so that I can see at a glance when we can play and with whom.

## Verdict (product owner, 2026-11-21)
EXTEND, not NEW and not DUPLICATE. The redesign changes the look, the placement and the navigation of features that exist (F-001, F-002, F-003, F-004, F-010, F-017, F-025, F-028, F-029, F-030, F-032, F-038, F-039, F-041, F-043, F-044, F-045). It adds no data field, no API, no action and no rule for a member. It supersedes decisions that were made about those features; the list is in "Decisions this supersedes". Two parts add a small new visual rule: the group colour (derived in the frontend, no API change) and the running order as the one week view of Home. Both are presentation. No feature ID is created.

## Terms
- **Running order**: the week view of Home and of a group's calendar view. One row per day, time runs from left to right, and a lobby is a block whose length is its duration. Replaces the week time grid of REQ-0004 and REQ-0019.
- **Next up band**: the band at the top of Home, on the surface colour, replacing the Next up card and its side column.
- **Top bar**: the signal-orange bar at the top of every logged-in page, at every width. Replaces the Group rail.
- **Group colour**: the colour of a group's lobby blocks and its square in the Group list and the Group view (see "Group colour").
- **Line-up**: the list of lobbies in the Group view, with day headings and large start times.
- **Seat box**: removed by Amendment 2026-11-21 (item 6). Not a term of the redesign.
- **Signal orange**: the one accent colour of the redesign, token `--color-signal` (ADR 0028 section 16.2). It replaces the gold of the Gold rule. The exact accent may change later by changing that one value.
- **Stage**: the dark theme chosen by the user on 2026-11-21 (option 1 of three dark mockups): a warm charcoal ground with signal orange. Its colour values are the tokens of ADR 0028 section 16.2.
- **Colour roles**: the colour names used in this requirement are the tokens of ADR 0028 section 16.2: text, muted, signal, on-signal, ground, surface, raised, rule, rule-strong, control-line, danger, scrim, group-1 to group-6 and on-group.

## Acceptance criteria

### 1. Tokens and theme (every page)
- Given I open any logged-in page or the landing page, when it is shown, then it uses the Stage dark theme (Amendment 2026-11-21, ADR 0028 section 16.1): dark only, `color-scheme: dark`. The colour values are the tokens of ADR 0028 section 16.2 in `frontend/src/styles/global.css`. Components use the tokens only (glossary "Design token"). The token names are the architect's, as ADR 0028 section 16.2 sets them.
- Given the colour roles, when I check the text pairings, then every text colour on a surface in the token table of ADR 0028 section 16.2 passes WCAG AA (4.5:1 for normal text). A test checks this (`styles/tokens.test.ts`).
- Given the design tokens, when I check the radius, then only two radii exist: `--radius` (8 px) on panels, the Next up band, the Group cards, the Create frame, dialogs, the Dropdown list panel (its phone sheet has the top corners), toasts, all buttons, text fields, the Dropdown trigger and the items of the phone Tab bar; and `--radius-sm` (4 px) on running-order blocks, Game chips, tags, the admin marker, Monograms, avatars, the game logo box and colour swatches (ADR 0028 section 16.5). Every `border-radius` uses one of the two tokens; no literal value and no pill. Native controls keep their own rounding. The Top bar, the phone Tab bar itself (edge to edge, ADR 0028 section 16.11 item 7) and the rows that divide content (the line-up rows, the Group list rows, the lists of the You page and the game list) have no radius. No element is fully round.
- Given any element, when I look at its shadow or glow, then there is no box shadow, text shadow, drop shadow, backdrop blur, glow, sheen, glass, blended gradient or grain, except the dialog scrim and the focus outline below (ADR 0028 section 16.6). Ruled lines may use hard-stop gradients (the hour lines of the running order). The Create frame has no shadow. Floating panels are separated by their surface and a 1 px `--color-rule-strong` border. The dark luxury UI spec of 2026-11-03 keeps its removals: its gradients, glow, grain and serif are not used. Its colours are not the spec either; the Stage tokens are.
- Given the Gold rule, when I look for gold, then the gold token is removed. Its uses are replaced by the Orange rule below (item 1a).
- Given the Orange rule (item 1a), when I check each use of signal orange, then it is one of these seven and nothing else (ADR 0028 section 16.4):
  1. the Top bar background, at every width. The text and the Wordmark on it are `--color-on-signal`;
  2. the background of a primary button, with `--color-on-signal` text;
  3. the Now line and the marker of today in the running order;
  4. the "Next up" eyebrow and the countdown or "Running" label on the Next up band. This is the only place where signal is text;
  5. the active tab: an underline in `--color-on-signal` on the Top bar; the active item of the phone Tab bar has a signal fill with on-signal text;
  6. a full role slot: a check icon in signal, with the count in the text colour. The check icon carries the meaning; signal alone never does;
  7. my own avatar in a player list: a signal fill with on-signal initials.
- Given signal orange, when I check its use, then it is never text except in item 4 of the Orange rule, and it is never a fill in a Dropdown list (ADR 0028 section 16.4). Counts, the admin marker, the Monogram and the joined marks are in the text colour. Group colours are never used for states or focus.
- Given a focus ring, when it is shown on any element, then it is a 2 px outline in `--color-text` with a 2 px offset (ADR 0028 section 16.3). Focus is never signal. Orange alone is not used for focus (WCAG 1.4.11 and 2.4.7).
- Given the group colour of a block, when I check its text, then the text is `--color-on-group` in every group (ADR 0028 section 16.7).
- Given a count, when it is shown, then it is in the text colour, with tabular figures (REQ-0028 item 1 stays). A count badge has a neutral background, not signal and not a group colour.
- Given an input field, a Dropdown list trigger or a secondary button, when I look at its border, then it has a 1 px `--color-control-line` border (DECISION, ADR 0028 sections 16.2 and 16.3), at least 3:1 against the ground, surface and raised (WCAG 1.4.11). Rules (`--color-rule`) only divide content and never mark a control. `--color-rule-strong` is for decorative panel edges only.
- Given the danger button (REQ-0028 item 4 and item 8), when it is shown, then it has no fill, a danger border and danger text (`--color-danger`, ADR 0028 section 16.3), and it has no glow. Danger text passes AA on the ground (ADR 0028 section 16.2).

### 2. Typography
- Given any page, when I read a heading, a time or a block label, then it is set in Big Shoulders Display (condensed, uppercase by CSS for headings and times). Given any running text, labels in forms and body text, then it is set in Archivo. Both are self-hosted under their OFL licences with the licence files shipped with the frontend.
- Given the font tokens, when I check them, then `--font-heading` is Big Shoulders Display and `--font-text` is Archivo. Space Grotesk (REQ-0028 item 3) is removed, together with its files and licence. No serif token or font exists in the code (ADR 0028 section 2).
- Given the landing headline, when the font changes, then its text, its role (first heading of the page, REQ-0013) and its size class stay, and the headline, lead and buttons do not move when the font loads (no layout shift; font-display set by the UI expert).
- Given a time on Home, the Group view or the lobby page, when it is shown, then it is the largest text of its block (the concept's big start time, 3.5rem to 6rem on desktop, UI expert's value within this range).
- Given text is shown, when I zoom the text to 200%, then no line is cut and no text is shown in a fixed-height box that clips it. Input text stays 16 px (REQ-0012).

### 3. Shell and navigation
- Given I am logged in on a screen 760 px or wider, when I see any page, then the Top bar is at the top of the page, full width, in signal orange, with the Wordmark "OpenLobby" (shown uppercase by CSS), the text tabs Home, Groups and You in `--color-on-signal` (the active tab has an underline in `--color-on-signal` and a bold weight), and my avatar with my display name at the right (REQ-0012, REQ-0016).
- Given I am logged in on a phone (narrower than 760 px), when I see any page, then the Top bar is at the top of the page in signal orange, at every width (ADR 0028 section 16.8). It shows the Wordmark and my avatar. There is no ground-coloured bar and no Group strip. My avatar on the Top bar has a ground fill and text-colour initials.
- Given the Top bar, when I look at it, then there is no Group rail. The Group rail (glossary, REQ-0012 and REQ-0025) is removed. The groups are reached through the Groups tab (the Group list), through the links on Home and through the Group list. No group icon, no right-click menu on a group icon, and no separator are shown.
- Given the removed Group rail, when I invite someone from a group, then the Invite popover opens only from the Invite button of the Group view header (REQ-0002, Fourth amendment 2026-11-04). The right-click path of REQ-0012 is removed.
- Given I am on a screen 760 px or wider, when I press the "+" for Create group, then it is only on `/groups`, in the Group list's page header, and it opens the Create group form as in REQ-0012. ASSUMPTION: the "+" of the Group rail moves into the Group list header; the Create group form and its behaviour are unchanged.
- Given I am on a phone, when I see any page, then the Tab bar is at the bottom with three items: Home, Groups and You, in this order. The Tab bar is a surface, edge to edge, with square corners and a 1 px `--color-rule-strong` border (ADR 0028 sections 16.3 and 16.11 item 7); its items have the radius of item 1. The active item has a signal fill with on-signal text (ADR 0028 section 16.4, item 5). The Tab bar respects the safe area (REQ-0012).
- Given I am on a phone and on `/groups`, when I see the page, then the floating "+" (Create group) is above the Tab bar at the bottom right and outside it (REQ-0012, Third amendment 2026-11-04). It is a primary button: signal fill with an on-signal "+", no glow.
- Given I am on the Group view, the lobby page or the You page on a phone, then no floating "+" is shown (REQ-0012, Third amendment 2026-11-04). The Create lobby button of a group is in the group's page header (see Group view).
- Given the Home control, when I am on Home, then the Home tab is the active one (REQ-0028 item 6: the word "Home" stays).
- Given the page transition, when I change page inside the logged-in app, then the new page slides in 24 px from the right, with opacity from 0 to 1, using only transform and opacity (compositor-only); the Top bar and the Tab bar stay still (REQ-0012, Second amendment 2026-11-04). The duration and easing belong to the design spec.
- Given reduced motion is on, when I change page, then the change is instant, and no slide or fade runs (REQ-0012).

### 4. Home (`/`, Dashboard)
Home is the Dashboard of REQ-0012 with the Next up card and the week of REQ-0012 replaced by the layout below. The rules of what is listed, the empty and error texts and the countdown wording of REQ-0012 stay.

Next up band (all widths):
- Given I am logged in, and my groups have upcoming lobbies, when Home opens, then the Next up band is shown first on the page, full width of the main area, on the surface colour (ADR 0028 section 16.8), with the eyebrow "Next up, in 2 h 8 min" (or "Running" or "Ended" as REQ-0012) in signal, the start time in the largest size (the time is the biggest thing on the page), the label (REQ-0015) in big heading type, the date, the time range and the Spot / max players, the role slots of my seat as in REQ-0023, and the buttons "Join lobby" or "Leave lobby" (REQ-0005). The band's primary button has the signal fill.
- Given the Next up band, when I look at it, then no side column is shown beside it. This replaces the side column of REQ-0025 for Next up (see Decisions this supersedes).
- Given the Next up band shows the lobby's group, when I look at it, then the group name is shown as text; the band has no group colour block (ASSUMPTION: the group colour is not used on the band, so the band reads as the "on stage" band of the concept).
- Given no lobby is upcoming in any group, when Home opens, then the band shows "Nothing booked" on the surface, as REQ-0012 says for the empty card.
- Given I am in no group, when Home opens, then there is no band and no running order, and the text "You are not in a group yet" with the link to `/groups` is shown (REQ-0012).

Running order, desktop (screen 760 px or wider):
- Given I am logged in and in at least one group, when Home shows the week, then the running order of the current week is shown below the Next up band with one row per day from Monday to Sunday. Each row has the day name in Big Shoulders and its date in the text font, and the row for today is marked with a signal bar under the day name (the marker of today).
- Given a row, when I look at its time axis, then the time runs from left to right, with hour ticks and labels. ASSUMPTION: the axis covers 00:00 to 24:00; the visible part fills the width of the main area at the desktop widths, and the rest is reached by a horizontal scroll inside the running order (the scroll stays inside the component, not the page).
- Given a lobby of the week, when it is shown, then it is a block in its day's row, placed from its start time to its end time (its length is its duration, as the mockup). A lobby that crosses midnight is shown on its start day and on the next day, each with the marker of REQ-0004. A lobby that started before Monday and is still running is shown from 00:00 on Monday.
- Given two or more lobbies of one day overlap, when they are shown, then they are stacked in sub-lanes inside that day's row, so that no block hides another (ASSUMPTION: the row grows in height to the number of lanes; the lanes are the UI expert's design).
- Given a block, when I look at it, then it shows, on its group colour fill with `--color-on-group` text (ADR 0028 section 16.7): the label (REQ-0015, game › mode › activity, or "Open"), the time range, Spot / max players as "3/5" and the group name. A block too short for its text follows the block-fit rule of REQ-0015 (Amendment 2026-11-13): the text is shortened with an ellipsis or cut at a whole line, and no line is shown cut in half. ASSUMPTION: a block too narrow for the label shows only the time and the spots.
- Given a block I have joined, when I look at it, then it has a 2 px outline in `--color-text`, set inside the block (`outline-offset: -2px`), and the text "you" after the spots, as in the mockup (REQ-0015 and REQ-0005). The colour is not the only cue.
- Given a block, when I press it, then its lobby page opens (REQ-0012, Third amendment, item 3).
- Given the Now line (glossary "Now line"), when the current week is shown, then a 2 px signal line runs down today's row at the current time over a 4 px `--color-ground` bar, and moves at least once a minute (REQ-0019). The line is not shown in other rows and in other weeks (ADR 0028 section 16.6). The line is not announced by a screen reader and has no label (REQ-0019).
- Given the running order is shown, when it opens, then it is scrolled once to the next lobby that has not ended (a Running lobby counts), or to the current time when none has not ended, following the opening rule of REQ-0019 with the time axis instead of the hour rows. Later data changes keep the scroll position (REQ-0019).
- Given the running order is shown and the week has no lobby, when I look at it, then each day row shows "Nothing booked" in the muted colour as one short line, with no time axis.
- Given the week grid of REQ-0019 is replaced, when the desktop layout is shown, then the week is no longer a column grid with hour rows (REQ-0004 time grid amendment, REQ-0019 width and height rules, see Decisions this supersedes).

Clickable empty time (Group view running order only, desktop and phone; not Home, DECISION, user, 2026-11-21):
- Given I am in a group's Calendar view and point at an empty part of a day row that lies in the future, when I hover it, then it shows the hover state of a control (a raised fill), and when I press it, then Create lobby opens with that date and start time prefilled (REQ-0003 item 3; rounded down to the half hour; end = start + 2 hours). Empty past parts and day rows that have passed show no hover state and open nothing.
- Given Home has no group context, when I press an empty time on Home, then nothing opens (DECISION, user, 2026-11-21). Home has no Create lobby button and no "+".

Phone (under 760 px):
- Given I am on a phone, when Home shows the week, then the Next up band is shown at the top, and below it one band per day from Monday to Sunday in the order of the week, each with its day name and date (Big Shoulders and the text font), followed by the day's lobbies in start-time order (REQ-0012 Phone, replaced: see Decisions this supersedes).
- Given a day has lobbies, when I look at its band, then about 6 hours of its time axis are visible at once (DECISION, user, 2026-11-21, ADR 0028 section 4).
- Given a day's band has lobbies, when I scroll it sideways, then the scroll stays inside the band, the page does not scroll sideways, and the band reaches the whole 00:00 to 24:00 axis (DECISION, user, 2026-11-21, ADR 0028 section 4).
- Given a day's band with lobbies is shown for the first time, when it opens, then it opens at the current time or at the first lobby that has not ended (a Running lobby counts) (DECISION, user, 2026-11-21, ADR 0028 section 4).
- Given a lobby of the day, when I look at the band, then its block on the time axis is in its group colour at its start and length, and below the axis a text row shows its time in big type, its label, its group name, and its Spot / max players at the right.
- Given a day has no lobbies, when I look at its band, then its name and date and "Nothing booked" are shown in one line, and no time axis is shown. Days that have passed with no lobby collapse to one line too.
- Given the phone week, when I scroll it, then the page scrolls vertically; there is no swipe between days and no day pills (REQ-0004 Amendment 2026-11-17 and REQ-0012 Amendment 2026-11-17 are replaced, see Decisions this supersedes).
- Given the phone week, when a day is today, then its name carries the signal marker and the Now line is shown on its time axis when the current time is inside the axis.
- Given the phone week, when I press a lobby, then its lobby page opens. A tap target is at least 44 px high (REQ-0012, REQ-0028 item 8).
- Given the phone week, when I press an empty part of a day's time axis, then nothing opens (DECISION, user, 2026-11-21).

Legend and "This week":
- Given Home shows the running order, when I look at it, then a legend below it lists the groups of the week with their group colour swatch and their names, and "You are in" with a 2 px `--color-text` outline and no fill. The legend lists only groups with a block in the week.
- Given the view toggle of REQ-0012 (Amendment 2026-11-07, Week calendar and Day list), when Home shows the running order, then the toggle is not shown (DECISION, user, 2026-11-21).

Home heading:
- Given Home is shown, when I look at the page heading, then it is the word "Home" in Big Shoulders at the top of the page below the Top bar (REQ-0028 item 6). The heading text is the same key as the Tab bar's Home (REQ-0028 item 6).

### 5. Group view (`/groups/{groupId}`)
The concept shows the Group view with a line-up list in the main column and Members and the Group feed in a right column. The rules of REQ-0004, REQ-0017, REQ-0018, REQ-0025 and REQ-0028 item 7 are kept except as listed.

- Given I open a group view on a screen 760 px or wider, when I see the page header, then it shows a square swatch of the group colour, the group name in Big Shoulders at display size, a line with the member count and the number of upcoming lobbies (text in the muted colour), and the Invite and Create lobby buttons at the right. Create lobby is a primary button; Invite is a secondary button. "Leave group" is not in the header (REQ-0028 item 7).
- Given the page header, when I look at the Groups link above it, then it is a text link back to the Group list with an arrow icon (ASSUMPTION: the back link replaces the Group rail as the way out of a group; the Top bar stays).
- Given the Group view has lobbies, when the Line-up list is shown (the List view of REQ-0004), then the lobbies are grouped by day under a day heading (weekday and date, Big Shoulders). Each lobby is a row: the start time in Big Shoulders at the largest size of the row, the end time as "to 14:35" in the muted colour, the label with the logo or Monogram (REQ-0026, the logo size of the list rows, 2.5rem), the role slots inline with their icons (REQ-0023), the Spot / max players at the right as "3/5 players" and "Full" when full (REQ-0011 full state). A lobby row shows no group colour block; the row is not the group colour (ASSUMPTION: the colour is for week blocks and the group's swatch).
- Given a lobby row, when I press it, then its lobby page opens. The row keeps the hover state of a link (REQ-0012: rows that navigate have a hover state).
- Given the Group view has no upcoming lobby, when I look at it, then the text "Nothing booked" of REQ-0004 is shown, in the line-up area.
- Given the Group view's view switch (List and Calendar, REQ-0004 Amendment 2026-11-07), when I look at it, then it stays: the List view is the Line-up list and the Calendar view is the running order of this group (the same component as Home, with one group's lobbies and the group colour, and the rules of Home's desktop and phone layout). ASSUMPTION: the group's running order keeps the Calendar view, because F-017 is Done and this redesign does not remove a feature. The switch is icon-only, as REQ-0004 says.
- Given the Group view is 98rem wide or wider, when I see the page, then the Members list and the Group feed are in a right side column (REQ-0025, Amendment 2026-11-14), beside the main column, as in the mockup. The side column is 19rem wide (REQ-0025). Below 98rem the Members list is below the lobbies (REQ-0025).
- Given the Member list in the side column, when I look at it, then each member is a row with the name in Big Shoulders, the admin marker as a neutral label "Admin" in the text colour with a 1 px `--color-rule-strong` border and the radius of blocks and tags (not signal, REQ-0028 item 1), and the member's Game chips (REQ-0021 Amendment 2026-11-17) in the visual of the mockup: the game's logo or Monogram in a 2.5rem square, then the role icons, and the name of a role with no icon. The Game chip behaviour and its popover are unchanged.
- Given the Group feed in the side column, when I look at it, then its events, their rules and its empty text are as REQ-0018. Only its look changes: the time ago in the muted colour above the text.
- Given the Group view, when I scroll to its end, then "Leave group" is the last item on the page, below the Group feed in the side column, or after the Member list below 98rem (REQ-0028 item 7). It is a danger button with visible text.
- Given the Group view, when I look at its Calendar view, then the Group feed and the Member list are unchanged in place.

### 6. Lobby page (`/groups/{groupId}/lobbies/{lobbyId}`)
The concept shows the lobby as one large time block and the facts and settings in the side column (REQ-0025). The concept's seat boxes are dropped (Amendment 2026-11-21, user; ADR 0028 section 16.8): the lobby page keeps the player list of the app as it is built today.

- Given I open a lobby page, when I see the top of the page, then the start time and the end time are in the largest size, the label in big heading type, the group name, and the Spot / max players. The game logo or Monogram is shown before the label at 4rem (REQ-0026 Amendment 2026-11-16; the logo is not a label part).
- Given a lobby with game roles, when I look at its players, then they are grouped under the role headings as today: each heading shows the role icon, the role name and the count (for example "0/1"; the count in the text colour, REQ-0028 item 1). Each player is a row with the avatar, the name, the "You" tag for me and the preferred-roles note (REQ-0021, REQ-0023). The player who is me has a signal fill on the avatar (Orange rule, item 7).
- Given a lobby with game roles, when a role slot is full, then it shows the check icon in signal and the count in the text colour (Orange rule, item 6). Open role slots show their count in the text colour.
- Given the lobby page, when I look at its seat actions, then "Change seat" and "Leave lobby" are shown for me as a player, as the app shows them today (REQ-0015 and REQ-0005). There is no button per seat.
- Given a lobby with no game role, when I look at its players, then the players are listed in a column of rows, as today (REQ-0005 and REQ-0015).
- Given a Flex player (REQ-0011), when I look at the players, then "Flex" with the count is shown as a neutral label (REQ-0028 item 1: counts neutral), as the app shows it today.
- Given the lobby page, when I look at its icons, then the role icons (REQ-0023) and the other icons the app uses today are shown (Amendment 2026-11-21, item 4).
- Given I am on a lobby page 98rem wide or wider, when I see the page, then the lobby facts and settings (game, mode, activity, max players, the creator, and the settings of REQ-0015 and REQ-0011) are in the side column (REQ-0025). The content and the rules of these settings are unchanged.
- Given the placement of "Join lobby", "Leave lobby" and "Delete lobby", when I look at them, then they follow REQ-0028 item 5 (DECISION, user, 2026-11-21: the 2026-11-18 placement is kept, not the concept's side column).
- Given the lobby page, when I look at the group's name, then it links to the Group view, with the back link of the Group view (item 5).

### 7. Group list (`/groups`)
The concept does not show the Group list. It follows the same language.
- Given I open `/groups`, when I see the page, then it has the page header "Groups" in Big Shoulders and the "+" for Create group (desktop and phone header, see item 3). Each group is a Group card (REQ-0024) built as a row of the same language: the group colour as a square swatch at the left, the group name in Big Shoulders, the member count in the muted colour, up to five member initials or avatars with "+N" (REQ-0024), and the next lobby line with its label, its start and the "Running" or "No upcoming lobbies" text as in REQ-0024.
- Given the Group cards, when I look at them, then they have the `--radius` corners of item 1 (ADR 0028 section 16.5), no shadow, no gold wash and no genre stripe. A card has a 2 px bottom rule in the text colour and the hover state of a link (REQ-0024, REQ-0028 item 1 and 2). ASSUMPTION: the card grid of REQ-0025 is kept (two columns from 760 px, three from 75rem), with the same card rules.
- Given a Group card, when I press it, then its Group view opens.
- Given the Group list is empty (no group), when I look at it, then the text "You are not in a group yet" and the "+" are shown (REQ-0012).

### 8. Other screens (follow the same language; not in the mockups)
The following are not in the mockups. They take the tokens (item 1), the fonts (item 2), the Button and form rules (item 9) and the copy rules, and nothing else. Their layout is not changed by this requirement, except where a criterion says so.
- **You page** (`/profile`): the sections Account, Game roles, System admin and Log out (REQ-0020, REQ-0021). Section headings in Big Shoulders, rows with a 2 px bottom rule in the text colour, "Log out" as a secondary button. The Avatar is the square form (item 10).
- **Game list and game form** (REQ-0010, REQ-0009, REQ-0015, REQ-0023, REQ-0026): the list rows follow the row rule of item 7; the game form follows item 9 (form rules). The logo of a game in the list is the logo at 2.5rem (REQ-0026 Amendment 2026-11-16) in a square with the radius of item 10.
- **Landing page** (`/`, logged out; REQ-0001, REQ-0013): the headline is set in Big Shoulders Display, weight as the font provides for the display (ASSUMPTION: the headline is uppercase by CSS, as in the mockup); the lead and the Discord login button (ButtonLink, REQ-0028 item 4) follow item 9. The 3D hero with its decorative lobby cards (REQ-0013, built) stays as built: it keeps its place, its lazy load and its static fallback, and takes the Stage palette. ASSUMPTION: the 3D hero is not removed by this redesign; its restyling beyond the Stage palette is a follow-up if the user asks for it. DECISION (user, 2026-11-21, ADR 0028 section 7): the cards are neutral, the genre motifs and the glow phase are removed in PR5b, and the 3D scene stays. The landing headline keeps its role and text (REQ-0013, REQ-0028 item 3).
- **Create lobby form** (REQ-0003, REQ-0015): a form in a Create frame (ADR 0023 Amendment 2026-11-17). It follows item 9.

### 9. Forms, dialogs, dropdown lists, toasts and buttons
- Given a Button, when I look at it, then it has a radius of 8 px (item 1), no glow and no shadow, and its style follows ADR 0028 section 16.3: the primary button has the signal fill with on-signal text and no colour change on hover (its press is a transform); the secondary button has the surface fill, a 1 px `--color-control-line` border and text, and a raised fill on hover; the ghost button has no border, text, and a raised fill on hover; the danger button has no fill, a danger border and danger text, and a raised fill on hover (glossary "Button variant"). Hover and focus use the focus outline of item 1.
- Given a Button on a touch screen, when I see it, then its height is at least 44 px (REQ-0028 item 8, unchanged).
- Given a text input, when I focus it, then it has the focus outline of item 1, and its border is the 1 px `--color-control-line` border of item 1.
- Given a Dropdown list (REQ-0027), when I open it, then its panel is a surface with a 1 px `--color-rule-strong` border and a radius of 8 px, with no shadow, and its options are rows of at least 44 px on touch. The highlighted option has the raised fill, and its text stays in the text colour (DECISION, user, 2026-11-21, ADR 0028 section 16.4: no signal in a Dropdown list). With a fine pointer, the highlighted option also has a 2 px text-colour ring for keyboard focus (ADR 0028 section 16.11 item 2); on touch sheets it has the raised fill only. The selected option has a check mark and a 2 px edge at its left in the text colour. The bottom sheet on phones keeps its rules (REQ-0027, ADR 0027).
- Given a Dialog (Confirm dialog, glossary) or a Create frame, when it opens, then it is a surface with a 1 px `--color-rule-strong` border, a radius of 8 px and no shadow, with the scrim `--color-scrim`. Its buttons follow the rules above. Its behaviour (REQ-0022, ADR 0023 Amendment 2026-11-19) is unchanged.
- Given a Toast (REQ-0022), when it shows, then it is a raised fill with text in the text colour and a radius of 8 px (ADR 0028 section 16.2), in the same corner and with the same timing, pause and fade as REQ-0022. Its text is unchanged. It is never signal text.
- Given a form error (REQ-0012 and others), when it is shown, then its text is in `--color-danger` with a visible text label, not colour alone.
- Given any form field's label, when I look at it, then it is a text label above the field in the text font, not in a placeholder (existing rule, unchanged).

### 10. Avatar, Monogram, logos and covers
- Given an Avatar of a person (REQ-0016, initials or picture), when it is shown, then it is a square with a radius of 4 px (not round), with initials in Big Shoulders on the raised fill in the text colour (ADR 0028 section 16.8). The glossary row "Avatar" says "round"; the change to square is this requirement's (see Decisions this supersedes).
- Given my own avatar in a player list, when it is shown, then it has a signal fill with on-signal initials (Orange rule, item 7).
- Given a Monogram (REQ-0026, the initials of a game name), when it is shown, then it is a 2.5rem square with a radius of 4 px, on the raised fill, with initials in the text colour, in the same place as the logo.
- Given a Game logo (REQ-0026), when it is shown in the redesign's places (the game form, the game list, the game choice, the You page game headings, the lobby page at 4rem, the list rows of the Group view and the Game chips), then it keeps its size from REQ-0026 and ADR 0026 in those places, and sits in a square with a radius of 4 px.
- Given a week block or a block on Home, when I look at it, then no Game logo is shown (DECISION, user, 2026-11-21: the small logo of REQ-0026 Amendment 2026-11-16 is removed from week blocks). The Monogram is not shown in blocks either.
- Given a Game cover (REQ-0026 Amendment 2026-11-16 and 2026-11-17, REQ-0028 item 2), when I look at the places where it was shown (the Next up card, the lobby page header and the lobby rows of the Group view), then no cover is shown in this redesign (DECISION, user, 2026-11-21). The upload and the storage of a cover in the game form stay unchanged (ADR 0026). Superseded 2026-11-25: covers are removed from the product entirely (no upload, no storage, no API; existing covers deleted), by REQ-0026 Amendment 2026-11-25 (DECISION, user, 2026-11-25). The Game logo is unchanged.
- Given the genre of a game (REQ-0014, F-032), when I look at a lobby, then no genre theme is shown in the redesign: no tint, no pattern, no icon, no 3D motif and no accent stripe (DECISION, user, 2026-11-21). The genre stays a stored value, editable in the game form (F-032 and ADR 0016); it has no visible place in this redesign.

### 11. Group colour
- Given a group, when its lobby blocks, its swatch or its legend entry are shown, then they use the group colour, which the frontend derives from the group ID with no API change. ASSUMPTION: the rule is a stable hash of the group ID, taken modulo the number of colours in the palette, so that the same group has the same colour on every screen and every device.
- Given the palette, when it is used, then it has six colours, `--color-group-1` to `--color-group-6` (ADR 0028 section 16.2). The six hues are the user's choice of 2026-11-21 (the concept's three and three more, ADR 0028 section 12, item 3). Six colours, so that a member of several groups rarely sees two groups in one colour. The palette is a design token list in `global.css`.
- Given the palette, when I check it, then no group colour equals the signal orange or the danger colour, each group colour carries `--color-on-group` text that passes WCAG AA for the block text (ADR 0028 section 16.2: 6.5 to 9.7:1), and each group colour has at least 3:1 contrast against the ground, so that a block is visible. A test checks this (Amendment 2026-11-21).
- Given two groups in one view have the same colour, when I look at their blocks, then the group name is shown in each block, so the colour is never the only cue (WCAG 1.4.1). ASSUMPTION: this is the reason to show the group name in every block.
- Given a group, when I look at the colour, then it has no choice in the app. A group admin cannot change it. Its colour is not stored and not shown as a setting. Group colours are never used for states or focus (ADR 0028 section 16.4).
- Given a block of a lobby the member has joined, when I look at it, then the 2 px `--color-text` outline marks it (item 4), not a colour change.

### 12. Accessibility
- Given all screens, when I check text contrast, then normal text meets 4.5:1 and large text 3:1 (WCAG AA), measured with the Stage tokens of ADR 0028 section 16.2. Signal is used as text only as item 1 allows.
- Given the running order, when I use a keyboard, then every block of a group's Calendar view can be reached with the Tab key in day and time order, and pressed with Enter. Each future day has one Tab stop: a "Create lobby" button that opens the form with that date and a default start time (DECISION, user, 2026-11-21, ADR 0028 section 12, item 1). Blocks have an accessible name with the label, the time range, the spots and the group name.
- Given the running order, when a screen reader reads it, then the reading order is day by day, lobby by lobby, the same as the phone band order (ASSUMPTION).
- Given a colour, when it is the only sign of a state, then it is not used. Joined blocks have the 2 px outline (item 4) and the text "you"; full role slots have the check icon and the text "Full" for screen readers (REQ-0011); and counts are text.
- Given reduced motion, when a page changes or the Now line moves, then no slide or fade is shown (item 3). The Now line still moves, without animation.
- Given the redesign, when I use 200% text zoom or a 390 px wide phone, then no page scrolls sideways except the horizontal axis of the running order, and every tap target is at least 44 px (REQ-0012).
- Given the Next up band, when its countdown ticks, then no element pulses or blinks (WCAG 2.3.1).
- Amendment 2026-11-25 (final cross-PR review 2026-11-25; ADR 0028 section 16.12, item 3; WCAG 2.4.1): the skip link was named in ADR 0028 as a separate small task and was never recorded. It is recorded here. Given any logged-in page or the landing page, when I press Tab once from the top, then the first focused element is the "Skip to content" link, hidden until it has focus, and visible on focus with the 2 px focus outline of item 1 (`--color-text`, not signal). When I activate it, then focus moves to the Main area. The other criteria of item 12 are unchanged.

### 13. Motion and signature details
- Given the redesign, when a page is shown, then only compositor-only motion is used: transform and opacity, on the page change, on the Create frame and dialogs, and on the entrance of Group cards and the landing page (user preference; REQ-0012; ADR 0028 section 2; colour changes on hover and focus are instant). No animation runs on content sections on hover (REQ-0012, Second amendment 2026-11-04).
- Given the hover rule, when I point at a content section, then it has no hover effect. Hover effects are only on controls, on rows that navigate (lobby rows and Group cards) and on the empty future time of the running order (item 4).
- Given the signature rule (glossary "Signature detail"), when I look at Home, then the running order track with the Now line is the one signature detail of that page (marked `signature: home` in the code, ADR 0023). The Next up band and the Group view have no signature detail (ASSUMPTION: the concept's one move per screen).

### 14. Copy (product owner, 2026-11-21)
- Given any new or changed text of this redesign, when I read it, then it is plain and factual, without sales talk (user preference, memory "Plain copy"). The copy of the concept is accepted as plain: "Next up", "This week", "Nothing booked", "Join lobby", "Leave lobby", "Change seat", "Leave group".
- Given the concept's "Open lobby" button on Next up, when it is shown, then the text is "Join lobby" (REQ-0005 copy), not "Open lobby". The concept's text is not the product copy.
- Given the Top bar, when I read it, then the tabs are "Home", "Groups" and "You" (REQ-0028 item 6).

## Decisions this supersedes
Each row names the documented decision, where it is written, and what replaces it in this requirement. The rule here wins where they differ, except where ADR 0028 section 16 wins (Amendment 2026-11-21). The other requirements get their pointer when the PR that changes them lands (see Delivery); this requirement is the source until then.

| Decision | Where it is written | Replaced by |
|---|---|---|
| Group rail (left navigation of the wide layout, its "+" and right-click invite) | glossary "Group rail"; REQ-0012 (App shell, Group rail criteria, Third and Fourth amendments); REQ-0025 (5.25rem rail) | Top bar with text tabs (item 3). The Group list is the entry to groups. The "+" for Create group moves to the Group list header. |
| Top bar with avatar and display name as the only top element | REQ-0012 (App shell, Top bar criterion) | The Top bar with tabs Home, Groups and You, the Wordmark and the avatar (item 3). |
| Gold rule: gold for action, state and focus | glossary "Gold rule"; REQ-0028 item 1; ADR 0023 Amendment 2026-11-18 | Orange rule (item 1) and the text-colour focus outline (item 1). Gold token removed. The counts, the neutral badges and the neutral rules of REQ-0028 item 1 are kept in spirit. |
| No gold glow on secondary buttons; the primary and danger glow | REQ-0028 item 4; ADR 0023 Amendment 2026-11-17 (Button hover glow) | No glow on any button (item 9). The danger button has no glow either. |
| Genre accent stripe on week blocks only | REQ-0028 item 2; REQ-0014 Amendment 2026-11-18; ADR 0016 Amendment | Group colour on blocks; no stripe anywhere (items 4, 11). |
| Genre theme (tint, background pattern, icon and 3D motif) on lobby lists and week blocks | REQ-0014; ADR 0016; F-032 | No genre look in this redesign (item 10). The genre value stays stored and editable. |
| Game cover on Next up, the lobby page header and lobby rows; cover gradient | REQ-0026 (Amendments 2026-11-16, 2026-11-17, 2026-11-18); ADR 0026 Amendment 2026-11-18 | No cover placed (item 10). Upload and storage unchanged. |
| Logo in week blocks (small size, hidden under 6rem) and logo sizes in Next up and the lobby page | REQ-0026 (Amendment 2026-11-16); ADR 0026 items 8, 10, 11 | Logo in square form in the places of item 10; no logo in blocks. Sizes of REQ-0026 kept where the places remain. |
| Space Grotesk as the landing headline and heading font | REQ-0028 item 3 (built 2026-11-18) | Big Shoulders Display for headings (item 2). Space Grotesk and its font files are removed. |
| Dark luxury UI spec of 2026-11-03: dark palette, glow, gradients, serif, motion of the hover light sweep | design spec 2026-11-03 (named in REQ-0028 "Out of scope"); ADR 0023 | Stage dark theme with small radii and no glow, gradients, glass, grain or serif (item 1, Amendment 2026-11-21). The spec's motion rules are replaced by items 3 and 13. |
| Light palette, the light theme and sharp corners (radius 0) of the first build (PR 1a, 2026-11-21) | REQ-0029 item 1 as first decided, PR 1a | Stage dark theme and radii of 8 px and 4 px (item 1, Amendment 2026-11-21; ADR 0028 section 16.5). |
| Lobby page seat boxes per role slot (concept) | REQ-0029 item 6 as first decided | Current player list, role slots, "Change seat" and "Leave lobby" (item 6, Amendment 2026-11-21; ADR 0028 section 16.8). |
| Danger button with a red fill and white text | REQ-0029 items 1 and 9 as first decided | No fill, danger border and danger text, raised hover (item 9; ADR 0028 section 16.3). |
| Dropdown highlighted option with an ink wash; selected option with a 2 px ink edge | REQ-0029 item 9 as first decided | Highlighted option with the raised fill; selected option with a check mark and a 2 px text-colour edge at its left (item 9; ADR 0028 section 16.4). |
| Week time grid with hour rows, its 32rem and 66.75rem widths, the vertical opening scroll and the grid's phone day pills | REQ-0004 (time grid amendment, Amendment 2026-11-17 phone day selection); REQ-0019 (all width, height and opening rules); REQ-0012 (Fifth amendment, phone rules) | Running order (item 4). Its opening scroll follows REQ-0019's target rule on the time axis. |
| Now line in today's column of a vertical grid | REQ-0019 (now line) | Now line in today's row of the running order (item 4). Its rules (once a minute, not in other weeks, not in the Day list, no screen reader text) are kept. |
| Next up as a side column beside This week from 98rem | REQ-0025 (Dashboard criteria); REQ-0012 (Amendment 2026-11-14) | Next up band full width above the running order at all widths (item 4). The side column stays for the Group view and the lobby page. |
| This week view toggle (Week calendar and Day list) | REQ-0012 (Amendment 2026-11-07) | Running order only (DECISION, user, 2026-11-21). |
| Phone day pills, the swipe between days, and the day-by-day phone grid | REQ-0004 (Amendment 2026-11-17); REQ-0012 (Amendment 2026-11-17, Phone rules) | Phone band per day in one vertical list (item 4). |
| Round Avatar and round generated group icons | glossary "Avatar"; REQ-0012 (Group icons); ADR 0021 (round icon button) | Square Avatar with 4 px radius (item 10). Icon-only buttons have the 8 px radius (item 1). Groups have no icon; they have the group colour swatch (item 11). |
| Hover and focus of rows and controls with a gold tint | REQ-0028 item 1 (gold hover edge kept) | Hover uses the raised fill (ADR 0028 section 16.3); focus uses the text-colour outline (item 1). |
| Group view header with Create lobby and Invite (no change) | REQ-0025 (header rule) | Kept, and the header has the Group name at display size (item 5). |
| Lobby page order and placement of actions | REQ-0028 item 5; REQ-0025 (side column) | Kept (DECISION, user, 2026-11-21; item 6). |
| Button and touch size of 44 px | REQ-0028 item 8 | Kept. |
| Create lobby button and floating "+" on Home | REQ-0012 (Third amendment: "+" only on `/groups`; Out of scope: creating a lobby from the "+") | Not on Home (DECISION, user, 2026-11-21). Create lobby only inside a group. |

## Delivery (small PRs, each shippable on its own)
DECISION (user, 2026-11-21, ADR 0028 section 13): the split is PR1a, PR1b, PR2, PR3a, PR3b, PR4, PR5a, PR5b, in that order, each shippable on its own. Where the list below differs, this split wins: PR1 = PR1a and PR1b; PR3 = PR3a and PR3b; PR5 = PR5a and PR5b. The old grid is deleted in PR3a, and each screen drops its genre frame in its own PR.
The order follows the dependencies: the tokens and the shell first, because every page uses them; the running order component second, because Home and the Group view calendar use it; then the Group view, the lobby page and the rest.

1. **PR 1: tokens, fonts, shell and primitives.** Stage dark tokens (Amendment 2026-11-21), the fonts changed (Big Shoulders Display and Archivo added; Space Grotesk and Inter removed), the Button, input, Dialog, Dropdown list, Create frame and toast restyled through the tokens, square Avatar with 4 px radius, the Top bar in signal orange at every width replacing the Group rail, the phone Tab bar, the "+" on `/groups`. Mixed look: the pages keep their old layouts in the new colours and fonts. This is intended and it is one coherent state. The landing page takes the tokens here; its dark-only rules and the headline font come in PR 5, so the landing is mixed until then (accepted).
2. **PR 2: Home.** The Next up band, the running order on desktop and phone, the Now line, the legend, the group colour (item 11) and the blocks. No Create lobby on Home and no toggle (DECISION, user, 2026-11-21). Mixed look: none on Home. The Group view still shows the old week grid until PR 3.
3. **PR 3: Group view and Group list.** Header, line-up list, the Calendar view using the PR 2 running order, Members with Game chips in the new look, the Group feed, the Group cards. Mixed look: none for the Group view after this PR; between PR 2 and PR 3 the Group view calendar is the old grid in new colours (accepted, one review cycle).
4. **PR 4: lobby page.** The large time block, the current player list with its role groups and role slots (no seat boxes, Amendment 2026-11-21), the side column for facts and settings. The actions keep the 2026-11-18 placement (DECISION, user, 2026-11-21). Mixed look: none.
5. **PR 5: remaining pages and cleanup.** You page, game list and game form, Create lobby form, landing headline in Big Shoulders, the 3D hero restyled to the palette, removal of dead tokens (gold, Space Grotesk, serif, `--color-ink`, `--color-orange`, `--color-wash`) and of dead CSS of the rail, the old grid and the stripe. Mixed look: none after this PR.

DECISION (user, 2026-11-21, Amendment 2026-11-21): the redesign is built on the branch `redesign-preview`. Nothing of it reaches `main` until the whole redesign (PR 1 to PR 5) is accepted by the user, and then only on the user's yes. Each PR is still reviewed and approved on its own branch step.

**Delivery status (product owner, 2026-11-24):**
- PR 5b (landing restyle, the last redesign PR) is built on `redesign-preview`. The landing headline is in Big Shoulders Display; the hero is two columns from 60rem; the steps are four flat columns with large numbers (headings uppercase by CSS; REQ-0013 Amendment 2026-11-24).
- The hero cards are neutral and unlit: no genre motif, no glow phase, no pointer-following light (DECISION, user, 2026-11-24). A full card is marked by a text-colour edge, not orange (accepted by the user, 2026-11-24). The 3D scene, tilt, float, lazy load, static fallback and reduced-motion rules stay.
- The genre visuals are removed from the frontend (the genre theme file and the genre art are deleted). The genre value stays stored and editable (ADR 0016; REQ-0014 Amendment 2026-11-24).
- PR #163 (bug fix, merged into `redesign-preview` on 2026-11-24): a lobby that crosses midnight no longer shows its start time on the next day's row; it shows the end time with the marker (for example "–01:00"), as item 4 already requires. No criterion changes.
- PR #165 (cover removal, REQ-0026 Amendment 2026-11-25) is delivered on `redesign-preview` (2026-11-25).
- The final fixes PR (a skip link to the main content, WCAG 2.4.1) is delivered on `redesign-preview` (2026-11-25). The final cross-PR review found the skip link missing. Its criterion is item 12, Amendment 2026-11-25 (the Given/When/Then "Skip to content" criterion).
- **Merged to `main` on 2026-11-25** on the user's yes: PR #168 (merge commit e238086) brings the whole redesign (PR 1 to PR 5b, the fixes #163, #164, #167 and the cover removal #165) to `main`. The goals docs of REQ-0030 (#166) came with it; they are docs only and not built. Status is `Implemented`.

Each PR goes through the review of CLAUDE.md step 5 and the Definition of Done. ADR 0028 (Accepted 2026-11-21, section 16 Amendment 2026-11-21) records the design (the dark tokens, the radii, the Orange rule, the running order component, the Top bar, the group colour rule) and amends ADR 0014, 0015, 0016, 0018, 0021, 0023, 0026 and 0027 where this requirement supersedes them.

## Out of scope
- New features, new data, new API fields or new rules for members. The group colour is derived in the frontend and is not stored.
- Changing what a lobby, a group, an invite or a game is, or what any action does.
- A light theme, or a theme switch. The Stage dark theme is the only one, dark only for now (Amendment 2026-11-21).
- A search field (concept C has one; concept A has none).
- A new view of the week (month view, Day list in the running order), and week navigation on Home (REQ-0012).
- Covers and genre looks in the new layout (item 10): the places are not placed, and a later decision may place them.
- A user setting for the colours or the group colour.
- Concept B and C. Their parts are not used.
- Swedish text (F-026); the copy of this requirement is English and translatable (ADR 0013).
- A native mobile app.

## Related features
- F-001 (landing page, login, Top bar and tabs): presentation. Extends F-001.
- F-002 (Create group, invite popover, "+"): the "+" moves to the Group list header; the Invite popover opens only from the Invite button. Extends F-002.
- F-003 (Create lobby): the button stays in the Group view header and the form is unchanged; there is no "+" for a lobby on Home (DECISION, user, 2026-11-21). Extends F-003.
- F-004 (list of upcoming lobbies): the Line-up list. Extends F-004.
- F-010 (Leave group): the placement of REQ-0028 item 7 is kept. Extends F-010.
- F-017 (calendar view of a group): the running order replaces the hour grid; the switch stays. Extends F-017; not a new feature (see the note in features.md).
- F-025 (game list and game form): the square look with the item 10 radius and the game form look. Extends F-025.
- F-028 (Dashboard, Next up and This week): the band and the running order replace the card and the grid; the toggle is removed (DECISION, user, 2026-11-21). Extends F-028; the rules of what is listed are unchanged.
- F-029 (Discord avatars): the square form with the 4 px radius. Extends F-029.
- F-030 (game logo and cover): the logo sizes stay where the places remain; the covers are not placed (item 10). Extends F-030; the cover upload is unchanged.
- F-032 (genre themes): no visible genre look (item 10). Extends F-032. This is the largest visual removal and it is the user's to confirm.
- F-038 (You page): the look only. Extends F-038.
- F-039 (preferred game roles, Game chips): the look of the Game chips follows the mockup; the behaviour and the popover are unchanged. Extends F-039.
- F-041 (toasts), F-045 (Dropdown lists): the look only (item 9); their behaviour is unchanged. Extends F-041 and F-045.
- F-043 (Group cards): the card look (item 7). Extends F-043.
- F-044 (wider layout): the Dashboard side column is removed; the Group view and lobby page side columns stay. Extends F-044.
- The redesign is not a duplicate of any feature, because no feature has a look-and-layout of its own; the product owner checked the register and found no feature that covers the visual language.

## Decisions by the user (2026-11-21)
- DECISION (user, 2026-11-21): no Create lobby and no "+" on Home; an empty time on Home opens nothing. Create lobby is offered only inside a group (the Group view header, REQ-0003). PR 2 has no Home Create lobby, no Home "+" and no Home empty-time action.
- DECISION (user, 2026-11-21): the Week calendar and Day list toggle of REQ-0012 (Amendment 2026-11-07) is removed on Home. The running order is the only view of This week; the phone band per day replaces the Day list. The Amendment 2026-11-07 is superseded on this point.
- DECISION (user, 2026-11-21): on the lobby page, "Join lobby", "Leave lobby" and "Delete lobby" keep the placement of REQ-0028 item 5 (main column, after the role slots; "Delete lobby" last). The concept's side-column actions are not used.
- DECISION (user, 2026-11-21, Amendment 2026-11-21): dark mode is mandatory. After seeing PR 1a in the light palette the user said: "I don't like the colour scheme. Dark mode is mandatory." After three dark mockups: "We like this design. Go with it. Accent colours we can discuss later." The choice is option 1, "Stage": a warm charcoal dark theme with signal orange. The accent colour may change later.
- DECISION (user, 2026-11-21, Amendment 2026-11-21): the user likes the use of icons and the member list in the lobby. The sharp edges are too sharp: small rounded corners (item 1). The lobby page seat boxes are dropped (item 6); the lobby page keeps the current player list.
- DECISION (user, 2026-11-21): the genre look is dropped entirely: no tint, no background pattern, no genre icon, no 3D motif and no accent stripe, in any place. Game covers are not shown in any place (Next up, lobby page header, lobby rows). The Game logo is removed from week blocks. The genre stays a stored value, editable in the game form (F-032, ADR 0016 data unchanged). Confirms the ASSUMPTION of item 10.

## Open questions
None blocking. The ASSUMPTIONs below stay open for the product owner's reading and the UI expert's confirmation; the user may change them.
- ASSUMPTION (product owner, user may change): a stable hash of the group ID picks the colour, and the group name is in every block (item 11). The six colours are a DECISION (user, 2026-11-21).
- ASSUMPTION (product owner, user may change): the group's Calendar view keeps the running order (item 5), so F-017 is not removed.
- ASSUMPTION (product owner, user may change): the 3D landing hero is kept and restyled, not removed (item 8).
- ASSUMPTION (product owner, user may change): the time axis of the running order covers 00:00 to 24:00 with a horizontal scroll inside the component (item 4).
- ASSUMPTION (UI expert to confirm): the sub-lane and row height rule, the block-fit rule of a too-short block, the Now line outline sizes, and the exact type sizes (item 2).
- Decided (ADR 0028 sections 16.2 and 16.3, Amendment 2026-11-21): the border of inputs, Dropdown triggers and secondary buttons is the 1 px `--color-control-line` (`#7a7268`), at least 3:1 on ground, surface and raised (WCAG 1.4.11). It replaces `--color-rule-strong` for controls; no open question remains on this.
- Not open (Amendment 2026-11-21): the orange accent may change later by changing `--color-signal` only (ADR 0028 section 16.2, token table).
