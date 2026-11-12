# 0022. Preferred game roles: stored by calendar, read with the lobby and group views
Status: Proposed (2026-11-12)
Requirement: REQ-0021 (F-039). Builds on ADR 0017 (game roles, modes, lobby seats), ADR 0018 (the shared-group rule), ADR 0004 (calendar owns groups and lobbies).
Amends ADR 0017 section 6 (write transaction, one more step: the cleanup of point 2; ADR 0017 carries a pointer to this ADR). Adds one table and two public routes to `calendar`, and optional fields to `Member` and `LobbyPlayer`. No new service, no new external dependency, no asynchronous communication.

## Context
- REQ-0021: a member records which game roles they play, one choice for all groups. Each game role is shown with its mode name. The choice (a) preselects the seat when the member joins a lobby with game roles, and (b) is shown to the members of the groups the member shares, the same rule as avatars (ADR 0018).
- Game roles, modes and their activities are owned by `calendar` (ADR 0017). Groups and memberships are owned by `calendar` (ADR 0003, ADR 0004). The lobby's seat copy (`lobby_role_slots`) is in `calendar` too.
- A member's identity reaches `calendar` as `X-User-Id` from the gateway (ADR 0002). `calendar` already stores `group_members.user_id` without a foreign key to `auth`.
- ADR 0017 section 6 writes a game's roles and modes by deleting all entries of the replaced owner and inserting them again with their IDs (`deleteGameRolesSQL`, `deleteGameModesSQL`, `writeTree` in `services/calendar/internal/infrastructure/postgres/games.go`). A game role's row is therefore deleted and re-created on every admin save, even when only a name changed. A foreign key with `ON DELETE CASCADE` would delete every choice for that role on each save. So the cascade cannot be used.
- Leaving a group deletes the member's upcoming `lobby_players` rows only (`deleteUpcomingPlayerSQL`). Past lobbies keep the rows of a former member, so a lobby view can show a player who is no longer in the group. The visibility rule must check current membership.
- The game list (`GET /api/games`) is for the system admin only. A member's account page therefore needs its own read of the games that have game roles.
- The API has a body size limit (`pkg/httpapi`, `MaxBodyBytes`), so an array of IDs in a request needs no separate limit.

## Decision

**1. Owner: `calendar`.** The choice refers to `game_roles.id`, and its visibility is decided by `group_members`. Both are in `calendar`'s database. Storing it in `auth` would need a copy of the game roles and of their removal in `auth`, and `auth` would depend on the game list. That is the coupling that ADR 0018 avoided for avatars. In `calendar`, every rule is one query on local tables, with no call to another service.

**2. Table, and how a removed role takes its choices with it.** Migration `0008_preferred_game_roles.sql` in `services/calendar/migrations`:

```sql
-- +goose Up
CREATE TABLE preferred_game_roles (
    user_id      uuid NOT NULL,
    game_role_id uuid NOT NULL,
    PRIMARY KEY (user_id, game_role_id)
);
CREATE INDEX preferred_game_roles_game_role_id_idx ON preferred_game_roles (game_role_id);

-- +goose Down
DROP TABLE preferred_game_roles;
```

- No foreign key to `game_roles`. Reason: ADR 0017 section 6 deletes and re-inserts the roles on each admin save. A foreign key (with or without cascade) would either wipe the choices or block the save. Removing the foreign key is the smallest safe change. The other option, changing section 6 to update kept roles in place, is rejected: section 6 deletes first on purpose, so that a swap of two names never meets the unique index, and in-place updates would need a two-step rename. That is more code in the admin write, which ADR 0017 has already settled.
- Cleanup step, in the same transaction as every admin write that can remove a game role. Placement: in `writeTree` (`services/calendar/internal/infrastructure/postgres/games.go`), at the end of the function, after the `gameRoles` and `modes` branches and after the inserts. It is not inside the `gameRoles != nil` branch: a `modes` replace with `gameRoles` nil deletes the modes, and their roles cascade, so the cleanup must run then too. It runs every time `writeTree` runs; when nothing was deleted it removes nothing. The game delete (`deleteGameSQL`) runs the same statement in its transaction.
- The statement: `DELETE FROM preferred_game_roles WHERE NOT EXISTS (SELECT 1 FROM game_roles gr WHERE gr.id = preferred_game_roles.game_role_id)`. It removes the choices of every role that no longer exists, including roles removed by a mode delete or a game delete, and the choices of roles that were not re-inserted. A kept role (same `id`) keeps its choices.
- Concurrency with `Replace` (point 5): an admin delete of a role that a save names waits until the save commits, and the cleanup then sees and removes the new choice. A role that the admin removed first gives `invalid_game_role`.
- `shortcut: the cleanup scans the whole choices table, fine while it holds a few rows per member, upgrade to a scan by game when it grows.`
- `user_id` has no foreign key, as in `group_members`. `auth` owns users.
- No ordering column. The member's order is the lobby's seat order (point 6), so there is nothing to store.
- Rollback: run the down migration (`DROP TABLE`), revert the code. The choices are lost. The new fields are optional and the frontend calls the new routes only from the new screens.
- The rule "effective game role" (ADR 0017 section 2: a role of a mode, or a game-level role of a game with no modes) exists twice: as a domain function, and as one SQL condition constant in the postgres adapter. An integration test runs both on the same fixtures (a game with modes, a game without modes, a game-level role of a game with modes) and asserts the same answer.

**Hidden choices.** A game-level role of a game with modes is not effective (ADR 0017 section 2). Its choice is stored but is never returned, never offered and never counted.
- Reads (`Choices`, `ForMembers`, `ForLobbyPlayers`) join `game_roles` and apply the effective rule, so a hidden choice is never shown.
- A save (`Replace`) deletes all rows of the member and inserts the effective roles named in the request. Hidden rows are therefore dropped at the member's next save. A choice saved while the game had no modes is kept until then, and applies again if the last mode is removed before that save. The member cannot see or save a hidden choice, so the save does not keep it.

**3. Reads and writes.** Calendar application use cases, with the port `PreferredGameRoleRepository` defined in `application` and implemented by the postgres adapter:
- `Choices(ctx, userID)`: the caller's effective `gameRoleIds`, and the `games` that have at least one effective game role. The `games` come from the existing game tree reader of the game list (ADR 0017), filtered in the domain. No new game query.
- `Replace(ctx, userID, gameRoleIDs)`: one transaction, see point 4.
- `ForMembers(ctx, groupID)`: the choices of all current members of the group, for `getGroup`.
- `ForLobbyPlayers(ctx, lobbyID)`: the choices of the players of the lobby, for the lobby's game (all its modes), only for players who are current members of the lobby's group. A lobby with no game gives none.

Each returns `PreferredGameRole` rows: `gameRoleId`, `name`, `gameName`, `modeName` (null for a game role of a game with no mode). Order: game name ignoring case, then mode order, then role order, as entered by the system admin.

`getGroup` and `getLobby` run the read as a second query in the same read transaction as their existing query. The existing member and player queries are not changed. Both reads already run after the membership check, so the caller is a member of the group.

**4. Permission order and error codes.**

`GET /api/users/me/preferred-game-roles` (operation `getPreferredGameRoles`):
1. No valid session or `X-User-Id` missing: `unauthenticated` (401), as on all routes.
2. Read the choices of the caller. No other check: any signed-in person may record their own choices. No membership and no system admin is needed.

`PUT /api/users/me/preferred-game-roles` (operation `replacePreferredGameRoles`), body `{gameRoleIds: uuid[]}`. An empty array clears the choices.
1. `unauthenticated` (401), as above.
2. `invalid_request` (400): invalid JSON, a wrong JSON type, or the same ID twice in `gameRoleIds`. The repeated-ID rule is the one of ADR 0017 section 6, step 2 ("Two entries with the same `id` in one request give `invalid_request`"). Checked before any database access.
3. `invalid_game_role` (400): an entry that is not a UUID, or a UUID that is not an effective game role of an existing game. Checked inside the transaction (point 5), so a role removed a moment ago gives the same answer. The client reloads the list and shows the message.
4. Write. Success is 200 with the stored choices in the `GET` shape (the saved state, so the client needs no second call).

No `not_allowed` exists here: the rule is "own data only", and the path has no other person's ID.

**5. Transaction of `Replace`.**
1. `SELECT pg_advisory_xact_lock(hashtext($1::text))` with the caller's ID. Two saves of the same person run one after the other. Without it, two concurrent saves insert the same rows and one gets a unique violation (SQLSTATE 23505), which would be a 500. The lock is transaction-scoped and is released on commit or rollback. `hashtext` returns 32 bits, so two different people can share a lock. That only makes two unrelated saves run one after the other, which is harmless.
2. Lock the games of the named roles, in ID order: `SELECT id FROM games WHERE id IN (SELECT game_id FROM game_roles WHERE id = ANY($2)) ORDER BY id FOR SHARE`.
3. Lock the named roles: `SELECT id FROM game_roles WHERE id = ANY($2) AND <effective game role> FOR SHARE`. The number of rows must equal the number of IDs, otherwise the transaction rolls back and the answer is `invalid_game_role`.
4. `DELETE FROM preferred_game_roles WHERE user_id = $1`, then `INSERT INTO preferred_game_roles (user_id, game_role_id)` for the rows of step 3. No foreign key is used (point 2), so there is no 23503 translation. The INSERT relies on the `FOR SHARE` locks of steps 2 and 3 being held until commit: an admin write cannot delete a role between the check and the commit.

**Lock order and why there is no deadlock.** An admin write takes `FOR UPDATE` on the game's row first (ADR 0017 section 6), and only then deletes or re-inserts roles. `Replace` takes its locks in the same order: the games (step 2), then the roles (step 3). Both sides take the game locks before the role locks, and the games in ascending ID order, so two `Replace` calls over overlapping games cannot wait on each other in a cycle. An admin write waits for a `Replace` that holds the game lock, and a `Replace` never waits for the admin write once it holds the game lock. The advisory lock of step 1 is taken before both and is never taken by the admin write, so it adds no cycle.

Two saves of the same person in sequence or in parallel: both return 200, and the stored state equals the input of the one that commits last. Each save is a complete replacement, so the final state equals one of the two inputs.

**6. Visibility (REQ-0021 option (b)) is the group view's own rule.** There is no separate read endpoint for another person's choices. Their choices appear only where the viewer already sees that person:
- `Member.preferredGameRoles` in `GET /api/groups/{groupId}`: the members of the viewed group. The viewer is a member of that group (`group_not_found` otherwise), so the owner and the viewer share a group.
- `LobbyPlayer.preferredGameRoles` in `GET /api/groups/{groupId}/lobbies/{lobbyId}`: the lobby's game, and only players who are current members of the lobby's group (`EXISTS` on `group_members`, the same rule as ADR 0018's `hasAvatar`). This hides a former member who still has a row in a past lobby.

Why no separate endpoint: a separate `GET /api/users/{userId}/preferred-game-roles` would need its own shared-group check, one more call per member, and the page would call it for every row. The group views already have the membership check. The avatar needed a route only because it is binary and has its own cache rules (ADR 0018).

Field shape (both `Member` and `LobbyPlayer`, added to `api/calendar/openapi.yaml`): `preferredGameRoles`, an array of `PreferredGameRole`, `x-omitempty: false`, and not in `required`, so that existing fixtures stay valid. The server always sends it, as `gameRoleId` on `LobbyPlayer` already is (ADR 0017).

**7. Join preselection: on the client, from data the client already has.** The server does not preselect. `joinLobby` keeps its rules of ADR 0017, so a join with no seat still gives `invalid_game_role` for a lobby with roles. The preselection is a screen rule:
- Input: the lobby's role slots (`roleSlots`, in the lobby's order, from `GET .../lobbies/{lobbyId}`), the caller's `gameRoleIds` (from `GET /api/users/me/preferred-game-roles`, which the frontend keeps in its query cache), and whether the caller is already a player.
- Rule: if the caller is not a player of the lobby, the seat is the first slot whose `gameRoleId` is in `gameRoleIds` and whose `playerCount` is below `slots`. Otherwise nothing is preselected (Flex is not preselected). A caller who is already a player sees the current seat, as today.
- Nothing is saved. A seat the member picks instead is used.
- Why client-side: the lobby detail already carries the slot counts, and the join form already uses them. The choices are read once per session and cached. A server-side preselection would need a per-caller field in `Lobby`, which every lobby list would then carry. Calls on join: the same as today, plus one cached read per session.

**8. Routes.** The gateway route table (`services/gateway/internal/transport/router.go`) gets two entries with `session: true`, both to `calendar`. They are added in PR1 with the contract, because the gateway route contract test requires a row for every contract operation; the calendar handlers answer 500 until PR2. Calendar's `/api/users/{userId}/avatar` (ADR 0018) has a different number of segments, so there is no conflict with `me`.

**9. Terms.** "Preferred game role" (table `preferred_game_roles`, field `preferredGameRoles`, request field `gameRoleIds`) is added to the glossary in `CLAUDE.md`. Avoid: favourite role, main role, class, preferred role on its own. "Game role" stays the term for the game's role (ADR 0017).

**10. Security.** The choices are personal data. They are served only to the owner and to members of a shared group, as in point 6. They are never written to the logs, and the request body is not logged. No new secret, no new environment variable, no new container, no new network.

## Consequences
- A former member's choice is not shown in past lobbies (point 6), and is not shown in the member list after leaving (the row is not in the group's members).
- A choice for a game-level role of a game with modes is hidden until the last mode is removed, or until the member next saves (point 2).
- Each admin save that can remove a role runs one more statement in its transaction, over the whole choices table.
- One more read in `getGroup` and in the lobby detail. Both are one indexed query on `preferred_game_roles` joined to `game_roles`. A group of 15 with a few choices each is a few dozen rows.
- The account page reads the game tree of all games with game roles. A signed-in person can then see games outside their groups (question 1).
- If a person is ever deleted, their rows must be deleted with them. No person deletion exists today (the same state as `group_members`), so no rule is coded now.
- `calendar` gets one table and two routes. The services map and the contract are updated (see the PR plan).
- `shortcut: no cache of the game tree for the account page, upgrade with the existing game list cache if the Pi shows load`.

## Delivery in small PRs
Build starts after REQ-0020 (the account section of the You page) is merged, for PR4. PR1 to PR3 do not depend on it.

| PR | Scope | Owner | Needs |
|---|---|---|---|
| 1 | Contract and generated code together. `api/calendar/openapi.yaml`: operations `getPreferredGameRoles` and `replacePreferredGameRoles` (path `/api/users/me/preferred-game-roles`), schemas `PreferredGameRoleChoices` (`gameRoleIds` required, `games` required), `SetPreferredGameRolesRequest` (`gameRoleIds` required), `PreferredGameRole` (`gameRoleId`, `name`, `gameName`, `modeName` nullable), and the optional `preferredGameRoles` on `Member` and `LobbyPlayer`. Error codes `invalid_request` and `invalid_game_role` already exist. Generated Go code and `frontend/src/api/gen/calendar.ts`. Services map: the two route rows. The two gateway route rows with `session: true` (the gateway route contract test requires a row for every contract operation; the handlers answer 500 until PR2). | backend-expert | none |
| 2 | Backend, own choices. Migration `0008` (up, down, integration test that the table exists and the down migration drops it). Port, postgres adapter, use cases `Choices` and `Replace` with the lock order of point 5 (advisory lock, games `FOR SHARE` in ID order, roles `FOR SHARE`), the transport handlers, . The cleanup statement at the end of `writeTree` (every run, not inside a branch) and in the game delete, in ADR 0017's transaction. ADR 0017 amendment pointer. Tests below. | backend-expert | PR1 |
| 3 | Backend, visibility: `ForMembers` in `getGroup`, `ForLobbyPlayers` in `getLobby`. Tests: a member sees the choices of other members of the group; a former member's row in a past lobby is not shown; a player of another game is not shown; an open lobby gives `[]`; a member of another group is not shown; a hidden choice (game-level role of a game with modes) is not shown. Contract tests with the generated types. | backend-expert | PR2 |
| 4 | UI, account section on the You page (REQ-0020): each game with game roles, its roles with the mode name, one check box per role, save. Uses `GET` and `PUT`. An `invalid_game_role` response shows the message and reloads the list. Tests: a game without roles is not shown; the mode name is shown; save and reload; the error message and the reload. | ui-ux-expert | PR2, REQ-0020 merged |
| 5 | UI, use: the join form preselects the seat by the rule of point 7 (tests: first preferred with a free slot in lobby order; none free gives nothing; a player already joined sees the current seat; a chosen seat is not replaced). The choices are shown as text next to the name in the member list and the lobby player list, in the places of ADR 0018 point 5. | ui-ux-expert | PR3, PR4 |

PR2 tests (backend-expert), all integration tests against PostgreSQL unless named otherwise:
- Rename a role, save the game again through the admin write, and read the member's choices: the choice stays.
- Remove a role through the admin write: the choice goes, and no row for the removed role is left (the cleanup).
- Remove a mode: the choices of its roles go. Delete a game: the choices of its roles go.
- Save a game that keeps all roles but whose modes are re-created: the choices of kept role IDs stay.
- Two concurrent `PUT`s of the same person with different inputs: both return 200 and the final state equals one of the two inputs (the advisory lock).
- A `PUT` racing an admin delete of a chosen role: either the `PUT` returns `invalid_game_role` (also allowed for a role that the admin kept, if the admin's re-insert is not yet visible to the `PUT`), or the choice is removed afterwards. No row for a removed role remains.
- Two overlapping writes in both orders, each over the same two games: (1) a `PUT` naming roles of games A and B, and an admin save of game B that keeps its roles, started while the `PUT` holds its locks; (2) the same, with the admin save started first. In both orders both transactions finish with no deadlock error (SQLSTATE 40P01), and the final state is consistent (no row for a removed role).
- The effective-rule parity test (point 2): the domain function and the SQL condition give the same answer on the same fixtures.
- Unit tests: an empty array clears; a repeated ID gives `invalid_request`; an unknown ID and a non-UUID give `invalid_game_role`; a game-level role of a game with modes gives `invalid_game_role`; a signed-in non-member can save and read their own choices.

DevOps: none. The migration runs in the existing `calendar_migrate` job. No container, environment variable or network changes.

Each PR keeps the earlier behavior: the new fields are optional and the old screens ignore them.

## Not built now (YAGNI)
- An order of the member's own choices (the lobby order is used).
- Suggesting a game role to a member or to a group (REQ-0021 out of scope, REQ-0011 forbids it).
- A limit on how many game roles a member may choose (the body size limit is enough).
- A choice per group (REQ-0021 decides one for all groups).
- A separate endpoint for another person's choices.
- A server-side preselection, a cache of the game tree, and a change of the `Lobby` shape.
- Keeping hidden choices across saves (point 2 drops them).
- A person deletion rule (none exists yet).

## Alternatives considered
- **`ON DELETE CASCADE` on `game_role_id`.** Simplest, but ADR 0017 section 6 deletes and re-inserts every role on each admin save, so every save would wipe all choices for the game's roles. Rejected.
- **A foreign key without cascade.** The admin save would be blocked by its own delete of a referenced role, so the save would fail, unless the choices were deleted first, which loses them just the same. Rejected.
- **Change ADR 0017 section 6 to update kept roles in place (option (b)).** Keeps the foreign key and the cascade meaning, but the admin write must rename without hitting the unique indexes, which needs a two-step rename, and it reopens a decision that ADR 0017 settled. More code and more risk than the cleanup statement. Rejected for this change.
- **Store the choice in `auth`.** `auth` would need a copy of the game roles and their removal, and must not depend on the game list. A foreign key cannot cross databases, so the cleanup would have to be synchronized between services. Rejected.
- **A new service "preferences".** A new bounded capability with no own rules, and a second copy of membership. The change is one table in the service that owns the rules. Rejected (CLAUDE.md: better one service too few).
- **A separate read per member (`GET /api/users/{userId}/preferred-game-roles`).** One call per member on each page, and a second place that checks the shared-group rule. Rejected, see point 6.
- **A `preferredGameRoles` field on `UserRef`.** `UserRef` is used by the feed and by creators as well; the rule of point 6 applies only in group views, so the field would be sent where the check is not made. Rejected. Only `Member` and `LobbyPlayer` get it.
- **Server-side preselection in `joinLobby` (an absent seat means "my first preferred seat").** Changes the join contract that ADR 0017 fixed, makes an absent body mean two things, and hides the seat the member is taking. Rejected. The client shows the seat and the member can change it.
- **Preselect Flex when no preferred role is free.** The member would take a seat they did not choose. REQ-0021 says nothing is preselected in that case. Rejected.
- **A sort column on the choices.** The lobby order is the order that matters for the rule, so a second order would be unused code. Rejected (YAGNI).
- **Keep hidden choices across saves.** The client cannot send them, so the save would need a special merge rule for them. Rejected (point 2).

## Open questions for the user
Each question has the answer that the architect recommends. The design above uses the recommended answer.
1. **A signed-in person who is in no group sees the game catalogue.** The account page lists every game that has game roles, so a person sees games outside their groups. Recommended: yes, since the game names are not private and the account page is not tied to a group. Alternative: only the games of the groups the member is in (one extra query per group and a merge in the frontend). The recommendation is the smaller change.
2. **Are the lobby player choices shown for the lobby's game only, or only for the lobby's mode?** Recommended: the game (all its modes), with the mode name shown next to each role. The lobby has one game, and a choice for another mode of that game still says what the player plays. Filtering by the lobby's mode would hide that and add a rule. Alternative: only the roles of the lobby's mode.
3. **What happens when a member chose a game role that the admin removed?** Recommended: the choice is removed by the admin write, and nothing is shown or said. Alternative: keep a stale row and show it greyed out. That needs a second rule and is not recommended.
4. **A stale ID on save** (the admin removed the role while the member had the account page open). Recommended: `invalid_game_role`, the list reloads, and the member saves again. Alternative: drop the stale ID silently. Recommended against: a save that silently changes the input is harder to explain.
5. **A choice for a game role of a game with modes** is dropped at the member's next save, and is hidden until then. Recommended: accept this (point 2). Alternative: keep hidden rows across saves, which needs a merge rule in `Replace`.
6. **When no preferred role has a free slot**: nothing is preselected, as REQ-0021 says. Recommended: keep it. Alternative: preselect Flex. Recommended against, see the rejected alternatives.
7. **REQ-0020 dependency**: PR4 needs the account section of the You page. Recommended: merge REQ-0020 first. If it is not merged, PR4 waits; PR1 to PR3 are not blocked.

## Changes in other documents
- `docs/services.md`: calendar owns `preferred_game_roles`; the two routes in the route table; the ADR list of calendar gets 0022; the overview route prefix `/api/users*`.
- `CLAUDE.md`: glossary row "Preferred game role" (point 9).
- No change to `docs/product/`: REQ-0021 is the product owner's document.
