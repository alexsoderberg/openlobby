# 0004. Service: calendar (groups, roles, invite links, lobbies, players)
Status: Accepted (2026-11-01)

## Context
The core flow (REQ-0002–0007) handles the concepts Group, Member, Group admin, Invite link, Lobby and Player (the glossary in CLAUDE.md). Every lobby belongs to a group, and every write requires the user to be a member of that group. The user's decision since the first design: the group has one or more admins (the creator from the start, more can be appointed by an admin), several members can create their own invite links, and a join works as an open room: one can enter until the lobby's end time and always leave (REQ-0005). Lobbies have a max number of spots (F-018), and games are chosen from a game list (F-024, REQ-0009, ADR 0010). The question remains whether groups and lobbies/players should be one or several domain services.

The starting point in CLAUDE.md is few services. A new service requires a clear boundary, its own data and a reason for separate deployment.

## Decision
One domain service: **`calendar`**. It owns groups, memberships with role, invite links, lobbies and players.

**Owns data (schema `calendar`):** `groups`, `group_members`, `invite_links`, `lobbies`, `lobby_players`. See ADR 0006.

**Why one and not several:**
- **The invariants span the concepts.** Joining a lobby requires membership in the lobby's group. Leaving a group affects lobbies, players and links. Within one service these are local checks in the same database, without calls in the write path.
- **The same reasons for change.** All requirements describe one flow and change together.
- **The removal test.** If membership were split out, the membership check would come back as an HTTP call in every write in `calendar`.
- **Scale.** 3–15 members per group. No load reason to split.

**Internal seams in the service:**
- `GroupRepository` (groups, memberships, roles, invite links) and `LobbyRepository` (lobbies and players) are separate ports in `application`. `GameCatalog` (reading) and `GameCatalogEditor` (writing) for the game list (ADR 0010) are the third and fourth ports.
- Member and admin checks are made in `application` (domain rules), not in SQL or the transport layer. Tests use fakes for the ports.

**Layers** (`services/calendar/internal/`):
- `transport`: HTTP handlers. Reads `X-User-Id` and `X-User-System-Admin` from the gateway (ADR 0002, 0011) and builds an `Actor{UserID, IsSystemAdmin}` that is passed to use cases. Missing or invalid `X-User-Id` → 401. Validates input and translates errors to codes.
- `application`: use cases `ListGroups`, `CreateGroup`, `GetGroup`, `LeaveGroup`, `MakeAdmin`, `CreateInviteLink`, `ListInviteLinks`, `RevokeInviteLink`, `GetInvite`, `JoinByInvite`, `ListUpcomingLobbies`, `CreateLobby`, `GetLobby`, `DeleteLobby`, `JoinLobby`, `LeaveLobby`, `ListGroupGames` (members), `ListGames`, `CreateGame`, `ReplaceGame`, `DeleteGame` (the last four require system admin, ADR 0010). Defines the ports `GroupRepository`, `LobbyRepository`, `GameCatalog`, `GameCatalogEditor`, `UserDirectory` and `Clock`.
- `domain`: `Group`, `Lobby`, `Role` and their rules (see below).
- `infrastructure`: `postgres` (repositories and `GameCatalog` against the table `games`, ADR 0010), `authclient` (`UserDirectory` against `auth`), `systemclock`.

**Rules fixed here (so that the reviewer can check them):**

1. **Names and games** are trimmed before validation. Length is measured in Unicode characters (code points). A trimmed empty string is invalid.
2. **Membership:** a non-member calling group or lobby endpoints gets `404 group_not_found`, not 403.
3. **Links:** an unknown, revoked, expired or exhausted (max uses reached) link gives `404 invite_invalid`. The same response in all cases, with no group information. Validity is checked when viewing and when joining. See ADR 0007.
4. **Roles:** the creator of the group becomes admin. A group can have several admins. As long as the group has members, at least one admin exists (rule 5e). An admin can make a member admin with `PUT /api/groups/{groupId}/admins/{userId}` (idempotent, 204; non-admin gets `403 not_allowed`, unknown member `404 member_not_found`). No one can remove an admin role in MVP. The admin role gives the right to revoke any link in the group and to make a member admin. Otherwise all members have the same rights. Replaces the earlier assumptions "exactly one admin" and "no admin role".
5. **Leaving a group** (REQ-0006), in this order in one transaction (locking per ADR 0006):
   a. If the member has created upcoming lobbies (`ends_at > now`, same definition as rule 8) → `409 own_upcoming_lobbies_exist`, nothing changes.
   b. Remove the member's players rows on upcoming lobbies and the invite links they have created.
   c. Remove the membership.
   d. If no members remain → remove the group with lobbies, players and links.
   e. If no admins remain but members exist → the member with the earliest `joined_at` (on ties: lowest `user_id`) becomes admin. If an admin leaves and other admins remain: no role change.
6. **Lobbies:** the server receives two moments in UTC (`startsAt`, `endsAt`). Checks:
   - `startsAt` is in the future (`Clock`) → otherwise `lobby_in_past`.
   - `endsAt` is after `startsAt` → otherwise `lobby_end_not_after_start`.
   - `endsAt - startsAt` is under 24 hours → otherwise `lobby_too_long`.
   - Exactly one of `gameId` (id in the game list) and `customGameName` (free text) is given. Unknown id, or a free-text name that is empty or over 50 characters after trim → `invalid_game`. The game name is copied to the lobby (`game_name`). The lobby also stores `game_id` (null for a custom name), used only to order the game choice (amendment review 3, ADR 0010).
   - `maxPlayers` is `null` (unlimited) or an integer ≥ 1 → otherwise `invalid_capacity`. The value does not change after creation.
   - The rule "an end time with a clock time before the start time counts as the next day" is applied only in the frontend. It is the only place for that rule. The server never sees clock times.
   - Creation saves the lobby and the creator's player row in the same transaction (REQ-0005). The creator takes a spot, and max ≥ 1 means it always fits.
7. **Joining and leaving:**
   - **Join** (`PUT .../players/me`), after the group's lock in this order: a. lobby missing → `lobby_not_found`. b. `endsAt` has passed (`endsAt <= now`, `Clock`) → `lobby_has_ended`. c. the caller is already a player → 204, nothing changes. d. `maxPlayers` is set and the number of players is ≥ `maxPlayers` → `lobby_full`. e. otherwise the player row is saved. Joining works while the lobby is ongoing.
   - **Leaving** (`DELETE .../players/me`): if the lobby exists → 204 for a member, also after the end time and also if the caller was not a player (idempotent). No lobby-time check. If the lobby is missing → `404 lobby_not_found`. Leaving after the end time is always allowed (the user's decision, REQ-0005). The rule about a missing lobby replaces the earlier assumption "always 204 even if the lobby is missing". REQ-0005 states the case (the lobby no longer exists).
   - A non-member gets `group_not_found` for both join and leave (rule 2).
8. **Upcoming lobbies:** the list shows lobbies with `ends_at > now` (`Clock`). No paging.
9. **Concurrency:** every write that touches a group locks the group row first (ADR 0006).
10. **Rejoining:** the membership is deleted when the member leaves. A new join is a new row with `joined_at` = now. No history. A join by an existing member changes nothing and does not count as a use of the link. A new join counts (ADR 0007).
11. **System admin:** `Actor.IsSystemAdmin` gives the right to manage the game list (ADR 0010) and no right in a group. Group and lobby checks ignore the flag, so a system admin who is not a member gets `404 group_not_found` just like anyone else. The check is made in `application`, not in transport. See ADR 0011.

**Listing lobbies without interval filter (F-017).** `GET /api/groups/{groupId}/lobbies` returns all upcoming lobbies, both for the list view and the week view. A `from`/`to` filter is not added now, because:
- the week boundary (Monday 00:00) is a local time that only the frontend knows. The server would still have to receive the boundaries from the client.
- the list is unpaginated in MVP anyway, so the filter saves no transfer in practice.
- the week view filters in the frontend by overlap with the week's interval in local time. A lobby that starts Sunday 22:00 and ends Monday 02:00 appears in both weeks where it overlaps.

The addition is made additively (optional query parameters) when the list becomes large.

**Vendor dependency:** calendar knows only the user's `id` (uuid) and gets names via the port `UserDirectory`. It knows nothing about Discord.

**Assumptions and how they affect the design:**
- *Admin role (replaces "one admin per group"):* a role column `role` in `group_members` without a unique index on role. Several admins are allowed. No separate role table. "At least one admin" is an application rule in the leave transaction (point 5e), because the database cannot express it.
- *Several invite links (replaces "one link per group"):* a separate table `invite_links` (ADR 0006, 0007). Links are valid 2 hours from creation (the user's decision). Links are created only on request, not when the group is created or when a link is revoked.
- *Link list: members see their own links, admins see all active links in the group, with token so that admins can copy and revoke them.* The user's decision. Since the list only contains links the caller may revoke, there is no `canRevoke` field. Links have an optional max number of uses (ADR 0007).
- *Time zone (REQ-0003):* lobby times are stored as exact moments. If the requirement changes to a fixed time zone per group, only input and display in the frontend are affected. No migration.
- *Crossing midnight (REQ-0003):* the user has decided that lobbies may cross midnight. REQ-0003 records it as a DECISION.
- *Max 24 hours:* the user has confirmed "under 24 hours". Exactly 24 hours is rejected (`lobby_too_long`), as REQ-0003 states. An end clock time equal to the start clock time is not earlier than the start, so the frontend keeps it on the same day, and the server answers `lobby_end_not_after_start` (rule 6), as REQ-0003 also states.
- *Max players per lobby (F-018, REQ-0005, REQ-0009):* each lobby has `max_players`, empty = unlimited. The limit check is made in `application` (rule 7d) after the group lock (ADR 0006). No max limit for members in the group (REQ-0002).
- *Unpaginated list:* `shortcut: no paging of upcoming lobbies, upgrade when a group's list becomes large (add from/to as optional parameters)`.
- *Leaving a group:* the rule in point 5 above. The confirmation step belongs to the frontend (REQ-0006).
- *Last member:* the group is removed. Invite links to it are removed with it.

**How future extension is handled:** a new consumer that needs membership (e.g. notifications, F-015) starts by reading via the API. Membership is split out only if a second consumer has a different pace of change or its own database, and then with an ADR.

## Consequences
- Calendar depends on `auth` for names at read time. It is the only synchronous dependency edge for domain logic.
- A domain schema makes migrations and tests simple, but requires discipline in `application` so that the ports are not widened without reason.
- Consistency of players (a lobby removed at the same time) is handled by the database and the per-group lock: joining a removed lobby gives `lobby_not_found`.
- The role rules (at least one admin, transfer when the last admin leaves) are new business rules that the reviewer must be able to check. They exist only here and in ADR 0006.
- The max limit requires that joins count the players under the group's lock. That is one more write path than leaving, and it is tested against real PostgreSQL (ADR 0006).

## Alternatives considered
- **`groups` and `schedule` as two services:** the membership check becomes a synchronous call in every lobby write.
- **Four services (groups, invites, lobbies, players):** far below the granularity justified by pace of change or ownership.
- **Event-based sync between the services:** requires a broker and its own ADR. No consumer needs it in MVP.
- **Roles in their own table (`roles`):** two roles fit in one column (YAGNI).
- **One admin per group (partial unique index):** replaced by the user's decision on several admins.
- **Transfer to the oldest member at every admin grant:** changes roles when other admins remain, without anyone asking. Replaced by the rule that transfer happens only when the last admin leaves.
- **Admin role via `PUT .../members/{userId}/role` with the role in the body:** opens for demotion, which MVP does not allow. `PUT .../admins/{userId}` does only what is required.
- **`from`/`to` interval filter in MVP:** see "Listing lobbies" above.
- **One link per group with rotation:** replaced by the user's decision on several links (ADR 0007).

Amendment 2026-11-01:
- `GET .../lobbies/{lobbyId}` for a lobby whose end time has passed gives `404 lobby_not_found`, since past lobbies are not shown (REQ-0004). Writes are assessed as before based on whether the lobby's row exists: leaving 204, joining `lobby_has_ended`, and the creator's deletion unchanged.
- `POST .../lobbies` returns 201 with a `Lobby` without `players`. Names are not looked up after the write, so a failure in auth cannot turn a committed lobby into an error. The client fetches the details with GET.

Amendment 2026-11-01 (review 2):
- **Rule 3 (links):** the state "left" is removed. The links of a member who leaves are deleted in the same transaction (rule 5b), so there is no such state to check. An unknown, revoked, expired or exhausted link gives `invite_invalid`.
- **Rule 6 (lobby input):** `createLobby` follows the order of ADR 0001 (consolidated amendment): shape first (400 `invalid_request`), then membership (404 `group_not_found`), then the rules of rule 6 in their order. `maxPlayers` omitted or `null` means unlimited. A wrong JSON type gives `invalid_request`. An integer under 1 gives `invalid_capacity`. A missing `startsAt` or `endsAt` gives `invalid_request`.
- **Rule 7 (join), order confirmed.** The contract states this order:
  a. the lobby is missing → 404 `lobby_not_found`;
  b. `endsAt <= now` → 409 `lobby_has_ended`, also for a caller who is already a player;
  c. the caller is already a player → 204, nothing changes, even when the lobby is full;
  d. `maxPlayers` is set and the number of players is at least `maxPlayers` → 409 `lobby_full`;
  e. the player row is saved.
- **Path IDs** in uuid form that is invalid give the not-found code of their resource in step 1 (ADR 0001).
- **Times:** any RFC 3339 offset is accepted and stored in UTC (ADR 0001).

Amendment 2026-11-01 (review 3). This overrides the rules named below. Other rules are unchanged.
- **Rule 6 (lobbies):** the lobby no longer has "no reference to the game list". It stores `game_id` (the game's uuid, null for a custom name) next to `game_name` (ADR 0006 amendment, ADR 0010 amendment review 3). The reference is not a foreign key and is used only for the order of the game choice.
- **Rule 6, `gameId`:** an unknown `gameId`, including a value that is not in uuid form, gives `invalid_game`. Lookup order: after the time rules and before the `maxPlayers` check, in the order of rule 6 above and of the contract (`createLobby`).
- **Use cases:** add `ListGroupGames` (members only; the membership rule 2 applies, `group_not_found` for a non-member, including a system admin). Port `GameCatalog` gets `ListForGroup(ctx, groupID)`, which returns the games ordered by use in the group. `ListGames` stays for the system admin page.
- **Endpoint:** `GET /api/groups/{groupId}/games` (ADR 0010 amendment review 3).

Amendment 2026-11-01 (consolidated). The final cross-cutting rules are in ADR 0001 "Amendment 2026-11-01 (consolidated)". Service-specific points:
- **Rule 6 order** (replaces the review 2 text "checks membership first"): shape (400 `invalid_request`), then membership (404 `group_not_found`), then the rules of rule 6 in their order. `startsAt` and `endsAt` are `required`. `maxPlayers` omitted or `null` is unlimited (not `required`).
- **Rule 7, join after the end time (decided by the user, closes product question 4):** a caller who is already a player and joins after `endsAt` gets `409 lobby_has_ended`. The frontend shows the lobby as "Ended" (REQ-0005). The order a-e of the review 2 amendment stands.
- **Use case `ListGames`** is for the system admin only (`not_allowed` otherwise), as `GET /api/games` is (ADR 0010 consolidated). Members use `ListGroupGames`.

Amendment 2026-11-01 (review 4):
- **Rule 12 (scoping, no cross-group access).** Every lookup of a resource below a group (`lobbyId`, `linkId`, and the `userId` of a member) is made together with the `groupId` of the path (`WHERE id = $1 AND group_id = $2`, never by the ID alone). An ID that belongs to another group gives the same code and status as an ID that does not exist: `lobby_not_found`, `invite_invalid` or `member_not_found` (404). The membership check comes first and is for the `groupId` of the path (rule 2). **Required test (calendar, for each operation that takes `lobbyId`, `linkId` or `userId`):** a member of group A calls the operation with group A's `groupId` and an ID that belongs to group B, and gets 404 with the same code and body as for a random uuid.
- **Order with path IDs:** a malformed uuid in the path comes before the membership check, from left to right (ADR 0001 consolidated, item 1). The contract text of `revokeInviteLink` and `deleteLobby` states it.
