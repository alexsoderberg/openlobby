# REQ-0003. Create lobby
Status: Implemented
Feature: F-003
Priority: Must

## Problem
Someone who can play wants to say "I'm free then" without writing in the chat. The group needs a clear, structured lobby to work from.

## User story
As a member, I want to create a lobby for a certain game so that others in the group see when we can play.

## Acceptance criteria
- Given that I am a member of a group, when I create a lobby with game, date, start time, end time and max players, then the lobby is saved and shown to all members of the group. The game is chosen and max players is set according to REQ-0009.
- Given that I create a lobby, when it is saved, then I am the creator of the lobby, I am a player in it, and I take one of its spots.
- Given that I enter an end time as a clock time that is earlier in the day than the start time, when I try to save, then the end time is read as the next day and the lobby is saved, provided the lobby is shorter than 24 hours (DECISION). Example: start 22:00 and end 02:00 gives a 4-hour lobby that ends the next day.
- Given that the lobby would be 24 hours or longer, when I try to save, then it is denied with an error message and no lobby is saved (DECISION: exactly 24 hours is denied).
- Given that the end time has the same clock time as the start time, when I try to save, then it is denied with an error message and no lobby is saved, because the end is not after the start.
- Given that the start time has already passed, when I try to save, then it is denied with an error message.
- Given that no game is chosen, or "Other" is chosen with a name that is empty or longer than 50 characters, when I try to save, then it is denied with an error message and no lobby is saved.
- Given that I am not a member of the group, when I try to create a lobby, then it is denied and no lobby is saved.
- Given that I am the creator of a lobby, when I delete it, then it disappears for all members of the group.
- Given that I am not the creator of a lobby, when I try to delete it, then it is denied.
- Given that two lobbies overlap, when both are saved, then both remain. No conflict checks in the MVP.
- Given that I create a lobby in one time zone and another member in a different time zone opens the group, when they see the lobby, then it is shown in their local time and corresponds to exactly the same real moment.

## Out of scope
- Editing an existing lobby, including its max players (delete and create a new one in the MVP, see F-011).
- Recurring lobbies (F-014).
- Description, link or note on the lobby.
- Notifications, calendar export, Discord publishing.
- Lobbies that are 24 hours or longer, and lobbies with several games.
- Maximum number of lobbies per member.

## Related features
F-004 (View upcoming lobbies) shows what is created here. F-005 (Join and leave lobby) is used because the creator is a player from the start but can leave like anyone else; this is not a duplicate but a consequence of F-005. F-011 (Edit lobby) is a possible future addition and is replaced in the MVP by deletion and new creation. F-024 (Game list with default max players) provides the game choice and the default max value used here. F-018 (Max players per lobby) is the limit that joining respects. F-024 suggests values, F-018 decides what applies when spots run out, so they are not duplicates.

## Open questions
- DECISION (time zone): The user enters date and clock time in their own local time zone. The lobby is saved as an exact moment and shown to each member in their local time zone.
- DECISION (over midnight): An end time as a clock time earlier than the start time is read as the next day. Consequence: a mistyped clock time (e.g. 09:00 instead of 21:00) gives a long lobby without a warning.
- DECISION (warning): No warning for long lobbies, not even over 12 hours. Mistyped clock times are accepted in the MVP.
- DECISION (game): Games are chosen from the game list (REQ-0009) or are "Other" with a free-text name. Game is mandatory. The same game may be spelled differently under "Other"; this is accepted in the MVP. Replaces the earlier decision that games were free text.
- DECISION (max players): Max players is set at creation and does not change in the MVP. Replaces the earlier decision that there was no max limit on players (REQ-0005).
- ASSUMPTION (wrong max): A wrong max value is corrected by deleting the lobby and creating a new one (F-011).
- DECISION (lobby in the past): It is not possible to create a lobby whose start time has already passed.
- DECISION (concurrent editing): No locking. Two members can create lobbies at the same time.

## Amendment 2026-11-04
Status stays Implemented. Decided by the user on 2026-11-04. Built: item 1 in PR #45, item 3 in PR #47 (2026-11-05). Before this amendment the Create lobby form was shown at all times in the group view. All rules above stay the same; only the way the form is opened changes. A calendar day is a second way to open the form (REQ-0004, Amendment 2026-11-04). It is not a new feature.

1. The form is hidden until a member asks for it (DECISION, user, 2026-11-04). User's words (translated): "The form for create a lobby should only come up when you have pressed a button to create a lobby; it should not be visible all the time."
   - Given that I am a member and I open a group view, when the page opens, then the Create lobby form is not shown, and a "Create lobby" button is shown in the upcoming lobbies section, in both the list view and the calendar view.
   - Given that I press "Create lobby", when the form opens, then it appears with the same scale-in motion as the Create group form (REQ-0012), its first field is focused, and with reduced motion it appears without animation (ASSUMPTION: copied from the Create group pattern).
   - Given that the form is open, when I press Esc or "Cancel", then the form closes without saving and focus returns to the control that opened it (ASSUMPTION: copied from the Create group pattern). Tapping outside the form does not close it, so typed input is not lost (ASSUMPTION).
   - Given that the form is open, when I save and the lobby is saved, then the form closes, focus returns to the control that opened it, and the new lobby appears in the list or the calendar (DECISION, user, 2026-11-04: the form closes after a successful create).
   - Given that the form is open, when I save and the save is denied by any rule above, then the form stays open with the entered values and the error message (ASSUMPTION).
   - Given that the form is opened from a calendar day (REQ-0004, Amendment 2026-11-04), when I save, then the same fields and rules as above apply, and the date is prefilled.

2. Out of scope in this amendment: creating a lobby from the Dashboard "This week" (REQ-0012). That section spans groups and the form needs one group (DECISION, product owner, 2026-11-04).

3. The form is prefilled from the time grid (DECISION, user, 2026-11-04; REQ-0004, Amendment 2026-11-04 (time grid)). All fields stay editable, and all rules above apply to the saved values.
   - Given that I select an empty time in a day's column of the week view, when the form opens, then the date is prefilled with that day, and the start time is prefilled with the selected time rounded down to the half hour (e.g. 14:40 gives 14:30).
   - Given that the start time is prefilled from the grid, when the form opens, then the end time is prefilled with the start time plus 2 hours. A result after midnight is shown as the next day's clock time and follows the rule of the next-day end time above (DECISION, user).
   - Given that I open the form from a day's create control on the week view, when the form opens, then the date is prefilled and the start and end times are empty (DECISION, product owner, 2026-11-04; the user allowed "date only, or a sensible default time").
   - Given that I change a prefilled start time, when I save, then the end time is not changed automatically (ASSUMPTION).
   - Given that a prefilled start time has passed by the time I save, when I save, then the rule "start time has already passed" applies and the save is denied (existing rule).

## Open questions (amendment)
- ASSUMPTION: The Esc, Cancel and tap-outside behavior above follows the Create group form. The user may overrule the tap-outside part.
- ASSUMPTION: Create from a grid time gives end = start + 2 hours (user's words). Whether the user wants a different default end is open.

## Related features (amendment)
F-002: the Create group form is the pattern for the open and close behavior, and is not changed by this amendment.
F-017 (calendar view): the time grid is the entry point for the prefill in item 3. The form, its rules and its data are unchanged.
