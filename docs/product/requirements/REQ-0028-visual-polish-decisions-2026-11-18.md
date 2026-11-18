# REQ-0028. Visual polish decisions 2026-11-18
Status: Decided
Feature: F-001, F-010, F-028, F-030, F-032, F-043, F-044 (extended; no new feature, see Related features)
Priority: Should

Decided by the user on 2026-11-18 (DECISION, user, 2026-11-18): the eight proposals of two read-only frontend audits (impeccable and design-taste-frontend), each accepted as proposed. Items marked ASSUMPTION are the product owner's reading of the decision; the user may change them. Each item overrides the earlier decision it names.

## Problem
The frontend uses gold on too many things, every lobby has a coloured stripe, the landing headline is a serif that is not part of the app, every secondary button glows, and a few placements and words disagree. The audits found these conflicts with earlier decisions. The user wants a calmer, more consistent look without changing what the app does.

## User story
As a member, I want gold to mean "act here" or "this is the current state", and every page to name and place its parts the same way, so that I see at a glance what I can press and what is active.

## Acceptance criteria

### 1. Gold only for action and state (DECISION, user, 2026-11-18)
Overrides the colour rules of the dark luxury UI spec of 2026-11-03 (accent used on key numbers, progress meters, the admin badge, the highlighted heading word and the logo).
- Given I look at any page, when I look for gold, then gold marks only: the primary button, the focus ring, the active item of the Tab bar and the Group rail, the Now line, the timing of Next up (the countdown and "Running"), and state: a selected option of a Dropdown list, a full role slot (REQ-0011), and the selected day in the day pills (REQ-0004). ASSUMPTION: these state uses are kept because they are state, not counts.
- Given a player count ("3/5 players") or a role slot count that is not full ("Tank 0/1"), when I see it, then the figures are in the text colour, not gold, and they use tabular figures, so the width of the digits does not change when the count changes.
- Given a count badge of a role slot or of Flex, when I see its background, then it is neutral, not the gold tint (DECISION, user, 2026-11-18, confirmed after review; the architect records it in ADR 0026). A full role slot keeps its gold fill as a state (item 1, state uses).
- ASSUMPTION (product owner): "Flex N" is a count, so it is in the text colour like the other counts.
- Given a meter of a lobby (its player count), when it shows its fill, then the fill uses the genre accent of its lobby's theme (the neutral theme for no genre).
- Given the invite uses meter of a link, when it shows its fill, then the fill is a neutral colour, not gold (DECISION, user, 2026-11-18; the link has no genre).
- Given I look at a Group card, when I see its background, then there is no gold wash. DECISION, user, 2026-11-18: the gold hover edge of cards and of secondary buttons stays gold, because it is action feedback.
- Given I look at the admin badge ("Group admin"), when I see it, then it is neutral, in the text colour, not gold (DECISION, user, 2026-11-18).
- Given I look at the landing headline, when I see the highlighted word ("planned") and the logo's "Lobby", then they are not gold (DECISION, user, 2026-11-18).
- Given any text in the gold rule above, when I check its contrast, then it meets WCAG AA as all text in the app does.
- Gold uses decided 2026-11-18 (DECISION, user, 2026-11-18; the first three bullets below were delegated by the user to the orchestrator, the last one was confirmed by the user). The closed list is the glossary row "Gold rule" in `CLAUDE.md`, which is the single source:
  - Stay gold, as action: the gold hover of a text link (as the gold hover edge of cards and secondary buttons) and the desktop "+" create control.
  - Stay gold, as state: the selected thumb of the view toggle, and checked checkboxes and radios (`accent-color`).
  - Neutral: the hover and open tint of a Game chip, the hover and focus tint of a context menu item, and the hover wash of the week grid's create area.
  - Neutral, as built and confirmed by the user: the panel edges of Create frame, Popover, Dropdown list and the context menu; initials circles; the Monogram; today's date in the week grid (the underline stays in the text colour); the "has lobbies" dot of a day pill.

### 2. Genre accent stripe only on week blocks (DECISION, user, 2026-11-18)
Overrides the 3px genre-accent left border of the lobby rows (F-032, PR #73) and the border named in REQ-0026 (Amendment 2026-11-18) and in the glossary row "Game cover".
- Given I see a lobby block of the week calendar (Group view and This week, REQ-0004 and REQ-0012), when the game has a genre, then the block has the 3px genre accent stripe on its left edge.
- Given I see a lobby row of the Group view list, the lobby page header or the lobby line of a Group card, when the lobby has a genre, then no stripe is drawn there.
- Given I see a lobby with a genre in any of these places, when I look at it, then the genre icon, the genre name and the tint or pattern of the theme are still shown (REQ-0014, REQ-0026).
- Given I see a cover on a lobby row, the lobby page header or Next up (REQ-0026), when I look at it, then the genre icon stays and no stripe is drawn.
- DECISION, user, 2026-11-18: the stripe is removed from Next up and from the This week day list too; only the week grid blocks keep it.
- Given two genres are shown in one view, when I compare them, then they still differ by icon and pattern (REQ-0014, "told apart without reading").

### 3. Landing headline in Space Grotesk (DECISION, user, 2026-11-18)
Overrides the serif headline of the dark luxury UI spec of 2026-11-03 (Cormorant Garamond for the landing headline).
- Given I open `/` logged out, when the headline is shown, then it is set in Space Grotesk, weight 700, the app's heading font.
- Given I open `/` logged out, when the page loads, then no serif font file is requested or shipped with the frontend (test: the build has no Cormorant Garamond file and the licence of that font is removed with it).
- Given I open `/` logged out, when the headline changes font, then the headline, lead and buttons do not move (no layout shift, as REQ-0013).
- Given I open `/` logged out, when the page loads, then the headline has the same text and the same accessible role (first heading of the page), as REQ-0013 requires.
- Given the Cormorant token `--font-display` is removed, when the landing page is built, then its uses take `--font-heading` (DECISION, user, 2026-11-18, confirmed after review).
- ASSUMPTION (product owner): the landing section titles use the heading font too, as the headline does.

### 4. No gold glow on secondary buttons (DECISION, user, 2026-11-18)
Amends ADR 0023 Amendment 2026-11-17 (Button hover: a glow in the button's own colour). The primary keeps its glow.
- Given I hover or focus a secondary button, when it shows its hover state, then it has no glow. Its gold edge on hover may stay (ASSUMPTION: it is action feedback, see item 1).
- Given I hover a primary button, when it shows its hover state, then it keeps its glow as before (ADR 0023 Amendment 2026-11-17).
- Given I hover a ghost button, when it shows its hover state, then it has no glow, as before.
- DECISION, user, 2026-11-18: the danger button keeps its red glow.
- Given the reduced motion setting, when I hover a secondary button, then the rule above still holds (no glow).

### 5. Lobby page order (DECISION, user, 2026-11-18)
Amends the placement rules of REQ-0025 (lobby page). The content and rules of REQ-0005 and REQ-0015 are unchanged.
- Given I open a lobby page, when I read the panel with the role slots and the players, then the "Join lobby" or "Leave lobby" button comes directly after the role slots, and before the "Players" heading. ASSUMPTION: where a lobby has no role slots, the button comes directly after the spot count.
- Given I am the creator of a lobby, when I open its lobby page, then "Delete lobby" is the last element of the panel (after the players), and it is a `danger` button with visible text (glossary, Button variant).
- Given I open a lobby page on a screen 98rem or wider, when I read it, then the lobby settings stay in the side column (REQ-0025). DECISION, user, 2026-11-18: "Delete lobby" is at the end of the main column, last in the lobby panel. The order rule applies on every width.
- Given I open a lobby page on a phone, when I read it, then the same order applies.

### 6. One word for the home page (DECISION, user, 2026-11-18)
- Given I am logged in, when I see the Home tab of the Tab bar, the Home control of the Group rail and the heading of the Dashboard page (`/`), then they show the same visible word, "Home", and the Home control's accessible name is "Home".
- Given I read the app's text, when I look for the word, then the page is not called "Dashboard" in any visible place. The glossary term "Dashboard" stays for code and documents.
- Given the text catalogue, when the word is changed, then the Tab bar and the page heading take it from the same text key (ADR 0013), so they cannot drift apart.

### 7. Leave group at the end of the Member list (DECISION, user, 2026-11-18)
Moves the "Leave group" button of REQ-0006 (F-010). The confirmation and every rule of REQ-0006 stay as they are.
- Given I open a group view, when I read its page header (group name and Invite button, REQ-0025), then "Leave group" is not in the header.
- Given I open a group view, when I read the page, then "Leave group" is the last item on the page, after the Member list and the Group feed in the layouts below. The member rows are not changed.
- Given the group view is in the side column layout (98rem or wider), when I read the side column, then the Member list and the Group feed (REQ-0018) come first, and "Leave group" is below the Group feed, the last item on the page (DECISION, user, 2026-11-18).
- Given I open a group view below 98rem, when I scroll to the end of the page, then "Leave group" is the last item on the page, after the Member list, which is below the lobbies (REQ-0025; DECISION, user, 2026-11-18).
- Given I press "Leave group", when I see it, then it is a `danger` button with visible text (glossary, Button variant), and the confirmation of REQ-0006 is shown before anything is changed.
- Given I am the last member or have upcoming lobbies, when I press "Leave group" and confirm, then REQ-0006 applies unchanged (the denial message, the admin hand-over, the deletion of the group).

### 8. Touch buttons 44 px (DECISION, user, 2026-11-18)
Amends the touch button size of ADR 0021 (point 2, 2.5rem on coarse pointers) and ADR 0023 (sizes by pointer type).
- Given I use a touch screen (coarse pointer), when I see any button or icon-only button, then its height is at least 2.75rem (44 px), the same value as the tap size of REQ-0012 and REQ-0004.
- Given I use a mouse or another fine pointer, when I see a button, then its size is as before (ADR 0021, 2rem).
- Given the design tokens, when I check the touch button size, then it is the same value as the tap size, and there is one value, not two (DRY, CLAUDE.md).
- ASSUMPTION (product owner): on a coarse pointer, text inputs (the group form inputs and the invite link URL field) and the Dropdown list trigger also take the 44 px height (`--size-tap`), so they match the touch buttons.

## Also decided: fix PR 1 (DECISION, user, 2026-11-18)
The user approved four small fixes of existing behaviour on 2026-11-18. They are fixes, not new functionality, so they go directly to workflow step 2 (CLAUDE.md), built in branch `frontend-polish-1`. They change no item above.
- (a) Panels (a code name, not a glossary term) in the logged-in app show at once: their scroll reveal is removed and only the page transition animates. The landing step cards and the invite link rows keep their reveal.
- (b) A person without an Avatar shows initials (`ui/Avatar`), not an empty circle, in the Member list and in the lobby player list.
- (c) The row hover tint with a mouse stays only on rows that are one full-row link (the lobby rows).
- (d) UI copy: capacity errors keep the upper limit in plain words; the image size error names 512 KiB; the Game cover hint and removal text name all three places a Game cover shows (Next up, the lobby page header and each lobby row of the Group view); the empty lobbies text ends with a full stop.

## Out of scope
- Any change of what the features do, their content or their rules. Only colour, font, placement, labels and button size change.
- A light theme, new fonts or a font other than the one named in item 3.
- The per-game accent colour of F-030 (not built), the genre colours and the genre theme designs (REQ-0014).
- The hover light sweep and the motion rules of the dark luxury UI spec (unchanged).
- The landing copy (REQ-0013 and the copy decision of 2026-11-03).

## Related features
- F-001 (landing page, item 3): a presentation change of the landing headline. No behavior, no new feature.
- F-010 (Leave group, item 7): the button moves; REQ-0006 is unchanged. Extends F-010, not a new feature.
- F-028 (Dashboard and Home, item 6): the visible label of the home page. Extends F-028.
- F-030 (game presentation, logo and cover, item 2 and item 1): the cover places lose the genre border; the logo's gold rule. Extends F-030 (REQ-0026 Amendment 2026-11-18).
- F-032 (genre themes, item 2): the stripe of PR #73 is removed from all places but the week blocks. Extends F-032 (REQ-0014 Amendment 2026-11-18).
- F-043 (Group cards, item 1 and item 2): no gold wash, no stripe on the lobby line. Extends F-043 (REQ-0024).
- F-044 (wider layout, items 5 and 7): the lobby page order and the Leave group place inside the side column layout. Extends F-044 (REQ-0025).
- Verdict (product owner, 2026-11-18): EXTEND each feature above, NEW rejected. Each item changes the look or the place of a feature that already exists; no item adds data, an action or a rule. The eight items are one requirement only because they came from one review and share the gold rule and the button size.
- Not a duplicate of F-041 (toasts) or F-045 (dropdown lists): those are behaviour and components, and this requirement changes only a colour, a font, a placement and a size.

## Assumptions
The user answered the open questions on 2026-11-18 (DECISION, user, 2026-11-18): the gold hover edge stays gold; the admin badge is neutral; the highlighted landing word and the logo's "Lobby" are not gold; the invite uses meter is neutral; the stripe is removed from Next up and the This week day list; "Delete lobby" is last in the main column; "Leave group" is below the Group feed, last on the page; the danger button keeps its red glow; the visible word is "Home" (the glossary term "Dashboard" stays for code and documents).

Items still ASSUMPTION (product owner, not asked by the user; the user may change them): the gold state uses of item 1 (the full role slot, the selected option, the selected day, the countdown of Next up); the place of the Join and Leave buttons when a lobby has no role slots (item 5).

## Amendments in other requirements
Each affected requirement carries a one-line pointer to this one (Amendment 2026-11-18). The rule here wins where they differ.
- REQ-0006 (item 7), REQ-0012 (item 6), REQ-0014 (item 2), REQ-0024 (items 1 and 2), REQ-0025 (items 5 and 7), REQ-0026 (item 2).
