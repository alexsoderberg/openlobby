# REQ-0004. View upcoming lobbies
Status: Implemented
Feature: F-004 (list), F-017 (calendar view)
Priority: Must

## Problem
Lobbies that are created are worthless if nobody can see them. Members need a quick overview of what is coming up and who is in, and sometimes an overview of the lobbies in a week schedule.

## User story
As a member, I want to see all upcoming lobbies in my group, with who is playing, as a list or a calendar, so that I can pick a lobby that suits me.

## Acceptance criteria

List (F-004):
- Given that I am a member and there are upcoming lobbies, when I open the group's page, then the lobbies are sorted by start time, and each row shows game, date and clock time, creator, and Spot / max players: "X/Y players" if the lobby has a max players value, and "X players" if it has no max.
- Given that a lobby ends the next day, when it is shown in the list, then the end date is also shown.
- Given that my locale formats dates or clock times differently from the English default, when I see a lobby in the list or the calendar, then its dates and clock times are formatted for my locale, and the interface text stays English until translations exist (vision.md DECISION: UI language).
- Given that I am a member, when I open the group's page, then a lobby is shown only until its end time has passed.
- Given that a lobby has passed its end time, when I open the group's page, then it is not shown in the list.
- Given that a lobby has passed its end time, when I open its detail view (e.g. via a direct link), then it is not shown and I see "not found".
- Given that the group has no upcoming lobbies, when I open the group's page, then the text "No lobbies have been created yet" is shown.
- Given that I am a member and click a lobby, when the detail view opens, then I see the names of all players.
- Given that another member has just joined or left a lobby, or deleted one, when I reload the group's page, then the change is shown.
- Given that I am not a member, when I try to see the group's lobbies, then the 404 page is shown without any lobby information, the same as for an unknown group (DECISION, consistent with REQ-0002).

Switching between list and calendar (F-017):
- Given that I am a member, when I open the group's page, then the list view is shown (DECISION: list is the default view).
- Given that I am on the group's page, when I select "Calendar", then the group's upcoming lobbies are shown in a week view for the current week. The week starts on Monday and ends on Sunday (DECISION). Month view is not part of the MVP (DECISION).
- Given that I am in a view, when I select "List" or "Calendar", then the view switches and shows the same lobbies, the same filter (not past) and the same detail view.
- Given that I am in the calendar view, when I select "Next week", then the upcoming lobbies in that week are shown. Past lobbies are not shown, and there is no backward navigation (DECISION).
- Given that a lobby starts on one day and ends the next day, when it is shown in the calendar, then it is shown on its start day with start and end time and a marker that it ends the next day, and on the next day with a marker that it started the day before (amended 2026-11-04, see Amendment 2026-11-04 (time grid)). Old wording: "then it is shown on its start day with start and end time and a marker that it ends the next day. The lobby is not split across two days (DECISION)."
- Given that I am in the calendar view, when I see a lobby, then the same Spot / max players ("X/Y players" or "X players") is shown as in the list.
- Given that two lobbies overlap, when the calendar is shown, then both are visible side by side in the same day column, sharing its width, and neither is hidden (amended 2026-11-04, see Amendment 2026-11-04 (time grid)).
- Given that I am in the calendar view and the group has no upcoming lobbies, when I see the calendar, then the same text as in the list is shown: "No lobbies have been created yet".
- Given that I use the keyboard, when I switch view or select "Next week", then I can do so without a mouse.
- Given that I have selected a view, when I open the group's page again later, then the list view is shown again. The view choice is not saved between visits (DECISION).

## Out of scope
- Real-time updates without reloading the page.
- Month view, filtering by game or date, search.
- History of past lobbies (F-020).
- Showing lobbies from several groups together (except the dashboard, REQ-0012).
- Calendar export (F-019).

## Related features
F-003 (Create lobby), F-005 (Join and leave lobby) and F-018 (Max players per lobby) provide the data shown here. F-017 is the same data in a different presentation; that is why it is in this requirement and not in its own. No other feature in the feature register shows group lobbies, so this is not a duplicate.

## Open questions
- DECISION: No real-time updates in the MVP. Members reload the page to see changes.
- DECISION: All upcoming lobbies are shown, without pagination in the MVP.
- DECISION: The week starts on Monday.
- DECISION (past lobbies): Past lobbies are not shown in the MVP. This applies to the list, the week view and the detail view alike. A past lobby is shown as "not found". This follows from the already decided rule that past lobbies are not shown (see vision.md).

## Amendment 2026-11-04
- The term "Spot / max players" (glossary) is used for the "X/Y players" and "X players" display in the list and calendar criteria.
- The out-of-scope line "Showing lobbies from several groups together" now has one exception: the dashboard (REQ-0012, F-028). Group views are unchanged.

## Amendment 2026-11-04 (create from the calendar)
Status stays Implemented. Decided by the user on 2026-11-04 and not yet built. The week calendar gets a second way to open Create lobby (REQ-0003, F-003). The form, its rules and its data are those of REQ-0003. This is not a new feature and not a duplicate of F-003.

Criteria added (binding for the UI expert):
- Given that I am a member and in the calendar view, when I select an empty part of a day's column, then the Create lobby form (REQ-0003) opens with that day's date in the date field (DECISION, user, 2026-11-04; amended 2026-11-04 (time grid): a click on an empty time also prefills the start time). User's words (translated): "The user should also be able to click directly in a calendar to create a new lobby."
- Given that I select a lobby shown in a day's column, when the calendar shows it, then its detail view opens, not the form (ASSUMPTION: a click on a lobby keeps its current meaning).
- Given that I use the keyboard, when I focus a day's create control and press Enter or Space, then the form opens with that day's date. Each day that can take a lobby has a visible create control whose accessible name names the day (ASSUMPTION: the look and the exact name are the UI expert's call).
- Given that a day lies before today in my local time, when I see the calendar, then that day has no create control, and selecting its column does nothing (DECISION, user, 2026-11-04; consistent with "lobby in the past" in REQ-0003). Today has a create control. The start-time rule of REQ-0003 applies when I save.
- Given that I save a lobby created from a day, when it is saved, then it appears on its start day in the calendar, under the existing rules of this requirement.

Out of scope in this amendment:
- Creating a lobby from the Dashboard "This week" (REQ-0012). The section spans groups and the form needs one group (DECISION, product owner, 2026-11-04).
- Creating a lobby by selecting a time range in the calendar (dragging over several hours). Prefilling the start time from the clicked place is in scope (Amendment 2026-11-04, time grid).
- Creating lobbies in a month view (no month view in the MVP).

## Open questions (amendment)
- RESOLVED (DECISION, user, 2026-11-04): a click on an empty time prefills the start time, rounded down to the half hour, and the end time is start + 2 hours. Old question for reference: "ASSUMPTION: A click in a day's column prefills the date only. Should it also prefill the start time from the clicked hour? User to decide."

## Related features (amendment)
F-003 (Create lobby): the calendar is a second entry point to the same form. F-017 (calendar view): the same view, with a create control added. F-028 (dashboard): its "This week" is not changed by this amendment in the create rules, but uses the same time grid on desktop and phone (Amendment 2026-11-04 (time grid) and REQ-0012).

## Amendment 2026-11-04 (time grid)
Status stays Implemented. Decided by the user on 2026-11-04 and not yet built. The week view is shown as a time grid: days are vertical columns and the hours run down the page. The same grid is used for "This week" on the dashboard (REQ-0012, Fourth amendment). The rules above stay, except where a criterion is marked as amended. Binding for the UI expert.

User's words (translated): "I also want the lobby's duration shown graphically. A calendar where the days are vertical and you can see which time slots the lobby spans."

Layout (screen 760 px or wider):
- Given that I am in the week view, when it is shown, then the days are columns Monday to Sunday, the hours run vertically from 00:00 to 24:00, and the grid scrolls vertically (DECISION, user).
- Given that the week view opens, when the page loads, then 16:00 is at the top of the visible grid, or, if a lobby in the displayed week starts earlier, the full hour containing the earliest such lobby's start is at the top (DECISION, product owner, 2026-11-05: the hour line gives orientation and the lobby is in view at once). A lobby that continues from the previous day counts as starting at 00:00 (DECISION, user: "around 16:00" and "the week's first lobby if earlier"; ASSUMPTION for the exact offset).
- Given that a lobby is shown, when I look at its block, then its height is proportional to its duration, so that the block covers the clock times its lobby spans (DECISION, user; amended 2026-11-05: DECISION, product owner, the height uses wall-clock minutes, so on a daylight-saving change day a lobby across the switch shows its clock span, which can differ from its real duration by one hour; the grid shows clock times and such lobbies are rare).
- Given that a lobby is shown, when I look at its block, then it shows the game, the time range and Spot / max players ("X/Y players" or "X players"). When a block is too short to show them, they stay available to assistive technology (ASSUMPTION).
- Given that a lobby starts on one day and ends after midnight, when it is shown, then its block runs to 24:00 in the start day's column with the marker "ends next day", and in the next day's column from 00:00 to its end time with the marker "started the day before" (DECISION, user; marker wording ASSUMPTION). Both blocks open the same detail view.
- Given that a lobby started before Monday and has not ended, when the current week is shown, then its remaining part is shown in Monday's column from 00:00 to its end time with the marker "started the day before" (DECISION, user).
- Given that two lobbies overlap in a day, when the grid is shown, then they sit side by side in that day's column, sharing its width, and neither is hidden (DECISION, user).
- Given that a lobby block is shown, when I select it with the mouse or with Enter while it has keyboard focus, then its detail view opens (ASSUMPTION: a block is a link, like a list row; amended 2026-11-05: DECISION, product owner, Enter opens it as with other lobby links, and Space keeps its native page scroll).

Create from the grid (the form is REQ-0003, Amendment 2026-11-04, item 3):
- Given that I am a member and I select an empty part of a day's column, when the start time rounded down to the half hour is not before now, then Create lobby opens with that day's date and that start time, and the end time is start + 2 hours (DECISION, user, 2026-11-04). This replaces the criterion "the Create lobby form opens with that day's date in the date field" (old wording, kept for reference) and the open question on prefilling the start time.
- Given that I select an empty part of a column for a day before today, or a time whose rounded start is already before now, when I select it, then nothing opens and no create control is shown for that day (DECISION, user: "not in the past"; the rounded edge is ASSUMPTION).
- Given that I use the keyboard, when I want to create a lobby from a day, then the day's create control opens the form with that day's date and no start time (DECISION, product owner, 2026-11-04). The user allowed "date only, or a sensible default time"; date only keeps the rule already in place. The user may overrule. Empty grid parts are not keyboard targets; the create control is the keyboard route (ASSUMPTION).

Phone (screen narrower than 760 px):
- Given that I am in the week view on a phone, when it is shown, then seven day pills Monday to Sunday are shown on top, and the time grid of the selected day is shown below them (DECISION, user). Today is selected when the view opens (ASSUMPTION, same as REQ-0012).
- Given that a day pill has lobbies, when I see the pill, then it shows a dot (same as REQ-0012).
- Given that I select a day pill, when the day changes, then that day's time grid is shown and the scroll position is kept (ASSUMPTION).
- Given that the week view opens on a phone, when the page loads, then the scroll rule above applies to the selected day: 16:00 at the top, or the full hour containing the start of the day's earliest lobby, if that lobby starts earlier (ASSUMPTION for the phone scope; amended 2026-11-05 as above).
- Given that I am on a phone, when I use the day pills, the blocks and the create control, then each is operable with the keyboard, and each tap target is at least 44 px (REQ-0012, cross-cutting rule).
- Given that I am on a phone, when I use "Next week", then the day pills and the time grid show the next week (criterion in the calendar view above applies).

Old wording of criteria amended in this section (kept for reference):
- Midnight criterion (line "a lobby starts on one day and ends the next day"): "then it is shown on its start day with start and end time and a marker that it ends the next day. The lobby is not split across two days (DECISION)."
- Overlap criterion: "then both are visible side by side, and neither is hidden."
- Create from a day: "the Create lobby form (REQ-0003) opens with that day's date in the date field (DECISION, user, 2026-11-04)."
- Scroll rule (2026-11-05): "16:00 is at the top, or, if a lobby starts earlier, the earliest such lobby is at the top."
- Block activation (2026-11-05): "when I select it with the mouse or with Enter or Space while it has keyboard focus".
- Block height (2026-11-05): "so that the block covers exactly the time its lobby spans".

Related features (time grid)
F-017 (calendar view): the view is the same; only its layout changes. F-028 (dashboard, REQ-0012): the same grid, with the group name on each block and no create from the grid (no group context).
