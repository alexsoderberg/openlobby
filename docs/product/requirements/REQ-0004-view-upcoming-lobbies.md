# REQ-0004. View upcoming lobbies
Status: Decided
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
- Given that a lobby starts on one day and ends the next day, when it is shown in the calendar, then it is shown on its start day with start and end time and a marker that it ends the next day. The lobby is not split across two days (DECISION).
- Given that I am in the calendar view, when I see a lobby, then the same Spot / max players ("X/Y players" or "X players") is shown as in the list.
- Given that two lobbies overlap, when the calendar is shown, then both are visible side by side, and neither is hidden.
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
