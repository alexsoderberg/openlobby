# REQ-0002. Create and join group via invite link
Status: Decided
Feature: F-002
Priority: Must

## Problem
Lobbies must belong to a circle of friends, not be visible to everyone. The group needs a simple way in for new members who are not already in, and a link that always has a max number of uses. Without an upper limit, a leaked link can be abused, e.g. by bots (DECISION, user).

## User story
As a member, I want to create a group and invite my friends with a link limited to a max number of uses, so that we all see the same lobbies and only the right people get in.

## Acceptance criteria
- Given that I am logged in, when I create a group with a name of 1–50 characters, then I become a member and group admin of the group, and the group appears in my group list.
- Given that I am logged in, when I create a group with an empty name or a name longer than 50 characters, then creation is denied with an error message and no group is saved.
- Given that I am a member of a group, when I select "Create invite link", then a new link is created with me as link creator, and I can copy it. The link is valid for 2 hours from creation. Validity cannot be chosen (DECISION). Links are created only on request, not automatically when a group is created (DECISION).
- Given that I create an invite link and leave max uses empty, when I save, then the link is saved with max 10 uses (DECISION, user: default value 10).
- Given that I create an invite link with max uses as an integer from 1 to 10, when I save, then the link is valid for at most that many uses (DECISION).
- Given that I create an invite link with max uses that is not an integer from 1 to 10 (e.g. 0, 11, -2, 2.5 or text), when I try to save, then it is denied with an error message and no link is created (DECISION).
- Given that an invite link has max 10 uses and 9 have already joined, when the 10th joins, then they become a member, the link's use count is 10 of 10, and the link is used up: it is no longer shown among the active links, for the creator and group admins as for everyone else (REQ-0007). Given that the link is used up, when an 11th opens it or clicks "Join group", then the 404 page is shown and no membership is created (DECISION).
- Given that I am a member of a group, when I open the group's page, then I see my own active invite links and can copy them. Each link shows when it expires in my local time and its uses as "X/Y", e.g. "3/10" (DECISION).
- Given that I am a group admin, when I open the group's page, then I see all of the group's active invite links, with creator, uses as "X/Y" and expiry time, and can copy and revoke any of them (DECISION; replaces the earlier assumption).
- Given that I am logged in but not a member, when I open an active invite link, then I see the group's name and a "Join group" button.
- Given that I am logged in and click "Join group", when the action succeeds, then I become a member, the group appears in my group list, and the link's use count increases by 1 (ASSUMPTION: each successful join via the link is one use).
- Given that I am on the "Join group" page and the link expires or reaches its max uses before I click, when I click "Join group", then the 404 page is shown and no membership is created. Validity is checked at the click, not only when the page is opened (DECISION).
- Given that two people click "Join group" on the link's last use at the same time, when the actions occur, then at most one of them becomes a member and the other gets the 404 page without membership. The use count never exceeds max (DECISION).
- Given that I have joined via the invite link, when the action succeeds, then I see the group's member list and the group's upcoming lobbies. Anyone who has the link can therefore see the group's content after joining. The lobby part is verified in REQ-0004 (see Open questions).
- Given that I am already a member and the link is active, when I open the invite link, then no new membership is created, the link is not counted as a use, and I go to the group's page (ASSUMPTION: no, not counted).
- Given that an invite link has expired (more than 2 hours after creation) or has reached its max uses, when someone opens it, then the 404 page is shown and no group information, the same as for an unknown link. Even a member sees 404 (DECISION: used-up works like expired).
- Given that an invite link does not correspond to any group, when someone opens it, then the 404 page is shown and no group information. The same 404 page as for a revoked, expired or used-up link (REQ-0007), so that they cannot be told apart (DECISION).
- Given that I am not logged in, when I open an invite link, then the login is shown and after a successful login I land on the invite page.
- Given that I am a member, when I open the group's page, then I see the member list with display names and which members are group admins.
- Given that I am not a member, when I try to open the group's page via direct address, then the 404 page is shown without any group content, the same as for an unknown group (DECISION: not 403, so that the group's existence is not revealed, consistent with the invite link rule above).

## Out of scope
- Leaving a group (see REQ-0006), removing a member (F-012), making a member group admin (see REQ-0008), removing another's group admin role, handing over one's own group admin role in advance (F-022), and group admin powers other than seeing, copying and revoking links and making a member group admin.
- Invitations via email or Discord message. The user copies the link themselves.
- Group description, image or settings.
- Group names that must be unique.
- Extending a link's validity, or changing a link's max uses after creation (ASSUMPTION, same as for max players in REQ-0009).
- Automatic new link when a link is revoked, expires or is used up.

## Related features
F-001 (Log in with Discord) is required to join. No other feature in the feature register handles groups, so this is not a duplicate. The group admin role is created here. F-013 (Revoke link), F-010 (Leave group) and F-023 (Make member admin) use the group admin role and the link creator. Multiple group admins are handled in REQ-0008. Max uses is a property of the same link, not a new feature: it uses the same creation, copying and validity rules.

## Open questions
- DECISION (user): Members can create their own invite links themselves. Several active links per group are allowed.
- DECISION (user): Invite links are temporary and valid for 2 hours from creation. Validity is fixed: always 2 hours, and the user cannot choose another time.
- DECISION (user): The invite link can be used by anyone who is logged in and has it, until it is revoked, expires or reaches its max uses.
- DECISION (user): Members see only their own links, so they can copy and share only their own. Group admins see all and can copy and revoke them.
- DECISION (user): Group admins can copy other members' invite links. The earlier open question about copying is therefore closed.
- DECISION (user): Every invite link always has a max number of uses. The creator chooses 1–10. The default is 10 when the field is left empty. Unlimited links do not exist. Values outside 1–10 are denied. Rationale: abuse protection, e.g. bots. When max is reached, the link works like an expired link: the 404 page. Replaces the earlier decision where max was optional and empty meant unlimited.
- DECISION (user): For each invite link, group admins see the creator, the number of uses and when the link expires.
- DECISION (user): The group's creator becomes group admin. A group can have several group admins (replaces "one admin per group"). A group admin can make a member group admin (REQ-0008). Nobody can remove another's group admin role in the MVP; a group admin gives it up by leaving the group. No advance hand-over of the role in the MVP. In the MVP, group admins have no powers beyond seeing, copying and revoking links and making a member group admin.
- DECISION (user): Links are created only when a member chooses to, not automatically when a group is created.
- DECISION (user): The interface shows when the link expires, in each member's local time (REQ-0003).
- DECISION (user): Validity is checked when "Join group" is clicked. A link that expires or is used up while the page is open is denied.
- DECISION (user): Who is a group admin is visible to all members.
- DECISION (user): No limit on the number of members per group in the MVP.
- ASSUMPTION: Each successful "Join group" via a link counts as one use, even if the person previously left the group and joins again. A reply is needed if another interpretation is wanted.
- ASSUMPTION: A member who opens an active link does not count as a use.
- ASSUMPTION: Used-up and expired links are not shown among the active links, just like revoked ones.
- ASSUMPTION: Max uses cannot be changed after creation, in the same way as for max players (REQ-0009).
- DECISION (sequencing): REQ-0002 may be implemented before REQ-0004. Until REQ-0004 is delivered, the group's page shows the member list and the invite links only, with no lobby section. The lobby part of the "after joining" criterion is covered by REQ-0004 ("Given that I am a member, when I open the group's page, then the lobbies are sorted...", and the empty-state text), which applies to every member regardless of how they joined. Both requirements must be delivered before the MVP is released.
- DECISION (non-member access): A non-member who opens the group's page by direct address gets the same 404 page as for an unknown group (`group_not_found` in the contract). Group existence is not revealed. This is the same principle as for invite links.
- DECISION (product owner, consistency with REQ-0007 and ADR 0007 section 7; no user decision asks otherwise): a used-up link is not shown in any list, including to its creator and group admins, because only active links are listed. The use count 10 of 10 is therefore verified in the data and by the 404 for the 11th person, not in the interface. If the user wants used-up links visible to creators or admins, this is a new decision and needs a new requirement or an amendment to REQ-0007.
