# REQ-0008. Make member group admin
Status: Implemented
Feature: F-023
Priority: Must

## Problem
The responsibility for revoking invite links, e.g. when a link leaks one evening when its creator is not logged in, currently falls on a single person. The group needs more than one person who can shut down a leaked link, but there is no way to get more group admins than the creator.

## User story
As a group admin, I want to make a member a group admin so that more people in the group can revoke leaked invite links.

## Acceptance criteria
- Given that I am a group admin in a group and another member is not a group admin, when I select "Make group admin" on them and confirm, then they become a group admin and the admin marker is shown to all members in the member list. Confirmation is required because it cannot be undone in the MVP (ASSUMPTION).
- Given that a member has become a group admin, when they open the group, then they have the same powers as the other group admins in the MVP: revoking all of the group's invite links and making other members group admins.
- Given that I am not a group admin, when I see the group's member list, then the "Make group admin" option is missing.
- Given that I am not a group admin, when I try to make a member a group admin, then it is denied and no role is changed.
- Given that I am a group admin trying to make a person group admin who is no longer a member of the group, when I confirm, then it is denied and no role is changed.
- Given that I am a group admin and see another group admin, when I go through the group's member list, then there is no option to remove their group admin role (DECISION: nobody can remove another's group admin role in the MVP).
- Given that I am a group admin and want to give up the admin role, when I leave the group, then REQ-0006 applies. There is no other way to give it up in the MVP.

## Out of scope
- Removing another's group admin role (not an MVP feature).
- Hand-over of one's own group admin role in advance without leaving the group (F-022).
- Undoing a group admin appointment.
- Removing a member from the group (F-012).
- Admin powers other than revoking invite links and making a member group admin.

## Related features
F-022 (Hand over admin role) is a different feature. It lets an admin give up their own role, while F-023 adds an admin without anyone losing their role. This is not a duplicate, but F-022 depends on F-023 existing. F-002 (Create and join group) gives the group's first admin. F-013 (Revoke link) and F-010 (Leave group) use the group admin roles that F-023 adds more of.

## Open questions
- ASSUMPTION (how more become admins): A group admin can make a member group admin. There is no other route in the MVP.
- ASSUMPTION (confirmation): Promotion to group admin requires confirmation.
- DECISION (user): Nobody can remove another's group admin role in the MVP. A group admin gives it up by leaving the group.
- OPEN QUESTION: Should a group admin be able to remove another's group admin role in a later version, e.g. if an admin should no longer hold the role? Not decided.
