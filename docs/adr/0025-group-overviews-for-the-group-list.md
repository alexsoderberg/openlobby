# 0025. Group overviews: one new read in calendar for the Group list
Status: Proposed (2026-11-13)
Requirement: REQ-0024 (F-043). Builds on ADR 0014 (the dashboard reads `GET /api/groups`; the Next up rule), ADR 0017 (lobby fields and labels), ADR 0003 (names from auth, batches of 100) and the `inSnapshot` read rule in calendar's `store.go`. ADR 0018 (the avatar flag, to come) extends it later. Adds one public route to `calendar`, routed by `gateway`. No new schema in `auth`, no new service, dependency or asynchronous communication.

## Context
- The Group list at `/groups` shows, per group, the member count, up to five members (avatars, or initials until REQ-0016), and the next lobby or "No upcoming lobbies". Sorted by name ignoring case. No live updates (REQ-0024).
- Today `GET /api/groups` returns `GroupSummary` (`id`, `name`). The dashboard calls it too (ADR 0014), so it must stay cheap and must not depend on `auth`.
- Member names come from `auth` (ADR 0003). The shared-group rule (ADR 0018) holds by construction here: the reads start from the caller's own memberships, so every member shown is in a group the caller is in. No separate check is needed for the names. ADR 0018 is still Proposed; its avatar flag follows the same rule.
- REQ-0024 asks that the number of requests does not grow with the number of groups.

## Decision

### 1. Endpoint and contract
- DECISION (architect, accepted by the user, 2026-11-13): the route `GET /api/group-overviews` and the backend term "Group overview" (the frontend term stays "Group card").
- New route `GET /api/group-overviews` (operation `listGroupOverviews`, `api/calendar/openapi.yaml`). Session required. Answer: an array of `GroupOverview`, one for each group the caller is a member of, sorted by `lower(name)`, then `id`. An empty array when the caller is in no group.
- The caller is the user ID from `X-User-Id`, set by `gateway` from the session (ADR 0002). It is never read from the path or the body.
- `GroupOverview` = `GroupSummary` plus, all required, nullable fields `x-omitempty: false`:
  - `memberCount` (integer, at least 1, includes the caller);
  - `members`: `UserRef[]`, at most 5, the members who joined first (`joined_at`, then `user_id`);
  - `nextLobby`: `NextLobby`, or `null`.
- `NextLobby`: `gameName`, `modeName`, `activityName` (nullable names as on `Lobby`), `gameGenre` (nullable `Genre`), `startsAt`, `endsAt`, `playerCount`, `maxPlayers` (nullable: unlimited). DECISION (user, 2026-11-13): no lobby `id`. The whole card opens the Group view.
- The next lobby of a group is its lobby with `ends_at > now` and the smallest `(starts_at, id)`. Running lobbies count. Lobbies the caller has not joined count (REQ-0024). This is the Next up rule (ADR 0014) for one group.
- Errors: `unauthenticated` (gateway), `service_unavailable` when `auth` gives no names (ADR 0001). No new error code.
- Why a new route and not `GET /api/groups`: the dashboard would wait for `auth` on every load, and fail when `auth` is down, because it shares the list. The contract of `GET /api/groups` stays as it is.

### 2. Application (`calendar`)
- Port `GroupOverviewReader` (defined in `application/ports.go`, implemented in `infrastructure/postgres`): `Overviews(ctx, userID string, now time.Time) ([]domain.GroupOverview, error)`. It returns each group with its name, member count, first five member IDs in order and next lobby or nil.
- Use case `Groups.ListOverviews(ctx, userID)`: take `now` from the existing `Clock` and pass it to the reader; collect all member IDs; call the existing `UserDirectory.DisplayNames` once (not called when the list is empty); fill the names. No new `auth` port.
- Avatars (ADR 0018, later): the same `UserDirectory` gets `hasAvatar`, and `UserRef` carries it, so the card gets the flag without a change here.

### 3. Adapter (`calendar`, PostgreSQL)
One read in one read-only snapshot (`inSnapshot`, `store.go`), two statements:
- (a) the caller's groups, with the member count as a subquery, and one `LEFT JOIN LATERAL` that returns the group's next lobby (`ORDER BY starts_at, id LIMIT 1`, `ends_at > $2`, player count as a subquery), joined to `games` for the genre;
- (b) the members of the caller's groups: `row_number() OVER (PARTITION BY group_id ORDER BY joined_at, user_id)` is computed in a subquery or CTE, and the outer query keeps `rn <= 5`. A window function cannot be filtered in the same `WHERE`.

Two statements, not one: one row per member would repeat the lobby columns, and an array aggregate would need driver-specific scanning (pgx). The adapter assembles the two results in Go.

Load on the Raspberry Pi (ADR 0008): (a) probes `lobbies_group_id_game_id_idx` per group and sorts a few lobbies; the member count uses the primary key prefix. (b) reads the members of the caller's groups, at friend scale 3 to 15 per group. No new index (YAGNI). Upgrade path when measured slow: an index on `lobbies (group_id, starts_at)`.

### 4. Transport and gateway
- `calendar` handler and route; `gateway` route `GET /api/group-overviews` with `session: true` (ADR 0002). The path is written in the same form everywhere: `/api/group-overviews`, exact, without `*`, because the route has no sub-paths.
- `docs/services.md`: the route row and the gateway's path list. The architect updates it in this change.

### 5. Live updates
None. The Group list does not subscribe to `GET /api/live-updates` (REQ-0024). Neither the port nor the handler has an event.

## Consequences
- The `/groups` page makes one request to `calendar`. `calendar` makes two statements and, when there are groups, one `auth` call that the adapter batches (ADR 0003).
- The dashboard path is unchanged: `GET /api/groups` has no `auth` call and no new fields.
- The Group list depends on `auth` for names, like the Group view does. When `auth` is down the page shows the error with retry (REQ-0024), not names without the people.
- A member's name on a card is read at each load. No copy is kept (ADR 0003).

## PR slices
| PR | Owner | Scope | Tests |
|---|---|---|---|
| PR1a | backend-expert (opus) | Contract `GroupOverview`, `NextLobby`, operation `listGroupOverviews`, generated Go and TS types in the same PR; domain type; port `GroupOverviewReader`; PostgreSQL adapter (statements (a) and (b)) | Integration (real DB): non-member groups absent; order by `lower(name)` then `id` (mixed case); member count includes the caller; five earliest members with a tie on `joined_at`; next lobby skips ended and deleted lobbies and other groups' lobbies; Running counts; earliest by start then `id`; no lobby gives `null`; genre from the game, `null` for no game or "Other"; `maxPlayers` `null` when unlimited |
| PR1b | backend-expert (opus) | Use case `Groups.ListOverviews` (names filled with one `DisplayNames` call); handler; `gateway` route | Unit (fakes): no groups gives no names call; names are filled in order; the use case passes the Clock time to the reader; an `auth` error is returned. Transport: arrays are `[]`, not `null`; nullable keys present; at most five `members`. Gateway: route requires a session |
| PR2 | ui-ux-expert (opus) | `/groups` uses `GET /api/group-overviews` and no other request; the Group card (name, "N members", initials row with "+N", lobby line, "Running" in place of the start, "No upcoming lobbies"); loading, error with retry, empty state unchanged; one link per card; no live updates | Unit: lobby line and label rule (shared with the other lobby views); "+N" count; sort kept from the server. Component: one request to `/api/group-overviews` per load; loading state; error with retry; empty state; "No upcoming lobbies"; "Running" for a lobby in progress; a lobby with no max players; one column on phones; the card link is at least `--size-tap` high on touch (44px); one focus stop per card with a visible focus ring; Enter opens the card (it is a link, so Space does not); no nested control; with reduced motion the card has no transition; the member count is the only text read for the members |

Order: PR1a, then PR1b, then PR2, because the frontend types come from PR1a. DevOps: none.

## Alternatives considered
- Extend `GET /api/groups` with the overview fields: one route fewer. Rejected: the dashboard would take the `auth` call and its failure mode on every load.
- One request per group from the frontend (the dashboard pattern, ADR 0014): N requests, against REQ-0024. Rejected.
- Copy display names into `calendar`: forbidden by ADR 0003. Rejected.
- Aggregate the members as JSON or arrays in SQL: needs driver-specific scanning. Rejected in favour of two statements in one snapshot.
- A composite index now: no measured need at friend scale. Rejected (YAGNI).

## Open questions
None. Both were settled on 2026-11-13: the endpoint and term are DECISION (architect, accepted by the user, 2026-11-13) in section 1, and the `nextLobby` without a lobby ID is DECISION (user, 2026-11-13) in section 1.
