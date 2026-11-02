# 0001. Base architecture
Status: Accepted (2026-11-01)

## Context
The MVP of OpenLobby consists of the requirements REQ-0001–0010. They build on one core flow: login, group, lobby, overview, joining a lobby, leaving a group and revoking an invite link, plus the group admin role, the game list and the system admin role. The stack is already decided in CLAUDE.md: microservices behind an API gateway, Go for the backend, React + Vite for the frontend, Discord OAuth2, PostgreSQL, Docker Compose on Raspberry Pi 5.

The project has few users (3–15 per group) and a small codebase. The architecture should therefore be as small as possible but still follow the rules of the stack.

## Decision
- **Services in the MVP:** `gateway` and `auth` (the starting set) and a domain service `calendar` (groups, membership, invites, lobbies, players and the game list). See ADR 0002–0004 and ADR 0010.
- **Frontend** is its own container with statically built files. It is reached via the gateway.
- **One entry point.** All external traffic goes through `edge` (Nginx, terminates TLS, ADR 0009) to `gateway`. The gateway serves the frontend on `/` and forwards `/api/*` to the services. Frontend and API therefore share an origin, which keeps cookies and CORS simple.
- **Internal services are not exposed.** Only `edge` publishes ports (80 and 443). `gateway` answers 404 to all paths that start with `/internal/`.
- **Communication:** synchronous HTTP/JSON. No queues or events in MVP.
- **Contract first.** Public endpoints are described in `api/<service>/openapi.yaml`. Service-to-service endpoints are described in `api/<service>/internal.yaml`. Types are generated for Go and TypeScript. No type is written by hand twice.
- **Error format** (the same for all services):
  ```
  {"error": {"code": "invite_invalid", "requestId": "..."}}
  ```
  The error contains a machine-readable `code` and no free text. The texts for the user are in the frontend, which maps codes to user-facing messages. That gives one authoritative place for the texts.
- **Correlation ID:** header `X-Request-Id`. The gateway accepts a valid incoming ID (at most 64 characters, characters `[A-Za-z0-9-]`) or generates a new one. The ID is passed on in all calls and written in all logs.
- **Times in the API** are exact moments in RFC 3339. Any offset is accepted in requests; responses are UTC with `Z` (`2026-11-07T18:00:00Z`). Local time is handled in the frontend. See ADR 0006.
- **Versioning:** no `/v1` prefix in MVP. Changes must be additive. A breaking change requires a new ADR.
- **Contract generators** (Go and TypeScript) are decided in ADR 0012.

## Consequences
- Three Go services and a frontend container mean more deployment than a monolith. This is motivated by the microservices requirement in CLAUDE.md and by the fact that each service can run alone with `docker compose up <service>`.
- Errors that the internal chain loses in transport become visible via the correlation ID, not via detailed error messages.
- All clients (the frontend and future ones) use the same contract, so changes show up at compile time.

## Alternatives considered
- **gRPC between services:** more tooling and a binary format than the need justifies. The stack says HTTP/JSON.
- **Event-based communication (broker):** no requirement in MVP needs asynchrony. A requirement for it needs an ADR according to CLAUDE.md.
- **A monolith:** conflicts with the stack. The service boundaries in ADR 0003–0004 are therefore the boundaries that carry the design.
- **Frontend in the gateway's container:** breaks the rule "one service = one container".

Amendment 2026-11-01: the error format above applies without free text. Codes and status codes:
- **Order in every endpoint:** see "Amendment 2026-11-01 (consolidated)", item 1 (shape before membership). The first order written here is replaced.
- **Status codes:** 400 for validation errors, 403 for permission, 404 for a missing resource, 409 for a state conflict. No 422.
- **`invalid_request`** (400) for invalid JSON, a missing field without a domain code, and `required` time fields that are missing or not RFC 3339 (any offset is accepted, review 2). An error in a field with a domain code gives the domain code, e.g. `invalid_max_uses`, `invalid_capacity`, `invalid_game`, `invalid_group_name`. Unknown fields in the body are ignored.
- **`service_unavailable`** (503) when a dependency does not respond: gateway to auth (session validation), gateway to an upstream it cannot connect to (ADR 0002 review 5), calendar to auth or database, auth to database. Never after a write has been committed. **`internal_error`** (500) without details for other unexpected errors.
- **Gateway's own responses:** unknown `/api/*` path and all `/internal/*` give 404 `not_found`. Wrong method on a known path gives 405 `method_not_allowed`.
- **Names:** the user's ID is called `userId` in all contracts. The resource's ID is called `id`. An ID that points to a user gets the role in its name, e.g. `createdByUserId`.
- **Lint:** `info-license` is turned off in `redocly.yaml` in the repository root, because the project is private and no license has been decided.
- The renamings and new codes are made before the first client, so they are not breaking. Allowed codes are `enum` in `api/<service>/*.yaml`. The overview is in `docs/services.md`.

Amendment 2026-11-01 (review 2): overrides amendment 1 where they differ. Decided by the architect after the reviewer's contract review and a check of oapi-codegen v2.8.2 behaviour.

**Order in every endpoint:**
0. **Identity:** missing or invalid `X-User-Id` in `calendar`, and missing `X-User-Id` on `auth`'s `GET /api/auth/me`, gives 401 `unauthenticated`. A transport middleware checks this before the generated handler. The gateway gives the same 401 for all client traffic.
1. **Shape, in transport before the use case:** invalid JSON, a value of the wrong JSON type (also for a field that has a domain code), a required time field that is missing or not RFC 3339, a body over 16 KiB → 400 `invalid_request`. A uuid path ID in invalid form gives the not-found code of its resource: `groupId` → `group_not_found`, `userId` → `member_not_found`, `lobbyId` → `lobby_not_found`, `linkId` and `token` → `invite_invalid`, `gameId` → `game_not_found`.
2. **Membership:** 404 `group_not_found`.
3. **Permission that does not depend on a resource:** 403 `not_allowed`.
4. **Domain validation of values:** 400 with the domain code (`invalid_group_name`, `invalid_max_uses`, `invalid_capacity`, `invalid_game`, `lobby_in_past`, `lobby_end_not_after_start`, `lobby_too_long`).
5. **Existence:** 404 for a missing resource. This includes a path `gameId` that matches no game (`game_not_found`) and a token that matches nothing (`invite_invalid`). Exception: a body `gameId` in `createLobby` that matches no game is a validation error, 400 `invalid_game` (step 4, ADR 0010 review 3).
6. **Permission that depends on the resource:** 403 (for example the creator of a lobby or a link).
7. **State:** 409, and `invite_invalid` for an inactive link.

Consequences: a non-admin with a malformed body gets 400 `invalid_request`, which contains no domain information. A non-admin with a valid body gets 403. A malformed body on a non-existing group gives 400, not 404. This reveals nothing about existence, because the same 400 is given for any group.

**Values and missing fields:**
- A wrong JSON type gives `invalid_request`. Domain codes are given only for values of the right type that break a rule.
- A missing or `null` nullable field is `null`. For `maxPlayers` and `defaultMaxPlayers`, `null` means unlimited. For `maxUses`, `null` means 10. For `gameId` and `customGameName`, `null` means not given.
- A missing or `null` string field that is not `required` is read as `""` and gets its domain code (for example `invalid_group_name`). See "Amendment (consolidated)" for the rule on `required`.
- A missing required time field gives `invalid_request`.
- Unknown fields are ignored (unchanged).
- **Times:** any RFC 3339 offset is accepted and converted to UTC. Responses are always UTC with `Z`. This replaces "times that are not UTC with `Z` give `invalid_request`". Checking the suffix would need the raw string, which the generated decoder does not keep. An offset denotes the same moment, so nothing is lost.
- **Body size:** at most 16 KiB (a named constant in `pkg/httpapi`). A larger body gives `invalid_request`.

**Errors and codes:**
- Every operation documents `500` with the shared response `InternalError` (`internal_error`, no details). The transport writes it through the generator's error handler (ADR 0012).
- The public contracts (`api/auth/openapi.yaml`, `api/calendar/openapi.yaml`) list `not_found` and `method_not_allowed` in the `code` enum, marked "gateway only". The internal contracts do not list them.
- `api/auth/openapi.yaml` no longer lists `invalid_request`, because no public auth endpoint has a request body.

**Names:** paths, operationIds, field names and enum values in the contracts name no login provider (ADR 0005). Descriptions may name the current provider.

**Path parameters** are `type: string` in the contracts, not `format: uuid` (ADR 0012).

Amendment 2026-11-01 (review 3): one exception to "every operation documents `500`" (review 2, Errors and codes). `GET /api/auth/login` and `GET /api/auth/callback` document no `500` and no JSON error. ADR 0005 requires that login endpoints always redirect. An internal error during login therefore gives the redirect `/?loginError=login_failed`, and no JSON reaches the browser (the `GET` login flow; a wrong method gets the gateway's 405 JSON, ADR 0005 amendment review 6).

Amendment 2026-11-01 (consolidated). This is the final statement of the cross-cutting rules. It supersedes every conflicting sentence in the earlier amendments of ADR 0001, 0003, 0004, 0010 and 0012. The contracts in `api/` follow this section. Reason: the review 2 and review 3 amendments contradicted each other on the points below, and the contracts failed review because of it.

**1. Order of checks, final (one order for all endpoints).**
0. Identity: missing or invalid `X-User-Id` (and missing `X-User-Id` on `GET /api/auth/me`) gives 401 `unauthenticated`.
1. Shape, in transport before the use case: first an invalid uuid in a path (from left to right in the path; the not-found code of that resource: `groupId` gives `group_not_found`, `userId` gives `member_not_found`, `lobbyId` gives `lobby_not_found`, `linkId` and `token` give `invite_invalid`, `gameId` gives `game_not_found`), then the body: invalid JSON, a value of the wrong JSON type (also for a field with a domain code), a missing or non-RFC 3339 `required` time, a body over 16 KiB → 400 `invalid_request`.
2. Membership: 404 `group_not_found`.
3. Permission that does not depend on a resource: 403 `not_allowed`.
4. Validation of values: 400 with the domain code.
5. Existence: 404. Exception: a body `gameId` in `createLobby` that names no game (also one not in uuid form) is validation, 400 `invalid_game` in step 4, not 404 `game_not_found`. The lobby rule treats an unknown game like an invalid choice (ADR 0004 rule 6, ADR 0010 review 3). `game_not_found` is only for a path `gameId`.
6. Permission that depends on the resource (creator of a lobby or link): 403.
7. State: 409, and `invite_invalid` for an inactive link.

Shape comes before membership. Reason: the strict server decodes the body before the handler runs, so shape-first needs no extra code, and a membership-first order would need a hand-written decoder. Consequence: a malformed body gets 400 `invalid_request` also from a non-member and for a group that does not exist. This reveals nothing, because the same 400 is given for any group. ADR 0004 "Rule 6" is changed accordingly. A step that does not apply to an endpoint is skipped. Applied per endpoint:
- `createLobby`: `invalid_request`, `group_not_found`, then the rules of ADR 0004 rule 6.
- `createInviteLink`: `invalid_request` (wrong JSON type), `group_not_found`, `invalid_max_uses`.
- `makeGroupAdmin`: `member_not_found` for an invalid `userId` form (step 1, so also before `not_allowed`), `group_not_found`, `not_allowed`, `member_not_found` for a user who is not a member.
- `deleteLobby`: `group_not_found`, `lobby_not_found`, `not_allowed` (creator).
- `revokeInviteLink`: `group_not_found`, `invite_invalid` (missing), `not_allowed`, `invite_invalid` (inactive).
- Game list endpoints: ADR 0010 (consolidated).

**2. The `required` rule (one rule for every request schema).** A field is `required` in a request schema only when its absence gives `invalid_request`. In MVP that is `startsAt` and `endsAt` in `CreateLobbyRequest` and nothing else. Every other request field is optional in the contract, and the default for an omitted field is stated on the field:

| Schema.field | Omitted or `null` gives |
|---|---|
| `CreateGroupRequest.name` | `""`, which gives `invalid_group_name` |
| `CreateInviteLinkRequest.maxUses` (and an omitted body) | 10 |
| `CreateLobbyRequest.maxPlayers` | unlimited |
| `CreateLobbyRequest.gameId`, `customGameName` | not given (exactly one must be given, else `invalid_game`) |
| `CreateGameRequest.name`, `ReplaceGameRequest.name` | `""`, which gives `invalid_game` |
| `CreateGameRequest.defaultMaxPlayers`, `ReplaceGameRequest.defaultMaxPlayers` | unlimited (on PUT too: PUT replaces the whole game) |
| `LookupUsersRequest.userIds` (auth internal) | an empty list, response `users: []` |
| `ValidateSessionRequest.token` (auth internal) | 401 without a lookup |

`null` and an omitted key are the same for every field that is not `required` (generated Go cannot tell them apart, ADR 0012 review 2). A wrong JSON type is always `invalid_request`. Response schemas keep their `required` lists, because the server always sends every field (a nullable value is sent as `null`). `required` is not enforced by the generated decoder for a `time.Time`: a missing or `null` time decodes to the zero value. Transport therefore treats a zero time in `startsAt` or `endsAt` as missing and answers `invalid_request`. A test covers it.

**3. Times.** Any RFC 3339 offset is accepted and converted to UTC. Responses are UTC with `Z` (unchanged from review 2).

**4. Shared copies of the error envelope (precise).** These blocks must be textually identical (same keys, same text) in `api/auth/openapi.yaml`, `api/auth/internal.yaml` and `api/calendar/openapi.yaml`: `components.parameters.RequestIdHeader`, `components.schemas.ErrorResponse`, `components.schemas.ErrorBody` except `properties.code.description` and `properties.code.enum`, `components.responses.ServiceUnavailable` and `components.responses.InternalError`. These differ on purpose and are not shared: `properties.code.enum` (each contract lists its own codes), `properties.code.description` (the two public contracts are identical and carry the gateway-only sentence about `not_found` and `method_not_allowed`; the internal contract has no gateway codes and no such sentence), `components.responses.Unauthenticated` (calendar also covers a missing identity from the gateway) and the `info` block. The reviewer checks this by comparison.

**5. Request body text in the contracts.** Every contract that has request bodies (`api/auth/internal.yaml`, `api/calendar/openapi.yaml`) states in its top description: body at most 16 KiB, invalid JSON or wrong JSON type gives `invalid_request`, a field that is not `required` may be omitted or `null`, unknown fields are ignored. `api/auth/openapi.yaml` has no request bodies and does not state it.

**6. Ordering of lists.** Names are compared case-insensitively (`ORDER BY lower(name)`), then by `id`. This applies to `GET /api/games` (by name, then `id`) and to `GET /api/groups/{groupId}/games` (lobby count descending, then name, then `id`). Upcoming lobbies are sorted by `starts_at`, then `id`.

**7. Permission for the game list.** `GET /api/games` is for the system admin only (403 `not_allowed` otherwise, step 3), as REQ-0010 requires. Members use `GET /api/groups/{groupId}/games`.

**Where earlier text is replaced by this section:** ADR 0001 review 2 "A missing required string is read as `""`" (now: not `required`); ADR 0004 review 2 rule 6 "membership first" (now shape first); ADR 0010 Decision "Both fields in the body are required" and "A missing field gives `invalid_capacity` or `invalid_game`" (now: see table); ADR 0010 Decision "`GET /api/games` permission session" (now system admin); ADR 0012 review 3 "The text is set in the review 3 change list" (now: item 4 above).

Amendment 2026-11-01 (review 4). Clarifications after the third contract review. They change no earlier rule; they make the text agree with the consolidated amendment.
- **Order of checks and path IDs (all operations):** shape (a malformed path uuid, from left to right, then the body) always comes before membership. That includes `deleteLobby` (`lobbyId` gives `lobby_not_found`) and `revokeInviteLink` (`linkId` gives `invite_invalid`). The per-endpoint list in item 1 is read with this step in front.
- **Defaults on name fields:** the table in item 2 applies in the contract text. `CreateGroupRequest.name`, `CreateGameRequest.name` and `ReplaceGameRequest.name` state "Omitted or `null` gives `invalid_group_name`" or "`invalid_game`" on the field itself. The 400 text says "omitted, `null`, empty..." for the domain code and "wrong JSON type" for `invalid_request`.
- **Ordering of lobbies:** `starts_at`, then `id` (item 6), stated in the contract.
- **Group scoping of IDs:** ADR 0004 rule 12.
- **Secrets in logs:** no log has a query string, and invite tokens are masked in paths: ADR 0002 and ADR 0009 (amendment review 4).
- **Redirect target:** the `returnTo` rule is in ADR 0005 (amendment review 4).
- **Supersession list (stale text rewritten in place so the ADRs agree with the amendments):** ADR 0002 "Public routes" (`/api/auth/discord/*` paths) and the rate-limit pointer; ADR 0003 public endpoint paths, `/me` and lookup response fields (`id` is now `userId`) and port method names; ADR 0004 rule 3 ("left"), rule 6 ("no reference to the game list") and the use case list (`ListGroupGames`); ADR 0005 flow paths and the `returnTo` rule; ADR 0007 `createdAt` in responses, "left" link, preface, revoke order and logging; ADR 0011 threat table, row "Old role remains"; ADR 0012 "Every operation documents `500`" (login exceptions) and the dependency list (`github.com/google/uuid`).

Amendment 2026-11-02 (review 5). Decided by the architect after the fourth contract review. New cross-cutting rules, each decided in the ADR named:
- **Login binding and PKCE storage:** the cookie `ol_login` binds a login attempt to the browser, and `login_attempts` stores the PKCE verifier (ADR 0005 review 5, ADR 0006).
- **Upstream failures in the gateway:** 503 `service_unavailable` when the gateway cannot connect to an upstream, 500 `internal_error` for other proxy errors, and the login redirect on the two login routes (ADR 0002 review 5).
- **Parameter binding errors** of the generated servers go to `ErrorHandlerFunc`, which every server sets (ADR 0012 review 5).
- **No secret in any container log:** `frontend` writes no access log, both Nginx containers log errors at `emerg` only, PostgreSQL logs no bind values (ADR 0008 and ADR 0009 review 5, ADR 0007 "Logging").
- **Network segmentation** in Compose, which the trust model of ADR 0002 depends on (ADR 0008 review 5).
- **Body `gameId` exception** to step 5 (consolidated item 1 and review 2 step 5 above).

**Supersession list (stale text rewritten in place in review 5, so that the body agrees with the amendments):** ADR 0001 Context (requirements), services, times and generators, amendment 1 (order and time fields); ADR 0002 `/readyz` and trust model; ADR 0003 data (`sessions`, `login_attempts`), transport (the `returnTo` rule is not in transport) and the cache rule; ADR 0004 use case list (`ListGroups`, `GetLobby`), rule 7 (REQ-0005), assumptions on REQ-0003 and the `gameId` lookup order of review 3; ADR 0005 flow, logout, logging, the cache rule and the CLAUDE.md example; ADR 0006 time, roles, migrations, `auth` and `calendar` data model (`games` uuid, `lobbies.game_id`, no `revoked_at`) and the migration consequences; ADR 0007 errors of `POST .../invite-links`, logging and the query string alternative; ADR 0008 PostgreSQL version and roles, logs, health and the frontend image; ADR 0009 error log level and smoke test; ADR 0010 Decision (table, invariants, ports, API table, rule order, consequences and the slug alternative); ADR 0011 threat table; ADR 0012 uuid mapping, runtime dependencies, import rule, test database and the H-list reference; `docs/services.md` status line, logs, data, networks and closed questions.
