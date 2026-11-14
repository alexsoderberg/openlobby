# REQ-0019. Larger week view on desktop and scroll to the next lobby
Status: Implemented
Feature: F-017 (group view week view), F-028 (This week on the Dashboard). Extends both; amends REQ-0004 and REQ-0012.
Priority: Should

Decided by the user on 2026-11-12. The product owner set the priority (Should): it changes how an existing view looks and where it opens, and no other requirement depends on it.

Corrected 2026-11-12 after review: the week grid was never limited to 40rem. On logged-in pages the main area of the app shell is up to 72rem wide and centred. The 40rem `.page` width applies only to logged-out pages. The grid looked small for two reasons: its fixed height (32rem), and, in the group view, the members panel beside the lobbies panel from 75rem.

Amendment 2026-11-12 (user browser check): the grid ends at 24:00 and the scroll cannot go past it. The end-of-day area below 24:00 that an earlier version of the opening scroll added is removed, because the user found that it scrolled too far and left a big empty space under the calendar (DECISION, user, 2026-11-12). Changed criteria are marked "Amendment 2026-11-12".

## Problem
The week view of the group view and the This week section of the Dashboard use the same time grid. On a desktop the grid has a fixed height (32rem), so on a tall window the space below it is unused. In the group view, from 75rem (1200 px) the members panel (19rem wide) sits beside the lobbies panel, which takes width from the week grid. A member who opens the grid sees the afternoon, or the earliest lobby of the week if that is earlier, and not the time of day they are in. The grid does not show the current time. The lobbies of the day are hard to see in one view.

## User story
As a member, I want the week view to use the width and height of my desktop window and to open at my next lobby with a line for the current time, so that I see when we can play without scrolling to find it.

## Acceptance criteria

Width and height (desktop, screen 760 px or wider):
- Given that I am on a screen 760 px or wider and I see a week view (group view or This week on the Dashboard), when it is shown, then the grid fills the width of the main area of the app shell, up to 72rem (about 1150 px), and it is centred there, as the main area is today.
- Given that the window is wider than 72rem, when I see the week view, then the grid is 72rem wide and does not grow further.
- Given that I am on a screen 760 px or wider, when I see the rest of the group view (header, Create lobby button, list view) or the rest of the Dashboard (Next up card, headings), then they keep their current layout and width. This requirement does not change them (DECISION, user, 2026-11-12: "the rest of the page keeps its width").
- Given that I am on a screen 760 px or wider and the week view is shown, when I look at the page at the top, then the bottom edge of the grid is at the bottom of the window, minus a small margin set by the UI expert, so the grid's height fills the window below its top edge (DECISION, user, 2026-11-12). The hours scroll inside the grid, not the page.
- Given that the window is short, so that the space below the grid's top edge is less than 32rem, when I see the week view, then the grid is 32rem high, the height it has today, and the page scrolls to reach the rest (ASSUMPTION: a minimum that keeps the grid usable on short windows).
- Given that I am on a phone (narrower than 760 px), when I see the week view, then its width and height are as they are today: the day pills and the time grid of the selected day (REQ-0004, Phone). This requirement changes nothing on phones (DECISION, user, 2026-11-12).
- Given that I resize the window across the 760 px line or the 75rem line, when the layout changes, then the grid and the members panel take the layout of the new width without a reload.

Group view layout (desktop, DECISION, orchestrator, 2026-11-12, serving the user's request for a bigger calendar; the user may change it):
- Given that I open a group view with the Calendar view shown, on a screen 75rem (1200 px) or wider, when I look at the page, then the members panel is below the lobbies panel, not beside it, so the week grid takes the full width of the main area.
- Given that I open a group view with the List view shown, on a screen 75rem (1200 px) or wider, when I look at the page, then the lobbies panel and the members panel are side by side, as today.
- Given that I am on a screen narrower than 75rem, when I see the group view in either view, then the members panel is below the lobbies panel, as today.

Opening scroll (desktop and phone):
- Given that the week view opens, when lobby data for the shown week (desktop) or the selected day (phone) is first shown, then the grid is scrolled once to the target described below (DECISION, user, 2026-11-12; "the scroll is still set once"). "Opens" means the view is shown with the current week (or, on a phone, today) selected: the page loads, or the Calendar view or Week calendar option is selected.
- Given that the week view opens, when the target is chosen, then the target is the lobby that starts first among the lobbies of the shown week (desktop) or the selected day (phone) that have not ended, where a Running lobby counts (DECISION, user, 2026-11-12). Lobbies that have ended are not counted.
- Given that a target lobby is found, when the grid is scrolled, then the full hour at or before the lobby's start is at the top of the visible grid (ASSUMPTION: the same hour alignment as REQ-0004), unless that would need the grid to scroll past 24:00. The grid never scrolls past 24:00 (Amendment 2026-11-12, user browser check; DECISION, user, 2026-11-12). Then the grid is scrolled to its end, with 24:00 at the bottom edge, and the target is visible but not at the top. A lobby that started before the shown week or the selected day, and is still running, counts as starting at 00:00 of Monday (desktop) or of the day (phone), as in REQ-0004.
- Given that no lobby of the shown week (desktop) or selected day (phone) has not ended, when the grid is scrolled, then the full hour at or before the current time is at the top of the visible grid, so that the now line is in view, unless that would need the grid to scroll past 24:00 (DECISION, user, 2026-11-12; the exact offset is ASSUMPTION). Then the grid is at its end, with 24:00 at the bottom edge, and the now line is in view (Amendment 2026-11-12, user browser check). At 23:30 the grid does not show 23:00 at the top; the now line is in the last hour of the grid.
- Given that the week view is open, when lobbies change (created, joined, left, deleted, or changed by REQ-0017) or I select another day pill on a phone, then the scroll position does not change (DECISION, user, 2026-11-12: "later data or day changes keep the user's scroll").
- Given that the group view's week view has "Next week" selected, when the next week is shown, then the scroll position does not change (ASSUMPTION: "set once"; see Open questions).

Examples for the opening scroll (desktop, current time Wednesday 14:10, week shown; the lobbies are as stated). The examples assume that the grid shows 10 hours at once (ASSUMPTION for the examples only; the real number depends on the window height). Amendment 2026-11-12 (user browser check): the examples are updated for the end of the grid at 24:00.
- Wednesday 19:00 to 21:00 and Thursday 18:00 to 20:00. The grid is at its end (14:00 to 24:00 shown), so 19:00 is visible, not at the top.
- Tuesday 09:00 to 11:00 (ended) and Wednesday 19:00 to 21:00. The grid is at its end (14:00 to 24:00 shown), so 19:00 is visible, not at the top.
- Wednesday 13:00 to 15:00 (Running at 14:10) and Wednesday 19:00 to 21:00. The grid opens with 13:00 at the top (13:00 to 23:00 shown).
- No lobby that has not ended. The grid opens with 14:00 at the top (14:00 to 24:00 shown), so the now line is visible.
- Wednesday 22:00 to 23:30, the only lobby that has not ended. The grid is at its end, so 22:00 is visible in its lower part, not at the top, and the last hours up to 24:00 are shown.
- Wednesday 23:00 to 23:45, the only lobby that has not ended. The grid is at its end, so 23:00 is visible in the last hour, not at the top.
- No lobby that has not ended, and the time is Wednesday 23:30. The grid is at its end, so the now line at 23:30 is visible in the last hour.

The now line:
- Given that today is in the shown week (desktop) or today is the selected day (phone), when the week view is shown, then a thin line across today's column marks the current time (DECISION, user, 2026-11-12). On a phone the line is shown only when today is the selected day.
- Given that the now line is shown, when the time passes, then the line moves to the current time without a reload, at least once a minute (ASSUMPTION: the update interval).
- Given that the week view is shown, when I look at the other days' columns, then no now line is shown in them. Given that the shown week is not the current week, then no now line is shown.
- Given that the now line is shown, when I select a lobby block or the line is over a block, then the block is still selected, because the line does not take pointer input (ASSUMPTION).
- Given that I use a screen reader, when I move through the week view, then the now line is not announced; the time is already given by the hour lines and the lobby blocks. The line has no text label in the MVP (ASSUMPTION).
- Given that the Day list option of This week is selected on the Dashboard, when I see it, then no now line is shown, because the Day list is not the time grid (REQ-0012, Amendment 2026-11-07).

## Out of scope
- A change to the phone layout: day pills, the grid's width and the phone scroll behaviour except the target rule above (REQ-0004 and REQ-0012 phone rules stay).
- A change to the list view, the Next up card, the Day list, the Create lobby form, or the lobby page.
- A change to the members panel's width or content, and a layout change below 75rem.
- A month view, a new week navigation, or a time range selection in the grid (REQ-0004 out of scope).
- A remembered scroll position between visits or between pages.
- A now line on the Day list, in the list view, or in the Next up card.
- A "zoom" control or a choice of hour range.
- Any change to what a lobby block shows (REQ-0004, REQ-0015 labels).

## Related features
F-017 (week view of the group view): the same view, larger on desktop, opening at a different place, and with the members panel below it from 75rem. Extended by this requirement; not a new feature.
F-028 (This week on the Dashboard): uses the same grid, so the same desktop size and opening rule apply to it. Extended by this requirement; not a new feature.
REQ-0004 (time grid amendment, 2026-11-04): the criteria on the desktop layout ("Layout (screen 760 px or wider)", the first criterion on the scroll position of the week view) and the phone scroll criterion are replaced by this requirement, as recorded in REQ-0004 (Amendment 2026-11-12).
REQ-0012 (Fifth amendment, 2026-11-04): This week uses the grid of REQ-0004; the same change applies to it on desktop, as recorded in REQ-0012 (Amendment 2026-11-12).
F-035 / REQ-0017 (live updates): the scroll stays when live updates change the lobbies. This requirement only adds that rule; it does not change live updates.
F-036 / REQ-0018 (group feed): not related to the grid. Its place in the group view is not set by this requirement (see Open questions).
No existing feature changes the size or the opening scroll of the week view, so this is not a duplicate. The Next up card (REQ-0012) is a different rule: it shows the first lobby across all groups, while the opening scroll works within one week or day of one group view, or of This week.

## Open questions
- GLOSSARY REQUEST for the architect (not added by the product owner): the term "Now line" is used in this requirement for the thin line at the current time in today's column. Please add it to the glossary in CLAUDE.md if the term is accepted, with its technical form, or name another term.
- ASSUMPTION (user to confirm): "Next week" in the group view keeps the scroll position, because the scroll is set once when the view opens. The alternative is to set it again for the new week.
- ASSUMPTION (user to confirm): the 760 px breakpoint of REQ-0004 is the only breakpoint for the size of the grid; there is no separate breakpoint at 72rem.
- ASSUMPTION (user to confirm): on the Dashboard, the grid is also sized to the window bottom, below the Next up card and the section heading. If that makes the Dashboard hard to scan, a fixed height below those is the alternative.
- ASSUMPTION (UI expert to confirm): the bottom margin of the grid, the minimum height 32rem, the exact offset of the hour at the top, the update interval of the now line, and that a target from 22:00 on is still visible with the grid at its end on the 32rem minimum height (Amendment 2026-11-12).
- ASSUMPTION (user to confirm): the target lobby is the one with the earliest start, also when a later lobby is longer. The alternative is to count lobbies that are shown as Running first.
- DECISION TO CONFIRM (user): the members panel moves below the lobbies panel in the group view's Calendar view from 75rem, and stays beside it in the List view. The user may change this. Open: if the Group feed (REQ-0018) is built, this decision does not say whether the feed moves below with the members panel or stays beside the lobbies panel.
