# REQ-0021. Preferred game roles per member
Status: Decided
Feature: F-039
Priority: Should

Decided by the user on 2026-11-12 (wish "fill in the classes I play"; user writes Swedish). "Class" is a term to avoid; the glossary term is Game role. The user decided the purposes (a) and (b) and the visibility of (b). Items marked "ASSUMPTION (orchestrator default 2026-11-12, user may change)" are the orchestrator's defaults for questions the user did not answer; the user may change them. The term "Preferred game role" and the design of storage and API are in ADR 0022 and its glossary row.

## Problem
When I join a lobby with game roles (REQ-0011), I choose my game role again in every lobby. If I always play the same game role in a game, the same choice repeats every time. Other members also have no way to see which game roles a member usually plays in a game, so they cannot tell from the lobby or the member list who plays what.

## User story
As a member I want to record which game roles I play in each game, so that my usual game role is preselected when I join a lobby of that game, and so that the members of my groups can see which game roles I play.

## Acceptance criteria

Recording:
- Given that I am logged in, when I open the "Account" section of the You page (REQ-0020), then I see each game that has game roles and can choose which of its game roles I play. Choosing none is allowed.
- Given that a game has no game roles, when I open the list, then that game is not shown.
- Given that I have chosen game roles for a game and I save, when I open the list again, then my choice is shown.
- Given that a system admin removes a game role that I have chosen, when I open the list, then that game role is no longer offered and no error is shown (same rule as REQ-0011 for removed game roles).
- Given that I choose game roles for a game with modes, when I see the choices, then each game role is shown with its name and the name of its mode (ASSUMPTION (orchestrator default 2026-11-12, user may change): per game role, not per game).
- Given that I save my choice, when I save it, then it applies to all groups I am a member of, and I do not choose it per group (ASSUMPTION (orchestrator default 2026-11-12, user may change): one choice for all groups).

Joining (extends REQ-0011 and REQ-0005):
- Given that I join a lobby with game roles, and I have chosen game roles for its game, when the join form opens, then the first of my chosen game roles in the lobby's order that has a free slot is preselected (ASSUMPTION: the order of the game's game roles).
- Given that none of my chosen game roles has a free slot, when the join form opens, then nothing is preselected and I must choose a seat, as in REQ-0011.
- Given that a seat is preselected, when I choose another seat before I click "Join lobby", then my choice is used. The preselection is not saved.
- Given that I have chosen no game roles for the game, or the lobby has no game roles, when the join form opens, then nothing is preselected, as today.

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
- REQ-0020 (Account settings panel): the place where the choice is made.

## Decisions
- DECISION (user, 2026-11-12): the purposes are (a) preselect my seat when I join a lobby and (b) show my game roles to other members.
- DECISION (user, 2026-11-12): visibility for (b) is the same rule as avatars: members of groups I share with the member.
- ASSUMPTION (orchestrator default 2026-11-12, user may change): the choice is per game role, shown with the mode name (Question 3).
- ASSUMPTION (orchestrator default 2026-11-12, user may change): one choice for all groups (Question 4).
- ASSUMPTION (optional): recording is optional. Nothing chosen means no preference.
- ASSUMPTION (place): the choice sits in the "Account" section of the You page (REQ-0020).
- Option (c) is not part of this requirement. It would need REQ-0011 amended first.
- Priority Should: the user is actively asking for it.

## Questions for the user
1. What is it for? Answered 2026-11-12: (a) and (b). Option (c) is not in scope.
2. Who sees my chosen game roles? Answered 2026-11-12: the same rule as avatars.
3. Per game role or per game? Not answered. Default: per game role, shown with the mode name. The user may change it.
4. One choice for all groups, or one per group? Not answered. Default: one for all groups. The user may change it.

## Open questions from ADR 0022 (for the user, with recommended answers)
The architect's design in ADR 0022 has these questions. The recommended answer is given for each. The criteria above do not yet decide them.
1. Does the account page list all games that have game roles, also for a person who is in no group? Recommended: yes.
2. Do lobby players show their choices for every mode of the lobby's game? Recommended: yes.
3. Is a choice removed silently when a system admin removes the game role? Recommended: yes, silently (no error, as in the criterion above).
4. When none of my chosen game roles has a free slot, is nothing preselected? Recommended: yes, nothing is preselected (as in the criterion above).

## Architect
The architect has designed storage and API in ADR 0022 (the game and its game roles belong to the calendar service, REQ-0010 and REQ-0011; the member comes from the gateway header). The term "Preferred game role" (avoid: class, main role, role alone) is defined there and in its glossary row. Implementation follows after the open questions above are answered.
