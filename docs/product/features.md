# Feature register

The single source of truth for which functionality exists or is decided. The Service column is filled in by the architect.

| ID | Feature | Status | Service | Requirement | Comment |
|---|---|---|---|---|---|
| F-001 | Log in with Discord | Decided | auth (+ gateway for session validation) | REQ-0001 | Only login method in the MVP. |
| F-002 | Create and join group via invite link | Decided | calendar | REQ-0002 | Member list is shown to members. The creator becomes group admin. Members create links on request and see only their own. Links are valid for 2 hours (fixed) and always have max uses, 1–10 (default 10, DECISION). Unlimited links do not exist (DECISION, abuse protection). Group admins see, copy and revoke all of them (DECISION). |
| F-003 | Create lobby | Decided | calendar | REQ-0003, REQ-0009 | Game is chosen from the game list (F-024) or is "Other" with a free-text name. Max players is set at creation. The creator can delete their lobby. Lobby shorter than 24 hours. |
| F-004 | View upcoming lobbies | Decided | calendar | REQ-0004 | List sorted by start time. Shows spot status (X/Y players). |
| F-005 | Join and leave lobby | Decided | calendar | REQ-0005 | All members can join. Leaving always works. Joining works until the end time, even during a running lobby (DECISION). After the end time, "Join lobby" shows the lobby as "Ended" (REQ-0005). Joining only if there are free spots (F-018). |
| F-010 | Leave group | Decided | calendar | REQ-0006 | MVP. Upcoming lobbies are deleted first. The last admin to leave hands the role to the member who has been in the group the longest (counted from latest join). The leaver's links are revoked. The last member to leave deletes the group. |
| F-011 | Edit existing lobby | Proposed | – | – | Later. In the MVP you delete and create a new one. This also applies to max players. |
| F-012 | Remove member from group | Proposed | – | – | Later. Builds on the admin role (REQ-0002). |
| F-013 | Revoke invite link | Decided | calendar | REQ-0007 | MVP. Group admins can revoke all links; link creators can revoke their own. No new link is created automatically. Expired and used-up links (max uses reached) are treated as revoked (404). |
| F-014 | Recurring lobbies (e.g. every Tuesday) | Proposed | – | – | Later. |
| F-015 | Notifications about new lobbies or player status changes | Proposed | – | – | Later. Can be connected to Discord. |
| F-016 | Publish lobbies in a Discord channel | Proposed | – | – | Later. Same need as F-015 in a different way; assessed when F-015 is decided. |
| F-017 | Calendar view (week/month) | Decided | calendar | REQ-0004 | MVP: switch between list (default) and week view (Monday–Sunday). Month view is not in the MVP (DECISION). |
| F-018 | Max players per lobby | Decided | calendar | REQ-0005, REQ-0009 | MVP (DECISION). Max is set at creation and the creator counts toward it. Empty max = unlimited. No upper limit. A full lobby denies joining. Does not change after creation (F-011). |
| F-019 | Calendar export (ics) and sync with external calendars | Proposed | – | – | Later. Not in the MVP. |
| F-020 | History of past lobbies | Proposed | – | – | Later. Past lobbies remain but are not shown in the MVP (REQ-0006). |
| F-021 | "Maybe" reply to a lobby | Proposed | – | – | Later. Adds complexity without solving the core need. |
| F-022 | Hand over admin role to another member | Proposed | – | – | Later. Give up one's own admin role in advance, without leaving the group. Differs from F-023. In the MVP: nobody can remove another's admin role; the role changes owner only when the last admin leaves (REQ-0006). |
| F-023 | Make member admin | Decided | calendar | REQ-0008 | MVP. Required for a group to have several admins (DECISION). Nobody loses their role. |
| F-024 | Game list with default max players | Decided | calendar | REQ-0009 | MVP (DECISION). Shared list that members choose from, ordered "most used first" within the group (ASSUMPTION details in REQ-0009). Changed only by a system admin in the app (F-025), without a new version. Members and group admins cannot add or propose games. "Other" with a free-text name for games that are missing. |
| F-025 | Manage game list as system admin | Decided | calendar (+ auth and gateway for the role) | REQ-0010 | MVP (DECISION). System admin is a role for the whole system, separate from group admin, and is appointed by the operator via configuration. Add, change (name, default max) and remove games in the app. Each game has a system-generated identity that never changes on rename. "Other" is reserved. No page for managing system admins in the MVP. |
| F-026 | Swedish UI language | Proposed | – | – | Later, not MVP. Swedish is the next UI language after English (vision.md DECISION). The MVP must be i18n-ready, see the cross-cutting note below. |

**Cross-cutting note (all UI requirements, REQ-0001 to REQ-0010):** the UI is English at launch, but all user-facing text must be translatable and dates and clock times must be formatted per the user's locale (vision.md DECISION). This is not a separate feature; F-026 only adds the Swedish translation.
