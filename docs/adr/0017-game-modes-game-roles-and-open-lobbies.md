# 0017. Game modes, game roles, named activities and open lobbies
Status: Accepted (2026-11-09)
Amends ADR 0004 (rule 6: lobby creation, game and mode optional; the value of a lobby is no longer fixed after creation for a mode change; rule 7: join order and seat checks), ADR 0006 (lobby tables and lobby writes), ADR 0010 (game list: default max and game roles are used only by games without modes).
Requirements: REQ-0011 (F-027, with its amendment of 2026-11-08) and REQ-0015 (F-033, F-034). Backlog A2 and A3, delivered together.

## Context
- The calendar service owns the game list (`games`), lobbies (`lobbies`) and players (`lobby_players`). A lobby keeps its own copy of the game name and of max players, so a change in the game list does not change existing lobbies (ADR 0010, ADR 0006). The genre is read live from the game (ADR 0016).
- REQ-0011 adds game roles with slots, and flex players who take a spot without a role. REQ-0015 adds game modes (each with game roles or a max players value), named activities of a mode, and lobbies without a game or without a mode. The user decided that max players changes after creation only through a mode change, and that game roles may sit on a mode.
- Both requirements change the game form, the lobby data and the join rules. One design covers both, so that no game role is built on the game and then moved to a mode.

## Decision

### 1. Owned data (calendar, database `calendar`)
No new service and no new external dependency. Every new table has `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, except `lobby_role_slots`, whose primary key is composite (the exception, see below). Names use the trimmed form and the same CHECK as `games.name` (no leading or trailing whitespace).

Game list (maintained by the system admin):

| Table | Columns and rules |
|---|---|
| `game_modes` (new) | `game_id` → `games` ON DELETE CASCADE. `name` 1–50 characters. `max_players` integer NOT NULL, 1–2147483647; for a mode with game roles it is the sum of their slots. `sort_order` integer (order as entered). Unique index `game_modes_game_name_key` on `(game_id, lower(name))`. Unique index `game_modes_id_game_id_key` on `(id, game_id)`, the target of the composite FK below. |
| `game_roles` (new) | `game_id` → `games` ON DELETE CASCADE. `game_mode_id` nullable; composite FK `(game_mode_id, game_id)` → `game_modes (id, game_id)` ON DELETE CASCADE. `name` 1–30 characters. `slots` integer, at least 1. `sort_order`. The owner is the game when `game_mode_id` is NULL, otherwise the mode. Two partial unique indexes: `game_roles_game_name_key` on `(game_id, lower(name)) WHERE game_mode_id IS NULL` and `game_roles_mode_name_key` on `(game_mode_id, lower(name)) WHERE game_mode_id IS NOT NULL`. |
| `activities` (new) | `game_mode_id` → `game_modes` ON DELETE CASCADE. `name` 1–50 characters. `sort_order`. Unique index `activities_mode_name_key` on `(game_mode_id, lower(name))`. One activity belongs to exactly one mode. |
| `games` (unchanged columns) | `default_max_players` and the game-level `game_roles` rows are kept while the game has modes, and are not used then. When the last mode is removed they apply again (DECISION, user, 2026-11-08; see section 2). |

Lobbies (existing tables changed by migration 0007):

| Table | Change |
|---|---|
| `lobbies` | `game_name` becomes nullable: NULL means the lobby has no game. `game_id` stays without FK (ADR 0010). New columns, all nullable and without FK, the same pattern as `game_id`: `game_mode_id` uuid, `mode_name` text (copy), `activity_id` uuid, `activity_name` text (copy). |
| `lobby_role_slots` (new) | `lobby_id` → `lobbies` ON DELETE CASCADE. `game_role_id` uuid, no FK: the game role may be renamed or removed, and this ID is its identity in the lobby. `name` text (copy, 1–30). `slots` integer, at least 1. `sort_order`. Primary key `(lobby_id, game_role_id)`, the only composite primary key of the change: the pair is the identity of a role in a lobby. Only roles with slots of at least 1 are stored. A lobby has game roles if and only if it has rows here. |
| `lobby_players` | New `game_role_id` uuid, nullable. Composite FK `(lobby_id, game_role_id)` → `lobby_role_slots (lobby_id, game_role_id)` ON DELETE SET NULL (game_role_id). NULL means flex. |

CHECK constraints on `lobbies` (safety net, the rules are in the domain):
- `game_name` is NULL or passes today's name check. The inline check `lobbies_game_name_check` is replaced.
- `mode_name` and `activity_name` are NULL or pass the name check (trimmed, 1–50 characters), named `lobbies_mode_name_check` and `lobbies_activity_name_check`.
- `game_id IS NULL OR game_name IS NOT NULL`.
- `game_mode_id IS NULL OR game_id IS NOT NULL`.
- `(game_mode_id IS NULL) = (mode_name IS NULL)` and `(activity_id IS NULL) = (activity_name IS NULL)`.
- `activity_id IS NULL OR game_mode_id IS NOT NULL`.

The database cannot check these; the domain checks them and its tests cover them: `max_players` equals the sum of the slots for a lobby or mode with game roles; an activity belongs to the lobby's mode; a mode without game roles has a max players value; a game without modes and with game roles stores the sum of its roles as its default max.

The FK `ON DELETE SET NULL` is the rule "every player becomes flex when the mode changes": the application deletes the lobby's `lobby_role_slots` rows, and the database clears the players' game roles. Removing a lobby removes its role slots and players in the same way.

Derived states (not stored):
- Open lobby (REQ-0015): `game_mode_id IS NULL`.
- No game, shown as "Open": `game_name IS NULL`.
- "Other": `game_id IS NULL AND game_name IS NOT NULL` (the free-text name; no mode, no game roles).
- Lobby with game roles: `lobby_role_slots` has rows.

### 2. Game roles on a game or on a mode
- A game without modes has its game roles on the game (`game_mode_id` NULL).
- A game with modes has its game roles on its modes. The game's own default max and game roles are kept in storage but not used and not offered in the admin form. When the last mode is removed, they apply again to new lobbies (DECISION, user, 2026-11-08).
- Role names are unique per owner (the game, or the mode), ignoring case and surrounding spaces. This is the rule of the REQ-0011 amendment of 2026-11-08 (names are unique per owner: per mode for a role on a mode, per game for a role on a game without modes); DECISION, user, 2026-11-08. The product owner writes that amendment in REQ-0011; this ADR does not change `docs/product`.
- A lobby copies its role slots from the owner: from the mode when the lobby has a mode, else from the game when the game has no modes. The lobby keeps the copy, so a rename or removal of a role does not change the lobby (REQ-0011). The identity `game_role_id` is the same as the game role's `id`.

### 3. How a lobby references game, mode and activity
- Game: `game_id` and the copy `game_name`. Set at creation, or later for a lobby without a game (PR6). Once set it does not change (REQ-0015).
- Mode: `game_mode_id` and the copy `mode_name`. Max players and role slots are taken from the mode when the mode is set. A mode change replaces them.
- Activity: `activity_id` and the copy `activity_name`. It belongs to the lobby's mode. A mode change clears it. It can be cleared on its own.
- Max players of the lobby is its own column (existing), as before. For a lobby with game roles it is the sum of the role slots.

### 4. Labels (frontend only, no API field)
One rule, implemented once in the frontend and used by every lobby view (lists, Next up, This week, week view block, lobby page):
- If `gameName` is null, the label is "Open".
- Otherwise the label is `gameName`, then `modeName` and `activityName` where set, joined with " › ". "Other" has no mode, so its label is its free-text name.

The label is text and is never only a color (REQ-0014). The backend has no label field. The separator and the "Open" wording are set by REQ-0015 as examples; the UI expert's text catalog holds the copy.

### 5. Where validation happens
- Domain (`services/calendar/internal/domain`): all rules about names, slots, capacity, the game, mode and activity relation, the roles of an owner, the seat choice (game role or flex), the join checks and the mode-change checks. Pure functions with unit tests. The sum of slots and the capacity check (`validCapacity`) are each written once and reused for games, modes and lobbies.
- Application: order of checks (ADR 0001), the group lock (ADR 0006), the reads that the checks need (section 10), and the comparison of `currentModeId`.
- Transport: JSON shape, UUID form in paths and body, body size. No business rule.
- Database: the constraints of section 1 as safety net. A unique violation is translated by constraint name, not only by SQLSTATE 23505: `games_name_lower_key` gives `game_taken`, `game_modes_game_name_key` gives `mode_taken`, `activities_mode_name_key` gives `activity_taken`, `game_roles_game_name_key` and `game_roles_mode_name_key` give `game_role_taken`.

### 6. Game list rules (system admin)
`POST /api/games` and `PUT /api/games/{gameId}` accept two optional arrays: `gameRoles` (game-level roles) and `modes`.

Omitted or `null` arrays and arrays given:
- Omitted or `null` leaves the stored modes or game-level roles unchanged. The existing admin page sends neither, so it cannot remove them. This differs from `genre` (an omitted genre means none, ADR 0016), because the existing page does not know these fields and must not remove data it cannot see.
- An empty array removes all entries of that owner.
- An array with entries replaces the owner's entries (replace semantics). An entry with `id` keeps that identity, so a rename keeps the link that lobbies have by ID. An entry without `id` gets a new one. The order of the array is kept as `sort_order`.

Write order and identity checks (one transaction; `SELECT ... FOR UPDATE` on the game's row first, which serializes admin writes to the same game):
1. Read the current IDs of this game with their owner (the game, or a mode).
2. Every given `id` must be a current ID of the same owner: a mode ID for `modes`, a game-level role ID for `gameRoles`, a role ID for the roles of that same mode. Otherwise `invalid_request`. Two entries with the same `id` in one request give `invalid_request`.
3. Delete the entries of the replaced owners. Deleting a mode cascades its roles and activities. Lobbies are not touched (no FK).
4. Insert every entry, with its given `id` or a new one.

Deleting before inserting means that a swap of two names in one request never meets the unique indexes in an intermediate state.

Amendment 2026-11-12 (ADR 0022): the write has one more step after step 4. It deletes the preferred game roles (ADR 0022) of every game role that no longer exists. It runs at the end of the tree write, every time the tree is written, and in the game delete. Lobbies and their copies are still not touched.

Rules for values, in this order after the existing checks (`invalid_request`, `not_allowed`, `invalid_game`, `invalid_capacity`, `invalid_genre`):
- Game without modes with game roles: `defaultMaxPlayers` is omitted or `null`, or equal to the sum of the game's role slots. The sum is stored as the game's default max. Any other value gives `invalid_capacity`. The equal-sum rule keeps the existing admin page working: it sends the value it read (the sum, for a game with roles) when only the name changes. A game without modes and without roles keeps the existing rule for `defaultMaxPlayers`. Test in PR2: a rename of a game with roles, sending the old sum, succeeds; a different value gives `invalid_capacity`.
- Game with modes: `defaultMaxPlayers`, the game-level roles and the modes are stored as sent; the game's own default and roles are not used (section 2).
- Mode: `maxPlayers` is omitted or `null` when the mode has game roles (the sum is stored). Without game roles it is required, 1–2147483647 (a mode is never unlimited; DECISION, user, 2026-11-08). Both a game-role list and a `maxPlayers` value give `invalid_capacity`.
- Game role: name 1–30 characters after trim (`invalid_game_role`), slots an integer of at least 1 (`invalid_capacity`), and the sum of a mode's or game's slots within the capacity (`invalid_capacity`).
- Activity: name 1–50 characters after trim (`invalid_activity`).
- Mode name 1–50 characters after trim (`invalid_mode`).
- Then `game_not_found` for the path, then the conflicts `game_taken`, `mode_taken`, `game_role_taken`, `activity_taken` (raised by the unique indexes).
- "Other" stays reserved and gets no modes (ADR 0010, REQ-0015).

### 7. Creating a lobby
Check order: shape (`invalid_request`), membership (`group_not_found`), time rules (as today), game, mode, activity, roles and max players, seat.

Snapshot before the lock: the game tree (game, modes, roles, activities) that a create request names is read before the group lock, as ADR 0010 does for the game list. A create does not hold a second connection while it waits for the lock (ADR 0006). The membership, the time rules and the insert are checked and written under the lock, as today. A mode deleted between the snapshot and the lock still gives a lobby with the copied values; this is the same ordering as for a game (ADR 0010).

Game, mode, activity:
- Game: `gameId` or `customGameName`. PR3: exactly one (as today). PR6: at most one; neither means an open lobby with no game. An unknown `gameId` gives `invalid_game`.
- Mode `modeId` needs `gameId`. A mode that is not of the chosen game gives `invalid_mode`. With `customGameName` (including "Other") a `modeId` also gives `invalid_mode`; this follows from the list, since "Other" is not in the game list.
- Activity `activityId` needs `modeId`. An activity that is not of that mode gives `invalid_activity`.

Roles and max players:
- The owner of the roles is the mode if given; otherwise the game if the game has no modes; otherwise there are no roles. A game with modes and no mode is a lobby without roles.
- `roleSlots` (optional, array of `{gameRoleId, slots}`). Omitted means the owner's own slots. Each `gameRoleId` must be a role of the owner, with no duplicates, else `invalid_game_role`. Roles not listed count as 0. `slots` is an integer of at least 0; below 0 or above 2147483647 gives `invalid_capacity`. The sum must be at least 1 and within the capacity, else `invalid_capacity` (the "all slots 0" rule of REQ-0011). Roles with 0 are not stored. `roleSlots` given for an owner without roles gives `invalid_game_role`.
- With roles: `maxPlayers` must be omitted or `null`, because the sum is used. Otherwise `invalid_capacity`.
- A mode without roles: `maxPlayers` is required, 1–2147483647, otherwise `invalid_capacity` (DECISION, user, 2026-11-08: a mode is never unlimited, so a cleared value is refused). The frontend prefills it from the mode.
- Open lobby or game without modes: `maxPlayers` is optional; `null` means unlimited (as today, REQ-0015 and DECISION, user, 2026-11-08).

Seat (see section 8). The creator is the first player and must choose a seat when the lobby has roles.

### 8. Seat: game role or flex
The seat is given as `gameRoleId` (uuid) or as `flex: true`. This applies to create and to join. Seat is the term of the glossary (CLAUDE.md).
- A lobby with roles needs exactly one of them. A lobby without roles needs neither.
- `flex: false` counts as not given.
- A `gameRoleId` that is not a role of this lobby, or any seat value that does not fit the lobby, gives `invalid_game_role`.

### 9. Join and change of seat (`PUT .../players/me`)
Checks under the group lock, in this order:
1. The lobby is missing: `lobby_not_found`.
2. The end time has passed: `lobby_has_ended`, also for a player (REQ-0005).
3. The seat does not fit the lobby: `invalid_game_role`.
4. The caller is a player and the seat is the same: 204, nothing changes, even when the lobby is full.
5. The caller is not yet a player: if the total is reached, `lobby_full`; then, for a role, if it has no free slot, `game_role_full`. Flex only needs a free total spot.
6. The caller is a player with another seat: a role target without a free slot (not counting the caller) gives `game_role_full`. Moving to flex is always allowed. The total does not change, so `lobby_full` is not checked.

Leaving (`DELETE .../players/me`) is unchanged.

ASSUMPTION (REQ-0011, stands unless overruled): a player may change the seat while the lobby can still be joined (until its end time). Leaving always works.

### 10. Changing game, mode and activity after creation
Four endpoints: `PUT .../lobbies/{lobbyId}/game`, `PUT .../lobbies/{lobbyId}/mode`, `PUT .../lobbies/{lobbyId}/activity`, `DELETE .../lobbies/{lobbyId}/activity`. All return `200 Lobby` (Amendment 2026-11-09).

Each endpoint runs in one transaction under the group lock (ADR 0006). Every value and every state that it checks is read inside that transaction, after the lock is taken, on the same connection. No mode, activity or limit is taken from a read made before the lock.

Check order: path form and body shape (`invalid_request`, and the not-found code of an invalid path ID), membership (`group_not_found`), the lobby exists in this group (`lobby_not_found`), the lobby has not ended (`lobby_has_ended`), the caller is a player of the lobby (`not_allowed`), the values (`invalid_game`, `invalid_mode`, `invalid_activity`), then the state (`lobby_game_set`, `lobby_changed`, `lobby_has_more_players`).

Inside the transaction the code reads: the lobby row (`game_id`, `game_name`, `game_mode_id`, `activity_id`, `ends_at`, `max_players`), the caller's player row, the player count, and the game's mode (with its game roles) or the activity by ID. Limits and role slots that are copied are taken from these reads.

- `PUT .../game`, body `{gameId}`. Allowed only if the lobby has no game (`game_id` and `game_name` NULL). Otherwise `lobby_game_set`, including for "Other". Sets `game_id` and `game_name` from the game read in the transaction. Max players does not change (DECISION, user, 2026-11-08). No role slots are created: the lobby has no mode, and a game change never creates role slots (a game with game roles gives its roles only through a mode, or at creation of a lobby without modes).
- `PUT .../mode`, body `{modeId, currentModeId}`. `currentModeId` is the mode the caller saw (`null` for none). The mode must belong to the locked lobby's game (`game_modes.game_id` equals the lobby's `game_id`), else `invalid_mode`; a lobby without a game refuses every mode. If the lobby's current mode is not `currentModeId`, `lobby_changed`. If `modeId` is the lobby's current mode, nothing changes. If the new limit (the sum of the mode's roles, or its max players) is below the number of players, `lobby_has_more_players` (DECISION, user, 2026-11-08). Otherwise, in the transaction: set `game_mode_id`, `mode_name` and `max_players` from the mode read; clear the activity; delete the lobby's `lobby_role_slots` rows and insert the mode's roles as copies. The players' game roles become NULL by the FK (every player is flex, DECISION, user, 2026-11-08). The total number of players does not change.
- `PUT .../activity`, body `{activityId}`. The activity must exist and its `game_mode_id` must equal the locked lobby's `game_mode_id`, else `invalid_activity`. A lobby without a mode refuses every activity. Sets `activity_id` and `activity_name`. Changes neither players nor limit.
- `DELETE .../activity`. Clears `activity_id` and `activity_name` and keeps the mode. Idempotent (DECISION, user, 2026-11-08, question 5).

Because each change reads the lobby's current mode under the lock, a concurrent mode change and activity change are always in one order: an activity set after a mode change is refused (`invalid_activity`), and an activity set before a mode change is cleared by it. The result never holds an activity of another mode.

Amendment 2026-11-09 (answer without player names). The answer is `Lobby`, not `LobbyDetail`: it is the lobby row as saved, read under the lock, with its counts, role slots and `joinedByMe`, the same shape as the answer of create. No player names are looked up, neither under the lock nor after the commit. Reason: a name lookup in auth after the commit would answer 503 to a saved change, which the contract forbids (`ServiceUnavailable`, ADR 0001). A lookup before the lock would miss players who join between the lookup and the lock. The client loads the player list with `GET .../lobbies/{lobbyId}`, as it does after a join (204). A 204 answer was rejected: it would force a second call for every change, where the new values are needed. These endpoints are new in PR3b, so no client depends on `players` in their answer.

### 11. Concurrency
- All lobby writes are under the group lock (ADR 0006): create, join, seat change, game, mode and activity changes, and leave. The leave takes the lock too.
- A seat change and a mode change serialize. A join for a role that a mode change has removed gives `invalid_game_role` after the change, or succeeds before it. No player status is saved for a role that the lobby no longer has (REQ-0015).
- Two mode changes at the same time: the group lock alone would let the second one win silently. The compare of `currentModeId` makes the second one fail with `lobby_changed` (REQ-0015: at most one change is saved).
- A mode change and an activity change at the same time: see the last paragraph of section 10.
- A player who leaves while one of their changes is in flight: the change and the leave serialize. If the leave is first, the change is refused with `not_allowed`; if the change is first, it is saved and the leave follows. No player row is created by a change.
- Two joins for the last spot or the last slot: the group lock and the counts under it (REQ-0005, REQ-0011).
- Admin writes to the game list: the game row lock of section 6 serializes two admin saves of the same game. A mode deleted by the admin concurrently with a lobby change is ordered before or after it; both orders are valid.

### 12. API changes (OpenAPI level)
Only additive changes to existing requests and responses. Paths and error codes of the calendar contract stay. New schemas and error codes are written in `api/calendar/openapi.yaml` in the PR that implements them (not here).

| Endpoint | Change | PR |
|---|---|---|
| `GET /api/games`, `GET /api/groups/{groupId}/games` | Response `Game` gains `gameRoles` (`GameRole[]`) and `modes` (`GameMode[]`). The group list is ordered as before. | PR2 |
| `POST /api/games`, `PUT /api/games/{gameId}` | Request gains `gameRoles` and `modes` (section 6). New error codes `invalid_mode`, `invalid_activity`, `invalid_game_role`, `mode_taken`, `activity_taken`, `game_role_taken`. Slot and mode-max errors use `invalid_capacity`. Replace semantics with omitted-means-unchanged. The admin page is not changed in PR2. | PR2 |
| `POST /api/groups/{groupId}/lobbies` | Request gains `modeId`, `activityId`, `roleSlots` (`RoleSlotInput[]`), `gameRoleId`, `flex`. `gameId` and `customGameName`: "exactly one" becomes "at most one" in PR6. New error codes `invalid_mode`, `invalid_activity`, `invalid_game_role`. | PR3a |
| `PUT .../lobbies/{lobbyId}/players/me` | Optional request body `{gameRoleId, flex}` (`JoinLobbyRequest`). A call without a body still works for lobbies without roles. New error codes `invalid_game_role`, `game_role_full`. | PR3a |
| `GET .../lobbies`, `GET .../lobbies/{lobbyId}` | `Lobby` gains `gameId`, `modeId`, `modeName`, `activityId`, `activityName`, `flexCount` (integer) and `roleSlots` (`RoleSlot[]`). `LobbyDetail.players` items gain `gameRoleId` (`LobbyPlayer`). `gameName` becomes nullable (PR6). | PR3a (`gameName` in PR6) |
| `PUT .../lobbies/{lobbyId}/mode` | New. Body `SetLobbyModeRequest`. Error codes `lobby_changed`, `lobby_has_more_players`, `invalid_mode`. | PR3b |
| `PUT .../lobbies/{lobbyId}/activity`, `DELETE .../lobbies/{lobbyId}/activity` | New. Body `SetLobbyActivityRequest` for PUT. Error code `invalid_activity`. | PR3b |
| `PUT .../lobbies/{lobbyId}/game` | New. Body `SetLobbyGameRequest`. Error code `lobby_game_set`; `invalid_game` as today. | PR6 |

New schemas:
- `GameRole`: `id` (uuid), `name` (1–30), `slots` (integer 1–2147483647).
- `GameRoleInput`: `id` (optional uuid), `name`, `slots`.
- `Activity`: `id`, `name` (1–50). `ActivityInput`: `id` (optional), `name`.
- `GameMode`: `id`, `name` (1–50), `maxPlayers` (the sum for a mode with roles), `gameRoles` (`GameRole[]`), `activities` (`Activity[]`). `GameModeInput`: `id` (optional), `name`, `maxPlayers` (optional), `gameRoles` (optional), `activities` (optional).
- `RoleSlot`: `gameRoleId`, `name`, `slots` (at least 1), `playerCount` (at least 0).
- `RoleSlotInput`: `gameRoleId`, `slots` (integer, at least 0).
- `LobbyPlayer`: `UserRef` plus `gameRoleId` (nullable; null means flex).
- `JoinLobbyRequest` (also the seat fields of `CreateLobbyRequest`): `gameRoleId` (uuid, optional), `flex` (boolean, optional). Rule: section 8.
- `SetLobbyGameRequest`: `gameId` (uuid, required).
- `SetLobbyModeRequest`: `modeId` (uuid, required), `currentModeId` (uuid, nullable, required).
- `SetLobbyActivityRequest`: `activityId` (uuid, required).

Required and optional:
- New request fields are optional. The fields of the new endpoints are required as stated above.
- New response fields (`Game.gameRoles`, `Game.modes`, `Lobby.gameId` and the other `Lobby` additions, `LobbyPlayer.gameRoleId`) are not in the `required` list of their schemas, although the server always sends them. Their descriptions say so. Reason: the backend PRs then add no required field to an existing response, so the frontend fixtures and generated types of the lobby and game screens need no change in those PRs. The architect decides in a later cleanup whether to make them required.
- `Lobby.gameName` stays in `required` and becomes nullable in PR6. Fixtures typed as `string` still compile; code that reads `gameName` as a string is changed in PR6.

Generated code: the PR that changes `api/calendar/openapi.yaml` regenerates both the Go server code (oapi-codegen) and the TypeScript types (`frontend/src/api/gen/calendar.ts`) in the same PR, and commits the output (ADR 0012). Nobody edits generated files by hand. This is a rule of the contract owner, not a UI change.

Wording of the bare word "activity": the revoke text in `api/calendar/openapi.yaml` (line 295, "The permission is checked before the activity"), its generated copy in `frontend/src/api/gen/calendar.ts` (line 140) and two comments in `services/calendar/internal/application/invite_links.go` (lines 128 and 162) use "activity" for the order of permission checks. PR2 rewords them to "the permission check" in the contract, regenerates the TypeScript output, and changes the two Go comments in the same PR.

### 13. Error codes (new)
The codes below enter the enum in `api/calendar/openapi.yaml` in the PR that uses them. In `docs/services.md` each one is marked "Planned, ADR 0017" until that PR, and the mark is removed in the same PR.

| Code | HTTP | Used when |
|---|---|---|
| `invalid_mode` | 400 | Game list: mode name invalid. Lobby: unknown `modeId`, a mode of another game, or a mode given for a lobby with no game (including "Other"). |
| `mode_taken` | 409 | Game list: mode name already used in the game, ignoring case. |
| `invalid_activity` | 400 | Game list: activity name invalid. Lobby: unknown `activityId`, an activity not of the lobby's mode, or a lobby with no mode. |
| `activity_taken` | 409 | Game list: activity name already used in the mode, ignoring case. |
| `invalid_game_role` | 400 | Game list: role name invalid (1–30 characters after trim). Lobby: unknown or malformed `gameRoleId`, duplicate in `roleSlots`, a seat missing or extra for the lobby's roles, roles given for a lobby without roles. |
| `game_role_taken` | 409 | Game list: role name already used by another role of the same owner, ignoring case. |
| `game_role_full` | 409 | The chosen game role has no free slot. |
| `lobby_game_set` | 409 | A game is set on the lobby already, including "Other". |
| `lobby_changed` | 409 | `currentModeId` is not the lobby's current mode, because another change was saved first. |
| `lobby_has_more_players` | 409 | The new mode's limit is below the number of players. |

Reused codes: `invalid_capacity` (max players, role slots, a sum of 0, `maxPlayers` given with roles, `defaultMaxPlayers` given with game roles), `lobby_full`, `lobby_has_ended`, `lobby_not_found`, `not_allowed`, `invalid_game`, `invalid_request`, `game_not_found`, `game_taken`.

### 14. Impact on existing endpoints and the frontend
- Existing clients keep working: no existing field changes its meaning or type, except `Lobby.gameName` in PR6 (section 12).
- `PUT /api/games/{gameId}` keeps the modes and game roles of a game when the request omits them (section 6). The existing admin page therefore cannot remove modes by accident.
- Frontend fixtures: the lobby and game fixtures in about 17 frontend files do not need a change in PR2 and PR3a, because the new response fields are optional. PR5 and PR6 update fixtures where the tests cover the new behavior.
- Data: no backfill. Existing lobbies have no mode and no role slots, and keep their game. Existing games keep their default max.

### 15. Delivery in small PRs
Each PR keeps `main` working. The reviewer reviews the whole change once (CLAUDE.md step 5), and the approved change is then cut into the PRs below in this order.

| PR | Scope | Owner | Needs |
|---|---|---|---|
| PR1 | Migrations `0006_game_modes_roles_activities.sql` and `0007_lobby_modes_roles.sql`, with up and down, and an integration test for up, down and the CHECKs. No code path uses the new tables, so behavior is unchanged. | backend-expert | none |
| PR2 | Contract for the game list (section 12 rows 1–2). Domain rules of section 6, including the write order and identity checks. Store, translation by constraint name, generated Go and TypeScript output. Rewording of the bare "activity" (section 12). The admin UI is not changed. | backend-expert | PR1 |
| PR3a | Create lobby with `modeId`, `activityId`, `roleSlots` and seat (pre-lock snapshot, section 7); join with seat; `Lobby` and `LobbyDetail` fields. | backend-expert | PR2 |
| PR3b | `PUT .../mode`, `PUT` and `DELETE .../activity` as in section 10, in one transaction under the group lock, with the compare of `currentModeId`. | backend-expert | PR3a |
| PR4 | Admin game form: modes, game roles on a mode or on the game, activities, default max hidden when the game has modes. Sends the arrays it shows. Confirmation before removing a mode or activity (REQ-0015, line 30, a UI-only criterion). | ui-ux-expert | PR2 (can run in parallel with PR3) |
| PR5 | Create form (game, mode, activity, role slots, seat). Join with game role or flex. Role and flex display in lists and on the lobby page. Mode and activity change on the lobby page. The label rule of section 4, including truncation in the week view block (REQ-0015, line 88, UI-only). | ui-ux-expert | PR3b and PR4 |
| PR6 | `gameName` nullable. Create without a game, `PUT .../game`, "Open" label, neutral theme for a lobby without a game. Backend and frontend changes in one PR, because the generated TypeScript type changes. The "most used first" exclusion of lobbies without a game (REQ-0015, line 51) is backend behavior: the count joins by `game_id`, so an open lobby is not counted; the PR adds a test. | backend-expert with ui-ux-expert | PR5 |

Tests per PR:
- Domain unit tests for each rule of sections 6 to 10.
- Integration tests (PostgreSQL, build tag `integration`) for the constraints, the FK SET NULL on mode change, the translation of unique violations by constraint name, and the replace write order (a name swap in one request succeeds; duplicate IDs and foreign IDs give `invalid_request`).
- Concurrency tests (named, PR3b unless stated):
  - `TestPutModeRacesPutActivity`: both orders end with an activity that is NULL or belongs to the final mode; never 500.
  - `TestActivityChangeAfterLeaveInFlight`: a player's activity change races the same player's leave; the result is either a saved change followed by the leave, or `not_allowed`; no player row is created.
  - `TestPutModeTwiceSameCurrentMode`: two mode changes with the same `currentModeId`; one saved, the other `lobby_changed`.
  - `TestJoinRacesModeChange`: a join for a role that the mode change removes gives `invalid_game_role` or succeeds before the change.
  - `TestJoinLastSpotRacesModeChange` (PR3b): neither the total nor a role count exceeds its limit.
- Authorization tests (per endpoint, PR3b and PR6):
  - a non-member gets `group_not_found` on `PUT .../game`, `PUT .../mode`, `PUT .../activity` and `DELETE .../activity`;
  - a member who is not a player gets `not_allowed` on the same four;
  - a non-system-admin gets `not_allowed` on the game-list writes with modes and game roles (PR2).
- Game-level default tests (PR2): a rename of a game with game roles that sends the sum as `defaultMaxPlayers` succeeds; any other value gives `invalid_capacity`.
- Replace-semantics tests (PR2): an omitted `modes` keeps the modes; an empty array removes them; a name swap in one request succeeds; an `id` of another game or of another owner gives `invalid_request`; duplicate IDs give `invalid_request`.
- Contract checks through `npm run lint:api` in every PR that changes `api/calendar/openapi.yaml`, and the CI check that the generated Go and TypeScript output is in sync.

UI-only criteria, owned by the frontend PRs (not by the backend): removal confirmation (REQ-0015, line 30) in PR4; label truncation in the week view block (REQ-0015, line 88) in PR5.

### 16. Ports, adapters and services
- Calendar only. No change to `pkg/`. No new service, no async event, no new external dependency.
- Create uses the existing snapshot of the game tree through `GameCatalog.Find` before the lock (section 7). The settings endpoints read the game tree inside their transaction through `LobbyTx` methods (a mode with its game roles by ID, an activity by ID, the lobby's game by ID), because they must read under the lock (section 10). Those reads are the new `LobbyTx` methods; the backend expert names them and the reviewer checks them against sections 9 and 10.
- `LobbyReader` returns role slots with counts for a group's lobby list in one extra query, not one per lobby. `LobbyTx` gains the methods for replacing role slots, setting a player's role, and updating the lobby's game, mode and activity.
- The PostgreSQL adapter is the only place that knows the tables.
- The domain has no SQL and no HTTP types.

### 17. Single place for each piece of knowledge (DRY)
- The sum of slots and the capacity check (`validCapacity`) are written once and used for games, modes and lobbies.
- The name rules (trim, length, no edge whitespace) are written once in the domain for each entity; the CHECKs mirror them.
- The rule that a mode change clears roles and activity is written once in the domain and in the FK; the application does not repeat it.
- The label is written once in the frontend.

### 18. Not built now (YAGNI)
- Reserved spots per game role, role icons, role ordering other than `sort_order`, translation of names, a genre per mode or per activity, activity limits, roles on activities.
- A "clear mode" endpoint (REQ-0015 says a mode cannot be cleared).
- Changing the game of a lobby once set.
- Per-role max players for "Other" lobbies.
- Notifications, matching or suggestions for roles, modes or activities.
- A separate flex entity: flex is the absence of a game role (NULL).
- JSON columns for roles or modes (see alternatives).
- A role or mode move between owners in one request (an ID of another owner gives `invalid_request`).

## Consequences
- Lobby list reads: one extra query for all lobbies of a group (role slots with player counts and the flex count), not one per lobby. The game list reads three more tables (modes, game roles, activities), one query each.
- Settings endpoints read the lobby and the game tree inside the lock. This holds the lock for a few more reads per change; the lock is per group and the changes are rare.
- Migration `0007` cannot roll back while open lobbies exist, because `game_name` cannot become NOT NULL again. The rollback plan is: delete the open lobbies first, or accept losing them. Migration `0006` rolls back without touching lobbies, but loses the modes, game roles and activities of the game list.
- Rollback of `0007` also loses the mode, activity and role information of lobbies. Lobbies revert to their game name and max players, and their players keep their spots.
- The domain carries most of the new rules, and its unit tests are the main protection against regressions.
- The API grows by four endpoints and about ten error codes, and the lobby and game responses grow by optional fields.

## Alternatives considered
- Roles and modes as JSON columns on `games` and `lobbies`. Smaller schema. Rejected: a role of a player needs an identity and an FK, and the rule "every player becomes flex when the mode changes" would move into application code instead of the database's SET NULL.
- Separate tables for game-level and mode-level roles. Rejected: the same rules twice (DRY). One table with an optional mode column is simpler.
- Flex as a special role row. Rejected: flex is the absence of a role. NULL avoids a fake row in every count and FK.
- Reference from the lobby to the mode by FK. Rejected: a removed mode must not change the lobby (REQ-0015), as ADR 0010 does for games.
- One PATCH for lobby settings with optional and nullable fields. Rejected: the difference between "omitted" and "null" is hard to express in generated Go code. Small endpoints in the style of `players/me` are clearer.
- Seat as separate endpoints (`players/me/game-role`). Rejected: joining and choosing a role must be one check under the lock.
- Omitted arrays mean "empty" in the game list (as `genre`). Rejected: the existing admin page would remove modes it cannot see. The omitted-means-unchanged rule costs one sentence and removes that data-loss risk.
- A new service for the game list or for modes. Rejected: the same bounded context as lobbies and games, with no separate reason to deploy.
- Reservation of spots per game role. Out of scope (REQ-0011).

## Decisions confirmed and assumptions still open
Confirmed by the user on 2026-11-08 (DECISION, user, 2026-11-08):
- After the last mode of a game is removed, the game's own default max and game roles apply again to new lobbies with that game and no mode.
- A mode is never unlimited. A lobby with a mode and no game roles needs an explicit max; a cleared value gives `invalid_capacity`.
- Role names are unique per owner: per mode for a role on a mode, per game for a role on a game without modes (REQ-0011 amendment of 2026-11-08, written by the product owner).
- Role slots have no bound beyond the integer limit of a lobby's capacity (2147483647); the sum of the slots is checked against it.

Still ASSUMPTION:
- ASSUMPTION (REQ-0011, stands unless overruled): a player may change the seat while the lobby can still be joined (section 9).
