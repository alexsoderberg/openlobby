# 0001. Base architecture
Status: Accepted (2026-11-01)

## Context
The MVP of OpenLobby consists of the requirements REQ-0001–0010 and, from Amendment 2026-11-04, REQ-0012. They build on one core flow: login, group, lobby, overview, joining a lobby, leaving a group and revoking an invite link, plus the group admin role, the game list and the system admin role. The stack is already decided in CLAUDE.md: microservices behind an API gateway, Go for the backend, React + Vite for the frontend, Discord OAuth2, PostgreSQL, Docker Compose on Raspberry Pi 5.

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

Amendment 2026-11-02 (REQ-0001 implementation). Decisions on the open questions of the backend and frontend for REQ-0001. Where this amendment differs from earlier text, this amendment governs.

**8. Database errors: 503 only when the database did not answer (refines "service_unavailable" in amendment 2026-11-01).** `service_unavailable` (503) is given only when the database connection did not answer: a connection that cannot be opened or that broke, a network error, `driver.ErrBadConn`, and PostgreSQL errors with SQLSTATE class `08` (connection exception), `53` (insufficient resources) or `57` (operator intervention). Every other database error is a SQL error or a bug. It gives `500 internal_error`, is logged with the request ID, and reaches the client without details. Reason: a SQL bug must not look like an outage in operations.
- The mapping stays in the adapter. `infrastructure/postgres` `translate()` is the only code that knows `pgx`. It returns `domain.ErrUnavailable` for the cases above and no domain error for the others. The transport already maps `ErrUnavailable` to 503 and every other error to 500.
- Backend: change `translate()`. Required unit test (no database, table-driven): `*pgconn.PgError` with code `42601` is not unavailable; code `08006` is unavailable; `*pgconn.ConnectError` and a `net.Error` are unavailable; `sql.ErrNoRows` is `ErrNotFound`. A `500` case goes through the transport test with an error that is not `ErrUnavailable`.
- DevOps: none.
- Amendment 2026-11-02 (REQ-0002): SQLSTATE `55P03` (`lock_not_available`, raised when `lock_timeout` expires) is also unavailable. Reason: a lock wait that hits its deadline means the database could not serve in time, the same as a timeout, and the client may retry. The `translate()` table test gains a case: `*pgconn.PgError` with code `55P03` is unavailable. `auth` takes no group locks and sets no `lock_timeout`, so its `translate()` needs no change; a service that adds lock waits adds `55P03` to its own list.

**9. Identity and cookie are read by transport middleware (confirmed).** `withCredentials` in `services/auth/internal/transport/credentials.go` reads the `ol_session` cookie and `X-User-Id` before the generated handler. Reason: the identity rule (step 0, amendment 2026-11-01 consolidated) is 401 `unauthenticated` for a missing or invalid `X-User-Id`. A declared header or cookie parameter would fail binding first and answer 400 `invalid_request`, and the cookie is optional for logout (idempotent).
- Backend: no change. Do not declare `ol_session` or `X-User-Id` as parameters in `api/auth/*.yaml`. The contract may describe them in `description` text.
- Frontend and DevOps: none.

**11. Network failure in the frontend (confirmed).** A request that gets no HTTP response (`fetch` rejects) is an `ApiError` with `status` 0 and `code` `service_unavailable`. A `503` response from the gateway or auth is an `ApiError` with `status` 503 and the same code. `status` 0 means "no HTTP response" and is not a status code of the contract. `isUnauthenticated` checks `401` only, so a network failure is never treated as a logged-out user.
- Frontend: no change; `httpApiClient.ts` already maps the rejection with `unreachableError()`. Backend and DevOps: none.

Amendment 2026-11-02 (REQ-0001 calendar). Decided by the architect on the open questions of the calendar service. Where it differs from earlier text, this amendment governs.

**1. Duplicate `X-Request-Id` (decided).** The generated server binds the header parameter before the strict handler. Two values make the binding fail, and the handler answered `400 invalid_request` before the identity check. That contradicts the contract: "a missing or invalid value is replaced by a new one" (`RequestIdHeader`). Decision: `pkg/requestid.Middleware` replaces the request header with the one value it keeps (`r.Header.Set(Header, id)`) before it calls the next handler, in addition to the response header and the context. The generated binding then sees exactly one value. Services need no change.
- `auth` has the same case: both its contracts declare the header and its routers use the same middleware. The same change covers it.
- The gateway uses the same middleware and therefore forwards one value, as ADR 0002 (review 5) requires.
- Required tests: in `pkg/requestid`, two values give one new ID and the request header holds one value. In `calendar` and `auth` transport tests, a request with a valid identity and two `X-Request-Id` headers gets the operation's own answer, not `400`.

**2. Operations not built yet (decided, confirmed).** The stubs in `pendingOperations` return an error. The strict server's `ResponseErrorHandlerFunc` writes `500 internal_error` without details and logs the error. This stays: the contract has no `501`, and no client calls an unbuilt route. The requirement that builds an operation removes its stub. No stub returns `501`. Identity and shape checks run before the stub, so unbuilt operations already answer `401` and `400` correctly. Required test: one transport test calls a pending operation with a valid identity and gets `500 internal_error`.

**3. Body limit (decided, with REQ-0002).** `httpapi.LimitBody` is added to the `Middlewares` list of the router of the service that gets its first operation that reads a body. For `calendar` that is `CreateGroup` (REQ-0002). The order is `requireUserID` first, then `httpapi.LimitBody`, so identity is checked first. Reason: no operation reads a body yet, so the line would have no test and no effect. The router is the place, not each handler; `pkg/httpapi` supplies the function, as `auth` already does for its internal router. Required test with REQ-0002: a body over 16 KiB gives `400 invalid_request`. The edge refuses bodies over 1 MiB with `413` before they reach a service (ADR 0009).

Amendment 2026-11-03 (REQ-0002 PR A). Two ordering rules, stated here because item 6 is the authority for list order:
- **Group members** (`GET /api/groups/{groupId}`, `members`): ordered by `joined_at`, then `user_id`. The tie-break keeps the order stable when two members join in the same instant. The order is the same as the transfer rule of ADR 0004 (rule 5e).
- **Groups of a user** (`GET /api/groups`): no order. The query has no `ORDER BY`, and the contract promises none.

Amendment 2026-11-04 (REQ-0012): the dashboard and the app shell are part of the MVP. The dashboard uses only existing endpoints and adds one additive field (`joinedByMe` on `Lobby`, `calendar`). No new service, dependency or communication style. Decided in ADR 0014.
