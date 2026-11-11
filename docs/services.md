# Service map

Status: Accepted (see ADR 0001–0013). The amendment sections in the ADRs override earlier text that was not rewritten in place. ADR 0001 "Amendment 2026-11-01 (consolidated)" is the final statement of the cross-cutting rules, and ADR 0001 "review 4" and "review 5" list the text rewritten in place. This file reflects the state after review 5 and the operations base amendments of ADR 0008, 0009 and 0012 (2026-11-02), and the REQ-0002 PR A amendments of ADR 0001 and 0004 (2026-11-03). The contracts are `api/auth/openapi.yaml`, `api/auth/internal.yaml` and `api/calendar/openapi.yaml`.

## Overview

```
Browser
   │  HTTPS (443). HTTP (80) redirects to HTTPS
   ▼
edge (Nginx)                          TLS, redirect, security headers (ADR 0009)
   │
   ▼
gateway ──────────────► frontend      (/ and all non-API paths)
   │  validates session, sets X-User-*
   ├──────────────► auth              (/api/auth/*)
   │                 ▲
   └──────────────► calendar          (/api/groups*, /api/invites*, /api/games*)
                     │  name lookup (internal HTTP)
                     └────────────► auth

certbot (sidecar)  renews certificates into a volume that edge reads (ADR 0009)
```

Each arrow is a shared Compose network; no other pair of containers shares one (ADR 0008 review 5). `auth` also has an egress network for Discord (login, and the picture taken at login, ADR 0018), and `postgres` is reached only by `auth`, `calendar` and their migration jobs.

All services use synchronous HTTP/JSON. The exceptions to JSON responses are the live updates stream, a server-sent events connection from `calendar` through `gateway` to the browser that carries only a change signal (ADR 0019), and the picture of a member (ADR 0018). No service reads another service's database. No service is exposed publicly except `edge`, which only forwards to `gateway`.

## Services

### edge (Nginx, no Go service)
- **Responsibility:** public entry point. TLS, HTTP→HTTPS redirect, HSTS, `Referrer-Policy`, forwarded headers to `gateway`, unbuffered forwarding of `/api/live-updates` (ADR 0019), and rate limiting (`limit_req`) of `/api/auth/login` and `/api/auth/callback` (ADR 0009, amendment on rate limiting).
- **Owns data:** nothing. Certificates and keys live in the volume `certs` and are never in the repository.
- **Logs:** access log without query string and with the invite token masked (`log_format` from `$uri`, ADR 0009 review 4); error log level `emerg`; no response temporary files (ADR 0009 review 5).
- **Dependencies:** `gateway`. Shares volumes with `certbot`.
- **Realizes:** HTTPS for all traffic (REQ-0001) and the prerequisite for the `Secure` cookie.
- **Decisions:** ADR 0009, 0019.

### gateway
- **Responsibility:** routing (route table with path and method per route), session validation, sets `X-User-Id` and `X-User-System-Admin` from the session and removes the client's own `X-User-*`, forwards the `Cookie` header to `auth` only, correlation ID, answers `404 not_found` and `405 method_not_allowed`, blocks `/internal/*`, answers `503 service_unavailable` or `500 internal_error` when an upstream fails (a redirect on the two `GET` login routes, ADR 0002 review 5; a wrong method on them still gives JSON 405, review 6), access log.
- **Owns data:** nothing.
- **Dependencies:** `auth` (session validation), `frontend` and `calendar` (routing).
- **Realizes:** F-001 (the session part of login), and the prerequisite for F-002–F-005, F-010, F-013, F-017, F-018, F-024, F-028, F-029, F-035 and F-036. The routes for avatars, the group feed and live updates (ADR 0018, 0019, 0020).
- **Decisions:** ADR 0002, 0011, 0018, 0019, 0020.

### auth
- **Responsibility:** login with Discord, user accounts, sessions, logout, display names, and the system admin role (determined by configuration, `SYSTEM_ADMINS`). The provider name is not in any public path (ADR 0005).
- **Owns data (database `auth`):** `users`, `user_avatars` (the Discord picture taken at login, ADR 0018), `sessions` (deleted at logout or after expiry), `login_attempts` (hash of `state`, PKCE verifier, `returnTo`; deleted when used or after expiry). ADR 0005 review 5, ADR 0006.
- **Cookies:** `ol_session` (the session) and `ol_login` (binds a login attempt to the browser, path `/api/auth/callback`, 10 minutes).
- **Dependencies:** Discord OAuth2 (external, behind the port `IdentityProvider`, `golang.org/x/oauth2` in the adapter), Discord's image CDN (external, behind the port `AvatarSource`, at login only, ADR 0018), PostgreSQL.
- **Realizes:** F-001 (REQ-0001), F-029 (REQ-0016: the picture at login and its internal read for `calendar`, ADR 0018), and the role for F-024 (system admin, REQ-0010). The display name and system admin flag for the dashboard (F-028, REQ-0012).
- **Decisions:** ADR 0003, 0005, 0011, 0018.

### calendar
- **Responsibility:** groups, membership and roles (one or more admins, at least one as long as the group has members), invite links expiring after 10 minutes, max uses per link (1–10, default 1), lobbies with game and max players, players joining and leaving lobbies, and the game list (F-024). The game list is managed by the system admin. Members see it ordered by use in their group. Authorization is checked here.
- **Owns data (database `calendar`):** `groups`, `group_events` (the group feed, user IDs only, ADR 0020), `group_members` (with `role` and `joined_at`), `invite_links` (with `expires_at`, `max_uses`, `use_count`), `lobbies` (with `game_id`, `game_name` and `max_players`), `lobby_players`, `games` (the game list with uuid IDs and the optional `genre`, ADR 0010, ADR 0016). Added by ADR 0017 migrations 0006 and 0007 (the game list tables are used by the game list endpoints; the lobby changes are used by create lobby, join and the lobby reads): `game_modes`, `game_roles` (on a game or a mode) and `activities` in the game list; `lobby_role_slots`; on `lobbies` a nullable `game_name` (no game), `game_mode_id`, `mode_name`, `activity_id` and `activity_name`; on `lobby_players` a nullable `game_role_id` (null means flex).
- **Dependencies:** `auth` (display names via internal `POST /internal/users/lookup`, from REQ-0002, with the `hasAvatar` flag of ADR 0018; no call and no Compose dependency before, ADR 0008 amendment REQ-0001 calendar), PostgreSQL.
- **Realizes:** F-002 (REQ-0002), F-003 (REQ-0003, REQ-0009), F-004 and F-017 (REQ-0004), F-005 (REQ-0005), F-018 (REQ-0005, REQ-0009), F-024 (REQ-0009, management by system admin), F-010 (REQ-0006), F-013 (REQ-0007), F-028 (REQ-0012, data only: the group list, each group's upcoming lobbies and `joinedByMe` on each lobby, ADR 0014), F-032 (REQ-0014, data only: `games.genre` and `gameGenre` on lobbies, read live through a join on `games`, ADR 0016). Realized by ADR 0017 (PR1 to PR6): F-027 (REQ-0011), F-033 and F-034 (REQ-0015), game modes, game roles, named activities and open lobbies.
- **Dependencies (proposed):** `auth` also for the picture of a member, read internally (`GET /internal/users/{userId}/avatar`). Calendar serves the picture only after a shared-group check on its own `group_members` (ADR 0018).
- **Realizes (proposed):** F-029 (`hasAvatar` and `GET /api/users/{userId}/avatar` with the shared-group check, ADR 0018), F-035 (live updates signal, ADR 0019), F-036 (group feed, ADR 0020).
- **Decisions:** ADR 0004, 0006, 0007, 0010, 0011, 0016, 0017, 0018, 0019, 0020.

### frontend
- **Responsibility:** React + TypeScript (Vite). The user interface, the live updates module (EventSource, paused notice, reload on signal, ADR 0019), `PersonAvatar` (ADR 0018), the group feed section (ADR 0020), the app shell and dashboard ("Next up", "This week" computed from `calendar` and `auth` data, ADR 0014), local time, filtering of the week view, interpretation of an end time as the next day, game selection from `GET /api/groups/{groupId}/games` with the max prefilled from `defaultMaxPlayers`, player count display ("X/Y players" or "X players"), expiry time and uses of links, error messages based on error codes, 404 page for `invite_invalid`, the genre themes of lobby views and the landing hero (`frontend/src/genres`, ADR 0016), and the page `/systemadmin/games` for the system admin (shown when `isSystemAdmin` is true).
- **Owns data:** nothing. Runs in its own container with static files (Nginx). No access log, error log level `emerg` (ADR 0008 and ADR 0009 review 5).
- **Dependencies:** `gateway` (all API calls).
- **Realizes:** the user interface for F-001–F-005, F-010, F-013, F-017, F-018, F-024, F-028, F-029, F-035 and F-036.
- **Decisions:** ADR 0008 (static web server), 0001, 0011, 0013 (texts and formatting), 0014 (dashboard), 0018 (`PersonAvatar`), 0019 (live updates), 0020 (group feed).

### Shared
- **Databases:** one PostgreSQL 17 instance (ADR 0008), one database per service (`auth`, `calendar`), with two roles each: `<service>` (DML) and `<service>_migrate` (DDL, only the migration job). ADR 0006, 0008, 0012.
- **Migrations:** goose, run by the one-off job `<service>-migrate` (same image) before the service, with `migrate up` and `migrate down`. ADR 0012.
- **Container contract:** one image per Go service, entrypoint `/<service>`, subcommands `serve` (default), `migrate up|down` and `healthcheck`. Configuration only through the variables of ADR 0008 (operations base). Non-root users, except `edge` and `certbot` (ADR 0009).
- **Networks:** one Compose network per group of containers that talk to each other (table in ADR 0008 review 5). The trust in `X-User-*` depends on it.
- **Integration tests:** build tag `integration`, `TEST_DATABASE_URL`, a PostgreSQL service container in CI. With the tag set and the variable missing, the test fails (ADR 0012 review 5, amendment 2026-11-02 item 3).
- **Go:** version 1.27.3 (the `go` line in each `go.mod` and the `golang:1.27.3` image in each Dockerfile). One `go.mod` per service and one for `pkg/`, connected with `replace` (ADR 0012 amendment 2026-11-02, items 1, 2). Lint rules in the root `.golangci.yml` (ADR 0012 amendment 2026-11-02 (REQ-0001 calendar), item 1).
- **Code generation:** oapi-codegen (Go, server in `net/http`, client in `authclient`) and openapi-typescript + openapi-fetch (frontend). One configuration file per generated target next to the contract in `api/<service>/` (ADR 0012, review 2). Generated code is checked in and CI verifies that it is in sync with `api/`.
- **Contract lint:** Redocly CLI, a development dependency in the root `package.json`. Script `npm run lint:api` (ADR 0012, review 2).
- **Shared code in `pkg/`:** infrastructure only: logging, configuration from environment variables, HTTP middleware (correlation ID, request body limit, error envelope, uuid form check, generator error handlers, health endpoints). The path for request logs without query and with the invite token masked (ADR 0002 amendment review 4) is added with the gateway, not before (ADR 0002 amendment 2026-11-02, item 7).

## Endpoints (overview, not the contract)

Public endpoints (via `gateway`, which receives traffic from `edge`):

| Method | Path | Service | Session | Requirement |
|---|---|---|---|---|
| GET | `/api/auth/login` | auth | no | REQ-0001 (`?returnTo=`, 302 to Discord, sets `ol_login`, ADR 0005) |
| GET | `/api/auth/callback` | auth | no | REQ-0001 (302 always. Needs `ol_login` equal to `state`, always clears `ol_login`. All errors except denied login redirect to `/?loginError=login_failed`, ADR 0005) |
| POST | `/api/auth/logout` | auth | no | REQ-0001 (204, idempotent, deletes the session) |
| GET | `/api/auth/me` | auth | yes | REQ-0001 (response `{userId, displayName, isSystemAdmin, hasAvatar}`, ADR 0001, 0003, 0011, 0018) |
| POST | `/api/groups` | calendar | yes | REQ-0002 (creates the admin membership, no link. 400 `invalid_group_name` or `invalid_request`) |
| GET | `/api/groups` | calendar | yes | REQ-0002 (groups where the caller is a member, no order required) |
| GET | `/api/groups/{groupId}` | calendar | yes, member | REQ-0002 |
| DELETE | `/api/groups/{groupId}/membership` | calendar | yes, member | REQ-0006 (transfers the admin role when the last admin leaves) |
| PUT | `/api/groups/{groupId}/admins/{userId}` | calendar | yes, admin | REQ-0008 (makes a member admin, idempotent, 204. Order: invalid `userId` form `member_not_found`, non-member `group_not_found`, non-admin `not_allowed`, unknown member `member_not_found`) |
| GET | `/api/groups/{groupId}/invite-links` | calendar | yes, member | REQ-0002, REQ-0007 (member: own active links; admin: all active links, with token so they can be copied. Fields `id`, `token`, `createdByUserId`, `expiresAt`, `useCount`, `maxUses`. Response `Cache-Control: no-store`) |
| POST | `/api/groups/{groupId}/invite-links` | calendar | yes, member | REQ-0002, REQ-0007 (body `{maxUses}`, optional. Omitted or `null` gives 1. 201 response with `id`, `token`, `createdByUserId`, `expiresAt`, `useCount`, `maxUses`. `invalid_max_uses` for an integer outside 1–10, `invalid_request` for a wrong type. ADR 0007) |
| DELETE | `/api/groups/{groupId}/invite-links/{linkId}` | calendar | yes, link creator or admin | REQ-0002 delivers admin only; REQ-0007 adds the creator (ADR 0007 item 10). Until then a non-admin gets 403 `not_allowed`. (order: membership, link exists, permission, active. Inactive link gives `404 invite_invalid`, ADR 0007) |
| GET | `/api/invites/{token}` | calendar | yes | REQ-0002 (active link: `groupId`, `groupName`, `isMember`; 404 `invite_invalid` if revoked, expired, used up or unknown, or the token has an invalid form. ADR 0007 amendment 2026-11-02) |
| POST | `/api/invites/{token}/join` | calendar | yes | REQ-0002 (404 `invite_invalid` as above. Counts one use for a new membership) |
| GET | `/api/games` | calendar | yes, system admin | REQ-0010 (the game list for the system admin page; non-admin `not_allowed`. Response `[{id, name, defaultMaxPlayers, genre, gameRoles, modes}]` (ADR 0017: `gameRoles` and `modes` always sent, with the roles and activities of each mode, in the order entered), sorted by name ignoring case, then `id`, ADR 0010 consolidated) |
| POST | `/api/games` | calendar | yes, system admin | REQ-0010 (ADR 0010 review 3. Body `{name, defaultMaxPlayers}`, 201 with the generated `id`. ADR 0017: optional `gameRoles` and `modes` arrays. Order: `invalid_request`, `not_allowed`, `invalid_game` (name, including `Other`), `invalid_capacity`, `invalid_genre`, `invalid_game_role`, `invalid_mode`, `invalid_activity`, then `game_taken`, `mode_taken`, `game_role_taken`, `activity_taken`) |
| PUT | `/api/games/{gameId}` | calendar | yes, system admin | REQ-0010 (ADR 0010 review 3. Body `{name, defaultMaxPlayers}`, 200. ADR 0017: optional `gameRoles` and `modes` arrays; omitted or `null` keeps the stored ones, an empty array removes them. Order: `game_not_found` (invalid form in path), `invalid_request`, `not_allowed`, `invalid_game`, `invalid_capacity`, `invalid_genre`, `invalid_game_role`, `invalid_mode`, `invalid_activity`, `game_not_found` (unknown), `invalid_request` (repeated or foreign `id`), then `game_taken`, `mode_taken`, `game_role_taken`, `activity_taken`) |
| DELETE | `/api/games/{gameId}` | calendar | yes, system admin | REQ-0010 (ADR 0010 review 3. 204. Order: `game_not_found` (invalid form in path), `not_allowed`, `game_not_found` (unknown). Lobbies keep their game name) |
| GET | `/api/groups/{groupId}/games` | calendar | yes, member | REQ-0009 (ADR 0010 review 3. The game list in the order of use in the group: most lobbies first, then by name ignoring case, then `id`; `Other` is not included and is shown last by the client. Non-member `group_not_found`) |
| GET | `/api/groups/{groupId}/lobbies` | calendar | yes, member | REQ-0004 (all upcoming lobbies, sorted by start time, without interval filter; shows `gameName` (`null` for an open lobby, ADR 0017), `maxPlayers`, `playerCount`. ADR 0017: `Lobby` also carries `gameId`, `modeId`, `modeName`, `activityId`, `activityName`, `flexCount` and `roleSlots` (`[{gameRoleId, name, slots, playerCount}]`); All of them are always sent, with `null` for `gameId` (custom name), `modeId`, `modeName`, `activityId` and `activityName` when unset. All role slots of the group come from one extra query) |
| POST | `/api/groups/{groupId}/lobbies` | calendar | yes, member | REQ-0003, REQ-0009 (`startsAt`, `endsAt` as RFC 3339, both required. At most one of `gameId` or `customGameName`; neither gives an open lobby (no game, ADR 0017). `maxPlayers` omitted, `null` (unlimited) or an integer from 1 to 2147483647. Order: `invalid_request`, `group_not_found`, then the lobby rules. 201 response `Lobby` without `players`. ADR 0017: optional `modeId`, `activityId`, `roleSlots`, `gameRoleId` (the creator's seat) and `flex`; order after the time rules: game, mode, activity, roles and max players, seat.) |
| GET | `/api/groups/{groupId}/lobbies/{lobbyId}` | calendar | yes, member | REQ-0004, REQ-0005 (shows the players who have joined, each with `gameRoleId` (`null` for flex, ADR 0017). `lobby_not_found` also after the end time, since past lobbies are not shown, ADR 0004) |
| DELETE | `/api/groups/{groupId}/lobbies/{lobbyId}` | calendar | yes, creator | REQ-0003 |
| PUT | `/api/groups/{groupId}/lobbies/{lobbyId}/players/me` | calendar | yes, member | REQ-0005, F-018 (ADR 0017: optional body `{gameRoleId, flex}`, also a change of seat for a player. Order: `lobby_not_found`, `lobby_has_ended` (also for a caller who is already a player), `invalid_game_role`, a player with the same seat → 204, a new player: `lobby_full` then `game_role_full`, a player with another seat: `game_role_full`. ADR 0004 rule 7) |
| DELETE | `/api/groups/{groupId}/lobbies/{lobbyId}/players/me` | calendar | yes, member | REQ-0005 (204 when the lobby exists, also after the end time and idempotent. 404 `lobby_not_found` when the lobby is missing) |
| PUT | `/api/groups/{groupId}/lobbies/{lobbyId}/mode` | calendar | yes, player | ADR 0017 (REQ-0015). Body `{modeId, currentModeId}`, 200 `Lobby` without player names; no auth call (Amendment 2026-11-09). One transaction under the group lock, everything read after the lock. Order: `invalid_request`, `group_not_found`, `lobby_not_found`, `lobby_has_ended`, `not_allowed`, `invalid_mode`, `lobby_changed` (stale `currentModeId`), `lobby_has_more_players`. The same mode changes nothing. A change replaces max players and role slots, clears the activity and makes every player flex |
| PUT | `/api/groups/{groupId}/lobbies/{lobbyId}/activity` | calendar | yes, player | ADR 0017 (REQ-0015). Body `{activityId}`, 200 `Lobby` without player names; no auth call. Order: `invalid_request`, `group_not_found`, `lobby_not_found`, `lobby_has_ended`, `not_allowed`, `invalid_activity` (not of the lobby's mode, or no mode) |
| DELETE | `/api/groups/{groupId}/lobbies/{lobbyId}/activity` | calendar | yes, player | ADR 0017 (REQ-0015). Clears the activity, keeps the mode. Idempotent, 200 `Lobby` without player names; no auth call. Same checks as the PUT, without the value |
| GET | `/api/users/{userId}/avatar` | calendar | yes | ADR 0018 (REQ-0016. The caller's own picture, or the picture of a user who shares a group with the caller. 200 `image/png`, quoted `ETag`, 304 on `If-None-Match`, `nosniff`. No picture, no shared group or `userId` of invalid form: 404 `avatar_not_found`) |
| GET | `/api/groups/{groupId}/feed` | calendar | yes, member | ADR 0020 (REQ-0018. Array of `FeedEvent`, newest first, last 7 days, at most 20. Non-member `group_not_found`) |
| GET | `/api/live-updates` | calendar | yes | ADR 0019 (REQ-0017. `text/event-stream`: event `groupChanged`, data = group ID. No lobby data. Ends after 10 minutes, the browser reconnects) |
| PUT | `/api/groups/{groupId}/lobbies/{lobbyId}/game` | calendar | yes, player | ADR 0017 (REQ-0015). Body `{gameId}`, 200 `Lobby` without player names. Sets the game of a lobby with no game, copied into the lobby; a game once set never changes. Order: `invalid_request`, `group_not_found`, `lobby_not_found`, `lobby_has_ended`, `not_allowed`, `invalid_game`, `lobby_game_set` (a lobby with a game or a custom name) |

Internal endpoints (not public, blocked by `gateway`, reachable only on the internal network `services`, ADR 0008):

| Method | Path | Caller | Service |
|---|---|---|---|
| POST | `/internal/sessions/validate` | gateway | auth (response `{userId, isSystemAdmin}`; empty token gives 401) |
| POST | `/internal/users/lookup` | calendar | auth (at most 100 IDs per call, more gives 400 `invalid_request`, ADR 0003; returns the name and `hasAvatar`, ADR 0018) |
| GET | `/internal/users/{userId}/avatar` | calendar | auth (the picture bytes, quoted ETag, 304, 404; no membership check, ADR 0018) |

Headers from the gateway to `calendar` (ADR 0002, 0011): `X-User-Id` (uuid) and `X-User-System-Admin` (`true` or `false`). The gateway removes the client's `X-User-*` on all routes. The session cookie is not forwarded to `calendar`.

Notes:
- A non-member gets `404 group_not_found` instead of 403, so that the group's existence is not revealed.
- Unknown, revoked, expired or used-up invite link gives `404 invite_invalid`. The response is the same in all cases.
- The member list shows role (`admin` or `member`), ordered by `joined_at`, then `user_id` (ADR 0001, Amendment 2026-11-03). Display names come from `auth`. A missing or empty name there is a server error (`500 internal_error`), never an empty name in the list (ADR 0004, Amendment 2026-11-03).
- A system admin has no rights in a group. Group and lobby endpoints give the same response as for anyone else (ADR 0004 rule 11).
- Order of checks in every endpoint (shape before membership), the `required` rule and the defaults for omitted fields, and the shape rules (wrong JSON type, missing time, body over 16 KiB, invalid uuid in path): ADR 0001, "Amendment 2026-11-01 (consolidated)".
- Times are RFC 3339. Any offset is accepted; responses are always UTC with `Z` (ADR 0001).
- Error codes and status codes: the table under "Error codes" below. The source is `enum` in `api/`.
- Login errors (`loginError=login_denied` and `login_failed`) are redirects and are not part of the table (ADR 0005).
- Leaving a lobby gives 204 for a member when the lobby exists, also after the end time and even if the member was not a player. Lobby missing → `404 lobby_not_found` (ADR 0004 rule 7).

## Error codes

The source is `enum` in `api/` (`auth/openapi.yaml` and `calendar/openapi.yaml` for the public codes). The table is the overview. Order and rules: ADR 0001.

| Code | HTTP | Used when |
|---|---|---|
| `unauthenticated` | 401 | No valid session, or `X-User-Id` missing or invalid in calendar; `X-User-Id` missing on `auth` `/me` |
| `not_allowed` | 403 | The caller lacks permission (non-admin, non-creator, non-system-admin) |
| `group_not_found` | 404 | The group is missing, the caller is not a member, or `groupId` has an invalid form |
| `member_not_found` | 404 | The user is not a member of the group, or `userId` has an invalid form |
| `avatar_not_found` | 404 | calendar (ADR 0018): the user has no picture, the caller shares no group with the user, or `userId` has an invalid form |
| `lobby_not_found` | 404 | The lobby is missing, the end time has passed on GET, or `lobbyId` has an invalid form |
| `invite_invalid` | 404 | The link is unknown, revoked, expired or used up, or the token or `linkId` has an invalid form |
| `game_not_found` | 404 | The game is missing (PUT, DELETE), or `gameId` in the path has an invalid form |
| `not_found` | 404 | Gateway only: unknown `/api/*` path or `/internal/*` path |
| `method_not_allowed` | 405 | Gateway only: wrong method on a known path |
| `invalid_request` | 400 | Invalid JSON, a value of the wrong JSON type, a required time that is missing or not RFC 3339, a body over 16 KiB, an invalid uuid in a lookup, more than 100 IDs in lookup. Checked before membership |
| `invalid_group_name` | 400 | Name empty after trim, over 50 characters, or missing |
| `invalid_max_uses` | 400 | `maxUses` is an integer outside 1–10 |
| `lobby_in_past` | 400 | `startsAt` is not in the future |
| `lobby_end_not_after_start` | 400 | `endsAt` is not after `startsAt` |
| `lobby_too_long` | 400 | The lobby is 24 hours or longer |
| `invalid_game` | 400 | Lobby: unknown `gameId` (also a value not in uuid form), both or neither of `gameId` and `customGameName`, invalid `customGameName`. Game list: name missing, empty after trim, over 50 characters, or `Other` (ignoring case) |
| `invalid_capacity` | 400 | `maxPlayers` or `defaultMaxPlayers` is an integer under 1 or over 2147483647 (`null` means unlimited) |
| `lobby_has_ended` | 409 | Joining when the end time has passed, also for a player who is already in the lobby |
| `lobby_full` | 409 | Joining when all spots are taken |
| `own_upcoming_lobbies_exist` | 409 | Leaving a group with own upcoming lobbies |
| `game_taken` | 409 | Name (case-insensitive) already used by another game |
| `invalid_mode` | 400 | Mode name invalid in the game list. Lobby: unknown mode, a mode not of the lobby's game, or a mode given for a lobby with no game (including "Other") |
| `mode_taken` | 409 | Mode name already used in the game |
| `invalid_activity` | 400 | Activity name invalid in the game list. Lobby: unknown activity, an activity not of the lobby's mode, or a lobby with no mode |
| `activity_taken` | 409 | Activity name already used in the mode |
| `invalid_game_role` | 400 | Game list: role name invalid (1–30 characters after trim). Lobby: unknown or malformed `gameRoleId`, duplicate in `roleSlots`, a seat missing or extra for the lobby's roles, or roles given for a lobby without roles |
| `game_role_taken` | 409 | Game role name already used by another role of the same owner (the game, or the mode), ignoring case |
| `game_role_full` | 409 | The chosen game role has no free slot (join or change of seat, ADR 0017) |
| `lobby_game_set` | 409 | The lobby already has a game or a custom name (`customGameName`), ADR 0017 |
| `lobby_changed` | 409 | `currentModeId` is not the lobby's current mode (another change was saved first) |
| `lobby_has_more_players` | 409 | The new mode's limit is below the number of players |
| `service_unavailable` | 503 | A dependency (auth, database) does not respond. Never after a committed write |
| `internal_error` | 500 | Unexpected error. No details to the client. Documented on every operation |

## Open questions and risks

Proposed, ADR 0018 to 0020. Decided by the user on 2026-11-10:
- A picture is served only to the owner and to members who share a group with the owner (ADR 0018).
- Animated Discord pictures are shown as their first frame (ADR 0018).
- A feed line shows the current name of the person (ADR 0020, point 6).
- A feed line shows the lobby's start time (ADR 0020, point 5).
- The feed starts empty at release, without events for existing lobbies (ADR 0020).

Open, for the user: a lobby link in a feed event (ADR 0020, open questions).

Confirmed by the user (closed, see ADR 0004, 0006, 0007, 0010, 0011):
- **Exactly 24 hours is rejected** (`lobby_too_long`), as REQ-0003 states. An end with the same clock time as the start gives `lobby_end_not_after_start` (REQ-0003, ADR 0004 rule 6).
- **Leaving a lobby is always allowed,** even after the end time. **Joining** is allowed until the end time, including while the lobby is ongoing, and only if a spot is free (`lobby_full`). See ADR 0004 rule 7.
- **Max players per lobby** (F-018): empty = unlimited (`null` in the API). The creator counts. The limit applies to joins under the group's lock (ADR 0006).
- **Max uses per invite link:** 1–10, default 1 at creation when omitted or `null` (the user's decision, to counter bots). Uses are counted when a new membership is created, under the group's lock. An exhausted link gives `invite_invalid` (ADR 0007).
- **Admins copy other members' links:** yes. An admin sees the token for all active links in the group (ADR 0007).
- **Game list in calendar** (ADR 0010): the table `games`, managed by the system admin in the app (`/api/games`, ADR 0011). Members and group admins cannot change it. The operations role `calendar_ops` is removed.
- **System admin** is set in configuration (`SYSTEM_ADMINS` in `auth`, ADR 0011). No management in the app. No rights in groups.
- **Crossing midnight is allowed** (DECISION in REQ-0003).
- **Past lobbies remain** with `created_by_user_id` for members who have left, without being shown. No cleanup in MVP.
- **Links from members who leave are removed** when the member leaves the group.
- **Inactive invite links are cleaned up** (expired or used up) when a new link is created in the group. Inactive links in inactive groups remain until the group creates a new link or is deleted (ADR 0007).
- **Own upcoming lobbies must be removed before leaving** (`own_upcoming_lobbies_exist`).
- **No max limit** on members. **No Discord server** is required (ADR 0005).
- **Game list** (ADR 0010, REQ-0009): starting content Counter-Strike 2, World of Warcraft, League of Legends and Overwatch, all with default max 5. No upper limit for max. The lobby stores the game name and the game's uuid (`game_id`, no foreign key). Game IDs are uuids generated by the system (review 3). Members see the list ordered by use in their group (review 3).

Closed with the product owner (requirement texts):
- **REQ-0005, leaving when the lobby is missing:** the API returns `404 lobby_not_found` (ADR 0004 rule 7). REQ-0005 states the case ("the lobby no longer exists", no error dialog).
- **REQ-0010 (F-025), change log:** REQ-0010 excludes "a history or change log of the game list for users". The operations log of ADR 0010 (every write logged at info level with `actorUserId`) is not a user feature, so the two agree. Closed (review 5).
- **The term "System admin"** has been added to `docs/product/vision.md`. The architect uses "group admin" in the ADRs where "admin" appears in the requirement text.

Decided by the user (review 3, 2026-11-01). The product owner updates REQ-0009 and REQ-0010 to match (ADR 0010 amendment review 3):
1. **Game ID:** a uuid generated by the system. The system admin types only the name and the default max.
2. **Reserved name "Other":** a game in the list cannot be named "Other" (ignoring case and surrounding spaces). Free text for a lobby named "Other" is not restricted.
3. **Order of the game choice:** most lobbies in the group first (all time, custom names not counted), then by name, `Other` last.

Closed by the user (2026-11-01):
4. **Join after the end time (REQ-0005):** a player who presses "join" again after the end time gets `409 lobby_has_ended`, and the frontend shows the lobby as "Ended". The order b before c in ADR 0004 rule 7 stands. REQ-0005 is updated.

Confirmed in the requirements (closed):
- **Several admins.** An admin can make a member admin. No one can remove an admin role in MVP. The creator becomes admin (DECISION in REQ-0002).
- **Transfer:** when the last admin leaves, the role goes to the member with the earliest `joined_at`, counted from the latest join. If an admin leaves and other admins remain, nothing changes (DECISION in REQ-0006).
- **Links:** members see only their own links. Admins see all active links in the group, to be able to copy and revoke (DECISION in REQ-0002).
- **The group row lock** (ADR 0006) ensures that two admins who leave at the same time cannot leave the group without an admin. A technical rule, not a requirement.

To the user (remaining):
- **Public entry (ADR 0009).** Requires a domain name, public IPv4 and forwarded ports 80/443. With CGNAT another way in is needed. The answer decides whether the deployment can be carried out.
- **Dependencies:** OpenAPI generators (Go and TS), migration tool, PostgreSQL driver and Redocly lint are decided in ADR 0012. `golang.org/x/oauth2` is decided in ADR 0005 (review 5). Nginx, certbot and Let's Encrypt are decided in ADR 0009.
- **Rate limiting on login and callback:** decided in ADR 0009 (amendment on rate limiting): `limit_req` in `edge`, 10 requests per minute per address, a limited request is redirected to `/?loginError=login_failed`. No Go code. The requirement comes from the backend expert's guidelines, not from CLAUDE.md. DevOps implements it in `infra/edge/`.
