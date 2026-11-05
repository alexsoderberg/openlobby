# REQ-0006. Leave group
Status: Implemented
Feature: F-010
Priority: Must

## Problem
A member who no longer wants to be in a group currently has no way out. They then still appear in the member list and can be players in lobbies, even though they are no longer in the group. The group's member list and player status then do not reflect reality.

## User story
As a member, I want to leave a group so that the group's member list and lobbies show only those who are actually in it.

## Acceptance criteria
- Given that I am a member of a group, when I click "Leave group" and confirm, then I am no longer a member, the group disappears from my group list, and I see "You have left <group name>" in the group list. Leaving requires confirmation, because my player status is removed (DECISION).
- Given that I am a player in upcoming lobbies in the group that I did not create, when I leave the group, then my player status is removed and the player count decreases by 1 on each such lobby.
- Given that I have created upcoming lobbies in the group, when I try to leave the group, then it is denied with the error message "Delete your upcoming lobbies first" and nothing changes (DECISION).
- Given that I have created or been a player in lobbies that have already passed their end time, when I leave the group, then they remain in the system but are shown to no member (DECISION).
- Given that I have left the group, when another member reloads the group's page, then I am missing from the member list.
- Given that I have left the group, when I open the group's page directly via address, then access is denied without the group's content being shown.
- Given that I have left the group and am logged in, when I open an active invite link for the group, then I see the group's name and the "Join group" button, just like any other non-member (REQ-0002).
- Given that I have left the group and join again via an invite link, when the action succeeds, then I am a member again and see the upcoming lobbies without my earlier player status. My join is counted from the new join (DECISION). The group admin role is not given back, even if I was admin before leaving (ASSUMPTION).
- Given that I am a group admin and other group admins remain, when I leave the group, then nothing happens to the group admin roles (DECISION).
- Given that I am the last group admin and other members remain, when I leave the group, then the member who has been in the group the longest becomes group admin. "In the group the longest" is counted from the latest join (DECISION).
- Given that I have created one or more invite links in the group, when I leave the group, then all my links in the group are revoked and stop working. The confirmation when leaving also covers this (DECISION, the confirmation is an ASSUMPTION).
- Given that I am the last member in the group, when I leave the group, then the group is deleted together with its lobbies and all its invite links, and the links show the 404 page (DECISION).

## Out of scope
- Removing another member from the group (F-012).
- Undoing a leave or getting player status back.
- Notification to other members when someone leaves (F-015).
- History of past lobbies (F-020).
- Hand-over of the admin role in advance (F-022). The admin role changes owner automatically only when the last admin leaves.

## Related features
F-002 (Create and join group) is the opposite: membership starts there and ends here. This is not a duplicate because the behavior, the effects on lobbies and player status, and the rules that apply are completely different. F-012 (Remove member) is a different actor, an admin who removes someone else, and requires a power that does not exist in the MVP. F-005 (Join and leave lobby) and F-003 (Create lobby) are affected by leaving, but are not duplicates. F-013 (Revoke link) is used when the leaver's links are revoked (see above), see REQ-0007.

## Open questions
- DECISION (confirmation): Leaving requires confirmation.
- DECISION (upcoming lobbies): A member with upcoming lobbies cannot leave until they have deleted them. Lobbies are not deleted automatically, because other people's player status would then disappear without warning.
- DECISION (last member): When the last member leaves, the group is deleted.
- DECISION (admin hand-over): When the last admin leaves, the admin role goes to the member who has been in the group the longest. If other admins remain when an admin leaves, nothing happens to the roles.
- DECISION (longest in group): Counted from the latest join. A rejoin replaces the previous join.
- DECISION (link creator who leaves): The link creator's invite links are revoked when they leave the group. Replaces the earlier assumption that a group admin could revoke them.
- ASSUMPTION (rejoin): A member who joins again is not an admin, even if they were before leaving. The admin role changes owner only when the last admin leaves.
