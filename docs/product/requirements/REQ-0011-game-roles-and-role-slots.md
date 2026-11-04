# REQ-0011. Game roles and role slots in lobbies
Status: Decided
Feature: F-027
Priority: Should

## Problem
Many team games have fixed roles. Overwatch needs one tank, two damage and two support players. Today a lobby only counts players, so five people can say "I'm in" with no tank, and nobody sees the gap until the game has started. The group needs to see which roles are covered before the game, and each player needs to say which role they take, or that they will take any role that is still missing.

## User story
As a member, I want to choose my game role when I join a lobby, or join as flex (any role), and see how many players each role has, so that the group sees whether the team is complete.

## Acceptance criteria

Game roles in the game list (extends REQ-0010):
- Given that I am a system admin, when I add or change a game, then the form also lets me list the game's game roles, each with a name and a number of slots of at least 1. A game may have no game roles, as today.
- Given that a game has game roles, when I save it, then its default max players is the sum of the slots of its game roles, and I do not enter max players separately.
- Given that I am a system admin, when I save a game role with an empty name, a name longer than 30 characters, or a name that another game role of the same game already has (ignoring case and surrounding spaces), then it is denied with an error message and no change is saved.
- Given that I am a system admin, when I enter slots that are not a whole number of at least 1, then it is denied with an error message and no change is saved.
- Given that I am a system admin, when I change or remove a game role, when a lobby already uses it, then that lobby keeps its game role, its slots and its players (same rule as REQ-0009 for changed and removed games).
- Given that a game has no game roles, when a member creates a lobby with it, then no role is asked for and the lobby works as in REQ-0003 and REQ-0005.

Creating a lobby with game roles (extends REQ-0003):
- Given that I choose a game with game roles, when I open the create form, then each game role is shown with its name and its default number of slots, and "Flex (any game role)" is offered as a choice.
- Given that I change the slots of a game role in the form, when I save, then the lobby keeps my numbers, the game list is not changed, and max players is the sum of the slots. A slot value of 0 leaves that game role out of this lobby.
- Given that all slots of a lobby are 0, when I try to save, then it is denied with an error message and no lobby is saved.
- Given that I create a lobby with game roles, when it is saved, then I am a player and take one slot of the game role I choose, or one spot as flex if I choose "Flex (any game role)". Choosing one of these is required.

Joining and changing game role (extends REQ-0005):
- Given that I am a member, the lobby has game roles, it has not passed its end time, the game role I choose has a free slot, and the lobby has a free spot, when I click "Join lobby", then I am shown among the players under that game role, and the count of that game role and the total each increase by 1.
- Given that I am a member, the lobby has game roles, it has not passed its end time, and the lobby has a free spot, when I click "Join lobby" as "Flex (any game role)", then I am shown among the flex players, and the total increases by 1. No game role count changes, whether or not any game role has a free slot.
- Given that the lobby has game roles, when I click "Join lobby" without choosing a game role or flex, then it is denied with an error message and no player status is saved.
- Given that the game role I choose has no free slot, when I try to join, then it is denied with an error message, no player status is saved, and I am not shown among the players. The other game roles and flex can still be chosen, as long as the lobby has a free spot.
- Given that the lobby has no free spot at all, when I try to join with any game role or as flex, then it is denied as in REQ-0005. This applies even if a game role still has a free slot: the lobby is full when the total is reached.
- Given that I am already a player in a game role A, when I choose game role B with a free slot, then I am moved from A to B: the count of A decreases by 1, the count of B increases by 1, and the total does not change.
- Given that I am already a player in a game role A, when I choose flex, then I am moved from A to flex: the count of A decreases by 1, the flex count increases by 1, and the total does not change. This works even when the lobby is full, because no spot is taken.
- Given that I am a flex player, when I choose a game role with a free slot, then I am moved from flex to that game role: the flex count decreases by 1, the count of that game role increases by 1, and the total does not change.
- Given that I am already a player and choose a game role with no free slot, when I submit, then it is denied with an error message and I stay in my current game role or flex.
- Given that I am a player, when I click "Leave lobby", then I am removed and my spot becomes free, as in REQ-0005. This always works, also after the end time.
- Given that the lobby has passed its end time, when I try to join, or to change game role or flex, then the lobby is shown as "Ended", as in REQ-0005.
- Given that two members take the last free spot or the last slot of the same game role at the same time, when both actions occur, then at most one succeeds, and neither the total nor a game role count ever exceeds its limit (same pattern as REQ-0005).
- Given that I am the creator and chose flex when creating the lobby, when I later change my game role, then the same rules apply as for any other player.

Lobbies without game roles:
- Given that a lobby has no game roles, when I join or leave, then the join works as in REQ-0005 and no game role or flex choice is shown.

Display:
- Given that a lobby has game roles, when I see it in the list, then each game role is shown with its name and "X/Y", for example "Tank 0/1, Damage 2/2, Support 1/2", next to the total "X/Y players". The total includes flex players.
- Given that a lobby has game roles and at least one flex player, when I see it in the list, then the flex players are shown as "Flex N", for example "Flex 1". When there is no flex player, "Flex" is not shown.
- Given that a game role has no free slot, when I see the lobby, then the game role is marked "full" in text, not only by color.
- Given that a lobby has game roles, when I open its detail view, then the players are listed under their game role, and flex players are listed in a separate "Flex" group after the game roles.
- Given that a lobby has no game roles, when I see it in the list or the detail view, then no game role or flex information is shown, as today.

## Rules for flex (decided)
- A flex player takes one spot of the lobby total, which is the sum of the slots. A flex player takes no role slot.
- A role is full when its slots are taken by players of that role. Flex players never fill a role slot.
- The lobby is full when the total is reached, counting role players and flex players together.
- There is no reservation: a flex player may take the last spot even if a game role still has an empty slot. Then that role stays open only as long as the lobby has a free spot, which in a full lobby is never. This is the way a missing role is covered by flex.
- A flex player can switch to any game role with a free slot, and a game role player can switch to flex, both while the lobby can still be joined.
- The creator may be flex.

## Out of scope
- Reserving spots for a specific game role, so that a flex player cannot take the last spot of the total. Not wanted: flex is the way to cover a missing role.
- Adding or removing game roles in a single lobby. A lobby only sets the slot numbers of the game's game roles.
- Game roles for "Other" lobbies and other free-text games.
- Changing slots or game roles after the lobby is created (F-011).
- Matching, rank, skill or suggestions for who should play which role.
- Reading game state or using the games' own systems or APIs (vision.md: no integration with the games).
- Icons or images for game roles (REQ-0009 excludes more fields per game).
- Translation of game role names. They are data entered by the system admin, not UI text (see F-026).
- Notifications when a game role is missing.
- Moving another member to a different game role or to flex.

## Related features
F-005 (Join and leave lobby) is the feature that gains the game role choice, flex, and the change of game role or flex. This extends F-005; it is not a duplicate. REQ-0005 remains the rule for joining, leaving, end time and concurrency.

F-018 (Max players per lobby) stays the total limit, and flex players count toward it. Game roles split the total per role. Max players of a game with game roles is derived from the slots, so there is no second limit to keep in step.

F-024 (Game list with default max players, REQ-0009) holds the default slots per game role, because they belong to the game in the list. REQ-0009 excludes "more fields per game than name and default max". This requirement lifts that exclusion for game roles only. REQ-0009 must be amended when this requirement is Decided, which is done with the implementation.

F-025 (Manage game list as system admin, REQ-0010) is the only place where game roles are entered. This extends the form of F-025; it does not add a second place to manage games.

F-003 (Create lobby) is where the creator sets the slot numbers and chooses a game role or flex. The same creation step as for max players.

Not a duplicate of the group roles `admin` and `member` (REQ-0002, REQ-0008). Those are a group's roles and have nothing to do with games. This requirement only uses the term "game role" to avoid that clash.

## Decisions

- DECISION (user, timing): This is not part of the MVP. It is prioritized after the MVP core flow (backlog A1).
- DECISION (user, flex): A player may join a lobby with game roles as "Flex (any game role)" without choosing a game role. The rules for flex are above.
- DECISION (user, composition): The creator sets the slot numbers of the game's game roles per lobby. The creator does not add or rename game roles in a lobby.
- DECISION (user, "Other"): "Other" lobbies and free-text games have no game roles.
- DECISION (user, max from slots): For a game with game roles, max players is the sum of the slots and is never unlimited.
- DECISION (product owner, within the user's flex decision): No reservation of spots for game roles. Flex can take any free spot. Creator may be flex. Switching between flex and a game role is allowed while the lobby can still be joined, with the same rules as for joining.
- ASSUMPTION (changing role): A player can change game role or flex while the lobby can still be joined (until its end time), in the same way as joining. Leaving always works.
- ASSUMPTION (name rules): A game role name is 1–30 characters, unique within its game ignoring case and surrounding spaces. Slots are whole numbers of at least 1 in the game list, and 0 or more in a lobby, where 0 leaves the game role out.
- ASSUMPTION (order): Game roles are shown in the order the system admin entered them.
- ASSUMPTION (data language): Game role names are shown as entered. They are not translated until F-026 is decided.

## Glossary proposal (for the architect, not yet in CLAUDE.md)
- **Game role** (`game_roles`, `gameRoles`): a named role a game in the game list has, e.g. "Tank". Entered by a system admin. Avoid: role (alone, it means group role), position, class.
- **Role slot** (`roleSlots`; per game role `slots`): the number of players a lobby allows in one game role, shown as "Tank 0/1". Avoid: spot (spot means a place in the lobby total).
- **Flex (any game role)** (technical form to be decided by the architect; suggestion: `gameRoleId` null on `lobby_players` in a lobby with game roles): a player who takes one spot of the lobby total without a role slot. Shown as "Flex N". Avoid: any role, wildcard, fill.
- **Player's game role** (`gameRoleId` on `lobby_players`): the game role a player has taken in a lobby. Not used for flex.
- Note: the API field `role` already means group role (`admin`/`member`, api/calendar/openapi.yaml). Game roles must not reuse that name.
