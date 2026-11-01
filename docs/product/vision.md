# Vision: OpenLobby

## Problem
Friends who play online together want to know when they can play together. Today this happens in chat or from memory: lobbies drown in messages, nobody sees who is actually coming, and coordinating every time takes effort.

## Target audience
Small circles of friends, roughly 3–15 people, who play the same games together and already communicate via Discord. All members are equal within their group, with one exception: each member can revoke their own invite links, and a group admin can additionally see, copy and revoke all of the group's links and make a member a group admin (see Glossary). A system admin is a role for the whole system, not for a group. That person maintains the game list and has no rights in groups. Nobody is a paying customer.

## Value
A shared, clear overview of when the group can play and who is in. Less coordination in chat, faster decisions on "are we playing tonight?".

## What the product is NOT
- No matchmaking or search for unknown players.
- No chat, voice or notifications in the MVP. Conversation stays in Discord.
- No integration with the games (no API coupling, no automatic sync of game state).
- No public calendar. Groups are private and are reached only via invite link.
- No calendar sync with Google, Outlook or Discord events in the MVP.
- No native mobile app in the MVP. A web browser is enough.
- No payment, no premium tiers.
- No user-managed game list in the MVP. Members do not add or propose games in the list.

## MVP scope
The core flow, in order:

1. Log in with Discord.
2. Create a group or join a group via invite link. Members create links on request. Each link is valid for 2 hours and always has a max number of uses (1–10). Members see only their own links; group admins see, copy and revoke all of them. Links can be revoked: a group admin can revoke all of the group's links, and each person can revoke the links they created themselves. A group admin can make a member a group admin.
3. Create a lobby (game, start, end, max players).
4. View the group's upcoming lobbies, as a list or as a calendar.
5. Join a lobby (if there are free spots), or leave it.
6. Leave a group.

Additionally, for operations: a system admin maintains the game list in the app (add, change and remove games), REQ-0010.

Everything else is outside the MVP and is listed in `features.md` with status `Proposed` or in the "Later" list.

## Glossary

Terms are identical to the Glossary section in `CLAUDE.md`, which holds the technical names (tables, fields, endpoints). This section gives the product meaning only.

The requirements use "admin" as short for group admin. System admin is a separate role.

| Term | Meaning | Avoid |
|---|---|---|
| Group | A private circle of members where lobbies are created. | Server, clan, team |
| Member | A logged-in user who belongs to a group. Stops being a member when they leave the group. | User (in group context), player |
| Group admin | A member of a group with two powers: to see, copy and revoke all of the group's invite links, and to make a member a group admin. The group's creator is group admin from the start. A group can have several group admins. Nobody can remove another's group admin role; a group admin gives it up by leaving the group. When the last group admin leaves, the role goes to the member who has been in the group the longest (counted from the latest join). | Admin without prefix, owner, moderator, leader, system admin |
| System admin | A role for the whole system, not for a single group. Appointed by the operator via configuration, not in the app. Can add, change and remove games in the game list (REQ-0010). Gives no rights in groups: a system admin is not a group admin. | Admin without prefix, superadmin, operator |
| Join (membership starts) | The moment a member most recently joined the group (for the creator: when the group was created). A rejoin replaces the previous join. | Connection, entry |
| Invite link | A link that gives access to join a group. Created by a member on request and valid for 2 hours from creation (fixed, cannot be chosen). Always has a max number of uses, 1–10 (default 10). A revoked, expired or used-up link (max uses reached) stops working immediately and shows 404. Several can be active at once. Not replaced automatically. Members see only their own links; group admins see all. | Code, invitation |
| Use | A successful "Join group" via an invite link that gives a new membership. A member who opens the link again does not count. | Click, view, hit |
| Link creator | The member who created a specific invite link. Can revoke that link. When the link creator leaves the group, their links are revoked. | Creator (meaning the lobby creator) |
| Lobby | An availability slot: game, start, end, max players, created by a member. The end time can be the next day, but the lobby must be shorter than 24 hours (exactly 24 hours is rejected). Shown to members until the end time. | Event, session, slot |
| Creator | The member who created a lobby. The only one who may delete it. Is automatically a player in their lobby and takes a spot. | Owner, admin |
| Player | A member who has joined a lobby ("I'm in") and takes a spot. A lobby works like an open room: you join it ("Join lobby") and leave it ("Leave lobby"). Leaving always works. Joining works until the end time, even while the lobby is running, and only if there is a free spot. | RSVP, sign-up |
| Game | The game a lobby is for: a choice from the game list (e.g. "World of Warcraft"), or "Other" with a free-text name. The lobby copies the game's name and default max players at creation; later changes to the list do not affect the lobby. "Other" is reserved and is never a game in the list. | Title, game type |
| Game list | A shared list of games where each game has a default max players. Each game keeps its identity when its name changes. Shared by all groups. Changed by a system admin in the app, without a new version (REQ-0010). Members and group admins cannot change it in the MVP. | Game catalog |
| Spot / max players | A player place in a lobby. Max players is the lobby's limit on spots: it defaults from the game list, the creator can change it at creation, and it does not change after creation in the MVP. The creator takes one spot. An empty max means unlimited. Shown as "X/Y players". | Slot, capacity, max attendees |
| Leave group | The member stops being part of the group and is removed as a player from upcoming lobbies. Upcoming lobbies they created must be deleted first. Their invite links are revoked. | Quit group, end group |

## Decisions
Applies to the whole product. Details and acceptance criteria are in the requirements.

- Time zone: each member sees lobbies in their local time (REQ-0003).
- UI language: English at launch. The product is built for several languages from the start: all user-facing text is translatable, and dates and clock times are formatted per the user's locale. Swedish is the next language (F-026, Proposed, not in the MVP). Applies to all UI requirements (REQ-0004 for dates).
- No limit on the number of members in a group in the MVP (REQ-0002). The number of players per lobby is limited by the lobby's max players (see below).
- Max players: each lobby has a max players value. The default comes from the game list, and the creator can change it at creation. The creator counts toward max. Max players does not change after creation in the MVP. Nobody can join when the lobby is full. There is no upper limit for max; an empty max means unlimited (REQ-0003, REQ-0005, REQ-0009). Replaces the earlier decision of no limit on players per lobby.
- Game list: games are chosen from a shared game list with a default max players, or as "Other" with a free-text name. The game list is dynamic: a system admin changes it in the app without a new version (REQ-0010). It is shared by all groups; members and group admins cannot change it in the MVP. A game may lack a default max (empty = unlimited). If a system admin renames or removes a game, existing lobbies are not affected (REQ-0009). Replaces the earlier decision that games were free text.
- System admin: a role for the whole system, separate from group admin. Appointed by the operator via configuration, not in the app. The app has no page for managing system admins in the MVP. A system admin has no rights in groups (REQ-0010).
- No connection to a specific Discord server: any Discord account can log in (REQ-0001).
- Group admin: the group's creator becomes group admin. A group can have several group admins, and a group admin can make a member a group admin (REQ-0002, REQ-0008). Nobody can remove another's group admin role. When the last group admin leaves, the role goes to the member who has been in the group the longest, counted from the latest join (REQ-0006).
- Links: members create links on request, several can be active at once, and each link is valid for 2 hours (fixed). A link always has a max number of uses, 1–10 (default 10), to protect against abuse such as bots; when max is reached, it works like an expired link. Members see only their own links. Group admins see, copy and revoke all of them. When a link creator leaves, their links are revoked (REQ-0002, REQ-0006, REQ-0007).
- Confirmation is required when revoking a link and when leaving a group (REQ-0006, REQ-0007).
- Lobby time: must be shorter than 24 hours. An end time earlier in the day than the start time is read as the next day. No warning for long lobbies (REQ-0003).
- Player status: leaving a lobby always works, even after its end time. Past lobbies are not shown in the MVP, so in practice the interface offers leaving only while the lobby is visible. Joining works until the lobby's end time, even while it is running, and only if there is a free spot (REQ-0005).
- Past lobbies from members who have left remain in the system but are not shown (REQ-0006).
- Upcoming lobbies must be deleted before a member can leave the group (REQ-0006).
- List view is the default. The calendar view is a week view, Monday–Sunday. A lobby that crosses midnight is shown on its start day with a marker (REQ-0004).
- Concurrent editing of lobbies happens without locking (REQ-0003).

## Open questions
- Should members be able to propose games in a later version? (REQ-0009)
- Should a group admin be able to remove another group admin's role in a later version? Not decided; the MVP does not allow it. (REQ-0008)

The following assumptions apply until the user decides otherwise:
- A rejoin does not give back the group admin role, even if the member was a group admin before leaving (REQ-0006).
- The confirmation when leaving a group also covers that their links are revoked (REQ-0006).
- Promoting a member to group admin requires confirmation (REQ-0008).
- The operator can appoint several system admins (REQ-0010).
