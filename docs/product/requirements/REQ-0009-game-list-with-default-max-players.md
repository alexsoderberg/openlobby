# REQ-0009. Game list with default max players
Status: Implemented
Feature: F-024
Priority: Must

## Problem
Free text for games means the same game is spelled differently between members, and nobody knows in advance how many fit in a lobby. Whoever creates a lobby needs a shared selection of games where a reasonable max players is already filled in, but which can still be changed.

## User story
As a member, I want to choose a game from a shared list where max players is pre-filled, so that I can quickly create a lobby that fits the game.

## Acceptance criteria

Game choice and default max:
- Given that I am creating a lobby, when I open the game choice, then the games in the game list are shown with their names, ordered "most used first" (see Ordering below), and "Other" is shown last.
- Given that I choose a game from the game list that has a default max, when I select it, then max players is filled in with the game's default value.
- Given that I have chosen a game from the game list, when I change max players to another value and save, then the lobby is saved with my value and the game list is not changed.
- Given that I choose "Other", when I enter a game name of 1–50 characters and save, then the lobby is saved with that name, and the name is not added to the game list.
- Given that I choose "Other", when I leave max players empty and save, then the lobby is saved without a limit on players.
- Given that I choose a game from the game list, when I empty max players and save, then the lobby is saved without a limit on players.
- Given that I enter max players as anything other than an integer of at least 1, when I try to save, then it is denied with an error message and no lobby is saved.
- Given that a lobby was saved with a game from the game list, when another member opens the lobby, then they see the same game name and the same max players.

Dynamic game list:
- Given that a system admin has added a game to the game list, when a member opens the game choice, then the game is shown, without the app needing to be rebuilt or redeployed.
- Given that a system admin has removed a game from the game list, when a member opens the game choice, then the game is no longer shown as a choice.
- Given that a system admin has changed the default max for a game, when a lobby with the game already exists, then the lobby's max players remains unchanged.
- Given that a system admin has changed the default max for a game, when a member chooses the game for a new lobby, then the new value is filled in.
- Given that a system admin has removed a game from the game list, when a lobby already uses the game, then the lobby remains with its game name and its max players unchanged.
- Given that a system admin has renamed a game, when a lobby already uses the game, then the lobby is shown with the name it was saved with.
- Given that a system admin has renamed a game, when a member opens the game choice, then the game is shown under its new name, and its lobbies still count toward its place in the "most used first" order.

Ordering in the game choice (most used first):
- Given that I am creating a lobby, when I open the game choice, then games are ordered by the number of lobbies created in my group with that game, highest first.
- Given that two games have the same number of lobbies in my group, when I open the game choice, then they are ordered alphabetically by name.
- Given that a game has never been used in my group, when I open the game choice, then it is shown after all games used at least once in my group, and alphabetically among the games never used.
- Given that my group has no lobbies yet, when I open the game choice, then all games are shown alphabetically, with "Other" last.
- Given that "Other" was used for lobbies with free-text names, when games are ordered, then those lobbies do not count for any game, and "Other" stays last.
- Given that a lobby was created in another group, when I open the game choice in my group, then that lobby does not affect the order.
- Given that a lobby was created with a game that a system admin has since renamed (REQ-0010), when I open the game choice, then the lobby counts toward that game, because the game keeps its identity.

Starting content:
- Given that the game list is in its starting state, when a member opens the game choice in a group with no lobbies, then Counter-Strike 2 (default max 5), League of Legends (default max 5), Overwatch (default max 5), World of Warcraft (default max 5) and "Other" are shown, in that order.

Management:
- Given that I am a member or group admin in a group, when I look for a function to change the game list or propose a new game, then there is none. Only a system admin can change the list (REQ-0010).

## Out of scope
- Members or group admins proposing or adding games to the list.
- Group-specific game lists.
- Changing max players after the lobby is created (F-011).
- More fields per game than name and default max, e.g. image, genre or category.
- Connection to the games' own systems or APIs.
- Search in the game list.
- Changing the game list in the app (adding, changing, removing games). This is described in REQ-0010. This requirement covers only how members see and choose from the list.

## Related features
F-003 (Create lobby) is where the game is chosen and max players is set. The game list is its data source, not a new feature for creating lobbies. F-018 (Max players per lobby) uses the value set here and determines what happens when spots run out. Not a duplicate: F-024 decides which game and which default max are suggested, F-018 decides the joining limit.
F-025 (Manage game list as system admin) is the only way to change the list. Not a duplicate: F-024 is what members see and choose, F-025 is how a system admin maintains the list.

## Open questions
- DECISION (dynamic): The game list can be changed without a new version. It is managed by a system admin (REQ-0010) and shared by all groups. Members and group admins cannot change it in the MVP. How a system admin is appointed is outside the app.
- DECISION (starting content): Counter-Strike 2 – 5, World of Warcraft – 5, League of Legends – 5, Overwatch – 5. The names are the official ones; the user wrote "Counter-Striker 2" and "WoW". The user has confirmed that "World of Warcraft" in the list is OK.
- DECISION ("Other"): Free-text names are not added to the game list. The same game can therefore exist both in the game list and under "Other".
- DECISION (empty max): An empty max players means unlimited, both for games from the list and for "Other".
- DECISION (max does not change): Max players is set at creation and does not change in the MVP (F-011).
- DECISION (no upper limit): No upper limit for max players. The value must be an integer of at least 1, or empty. Amendment 2026-11-04: the technical upper bound is 2147483647 (ADR 0010); there is no product cap.
- DECISION (members do not propose): In the MVP, members cannot propose games.
- DECISION (rename): If a system admin renames a game, existing lobbies keep the name they were saved with, in line with the rule for removed games.
- DECISION (default max missing): A game in the game list may lack a default max. Then max players is empty (unlimited), just as for "Other".
- DECISION (identity): Each game has a system-generated ID that is never typed by anyone and never changes, even when the game is renamed. The system admin enters only name and default max players (REQ-0010). Lobbies refer to the game by its identity, so renames do not break the "most used first" order.
- DECISION ("Other" reserved): "Other" is the free-text choice and cannot be a game in the list (REQ-0010).
- DECISION (most used first): The game choice is ordered by how often each game has been used in the group: "most used" = number of lobbies created in this group with that game, all time. Ties are broken alphabetically by name. Games never used in the group follow, alphabetically. "Other" is always last. Consequence: a new group sees the list alphabetically.
- ASSUMPTION (most used, counting): Lobbies that the creator has deleted no longer exist and do not count. Past lobbies do count.
- ASSUMPTION (most used, counting): A lobby counts for the game it was created with, regardless of which member created it or whether it is past or upcoming.
- ASSUMPTION (alphabetical): Names are compared without regard to case.
- ASSUMPTION (most used, timing): The order is recalculated each time the game choice is opened.
- OPEN QUESTION: Should members be able to propose new games in a later version? Not decided. In the MVP: no.
