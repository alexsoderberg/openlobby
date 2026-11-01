# REQ-0007. Revoke invite link
Status: Decided
Feature: F-013
Priority: Must

## Problem
An invite link that leaks, e.g. to the wrong person or publicly in a chat, lets anyone join the group. The group needs a way to shut down a leaked link without creating a new group.

## User story
As a group admin or link creator, I want to revoke an invite link so that a leaked link no longer gives access to the group.

## Acceptance criteria
- Given that I am the link creator of an active invite link, when I select "Revoke link" and confirm, then that link stops working. No new link is created automatically (DECISION).
- Given that I am a group admin, when I select "Revoke link" on any active link in the group and confirm, then that link stops working.
- Given that I am a member but neither a group admin nor the creator of the link, when I try to revoke it, then it is denied with an error message and no link is changed.
- Given that I select "Revoke link" and cancel the confirmation, when I close the dialog, then the link remains active and nothing changes. Confirmation is required when revoking (DECISION).
- Given that a link has been revoked, expired or reached its max uses, when I open the group's page, then it is not shown among the active links.
- Given that a link has been revoked or has reached its max uses, when I, as a logged-in non-member, open it, then the 404 page is shown, exactly the same as for a link that does not correspond to any group (REQ-0002). The group's name is not shown.
- Given that a link has been revoked or has reached its max uses, when someone who is already on the "Join group" page clicks "Join group", then the 404 page is shown and no membership is created. Validity is checked at the click (DECISION).
- Given that a link has expired (more than 2 hours after creation) or has reached its max uses, when someone opens it or clicks "Join group", then the 404 page is shown, exactly the same as for a revoked link. No membership is created at the click (DECISION).
- Given that a link has expired or has reached its max uses, when someone tries to revoke it, then it is denied with an error message and no link is changed. An expired or used-up link is treated as already dead and does not need to be revoked (DECISION).
- Given that a member is already in the group when a link is revoked, expires or is used up, then they are not affected: they remain a member, keep their player status and see the group's lobbies as before.
- Given that I am not a member of the group, when I try to revoke a link, then it is denied and no link is changed.
- Given that I am the creator of a link and leave the group, when the leave succeeds, then the link is revoked (DECISION, see REQ-0006).

## Out of scope
- Removing a member from the group (F-012). Revocation and expiry affect only future joins, not members who have already joined.
- Other group admin powers than seeing, copying and revoking links and making a member group admin (REQ-0002, REQ-0008), and hand-over of the group admin role (F-022).
- Extending a link's validity.
- History of revoked, expired and used-up links.
- Notification to members when a link is revoked, expires or is used up (F-015).

## Related features
F-002 (Create and join group) creates the links and uses them. Revocation and expiry change what happens to the link after it has been shared, and therefore require their own behavior and their own requirement. F-010 (Leave group) triggers revocation of the leaver's links. F-012 (Remove member) is another feature: it removes a specific person, while revocation closes a link for all future joins through it.

## Open questions
- DECISION (user): Only the group admin or the person who created a link may revoke that specific link. Other members are denied.
- DECISION (user): A person who opens an old, revoked link sees the 404 page.
- DECISION (user): Invite links are valid for 2 hours from creation. An expired link is treated as revoked and gives the 404 page.
- DECISION (user): A link whose max uses has been reached is treated as expired: the 404 page, not in the list of active links, and it cannot be revoked.
- DECISION (user): Validity is checked when "Join group" is clicked. A link that expires while the page is open is denied.
- DECISION (user): Members can create links themselves, and several can be active at once (REQ-0002).
- DECISION (user): Revocation does not create a new link. The group may therefore have no active link until someone creates one.
- DECISION (user): When a link creator leaves the group, their links are revoked (REQ-0006). Replaces the earlier assumption that only a group admin could revoke them.
- DECISION (user): Revocation requires confirmation.
