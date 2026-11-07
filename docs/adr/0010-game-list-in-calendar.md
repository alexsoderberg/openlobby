# 0010. Game list: table in calendar, managed by system admin in the app
Status: Accepted (2026-11-01)
Amended by ADR 0016 (genre only: the genre is read live from the game, unlike the name and preset max)

## Context
REQ-0009 (F-024) requires a shared game list where each game has a preset max number of players. The list is shared across all groups and is managed by the project, not by members or group admins. A lobby stores the game's name and stays unchanged if the game is removed from the list.

The user has explicitly rejected a file in the repository: the list must be dynamic and change without a commit and without a new release. The starting content is Counter-Strike 2, World of Warcraft, League of Legends and Overwatch, all with a preset max of 5. There is no upper limit for max.

The user has now decided that management happens in the app, by a system admin (ADR 0011). The earlier recommendation (psql against a dedicated operations role `calendar_ops`) is replaced. Since 0010 is not yet accepted, it is rewritten rather than replaced with a new number.

## Decision
- **The list is a table** `games` in the database `calendar` (ADR 0006):
  ```sql
  create table games (
      id uuid primary key default gen_random_uuid(),
      name text not null check (name !~ '^\s|\s$' and char_length(name) between 1 and 50),
      default_max_players integer check (default_max_players is null or default_max_players >= 1)
  );
  create unique index games_name_lower_key on games (lower(name));
  ```
  `id` is a uuid generated at creation (review 3). It never changes. No sort column and no `active` column, because REQ-0009 requires neither. The lists are sorted as the consolidated amendment says.
- **The database has the schema's invariants and the same safety-net checks as the other tables (ADR 0006):** primary key, unique index on the name ignoring case, a name without leading or trailing whitespace and 1–50 characters, and max ≥ 1 (amendment 2026-11-03 for the form of the whitespace check). The reserved name `Other` is checked in Go code, in `domain.NewGame`, not in the database (amendment 2026-11-03, REQ-0010 review).
- **Seed content** is inserted by a seed migration in `services/calendar/migrations/` (next sequence number, `*_games`). `up` creates the table and inserts the four rows with fixed ids (review 3). `down` drops the table. No other table is affected, because `lobbies.game_id` has no foreign key to `games`.
- **Ports** in `application`, split by use (ISP):
  - `GameCatalog`: `List(ctx) ([]domain.Game, error)` and `ListForGroup(ctx, groupID) ([]GameUsage, error)`, where `GameUsage{Game domain.Game, LobbyCount int}` (amendment 2026-11-04). Used by `ListGames` (`List`) and `ListGroupGames` (`ListForGroup`). `Find(ctx, id) (domain.Game, error)` is added with REQ-0003 for `CreateLobby`; it is not built before that.
  - `GameCatalogEditor`: `Create(ctx, Game) (Game, error)` (takes a `Game` with an empty `ID` and returns the stored game with its generated ID), `Replace(ctx, Game) error` and `Delete(ctx, id) error`. Used by the three system admin use cases.
  - `Game{ID, Name, DefaultMaxPlayers *int}` is a domain type. Sentinel errors in `application`: `ErrGameNotFound` and `ErrGameTaken`. All implementations give the same error behavior (LSP).
- **Adapter** `infrastructure/postgres` implements both ports. Unique violation (SQLSTATE `23505`) is translated to `ErrGameTaken`. An update or delete that affects 0 rows gives `ErrGameNotFound`.
- **Use cases:** `ListGames` (system admin), `ListGroupGames` (members, review 3), `CreateGame`, `ReplaceGame` and `DeleteGame`. `CreateLobby` will use `GameCatalog.Find` (REQ-0003).
- **API:**

  | Method | Path | Permission | Response |
  |---|---|---|---|
  | GET | `/api/games` | system admin (consolidated amendment) | 200 `[{id, name, defaultMaxPlayers}]`, sorted by `lower(name)`, then `id`. |
  | POST | `/api/games` | system admin | 201 `{id, name, defaultMaxPlayers}` with the generated `id`. Body `{name, defaultMaxPlayers}` |
  | PUT | `/api/games/{gameId}` | system admin | 200 `{id, name, defaultMaxPlayers}`. Body `{name, defaultMaxPlayers}` |
  | DELETE | `/api/games/{gameId}` | system admin | 204 |
  | GET | `/api/groups/{groupId}/games` | member (review 3) | 200 `[{id, name, defaultMaxPlayers}]` in the order of use in the group |

  PUT replaces the whole game. `id` in the path cannot be changed. The body fields are not `required` (ADR 0001 consolidated, item 2): an omitted or `null` `name` gives `invalid_game`, and an omitted or `null` `defaultMaxPlayers` means unlimited. PUT was chosen over PATCH, because PATCH would then need to distinguish "missing" from "null", which means more code for the same thing.
- **Rules** for the system admin endpoints, in this order (ADR 0001 consolidated, item 1). Steps that do not apply to an endpoint are skipped: `GET /api/games` has steps 1–2, `DELETE` has steps 1, 2 and 5.
  1. Shape, in transport: a path `gameId` that is not in uuid form → `404 game_not_found`; then invalid JSON or a wrong JSON type → `400 invalid_request`.
  2. Permission: `Actor.IsSystemAdmin` false → `403 not_allowed`. Shape comes first, so a non-admin gets no domain information.
  3. Name: trimmed (ADR 0004 rule 1), measured in code points, 1–50 characters, and not `Other` ignoring case → otherwise `400 invalid_game`.
  4. `defaultMaxPlayers` is `null` or an integer from 1 to 2147483647 → otherwise `400 invalid_capacity`. No product upper limit; 2147483647 is the technical limit (amendment 2026-11-04).
  5. Unknown `gameId` on PUT or DELETE → `404 game_not_found`.
  6. Name (ignoring case) used by another game → `409 game_taken`. A game that keeps its own name is not a conflict.
- **Logging:** every successful write is logged at info level with `actorUserId`, `gameId` and action (`create`, `replace`, `delete`). This is the operations log under CLAUDE.md, not a user feature. REQ-0010 excludes user-facing history, and that boundary is kept. No history table is introduced.
- **Deletion = row deletion.** No FK from `lobbies` to `games`, so a deletion cannot block or cascade lobbies. A lobby holds its own copy `game_name` and `max_players` and is not affected.
- **Change** of name or preset max affects only lobbies created after the change. Existing lobbies keep their values.
- **Gateway:** `/api/games` and `/api/games/*` go to `calendar` for all methods (ADR 0002).
- **Tests:**
  - Application against fakes: permission before validation, every error code in rules 2–6, trimming, and that deleting a game does not touch lobbies. Transport: rule 1.
  - Adapter against real PostgreSQL: sorting by name, `ErrGameNotFound`, case-insensitive duplicate name gives `ErrGameTaken`, check on max ≥ 1, and the migration `up` and `down`.
  - Transport: `X-User-System-Admin` with any value other than `true` gives non-admin. A missing or invalid `X-User-Id` gives 401 (ADR 0011).
  - Contract conformance against `api/calendar/openapi.yaml` as set in amendment 2026-11-03 (no separate contract test suite).

## Consequences
- Changing the list requires no commit, no release and no new container. Management happens in the app by the system admin.
- Management is logged but not versioned. That is acceptable for a list of a few rows. There is no history to restore from. If that becomes a need, it is done with a new ADR.
- The runtime role `calendar` gets `select`, `insert`, `update` and `delete` on `games`. This is necessary because the service now writes the list. If migrations run as the same role, that role owns the table. The DevOps expert decides whether the migration role is separated from the runtime role (least privilege).
- The operations role `calendar_ops` is removed (YAGNI). There is no psql path left for management. Access for emergencies is the operations database administrator's, not a management path, and the DevOps expert documents it in the operations routines.
- The management interface is local to the frontend (route `/systemadmin/games`) and relies on ADR 0011.
- The endpoints are in `api/calendar/openapi.yaml` and listed in `docs/services.md`.
- The migration is reversible (`down` drops the table, no lobbies are affected).

## Alternatives considered
- **File embedded with `go:embed` (earlier decision):** a change requires a commit and a release. The user has rejected it.
- **Configuration file in `infra/` or environment variable:** a change requires redeployment or restart, and the list is data, not configuration (CLAUDE.md).
- **psql against an operations role `calendar_ops` (earlier recommendation):** requires operations access for every change, an extra role with a password, and bypasses all validation in `application`. Replaced by the user's decision.
- **CLI in the calendar container:** a second entry point to the same function. Replaced by the system admin UI.
- **Management by group admins:** REQ-0009 excludes it. The list is shared by all groups.
- **Own service `games`:** no own pace of change or ownership, and an extra container on the Pi (ADR 0004, 0008).
- **Column `active` (deactivate instead of delete):** unnecessary while no lobby refers to the game and no history is required (YAGNI).
- **Foreign key from `lobbies` to `games`:** removed games would either block the lobby or cascade it away, which REQ-0009 excludes (ADR 0006).
- **Deriving `id` from the name, or a slug chosen by the system admin (the first decision):** the first needs Unicode rules and handles collisions poorly, the second makes the admin type an ID. Replaced by a generated uuid (review 3).
- **PATCH with three states for `defaultMaxPlayers`:** absent, null or value. PUT with the whole game is simpler and matches the other writes in the API.
- **History table for management:** the log is enough for a list that changes rarely (YAGNI).
- **Trigger or database rule that checks max against players:** belongs to F-018 and already lives in `application` under the group lock (ADR 0006).

## Open questions for the user
- **The name "World of Warcraft":** the user wrote "World of Warcraft/WoW". The starting content uses "World of Warcraft". If "WoW" should be the name, it is a data change, not a design change. No alias model is introduced.

## Dependencies on other agents
- **Backend expert:** migration, ports and `postgres` adapter, use cases, transport (`Actor`), endpoints as in the table and tests as above. The contract in `api/calendar/openapi.yaml` is updated first.
- **DevOps expert:** `SYSTEM_ADMINS` in the `auth` container environment (ADR 0011), grant for the runtime role on `games`, removal of `calendar_ops`, and assessment of a separate migration role. The gateway route for `/api/games/*` (ADR 0002).
- **UI/UX expert:** the page `/systemadmin/games` and its error messages based on the codes `not_allowed`, `invalid_game`, `invalid_capacity`, `game_taken` and `game_not_found`. The page is shown only when `isSystemAdmin` is true (ADR 0011).
- **Product owner:** nothing left. REQ-0009 and REQ-0010 (F-025) are updated in line with this ADR. The scope of the operations log is described above.

Amendment 2026-11-01: for PUT, the unknown ID (rule 6, `404 game_not_found`) is checked before the name conflict (rule 5, `409 game_taken`), in line with the order in ADR 0001. Other rules unchanged.

Amendment 2026-11-01 (review 2). This replaces the rule list for the order, the missing-field rule and the name conflict. Other rules are unchanged.
- **Order for `POST /api/games`, `PUT` and `DELETE`** (ADR 0001):
  1. Shape: invalid JSON or a wrong JSON type → 400 `invalid_request`.
  2. Permission: not a system admin → 403 `not_allowed`. Shape is checked first, so a non-admin never gets domain information.
  3. Validation: `id` format on POST and `name` → 400 `invalid_game`; `defaultMaxPlayers` → 400 `invalid_capacity`.
  4. Existence: on PUT and DELETE an unknown `gameId`, including an invalid slug → 404 `game_not_found`.
  5. State: ID or name (ignoring case) used by another game → 409 `game_taken`. A game that keeps its own name is not a conflict.
- **Missing fields:** a missing `name` or `id` is read as `""` and gets `invalid_game`. A missing or `null` `defaultMaxPlayers` means unlimited, as REQ-0010 requires for a game saved without a default max. A wrong JSON type for `defaultMaxPlayers` gives `invalid_request`. An integer under 1 gives `invalid_capacity`.
- **Sorting:** `GET /api/games` stays sorted by `name` (`ORDER BY name`, no stored sort column). REQ-0009 requires the game choice to show the games by name, and a stable order is needed for the choice. Open for the product owner, see `docs/services.md`.
- **Path parameter:** the contract names it `GameIdPath` (ADR 0012), which avoids a clash with the schema `GameId`.

Amendment 2026-11-01 (review 3). Decided by the user and written up by the architect. This overrides the earlier amendments where they differ. The Decision above was rewritten in place in review 5 to match it; this amendment keeps the reasons.

- **Game ID is a uuid generated by the system.** `games.id` is `uuid primary key default gen_random_uuid()` (ADR 0006). The system admin sends only `name` and `defaultMaxPlayers` when creating a game. Nobody types an ID. The slug rule (format `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 50 characters) is removed from `application`, and so is the alternative "admin chooses the ID". The ID never changes after creation (unchanged).
  - `Create` returns the stored game with its generated ID (`INSERT ... RETURNING id`). The port `GameCatalogEditor.Create` takes a `Game` with an empty `ID` and returns the stored `Game`.
  - The seed migration inserts the four starting games with fixed uuids, so that the ids are the same in every environment and in tests. `down` drops the table, so the migration stays reversible:
    - Counter-Strike 2: `ce3ff9c1-dabb-4270-b5e0-7b34de37410b`
    - World of Warcraft: `bd8fae98-29a7-4b2c-8b49-384ee7a75ff7`
    - League of Legends: `21d79e45-fc60-49b3-aa95-b44fa46a75b5`
    - Overwatch: `7e9a4d35-1616-4f25-9828-fc6e2383b07b`
- **`gameId` in paths and bodies follows the uuid rules of ADR 0001 and 0012.**
  - Path `gameId` (`PUT`, `DELETE`): the contract has `type: string`, and transport checks the canonical uuid form with `pkg/httpapi` in step 1 of ADR 0001 (shape). An invalid form gives `404 game_not_found`, before the permission check. This replaces "including an invalid slug" in step 4 of review 2.
  - Body `gameId` in `POST /api/groups/{groupId}/lobbies`: `type: string` in the contract, without `format: uuid`. The generated decoder would otherwise reject a malformed value as `invalid_request`. Any value that is not a game in the list, including a value that is not in uuid form, gives `400 invalid_game`. A malformed value names no game, so it is the same case as an unknown one. The `postgres` adapter maps SQLSTATE `22P02` (invalid input syntax for uuid) on the lookup to `ErrGameNotFound`. `CreateLobby` maps `ErrGameNotFound` to `invalid_game`. The check runs in the rule order of ADR 0004 rule 6, after the time rules.
- **"Other" is a reserved name.** A game name (`POST /api/games`, `PUT /api/games/{gameId}`) that equals `Other` after trim, compared case-insensitively (`strings.EqualFold`), gives `400 invalid_game`. It is a validation step: on `PUT` it comes before the existence check, so an unknown `gameId` with the name `Other` gives 400. The rule lives only in `application`. The database has only the safety-net checks of the Decision (trimmed, 1–50 characters), so it does not check the reserved name. No new error code. `customGameName` is not restricted: a lobby with the free-text name "Other" is allowed, because the rule concerns the game list only.
- **Game choice ordered by use in the group.** New endpoint `GET /api/groups/{groupId}/games` (members only, listed in `docs/services.md`). The order is:
  1. count of lobbies in this group whose `game_id` is the game, all time (past and upcoming lobbies that still exist), descending;
  2. name ascending (unused games are sorted here, as ties);
  3. `id` ascending as the last tie-break, so that the order is deterministic.
  Lobbies with a custom name have `game_id` null and do not count. Lobbies that were deleted do not count either, since no history is kept (YAGNI). The client puts "Other" last. The server never includes "Other".
- **Why a group path and not a query parameter on `GET /api/games`:** `GET /api/games` stays the list for the system admin (no group context). A `groupId` query parameter would give one path two authorization rules (no check without a group, membership check with one). The group path reuses the membership rule (ADR 0004 rule 2) that every group endpoint already has, so the authorization is the same in every group endpoint. The surface is one path and one method, with the same response type as `GET /api/games` (array of `Game`). The gateway already routes `/api/groups*` to `calendar`, so no gateway change is needed.
- **`GET /api/games`** keeps its response and its order by name. It is used only by the system admin page, so the sort by name is correct there. The order by name in REQ-0009 for the game choice is replaced by the order above (review 2, "Sorting", is superseded for the choice).
- **Lobby keeps a reference to the game:** `lobbies.game_id uuid null`, without foreign key (ADR 0006 amendment, review 3). A game that is removed from the list leaves the id in its lobbies. The id matches no game in the list, so the lobby is not counted for any entry. A game that is removed and added again gets a new id and starts from zero. This is accepted (YAGNI, no history).
- **Tests** (in addition to the tests listed above):
  - `application` against fakes: `Other` gives `invalid_game` on create and on rename, for different case and surrounding spaces, and `customGameName` "Other" is accepted; order of ID-based checks on `PUT` (`invalid_game` before `game_not_found`); a non-member gets `group_not_found` on `GET /api/groups/{groupId}/games`.
  - `postgres` adapter against real PostgreSQL: the ordering of `ListForGroup` (most used first, ties and unused by name, custom-named lobbies not counted, lobbies of other groups not counted); a malformed `gameId` in `Find` gives `ErrGameNotFound`; `gen_random_uuid()` gives a value on `Create`; the seed migration `up` and `down`.
  - Transport: a malformed path `gameId` gives `404 game_not_found` for a non-admin too (step 1 before step 2).
- **A game that is removed and added again** gets a new id. Its old lobbies keep the old id, so the old lobby count does not come back for the new game. This is accepted, because no history is kept (YAGNI).
- **Schemas:** the game's default max is the schema `DefaultMaxPlayers`, and the lobby's max stays `MaxPlayers`. `replaceGame` changes only the default. It never changes lobbies.

Amendment 2026-11-01 (consolidated). The final cross-cutting rules are in ADR 0001 "Amendment 2026-11-01 (consolidated)". It overrides the Decision and the earlier amendments where they differ:
- **`GET /api/games` is system admin only** (403 `not_allowed` for anyone else). REQ-0010 says a non-admin who opens the game list is denied and no part is shown. Members use `GET /api/groups/{groupId}/games`. The permission check is step 3 of ADR 0001. The use case `ListGames` checks `Actor.IsSystemAdmin`.
- **Fields of the write bodies are not `required`** (ADR 0001 consolidated, item 2). Omitted or `null` `name` gives `""` and `invalid_game`. Omitted or `null` `defaultMaxPlayers` means unlimited, also on `PUT`, which replaces the whole game. (The Decision states the same since review 5.)
- **Rule order** is the one of the review 2 amendment (shape, permission, validation, existence, state), where the invalid-form path `gameId` is a shape error (404 `game_not_found`, before the body). The name conflict is on the name only, because IDs are generated (review 3).
- **Sort order** is case-insensitive (`ORDER BY lower(name), id`) in `GET /api/games`. In `GET /api/groups/{groupId}/games` it is lobby count descending, then `lower(name)`, then `id` (ADR 0001 consolidated, item 6).

Amendment 2026-11-03 (REQ-0009 review: whitespace check). The database check on `games.name` is `name !~ '^\s|\s$' and char_length(name) between 1 and 50`, not `btrim`. The Decision above is rewritten in place to match.
- **Why not `btrim`:** `btrim` strips only spaces. A name with a leading tab or newline would pass the database check, although ADR 0004 rule 1 trims it.
- **Why the regex:** it rejects a leading or trailing character of PostgreSQL's whitespace class `\s` (space, tab, newline, carriage return, form feed, vertical tab). That is the database form of "no leading or trailing whitespace".
- **What stays in `application`:** the rule is ADR 0004 rule 1, `strings.TrimSpace`, which covers all Unicode whitespace. Names are trimmed there before validation and before any write.
- **Accepted gap:** the database does not reproduce Go's Unicode whitespace exactly. A name with an exotic Unicode space that the database locale does not classify as `\s` can pass the database check. The shortcut is recorded in `services/calendar/migrations/0003_games.sql` and is upgraded if such a name gets in.
- **Wording of the safety-net bullet above:** "the same safety-net checks as the other tables" holds for `games` only. The `groups` name has no whitespace check in the database. See the follow-up in ADR 0006, amendment 2026-11-03.

Amendment 2026-11-03 (REQ-0010 review: placement of the game rules, contract conformance, deferred test). This overrides the sentences "The rule lives only in `application`" (review 3) and "What stays in `application`" (REQ-0009 review) where they differ.
- **Placement of the game rules (question 1). DECISION:** the rules for a game's name and default max players live in the domain constructor `domain.NewGame`, following the precedent `domain.NewGroupName`. `NewGame` trims the name (ADR 0004 rule 1), checks 1–50 code points, rejects the reserved name `Other` (`strings.EqualFold`) and checks the default max ≥ 1. It returns `ErrInvalidGame` or `ErrInvalidCapacity`. Every create and replace in `application` calls `NewGame` before any port is called, so all writes pass through it. The check order is the one of rule 3 and rule 4 (name first, then capacity).
  - Reason: these are pure rules without I/O, and the domain is the one place that holds them (DRY). The database keeps only the safety-net checks of the Decision, because the reserved name is a Go rule and not a schema invariant.
  - Where the older text says "application" for the trim or the reserved name, read "`domain.NewGame`, called by `application`". The trim is not done in the transport layer.
- **Contract conformance (question 2). DECISION:** a separate contract test suite is not required for the four game operations or for `GET /api/groups/{groupId}/games`. The accepted equivalent is:
  - (a) transport uses oapi-codegen strict handlers generated from `api/calendar/openapi.yaml`, so request and response types are checked at compile time;
  - (b) CI fails if the generated code is out of sync with the contract;
  - (c) for each operation, every status code the contract declares and every error code in the rules has a transport test against the handler. The reviewer checks this list against the contract.
  - CLAUDE.md's contract test rule covers calls between services. These endpoints are called by the gateway and the frontend, which both use the same generated types, so no further test is needed.
- **Deferred test (REQ-0003). DECISION:** "deleting a game does not touch lobbies" cannot be tested yet, because there is no lobbies table. It is moved to REQ-0003 and must be in place with the first lobby write.
- **No foreign key from lobbies to games. DECISION:** the lobbies migration in REQ-0003 must not add a foreign key from `lobbies.game_id` to `games`. This is the rule of review 3 and the Alternatives above. The reviewer checks it in that migration.

Amendment 2026-11-04 (REQ-0010 review 2). This overrides the earlier text where they differ. The Decision lines for the port `GameCatalog`, for `CreateLobby`'s use of `Find`, and for rule 4 (`defaultMaxPlayers`) were rewritten in place to match.

- **Capacity bound (BLOCKER). DECISION:** the largest allowed max players is `2147483647`, the maximum of PostgreSQL `integer` (int4). The rule for `defaultMaxPlayers` and for a lobby's `maxPlayers` is: `null` or omitted, or an integer from 1 to 2147483647. A value below 1 or above 2147483647 gives `400 invalid_capacity`. A value that is not an integer (2.5, text) keeps `400 invalid_request`.
  - **Option chosen: (a), the int4 maximum.** The column stays `integer`, so there is no migration and no rollback. Option (b), `bigint`, was rejected: it still needs a maximum, because the JSON number is decoded into Go `int`, so the bound would only move. The bound is technical. "No upper limit" in REQ-0009 stays true as a product rule, because no product cap is introduced.
  - **No realistic cap (for example 100).** That would be a product decision that reverses REQ-0009 and is not made here. If the product owner wants one, it is a new decision for the product owner, not a change to this rule.
  - **Constant and place:** `maxPlayersLimit = math.MaxInt32` in `services/calendar/internal/domain/domain.go`. The helper `validCapacity(maxPlayers *int) bool` returns true for `nil` and for values from 1 to `maxPlayersLimit`. `NewGame` returns `ErrInvalidCapacity` when it returns false. REQ-0003's lobby creation calls the same helper, so the rule is in one place.
  - **Contract:** `DefaultMaxPlayers` and `MaxPlayers` in `api/calendar/openapi.yaml` get `maximum: 2147483647`, and their descriptions say "an integer from 1 to 2147483647". Valid values are unchanged, so this is not a breaking change.
  - **Database:** no change. `games.default_max_players` (ADR 0010, `0003_games.sql`) and `lobbies.max_players` (ADR 0006) stay `integer`, so every stored value is in range.
  - **Platform:** the service is built for 64-bit targets (`linux/amd64`, `linux/arm64`). On a 32-bit build the JSON decoder would reject a larger value earlier as `invalid_request`; this is not expected in production.
  - **Tests** (written first, because they reproduce the 500 from review 2):
    - Transport: `POST` and `PUT` with `defaultMaxPlayers` 2147483648 and 3000000000 give `400 invalid_capacity`; 2147483647 is accepted (201 and 200).
    - Domain: 2147483647 is valid and 2147483648 is invalid.
    - REQ-0003 repeats the same cases for `maxPlayers` on lobby creation.
- **Name length (SHOULD). DECISION:** one constant and one helper for the name rule in `services/calendar/internal/domain/domain.go`:
  - `maxNameLength = 50` replaces `maxGroupNameLength` and `maxGameNameLength`.
  - `trimName(raw string) (name string, ok bool)` trims with `strings.TrimSpace` and returns `ok` when the result is 1 to `maxNameLength` code points.
  - `NewGroupName` and `NewGame` call it and map `ok == false` to their own error (`ErrInvalidGroupName`, `ErrInvalidGame`). The reserved name `Other` stays in `NewGame`.
  - Reason: this is one rule, not two similar pieces of code. ADR 0004 rule 1 defines it, and ADR 0010 defines the game name as "counted like the group name", so the two values must change together. The rule of three is about similar code; here it is the same knowledge. The contract `maxLength: 50` and the database check on `games.name` remain mirrors of the same value (ADR 0006 precedent).
- **Malformed path ID (SHOULD). DECISION: adopt one middleware.** The shape of a path ID is checked once, by `rejectMalformedPathID` in `services/calendar/internal/transport/router.go`. It is added to `StdHTTPServerOptions.Middlewares` for all operations and uses the existing `pathIDCodes` table and `r.PathValue`.
  - **Order:** `requireUserID` stays outermost, so a caller without identity still gets 401 first. Then `rejectMalformedPathID` gives 404 with the not-found code of the resource, before the body is read and before the strict handler. Then the body (400 `invalid_request`), then permission (403), then the rest. This is ADR 0001's order.
  - **Removed:** the loop in `requestErrorHandler` (the strict handler's `RequestErrorHandlerFunc` becomes `httpapi.InvalidRequestHandler`), and every `httpapi.IsUUID` check on a path ID in a handler (`games.go`, `invite_links.go`, `public.go`).
  - **Kept:** the `IsUUID` check on the identity header (`identity.go`) and on body fields (`gameId` in the lobby body, amendment review 3).
  - **Tests:** the transport tests for rule 1 stay, and one table test covers each path parameter in `pathIDCodes` for a non-admin with an invalid body.
- **Not changed:** migrations, ports and endpoints, apart from the text corrections above.
- **Dependencies:** backend expert implements the above, including the contract change, and runs the contract generator so that the generated code is in sync (ADR 0012). The architect writes the lobby bound into ADR 0004 rule 6 with REQ-0003. The UI expert shows `invalid_capacity` for values above the bound in the existing error text.

Amendment 2026-11-04 (REQ-0003 review, follow-up: integers beyond int64). Overrides the sentence "A value below 1 or above 2147483647 gives 400 invalid_capacity" of the capacity bound above, for this one input. The other text stands.
- **Decision (accepted, closes the BLOCKER):** an integer that the server's JSON decoder cannot hold (beyond the int64 range, for example `99999999999999999999`) is rejected by the body decoder in the generated strict bind (`runtime.BindJSONBody`, then `httpapi.InvalidRequestHandler`) and gives `400 invalid_request`. Integers from 2147483648 up to the int64 maximum give `400 invalid_capacity`, as before. In both cases nothing is stored.
- **Reason:** the value never reaches the domain rule, because the decoder stops it first. Giving it `invalid_capacity` would need custom decoding of the body before the generated bind (`json.Number`), written twice for `POST` and `PUT /api/games` and once for `createLobby`, for an input no client sends. That is more code than the difference in error code protects (KISS, YAGNI). The platform note above already accepts the same outcome on 32-bit builds.
- **Contract:** no change. `maximum: 2147483647` stays as documentation in `api/calendar/openapi.yaml`.
- **Test:** one transport case per endpoint (`POST /api/games`, `PUT /api/games/{gameId}`) and one for `createLobby` sends `99999999999999999999` and expects `400 invalid_request`. This documents the accepted outcome, so that nobody changes it by accident. The cases 2147483648 and 3000000000 stay `invalid_capacity`.
- **Reviewer:** the BLOCKER on this point is closed by this amendment.
