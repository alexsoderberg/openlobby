# REQ-0018. Group feed of recent lobby events
Status: Decided
Feature: F-036
Priority: Should

Decided by the user on 2026-11-10 (priority 2 of the new ideas, "group activity feed"). The term "group feed" is used instead of "activity feed", because "activity" is the reserved term for a named activity (CLAUDE.md glossary). The feed is recent events only; it is not the history of past lobbies (F-020).

## Problem
The group view shows the lobbies as they are now. A member who was away does not see what happened since their last visit: who joined, which lobby was created, which one filled up. They must open each lobby to find out.

## User story
As a member, I want to see the recent events in my group, such as a new lobby, someone joining or leaving, or a lobby that is full, so that I know what changed without opening every lobby.

## Acceptance criteria

Showing the feed:
- Given that I am a member, when I open a group view, then a Group feed shows the group's recent events, newest first. Each event is one line of text with the time it happened, formatted for my locale (REQ-0004).
- Given that the group has no event in the retention period, when I look at the Group feed, then a short text says that nothing has happened yet (ASSUMPTION: the wording is the UI expert's).
- Given that I am on a phone, when I look at the Group feed, then it is readable without scrolling sideways (REQ-0012, mobile rule).
- Given that the Group feed is shown, when I look at it, then it shows only the events of the group I am viewing. It does not show other groups' events (REQ-0004).
- Given that I am not a member of the group, when I try to see its feed, then the 404 page is shown without any event (REQ-0004).

Recorded events (each is recorded when the change is saved, and only then):
- Given that a member creates a lobby, when it is saved, then the event "New lobby by <creator>: <label>, <date and clock time>" is recorded (DECISION, user, 2026-11-10: the event names the creator). The creator is a player of the lobby, but this creates no "joined" event.
- Given that a member joins a lobby, when the join is saved, then the event "<name> joined <label>, <date and clock time>" is recorded.
- Given that a member leaves a lobby, when the leave is saved, then the event "<name> left <label>, <date and clock time>" is recorded.
- Given that a join fills the lobby, when it is saved, then the event "Lobby full: <label>, <date and clock time>" is recorded directly after the "joined" event.
- Given that a lobby is full and a player leaves and another member joins, when the join is saved, then "Lobby full" is recorded again.
- Given that a lobby has no max players, when players join, then no "Lobby full" event is recorded.
- Given that a join or leave is denied (full lobby, ended lobby, not a member, lobby deleted), when it is denied, then no event is recorded.
- Given that a lobby has no game, when its event is shown, then its label is "Open" (REQ-0015).
- Given that a lobby's label, game or mode changes later, when an event from before the change is shown, then the event keeps the label it had when it was recorded (REQ-0009, REQ-0015).

Retention and removal:
- Given that an event is older than 7 days, when I look at the Group feed, then it is not shown (DECISION, user, 2026-11-10).
- Given that more than 20 events are in the retention period, when I look at the Group feed, then only the 20 newest are shown, with no "load more" (DECISION, user, 2026-11-10: at most 20 events).
- Given that a lobby is deleted by its creator, when its events are shown, then the events stay until they expire. Deleting a lobby is not an event (DECISION, user, 2026-11-10).
- Given that a member has left the group, when I look at the feed, then their earlier events still show their name as it was (DECISION, user, 2026-11-10: events of members who left keep their name).
- Given that an event names a person, when I look at the feed, then that person's avatar, or their initials, is shown next to the name in the line (DECISION, user, 2026-11-10: avatars wherever a name is shown; REQ-0016).

Events are text:
- Given that an event is shown, when I select it, then nothing opens, because the feed lines are text (ASSUMPTION: a lobby may no longer exist or may have ended, and past lobbies are not shown in the MVP).

Live (needs REQ-0017):
- Given that I have the group view open and REQ-0017 is delivered, when a new event is recorded, then it appears at the top of the feed within the latency of REQ-0017, with a short highlight.
- Given that REQ-0017 is not yet delivered, when a new event is recorded, then it appears when I reload the page.

## Out of scope
- Events for the rest of the lobby life: a mode, game or activity change (REQ-0015), a lobby edit, a deleted lobby, a player's status other than join, leave and full.
- Events for group membership: someone joins or leaves the group, a group admin is made (REQ-0002, REQ-0008), and invite links created, used or revoked (REQ-0007).
- "Maybe" replies (F-021).
- A feed on the Dashboard, across groups (REQ-0012 shows lobbies, not events).
- Notifications, Discord messages and reminders (F-015, F-016).
- History of past lobbies (F-020), search, filters, reactions, comments and "unread" markers.
- Statistics of the group.

## Related features
F-020 (history of past lobbies, Proposed): the feed is recent events for seven days, not the history of lobbies; F-020 stays Proposed and is not replaced. F-015 (notifications): this is in-app only and has no push; F-015 stays Proposed. F-035 (live updates, REQ-0017) shows new entries live. F-003, F-005 and F-018 provide the changes that are recorded. F-004 and F-017 are the group view the feed sits in. It is not a duplicate: no existing feature lists the events of a group.

## Open questions
- DECISION (user, 2026-11-10): the draft is accepted as written. Events are kept 7 days, at most 20 are shown; events of members who left keep their name; "New lobby" names the creator; deleting a lobby is not an event.
- OPEN QUESTION: an event is not a link, and selecting it opens nothing (ASSUMPTION). A lobby of an old event may no longer exist, so the question is whether the line should link to a lobby that still exists.
- OPEN QUESTION: the wording of the empty feed text, and the exact copy of each event, are the UI expert's within these rules (ASSUMPTION).
- OPEN QUESTION (architect): how an event keeps the label it had when it was recorded (criterion above). The product rule stays as written; the mechanism is the architect's decision.
