# REQ-0010. Manage game list as system admin
Status: Decided
Feature: F-025
Priority: Must

## Problem
The game list (REQ-0009) is shared by all groups and must be changeable without a new version. Without a page in the app, every change has to be made outside the app, where spelling and duplicates are hard to check. The project's owner needs a safe way to maintain the list, and only that person should be able to do it.

## User story
As a system admin, I want to add, change and remove games in the game list in the app, so that all groups see the right games without the app needing to be redeployed.

## Acceptance criteria

Permissions:
- Given that I am logged in as a system admin, when I open the game list, then I see all games in the list with name and default max players. Amendment 2026-11-04 (orchestrator): a missing default max is shown as the text "No player limit" instead of an empty cell, because an empty cell reads as missing data.
- Given that I am logged in but not a system admin, when I see the app's navigation, then there is no link to the game list.
- Given that I am logged in but not a system admin, when I open the game list's address directly, then access is denied and no part of the game list is shown.
- Given that I am a group admin or a regular member in a group, when I try to add, change or remove a game, then it is denied and the game list is not changed.
- Given that I am not logged in, when I open the game list's address, then the login is shown (REQ-0001), and after a successful login I am denied if I am not a system admin.

Identity and the form:
- Given that I am a system admin, when I add or change a game, then the form asks only for name and default max players. No ID is entered by anyone.
- Given that I am a system admin, when I rename a game, then the game keeps its identity, and lobbies created with it still count toward its place in the "most used first" order (REQ-0009).

Reserved name:
- Given that I am a system admin, when I add or rename a game to "Other" (ignoring case and surrounding spaces), when I try to save, then it is denied with an error message and no change is saved.

Add:
- Given that I am a system admin, when I add a game with a name of 1–50 characters and a default max of at least 1, when I save, then the game is added and shown in the game choice for members (REQ-0009) without the app being rebuilt or redeployed.
- Given that I am a system admin, when I add a game without a default max, when I save, then the game is saved without a default max (empty = unlimited).
- Given that I am a system admin, when I add a game with an empty name or a name longer than 50 characters, when I try to save, then it is denied with an error message and no change is saved.
- Given that I am a system admin, when I add a game whose name already exists in the game list, when I try to save, then it is denied with an error message and no change is saved (ASSUMPTION: the comparison ignores case and leading and trailing spaces).
- Given that I am a system admin, when I enter a default max that is not an integer of at least 1 (e.g. 0, -3, 2.5 or text), when I try to save, then it is denied with an error message and no change is saved (ASSUMPTION: the same rule as for max players in REQ-0009).
- Given that two system admins add the same game name at the same time, when both save, then at most one of them succeeds (ASSUMPTION: the same pattern as for the last spot in REQ-0005).

Change:
- Given that I am a system admin, when I change the name or default max of a game and save, then the game is updated in the game list. The same name rules and max rules apply as when adding.
- Given that I am a system admin, when I change a game's name to a name already used by another game in the list, when I try to save, then it is denied with an error message and no change is saved.
- Given that I have changed the default max or name of a game, when a lobby already exists with the game, then the lobby's values remain (REQ-0009).

Remove:
- Given that I am a system admin, when I select "Remove" on a game and confirm, then the game is removed from the game choice (ASSUMPTION: confirmation is required).
- Given that I am a system admin, when I select "Remove" and cancel the confirmation, when I close the dialog, then the game remains unchanged.
- Given that I am a system admin, when I remove a game that is used by one or more lobbies, when it happens, then those lobbies remain with their game name and their max players (REQ-0009).

## Out of scope
- Appointing or removing system admins in the app. This happens outside the app, by the operator, via configuration. The app has no page for it in the MVP.
- Members or group admins proposing or adding games (REQ-0009).
- Group-specific game lists.
- More fields per game than name and default max.
- A history or change log of the game list for users.
- Search or sorting on the system admin's game list page.
- Changing default max on lobbies already created (F-011).
- System admins viewing or changing groups, members or lobbies. The role gives no rights in groups.

## Related features
F-024 (Game list with default max players) is the members' view of the list and the choice when creating a lobby. F-025 is the only way to change the list. Not a duplicate: F-024 is reading and choosing for members, F-025 is maintenance of the list itself by a system admin. Group admin (REQ-0002, REQ-0008) and system admin are separate roles, and F-025 gives group admins no rights. F-001 (Log in with Discord) identifies the system admin, and F-003 (Create lobby) uses the list.

## Open questions
- DECISION (identity): A game's identity is a system-generated ID, not its name. The system admin enters only name and default max players. The ID is never typed by anyone and never changes, even if the name changes (REQ-0009).
- DECISION ("Other" reserved): The name "Other" is reserved. A system admin cannot create a game named "Other" or rename a game to "Other", compared without regard to case and surrounding spaces, because "Other" is the free-text choice in REQ-0003 and REQ-0009.
- ASSUMPTION (multiple system admins): The operator can appoint more than one system admin.
- ASSUMPTION (login): A system admin logs in with the same login as other users (REQ-0001).
- ASSUMPTION (confirmation on removal): Yes, confirmation is required when removing a game, in the same way as when revoking a link (REQ-0007).
- ASSUMPTION (duplicate rule): Names are compared without regard to case and without leading or trailing spaces.
- ASSUMPTION ("Other"): "Other" is not an entry in the game list and cannot be changed or removed here (REQ-0009).
- ASSUMPTION (concurrent change): No locking, just as in REQ-0003. For concurrent changes to the same game, the last saved change applies. The duplicate rule still applies.
- ASSUMPTION (display of use): The app does not show how many lobbies use a game before it is removed. If that is wanted, it becomes a separate requirement.
