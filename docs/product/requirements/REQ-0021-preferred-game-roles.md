# REQ-0021. Preferred game roles per member
Status: Implemented
Feature: F-039
Priority: Should

Decided by the user on 2026-11-12 (wish "fill in the classes I play"; user writes Swedish). "Class" is a term to avoid; the glossary term is Game role. The user decided the purposes (a) and (b), the visibility of (b), the choice per game role with the mode name and the choice for all groups (Questions 3 and 4), and all seven ADR 0022 questions (1, 2, 3 and 6 first, 4, 5 and 7 confirmed later the same day). ADR 0022 is Accepted (2026-11-12). The term "Preferred game role" is defined in ADR 0022 and its glossary row.

## Problem
When I join a lobby with game roles (REQ-0011), I choose my game role again in every lobby. If I always play the same game role in a game, the same choice repeats every time. Other members also have no way to see which game roles a member usually plays in a game, so they cannot tell from the lobby or the member list who plays what.

## User story
As a member I want to record which game roles I play in each game, so that my usual game role is preselected when I join a lobby of that game, and so that the members of my groups can see which game roles I play.

## Acceptance criteria

Recording:
- Given that I am logged in, when I open the You page, then I see a section "Game roles" between "Account" and "System admin" that lists each game that has game roles and can choose which of its game roles I play. Choosing none is allowed. The list is shown to any signed-in member, also to a member who is in no group (DECISION, user, 2026-11-12).
- Given that a game has no effective game role (ADR 0017 section 2), when I open the list, then that game is not shown. A game whose only role is a game-level role of a game with modes is not shown.
- Given that I have chosen game roles for a game and I save, when I open the list again, then my choice is shown.
- Given that a system admin removes a game role that I have chosen, when I open the list, then that game role is no longer offered, and the removal is silent: no error is shown (same rule as REQ-0011 for removed game roles; DECISION, user, 2026-11-12).
- Given that I choose game roles for a game with modes, when I see the choices, then each game role is shown with its name and the name of its mode (DECISION, user, 2026-11-12: per game role, not per game).
- Given that I save my choice, when I save it, then it applies to all groups I am a member of, and I do not choose it per group (DECISION, user, 2026-11-12: one choice for all groups).

Joining (extends REQ-0011 and REQ-0005):
- Given that I join a lobby with game roles, and I have chosen game roles for its game, when the join form opens, then the first of my chosen game roles that has a free slot is preselected, in the order and by the rule of ADR 0022 point 7.
- Given that none of my chosen game roles has a free slot, when the join form opens, then nothing is preselected and I must choose a seat, as in REQ-0011 (DECISION, user, 2026-11-12).
- Given that a seat is preselected, when I choose another seat before I click "Join lobby", then my choice is used. The preselection is not saved.
- Given that I have chosen no game roles for the game, or the lobby has no game roles, when the join form opens, then nothing is preselected, as today.

Lobby players:
- Given that a lobby has game roles, when I see its players, then each player's chosen game roles are shown for every mode of the lobby's game, as far as the player has chosen them (DECISION, user, 2026-11-12).

Visibility (decided by the user, 2026-11-12, option (b)):
- Given that I have chosen game roles, when a member of a group I share with me sees a lobby or a member list of that group, then my chosen game roles are shown.
- Given that I have chosen game roles, when a member of no group I share with me sees a lobby or a member list, then my chosen game roles are not shown.
- Given that I am a member of a group and I share it with another member, when that member has chosen game roles, then I see them in the same places as I see my own avatar (REQ-0016, F-029).

## Out of scope
- Suggesting or assigning a game role to a member, or to a group to fill a missing game role (option (c)). REQ-0011 excludes "matching, rank, skill or suggestions for who should play which role".
- Skill, rank, hours played or any other attribute of a player.
- Changing the game roles of a game (REQ-0010, REQ-0011) or of a lobby (REQ-0011).
- Reading a player's game profile or any game state (vision.md: no integration with the games).
- Games without game roles, and "Other".
- A separate choice per group.

## Related features
- F-027 (Game roles and role slots in lobbies): F-027 has the seat choice when joining a lobby. This requirement adds a standing choice per member that preselects that seat and is shown to group members. It is not a duplicate: F-027 chooses a seat in one lobby, this stores the game roles a member usually plays across lobbies.
- F-005 (Join and leave lobby): the join form gets a preselection. REQ-0005 stays the rule for joining.
- F-024 and F-025 (game list): the game roles belong to the game list. The member's choice refers to them and adds no field to the game list.
- F-029 (Discord avatars): the visibility rule follows the same rule as the avatar: members of groups the viewer shares with the owner.
- F-031 (Per-player item goals): also per-player data kept for a game, but a different need, and its decision is postponed. Not a duplicate.
- REQ-0020 (Account settings panel): the You page is where the choice is made, in its own section "Game roles" between "Account" and "System admin", not inside "Account" (see the placement decision below, adopted by the product owner on 2026-11-13).

## Decisions
- DECISION (user, 2026-11-12): the purposes are (a) preselect my seat when I join a lobby and (b) show my game roles to other members.
- DECISION (user, 2026-11-12): visibility for (b) is the same rule as avatars: members of groups I share with the member.
- DECISION (user, 2026-11-12): the choice is per game role, shown with the mode name (Question 3).
- DECISION (user, 2026-11-12): one choice for all groups (Question 4).
- DECISION (user, 2026-11-12): ADR 0022 question 1, the account list shows to any signed-in member, also with no group; question 2, lobby players show choices for every mode of the game; question 3, a removed role's choice is removed silently; question 6, nothing is preselected without a free preferred slot.
- DECISION (user, 2026-11-12): question 4, a stale ID on save gives `invalid_game_role`, and the list reloads; question 5, a choice for a game role of a game with modes is dropped at the member's next save; question 7, REQ-0020 is merged before PR4.
- ASSUMPTION (optional): recording is optional. Nothing chosen means no preference.
- DECISION (architect, ADR 0022, 2026-11-12, adopted by the product owner on 2026-11-13), place: the choice sits in its own section "Game roles" on the You page, between "Account" and "System admin". It is not inside "Account". Reason: REQ-0020 gives later settings their own section above "Log out", and a list of games in "Account" would mix the name and avatar with gameplay choices.
- DECISION (architect, ADR 0022, 2026-11-12, adopted by the product owner on 2026-11-13), games without roles: the server alone leaves out a game with no effective game role, and the page shows the games it receives. The criterion "a game with no effective game role is not shown" stays as written; it is met by the server rule together with the page.
- Option (c) is not part of this requirement. It would need REQ-0011 amended first.
- Priority Should: the user is actively asking for it.

## Questions for the user
None open. Answered 2026-11-12:
1. What is it for? (a) and (b). Option (c) is not in scope.
2. Who sees my chosen game roles? The same rule as avatars.
3. Per game role or per game? Per game role, shown with the mode name.
4. One choice for all groups, or one per group? One for all groups.

## Open questions from ADR 0022
All seven questions of ADR 0022 (section "Open questions for the user") are answered or decided.
1. A signed-in person who is in no group sees the game catalogue: DECISION (user, 2026-11-12), yes.
2. Lobby player choices are shown for every mode of the lobby's game: DECISION (user, 2026-11-12), yes.
3. A choice is removed when the admin removes its game role, and nothing is shown or said: DECISION (user, 2026-11-12), yes.
4. A stale ID on save gives `invalid_game_role`, the list reloads, and the member saves again: DECISION (user, 2026-11-12).
5. A choice for a game role of a game with modes is dropped at the member's next save and hidden until then: DECISION (user, 2026-11-12).
6. When no preferred role has a free slot, nothing is preselected: DECISION (user, 2026-11-12), yes.
7. REQ-0020 is merged before PR4 of ADR 0022: DECISION (user, 2026-11-12).

## Architect
ADR 0022 (Accepted, 2026-11-12) holds the storage and the API: the game and its game roles belong to the calendar service (REQ-0010 and REQ-0011), and the member comes from the gateway header. The term "Preferred game role" (avoid: class, main role, role alone) is defined there and in its glossary row. Implementation follows the design in ADR 0022.
