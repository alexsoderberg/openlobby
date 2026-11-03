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

1. **Names and games** are trimmed before validation with Go's `strings.TrimSpace` (all Unicode whitespace, ADR 0010 amendment 2026-11-03). Length is measured in Unicode characters (code points). A trimmed empty string is invalid.
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

Amendment 2026-11-02 (REQ-0002 ports and adapters). Decided by the architect before implementation. The ports named in "Layers" above are extended as follows. All are defined in `application`, at the consumer.

**Ports for REQ-0002:**
- `GroupRepository`:
  - reads: `ListForUser(ctx, userID)`, `Members(ctx, groupID)` (with role), `FindMember(ctx, groupID, userID)`, `FindLinkByToken(ctx, token)` (link and group ID), `ListLinks(ctx, groupID, creatorID or all)`, group name.
  - `Create(ctx, group, creatorID, now)`: one transaction for the group and the admin membership. No lock is needed, because the row is new.
  - `WithLockedGroup(ctx, groupID, fn func(tx GroupTx) error) error`: the adapter starts a transaction, runs `SELECT ... FROM groups WHERE id = $1 FOR UPDATE` as the first statement, and passes a transaction-scoped `GroupTx`. It returns `ErrGroupNotFound` when no row exists. `GroupTx` holds the locked operations only: membership and link reads, `AddMember`, `InsertLink`, `DeleteInactiveLinks(now)`, `DeleteLink`, `IncrementUse`. Every write that touches a group uses this method (ADR 0006). The method names are the backend's; the shape is fixed here so that the test fakes implement one rule.
- `Clock` (`Now() time.Time`), adapter `systemclock`. Read after the lock (ADR 0007, item 3).
- `TokenGenerator` (`NewToken() (string, error)`), adapter `cryptotoken` (ADR 0007, item 2).
- `UserDirectory` (`DisplayNames(ctx, userIDs []string) (map[string]string, error)`), adapter `authclient`.

**`authclient` (decided).**
- Generated from `api/auth/internal.yaml` with `api/auth/oapi-codegen-client.yaml` into `services/calendar/internal/infrastructure/authclient/gen/` (ADR 0012).
- Calls are split into batches of at most 100 IDs (named constant, ADR 0003). The adapter's tests check 100 (one call) and 101 (two calls).
- Timeout 5 seconds (named constant, the same value as the session call in ADR 0002).
- A request editor sets `X-Request-Id` from the context (`pkg/requestid`), so the correlation ID is passed on.
- Error mapping (the only place where it is decided):
  - connection error, timeout or `503` from `auth`: `ErrUserDirectoryUnavailable`, which gives `503 service_unavailable` (ADR 0003);
  - any other status (`400`, `500`), a malformed response, or a requested ID missing from the response: a plain error, which gives `500 internal_error`, logged with the request ID. A member is never shown with an empty name. In MVP users cannot be deleted, so a missing name is a fault, not a normal case.

**Where names are used (decided).** `getGroup` uses `UserDirectory`, because the member list needs names (REQ-0002). `listInviteLinks` and `createInviteLink` do not call `auth`: the frontend takes the creator's name from the member list (ADR 0007). Lobby details (REQ-0004, REQ-0005) use the same port later.

**Create group (decided).** `CreateGroup` validates the name in `domain.NewGroupName` before any write: trimmed, 1–50 code points. Omitted, `null`, empty after trim or too long give `ErrInvalidGroupName` (`invalid_group_name`). Only then does `GroupRepository.Create` run. No link is created.

**Router (decided).** The `calendar` router adds `httpapi.LimitBody` after `requireUserID` (ADR 0001, item 3; ADR 0007, item 11).

**Compose (decided; ADR 0008 item 1 applies now).** `calendar` gets `AUTH_URL: http://auth:8080` and `depends_on: auth` with the same condition as `gateway` (`service_healthy`). The `services` network already contains `calendar` and `auth`.

**Test rules for REQ-0002 (decided).** Domain tests: `NewGroupName`; `NewInviteLinkMaxUses` (nil gives 10; 1 and 10 are valid; 0, 11 and -2 give `invalid_max_uses`); `IsActive` at the boundaries. Application tests with fakes, including the fake of `WithLockedGroup`. Integration test (tag `integration`, real PostgreSQL): two concurrent joins on the last use give one membership and `use_count` = `max_uses`; migration `0002` up and down; deleting a group removes its links. Transport test: the bodies of unknown, inactive and invalid-token 404 responses are equal except `requestId`.

Amendment 2026-11-02 (review of the REQ-0002 design). Decided by the architect. This section supersedes the bullet "`GroupRepository`" and the test rules of the previous amendment 2026-11-02. The other text of that amendment stands.

**Ports (split, supersedes the single `GroupRepository`).** Each port is defined in `application` at the consumer and has only the methods of its use cases (interface segregation, CLAUDE.md). A single `GroupRepository` was rejected: every use case would depend on methods it does not use, and every fake would grow with the feature.
- `GroupsOfUser` (ListGroups): `ListForUser(ctx, userID) ([]GroupSummary, error)`.
- `GroupCreator` (CreateGroup): `Create(ctx, group, creatorID, joinedAt) error`. One transaction, no lock, because the row is new.
- `GroupReader` (GetGroup, membership check of ListInviteLinks and CreateInviteLink): `Membership(ctx, groupID, userID) (Membership, bool, error)`, `Members(ctx, groupID) ([]Member, error)`.
- `InviteLinkReader` (GetInvite, ListInviteLinks): `FindLinkByToken(ctx, token) (LinkLookup, bool, error)`, where `LinkLookup` holds the link, the group ID and the group name (one query, so a missing group gives "not found", ADR 0007 item 13); `ListLinks(ctx, groupID, creatorID or all)`.
- `GroupLocker` (every write that touches a group): `WithLockedGroup(ctx, groupID, fn func(tx GroupTx) error) error`. The adapter starts the transaction, sets `lock_timeout` and runs `SELECT ... FOR UPDATE` as the first statement (ADR 0006, lock-order invariant). It returns `ErrGroupNotFound` when no row exists. `GroupTx` holds the locked operations only, each scoped to the group (ADR 0006 rule 12): `Membership`, `LinkByID`, `GroupName`, `AddMember`, `InsertLink`, `DeleteInactiveLinks(now)`, `DeleteLink`, `IncrementUse`.
- `Clock`, `TokenGenerator`, `UserDirectory`: unchanged from the previous amendment.

**One error for a dependency that is down (decided).** The application error is `ErrUnavailable`. It is returned when the database does not respond, when the group lock times out (SQLSTATE `55P03`, ADR 0006 and ADR 0001 item 8) and when `UserDirectory` cannot reach `auth`. The transport maps it to `503 service_unavailable`. `ErrUserDirectoryUnavailable` is removed. A second error would give the same answer, so one is enough. `ErrUnavailable` is never returned after a commit (ADR 0001).

**One deadline for the whole name lookup (decided).** `DisplayNames` runs under one deadline of 5 seconds (named constant in `authclient`), not 5 seconds per batch. The batches of 100 run in order under that one context. A group of more than 100 members therefore cannot take longer than the deadline in total.

**Order in `getGroup` (decided).** The membership check (`group_not_found`) comes before the `authclient` call. A non-member never causes a call to `auth`.

**Error mapping of `authclient` (decided, restated).** Connection error, timeout or `503` from `auth`: `ErrUnavailable`, so `503`. `400`, `500`, a malformed response body, or a requested ID missing from the response: a plain error, so `500 internal_error`, logged with the request ID. A member is never shown with an empty name.

**Test rules for REQ-0002 (decided; replaces the list of the previous amendment).**
- Domain: `NewGroupName` (trim, 1 and 50 valid, empty and 51 invalid, code points); `NewInviteLinkMaxUses` (nil gives 10; 1 and 10 valid; 0, 11 and -2 give `invalid_max_uses`; 2.5 and text give `invalid_request` in the transport); `IsActive` at the boundaries (`expires_at == now` is not active, `use_count == max_uses` is not active).
- `authclient` error mapping: connection error, timeout and `503` give `service_unavailable` (503); `400`, `500`, a malformed body and a missing ID give `internal_error` (500); no member is ever returned with an empty name.
- `authclient` contract test with an `httptest` server that implements `api/auth/internal.yaml`: 100 IDs in one call, 101 IDs in two calls, one deadline for the whole lookup.
- Authorization: a non-member gets `group_not_found` on `getGroup`, `listInviteLinks`, `createInviteLink` and `joinInvite`. A member sees only their own links in `listInviteLinks`; an admin sees all of them.
- A member opening an active link through `getInvite` gets 200 with `isMember` true; `useCount` is unchanged and no row is inserted. Joining as a member through `joinInvite` also changes nothing.
- An empty `createInviteLink` body gives 201 with `maxUses` 10.
- A body over 16 KiB gives 400 `invalid_request`.
- Max-uses values: 0 gives `invalid_max_uses`; 11 gives `invalid_max_uses`; -2 gives `invalid_max_uses`; 2.5 gives `invalid_request`; text gives `invalid_request`.
- Cross-group link for revoke: a member of group A calls `DELETE /api/groups/{A}/invite-links/{linkId}` with a link of group B and gets 404 `invite_invalid`, the same as for a random uuid (ADR 0004 rule 12).
- Integration (real PostgreSQL, tag `integration`): two concurrent joins on the last use; migration `0002` up and down; deleting a group removes its links; a lock that waits longer than `lock_timeout` (SQLSTATE `55P03`) gives `ErrUnavailable`; the `translate()` unit test also covers code `55P03`.
- Transport: the bodies of unknown, inactive, group-gone and invalid-token 404 responses are equal except `requestId`.

Amendment 2026-11-03 (REQ-0002 PR A implementation: `createGroup`, `getGroup`). Records what is built. Where it differs from the amendments of 2026-11-02, this amendment governs.
- **`GroupCreator.Create` (deviation):** `Create(ctx, name, creatorID, joinedAt) (domain.Group, error)`. `name` is the validated name from `domain.NewGroupName`. It returns the stored group with its generated ID, not only the ID. Replaces the signature above.
- **`GroupReader` (deviation):** three methods.
  - `IsMember(ctx, groupID, userID) (bool, error)` replaces `Membership(...)`. The role is read from `Members`. A non-member is `false` with no error.
  - `Group(ctx, groupID) (domain.Group, error)` reads the group itself, separate from its members. It returns `ErrGroupNotFound` when the row does not exist.
  - `Members(ctx, groupID) ([]domain.Member, error)` is ordered by `joined_at`, then `user_id` (ADR 0001, item 6).
- **Display names (deviation):** an empty `displayName` in the answer of `auth` is treated like a missing name. It is a plain error, so `500 internal_error`, logged with the request ID. It is not replaced by a fallback name. A `503` from `auth` stays `service_unavailable`.
- **Router order (decided, clarified):** the router lists `Middlewares: [LimitBody, requireUserID]`. Each middleware wraps the handler in list order, so the last one is outermost. `requireUserID` therefore runs first. An unauthenticated caller is refused before `LimitBody` runs and before any body is read. `LimitBody` only limits the body that the handler reads later. This replaces the phrase "adds LimitBody after requireUserID" above, which reads the list order as the execution order.
- **One error handler (deviation):** `ErrUnavailable` is mapped to `503 service_unavailable` in one function, `errorHandler` in `transport/router.go`, and not in each handler. Every other error goes to `httpapi.InternalErrorHandler`: `500 internal_error`, logged with the request ID. The `503` path logs a warning with the request ID before it answers, so an operator can see whether the database or auth was down.

Amendment 2026-11-03 (S2b: `listInviteLinks` needs the caller's role). Supersedes the `GroupReader` bullet above (`IsMember`, role read from `Members`). The other text stands.
- **`GroupReader.Membership` (decided):** `Membership(ctx, groupID, userID) (domain.Member, bool, error)` is the one method for membership, outside the lock. It returns the member with `Role`, and `false` with no error for a non-member. `IsMember` is removed. `Group` and `Members` are unchanged.
- **Same shape under the lock:** `GroupTx.Membership` has the same signature and the same adapter helper (`membership` in `infrastructure/postgres/groups.go`). S2c (join: "already a member", no change) and S2d (revoke: the caller is an admin or the link's creator) use it under the group lock.
- **Why:** `listInviteLinks` must know the role. Reading it from `Members` loads every member for one answer, and a second method would repeat the membership query. One method serves `getGroup` (role ignored), `listInviteLinks`, join and revoke, so no further reader method is needed.
- **Rule for the reviewer:** no use case calls `Members` to learn whether a user is a member or what role the user has. Fakes implement `Membership` once for both `GroupReader` and `GroupTx`.

Amendment 2026-11-03 (S2d: revoke). Names the `GroupTx` methods as built. Where a name in the 2026-11-02 amendments differs, this list governs.
- **`GroupTx` (as built):** `Membership`, `DeleteInactiveInviteLinks(now)`, `InsertInviteLink`, `LinkByID`, `AddMember`, `IncrementUse`, `DeleteInviteLink`. The 2026-11-02 names `DeleteLink` and `DeleteInactiveLinks` are replaced by `DeleteInviteLink` and `DeleteInactiveInviteLinks`. The names are kept as they are in code, because each one says which row it deletes. Every method is scoped to the group (rule 12). `GroupTx` does not contain a `GroupName` method, because the group name comes from the unlocked lookup.
- **Revoke under the lock:** `Revoke` runs `revokeLocked` in the order membership (`group_not_found`), link in this group (`invite_invalid`), creator or admin (`not_allowed`), active (`invite_invalid`), then `DeleteInviteLink`. This is the order of ADR 0007 (amendment review 2, revoke order).
