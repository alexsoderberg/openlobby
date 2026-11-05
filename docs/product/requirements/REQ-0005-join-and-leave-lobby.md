# REQ-0005. Join and leave lobby
Status: Implemented
Feature: F-005, F-018
Priority: Must

## Problem
A list of lobbies is not enough. The group needs to know who is actually coming, and members must be able to take back their sign-up when plans change. Lobbies with a limited number of spots also need a limit, so that no more than fit can come.

## User story
As a member, I want to join a lobby and be able to leave it, so that the group sees who is coming and the lobby is not overfilled.

## Acceptance criteria
- Given that I am a member, the lobby has not passed its end time and there is a free spot, when I click "Join lobby", then I am shown among the players, the player count increases by 1 and the number of free spots decreases by 1. This also applies while the lobby is running (DECISION).
- Given that all spots in the lobby are taken, when I click "Join lobby", then it is denied with an error message, no player status is saved, and I am not shown among the players.
- Given that two members click "Join lobby" on the lobby's last free spot at the same time, when the actions occur, then at most one of them succeeds and the other is denied as in the previous criterion. The number of players never exceeds max players.
- Given that I am already a player in a lobby, when I click "Join lobby" again, then nothing changes and I am listed among the players only once.
- Given that I am a player in a lobby, when I click "Leave lobby", then I am removed from the players, the player count decreases by 1 and the spot becomes free. This always applies, even when the lobby has passed its end time (DECISION).
- Given that I am not a player in a lobby, when I click "Leave lobby", then nothing changes and no error message is shown.
- Given that the creator has deleted the lobby, when I leave it, then it is shown that the lobby no longer exists, and the lobby disappears from the view without an error dialog.
- Given that the lobby has passed its end time, when I click "Join lobby", then no player status is saved, I am not shown among the players, and the lobby is shown with the state "Ended" instead of an error dialog.
- Given that the creator has deleted the lobby, when I try to join, then it is denied with the message "The lobby no longer exists".
- Given that I am not a member of the group, when I try to join a lobby, then it is denied and no player status is saved.
- Given that I create a lobby, when it is saved, then I am automatically a player in it and take one of its spots. I can leave like anyone else, and when I have left I can join again if there is a free spot. The player count is 1 from the start.
- Given that two members join the same lobby at the same time and there are spots for both, when both actions succeed, then both are players and the count is 2.

## Out of scope
- Changing max players after creation (F-011).
- Waiting list for full lobbies.
- "Maybe" reply (F-021).
- Notifications about player status (F-015).
- Joining on behalf of someone else.

## Related features
F-003 (Create lobby) and F-004 (View upcoming lobbies). Player status is not a duplicate of anything else; it is the only feature that shows who is coming. F-018 (Max players per lobby) is a limit for this feature and is included in this requirement. The max value comes from REQ-0009 (F-024), which sets the default value and does not control player status.

## Open questions
- DECISION (user): Leaving always works. Joining works until the lobby's end time, even while the lobby is running. Player status works like an open room that you can enter and leave.
- NOTE: Past lobbies are not shown in the MVP (REQ-0004), so in practice the interface offers leaving only while the lobby is visible. The rule above still always applies.
- DECISION (user, ended lobby): A member who clicks "Join lobby" after the lobby has ended sees that the lobby has ended (state "Ended"), not an error box. This is the same rule as above, shown differently. The same applies when the lobby ends while the member's view is still open.
- DECISION (user): There is no limit on the number of players per lobby. Instead, each lobby has a max players value (F-018, REQ-0009). Replaces the earlier decision.
- DECISION (user): Only the creator deletes a lobby (see REQ-0003). No other member can delete another's lobby.
- DECISION (user): The creator counts toward max players, so a lobby with max 1 has only the creator.
