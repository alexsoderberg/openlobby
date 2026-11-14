# REQ-0024. Group cards on the group list
Status: Decided
Feature: F-043
Priority: Should

Requested by the user on 2026-11-13. User's words (translated): "The list items of groups under /groups look a bit boring. Can we make each group item a little more interesting?" In a follow-up question the user chose "Look + data": a richer card with information, namely the member count, a few member avatars and the next lobby.

Decided by the user on 2026-11-13 (DECISION, user, 2026-11-13): the answers to open questions 1 to 9 are in the Decisions section below. Items still marked ASSUMPTION are not decided by the user; the UI expert and the architect settle them within the criteria.

## Decisions
- DECISION (user, 2026-11-13, question 1): up to five member avatars on a card, with a "+N" marker for the rest.
- DECISION (user, 2026-11-13, question 2): the avatars shown are the members who joined the group first.
- DECISION (user, 2026-11-13, question 3): the next lobby counts lobbies I have not joined.
- DECISION (user, 2026-11-13, question 4): the lobby line shows the player count, "X/Y players".
- DECISION (user, 2026-11-13, question 5): the text for a group with no upcoming lobby is "No upcoming lobbies".
- DECISION (user, 2026-11-13, question 6): the cards are sorted by group name, ignoring case.
- DECISION (user, 2026-11-13, question 7): the first version has no live updates on the Group list.
- DECISION (user, 2026-11-13, question 8): priority Should, built right after the game role icons (A3b, REQ-0023) and before A4 to A6. The member count and the lobby line ship first. Avatars show initials until the avatars of REQ-0016 (A4) are built. Backlog position A3c.
- DECISION (user, 2026-11-13, question 9): keep the next-lobby line. When this is built, the sentence that calls F-028 "the only view that shows lobbies of several groups together" is amended. That sentence is in the F-028 row of features.md, and REQ-0012 says the same in its out-of-scope line "Only the dashboard is cross-group." Both are amended when this is built (the product owner corrected the attribution, which first named REQ-0012 only).

## Problem
The Group list at `/groups` shows each group as its name only. A member who opens it to pick a group learns nothing about the group before opening it: how many people are in it, who they are, and when the group can play next. The list looks bare next to the rest of the app.

## User story
As a member, I want each group in the Group list to show how many people are in it, a few of them, and its next lobby, so that I see at a glance which group has a game coming up and who is in it, before I open it.

## Terms
- **Group card**: the item of one group in the Group list. One card is one link to that group's Group view. (Glossary request for the architect: add "Group card", frontend only.)
- **Next lobby of a group**: the lobby of that group that starts first among its lobbies that have not ended; a Running lobby counts. This is the Next up rule (REQ-0012) for one group.

## Acceptance criteria

What a card shows:
- Given that I am a member of a group, when `/groups` shows its card, then the card shows the group's name and the number of members, including me, as "N members" (ASSUMPTION: wording and plural rules are the UI expert's, within translatable text).
- Given that a group has members, when its card is shown, then the card shows up to five member avatars in one row, each as the member's avatar or, until REQ-0016 is built, its initials (DECISION, user, 2026-11-13, questions 1 and 8).
- Given that a group has more members than avatars shown, when its card is shown, then a "+N" marker follows the avatars, where N is the number of members not shown (DECISION, user, 2026-11-13, question 1).
- Given that a card shows avatars, when the avatars are chosen, then the members shown are those who joined the group first (DECISION, user, 2026-11-13, question 2), so the same people show on every visit.
- Given that a card is shown, when I look at it, then it shows no member names and no player names (ASSUMPTION: the people are shown by their avatars; names stay in the Group view, as the Next up card has none).
- Given that a group has a lobby that has not ended, when its card is shown, then the lobby line shows the lobby's label (REQ-0015: "game › mode › activity", or "Open" for a lobby with no game), its start date and clock time in the format of the Next up card (REQ-0012), and its label is shown with the genre theme that REQ-0014 gives lobby views (ASSUMPTION: as on Next up).
- Given that a group's next lobby is shown, when it has a player count, then the lobby line shows "X/Y players" as on Next up (DECISION, user, 2026-11-13, question 4).
- Given that a group's next lobby is Running, when its card is shown, then the lobby line shows the label, the start date and clock time as for any lobby, and "Running" (DECISION, product owner, 2026-11-13; the start time stays, as REQ-0012 says "Running" replaces only the countdown). The card has no countdown, so "Running" is shown beside the start time. Its exact place is the UI expert's (ASSUMPTION).
- Given that a group's next lobby is shown, when the card is shown, then no countdown is shown; the countdown stays on Next up (ASSUMPTION).
- Given that a group's next lobby exists, when I am not one of its players, then it still counts as the next lobby (DECISION, user, 2026-11-13, question 3).
- Given that a lobby of a group has ended or been deleted, when the card is shown, then that lobby is not the next lobby (REQ-0004 and REQ-0012 rules).
- Given that a group has no lobby that has not ended, when its card is shown, then the lobby line shows the text "No upcoming lobbies" (DECISION, user, 2026-11-13, question 5).

Order of the cards:
- Given that I open `/groups`, when the cards are shown, then they are sorted by group name, ignoring case, then by the group's identity, so the order is the same on every visit while my groups do not change (DECISION, user, 2026-11-13, question 6). Today no order is promised for the list.

Only my groups:
- Given that I am not a member of a group, when `/groups` is shown, then that group has no card, and nothing about it is shown (no count, no avatars, no lobby).
- Given that I have left a group, when `/groups` is shown next, then that group has no card (REQ-0006).

Empty, loading and error states:
- Given that I am in no group, when `/groups` is shown, then no card is shown and the empty text of today is shown, unchanged (REQ-0012: "You are not in a group yet" and the link to create one).
- Given that `/groups` is loading, when it is shown, then the loading text of today is shown instead of cards (ASSUMPTION: placeholder cards are the UI expert's choice).
- Given that any part of the list fails to load (the group list or the data of any card), when `/groups` is shown, then one page-level error with a retry action is shown and no card, the same rule as the Dashboard (REQ-0012; ADR 0014, point 4). No toast is shown (REQ-0022).
- Given that the error is shown, when I press retry and the data loads, then the cards are shown.

Performance (ASSUMPTION for the architect; the design is the architect's):
- Given that I open `/groups`, when the page loads, then the number of requests it makes does not grow with the number of my groups (ASSUMPTION: one request for the list with the card data, not one request per group; the Dashboard makes one request per group today).

Live updates:
- Given that `/groups` is open, when another member creates, joins, leaves or deletes a lobby, then the card does not change until I reload the page or come back to it (DECISION, user, 2026-11-13, question 7; REQ-0017 covers the Group view and the Dashboard only).

Navigation and accessibility:
- Given that I select a card with a click, or with Enter or Space on the keyboard, when it opens, then the Group view at `/groups/{groupId}` opens, as today (REQ-0012).
- Given that I move through the list with the keyboard, when I reach a card, then the whole card is one focus stop with a visible focus state, and it contains no other control (ASSUMPTION).
- Given that a screen reader reads a card, when it reads the card, then it announces the group name, the member count and the lobby line in one announcement. It does not announce each avatar, and the "+N" marker is read only as part of the member count (ASSUMPTION: the avatars are decorative beside the count, as in REQ-0016).
- Given that I use a phone (under 760 px), when I see the list, then each card is one tap target of at least 44 px in height, the cards form one column, and the page does not scroll sideways (REQ-0012, mobile rule).
- Given that I point at or focus a card, when it is hovered or focused, then it shows its hover or focus state, because it is a row that navigates (REQ-0012, motion and hover).
- Given that reduced motion is on, when the list is shown, then the cards appear without animation of their own (REQ-0012).

## Out of scope
- Member names, the member list, and player names on a card.
- A group picture or the group's icon on a card. Groups keep their generated initials (REQ-0012, REQ-0016); no icon is added by this requirement.
- A countdown on a card.
- More than one lobby per group, and the full list of upcoming lobbies of a group (F-004, Group view).
- Sorting by the user's choice, pinning, hiding or filtering groups.
- Live updates on the Group list in the first version (DECISION, user, 2026-11-13, question 7).
- Changes to the Dashboard, Next up, This week, the Group view, the Group rail or the Tab bar.
- Preferred game roles on a card (REQ-0021 shows them in the members list and on the You page).
- The Group feed (REQ-0018) and member availability (F-037) on a card.

## Related features
- F-001 and REQ-0012 (Group list page `/groups`): the page exists. This requirement adds content to its items; the page, its empty state and its "+" rule do not change.
- F-028 (Dashboard: Next up and This week): shows lobbies of several groups. The card shows one lobby per group, with the same next-lobby rule. The jobs differ: the Dashboard answers "what is next for me", the card answers "which group is this, who is in it, and when can it play next". Not a duplicate. The F-028 row of features.md calls F-028 "the only view that shows lobbies of several groups together", and REQ-0012 (out of scope) says "Only the dashboard is cross-group." When this requirement is built, both are amended (DECISION, user, 2026-11-13, question 9; the attribution is corrected here, as the sentence is not in REQ-0012).
- F-004 (upcoming lobbies per group) and F-002 (member list in the Group view): the card shows a count, some avatars and one lobby line, not a list. Not a duplicate.
- F-029 (Discord avatars, REQ-0016, backlog A4): the card shows the avatars of the group's members. This is a place where pictures are shown without names, so it extends REQ-0016's "wherever a name is shown" to this place. It is no new feature and no new sharing rule: every member on a card shares the group with the viewer, which is the sharing rule of REQ-0016. Until REQ-0016 is built, the card shows initials.
- F-035 (live updates, REQ-0017): covers the Group view and the Dashboard. The Group list is not in its scope, and this requirement does not add it (DECISION, user, 2026-11-13, question 7).
- F-032 (genre themes, REQ-0014): the lobby line uses the theme as on Next up, so this is not a new look.
- Not a duplicate of any feature: no feature shows the member count or member avatars of a group in the Group list. The product owner's verdict is NEW (F-043), with the overlap with F-028 recorded above.

## Open questions
None. All nine questions are answered (see Decisions). Items marked ASSUMPTION are for the UI expert and the architect to settle within the criteria.
