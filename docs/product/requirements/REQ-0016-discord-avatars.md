# REQ-0016. Discord avatars for users
Status: Decided
Feature: F-029
Priority: Should

Decided by the user on 2026-11-10 (priority 1 of the new ideas, "Discord avatars for users"). Until now the MVP shows initials instead (ASSUMPTION in REQ-0012, F-029). This requirement replaces that for people who have a Discord picture. The data handling is the architect's.

## Problem
Members are shown as names and initials only. In a group with ten people, a player list reads as text, and members cannot recognise each other at a glance. Their Discord account already has a picture that they and their friends know.

## User story
As a member, I want to see the Discord avatar of the people in my groups and lobbies, so that I recognise them at a glance.

## Acceptance criteria
- Given that I log in and my Discord account has a profile picture, when the login succeeds, then my avatar in the Top bar and on the You page is that picture, not my initials.
- Given that my Discord account has no profile picture, when my avatar is shown, then my initials are shown in the same round form as today (REQ-0012).
- Given that I log in and my Discord picture has changed since my last login, when I log in, then the new picture is shown. Before my next login the old picture stays, the same rule as for the display name (REQ-0001).
- Given that I have removed my Discord picture, when I log in again, then my initials are shown (ASSUMPTION: the same next-login rule as for a changed picture).
- Given that a feed line (REQ-0018) names a member who has left the group, when the line is shown, then the picture shown is the last one known for that member (ASSUMPTION).
- Given that I am a member of a group, when I open its member list, then each member's avatar, or their initials if they have no picture, is shown next to their display name.
- Given that I open a lobby, when its player list is shown, then each player's avatar, or their initials, is shown next to their name, and the same for the creator.
- Given that a lobby list or week view shows the lobby's creator (REQ-0004), when the creator is shown, then their avatar, or their initials, is shown next to their name.
- Given that a place shows a person's display name, when that place is shown, then the person's avatar, or their initials, is shown with it. The Next up card shows no player names (REQ-0012), so it shows no avatars.
- Given that a Group feed line (REQ-0018) names a person, when the line is shown, then that person's avatar, or their initials, is shown next to the name in the line (DECISION, user, 2026-11-10, from "wherever a name is shown").
- Given that the picture of a person cannot be loaded, when the page is shown, then their initials are shown instead, no error is shown and the rest of the page works.
- Given that a picture is loading, when the page is shown, then the space for the avatar keeps the size of the initials circle, so the layout does not move when the picture appears.
- Given that a screen reader reads a page with avatars, when it reads a person, then it announces the name once; the avatar is not announced in addition (ASSUMPTION: the avatar is decorative beside the name).
- Given that I am not a member of a group, when I try to see its members or lobbies, then no avatar of its members is shown, because no names are shown either (REQ-0002, REQ-0004).
- Given that a group is shown, when I see its icon, then the icon stays the generated initials of the group name (REQ-0012). Groups get no picture.

## Out of scope
- Uploading or choosing a picture in the app, and any picture other than the Discord one.
- Profile editing (REQ-0001).
- Group pictures or server icons.
- Refreshing the picture more often than at login.
- Avatars in messages or notifications outside the app (F-015).

## Related features
F-029 (this requirement). F-001 and REQ-0001 (the login is the source of the picture; the out-of-scope line is amended, see REQ-0001 Amendment 2026-11-10). The landing hero (REQ-0013) shows sample cards with no real people and keeps its sample initials or abstract dots; this requirement does not change it. F-002 (member list), F-004 and F-005 (creator and player names) show the avatar with the name. F-028 and REQ-0012 (top bar and You page; the initials rule is amended, see REQ-0012 Amendment 2026-11-10). No other feature shows person pictures, so this is not a duplicate.

## Open questions
- ASSUMPTION: the picture is taken at login together with the display name (REQ-0001) and changes only at the next login.
- DECISION (user, 2026-11-10): no opt-out. The avatar is shown wherever the display name is shown, with no setting to hide it. The Next up card is the only exception, because it shows no names (REQ-0012).
- DECISION (user, 2026-11-10): a Group feed line shows the avatar of the person it names (see the criterion above).
- For the architect: where the picture reference is stored (the auth profile has no avatar field today, `api/auth/openapi.yaml`), how it reaches the calendar views (member and player names), and how the image is delivered. Loading the image directly from Discord reveals the viewer's IP address to Discord, and the content security policy must allow it. The delivery route is the architect's decision.
