# 0014. Dashboard from existing endpoints
Status: Accepted (2026-11-04)

## Context
REQ-0012 (F-028) shows the "Next up" lobby and "This week" across all groups of a member. REQ-0004 excludes cross-group views on purpose; the dashboard is the one exception. The data already exists: `GET /api/groups` (`calendar`) returns the caller's groups as `GroupSummary` (`id`, `name`), `GET /api/groups/{groupId}/lobbies` (REQ-0004, `calendar`) returns each group's upcoming lobbies, including running ones, sorted by `startsAt` and then `id`, and `GET /api/auth/me` (`auth`) gives the display name and system admin flag. Every request passes the gateway, which validates the session with `auth` (ADR 0002).

## Decision
1. **Endpoints.** The dashboard uses only these existing endpoints, plus one additive field (point 5): `GET /api/groups`, `GET /api/groups/{groupId}/lobbies` and `GET /api/auth/me` (display name in the top bar; `isSystemAdmin` for the Game list link on the You page). No new service, endpoint, dependency or asynchronous communication. The data stays in `calendar`; no service reads another service's tables.
2. **Loading.** The frontend loads `GET /api/groups`, then `GET /api/groups/{groupId}/lobbies` for every group in parallel, and computes "Next up" and "This week" in the browser with pure functions.
3. **Next up.** The first lobby of the merged lists by `startsAt`, ties by `id`. This is the sort key the contract already uses, so no new rule is added. Running lobbies count. The lobby list has no group name; the frontend takes it from the `GroupSummary.name` of the group the lobby came from.
   The card shows time or countdown (or "Running"), game (`gameName`), group name and spots (`playerCount` / `maxPlayers`, "Spot / max players"). It shows no player names and makes no detail calls (`GET /api/groups/{groupId}/lobbies/{lobbyId}` is not used by the dashboard).
4. **Errors.** If any request fails, the dashboard shows one page-level error with a retry action. It never shows a partial set of lobbies, because "Nothing booked" would then be wrong. No toasts for this case. Error codes are mapped to texts as in ADR 0013.
5. **Join state.** The card's "Join lobby" / "Leave lobby" button needs to know whether the caller is a player, and `Lobby` has no such field. `Lobby` gets `joinedByMe` (boolean, `true` when the caller is a player). `calendar` computes it in the same list query; on create it is `true`, because the creator is the first player. This is an additive change to `api/calendar/openapi.yaml`, owned by the backend expert, delivered with REQ-0005 (Join/Leave buttons and `joinedByMe` arrive together; until then the card has neither). The Join/Leave button on the card depends on it. Without it the card would need one detail call per lobby, which point 3 excludes.
6. **Route.** DECISION: the dashboard is at `/` when the user is logged in. The logged-out `/` stays the landing page; `App.tsx` chooses between them by session status, as it does today. No `/dashboard` route is added. The Groups tab opens the group list at `/groups` (a frontend page, data from `GET /api/groups`). The group view stays `/groups/{groupId}`. Reason: no extra URL, the path after login is already `/`, and the choice is one branch on session status instead of a redirect.
7. **Timeouts.** The dashboard's requests use the existing API client (`frontend/src/api/httpApiClient.ts`) unchanged and inherit its timeout behavior. This ADR sets no timeout of its own.
8. **Rules in the frontend.** The rules for "Next up" (point 3) and for the week are pure functions, unit tested in the frontend. The week rule: a lobby is in "This week" when it has not ended yet and its time overlaps Monday–Sunday of the current week (local time), including lobbies that started before Monday and are still running (shown in Monday's column on desktop); the Next up lobby is also listed.

## Consequences
- A member with N groups makes N+1 requests through the gateway (one group list, N lobby lists), and each one has its own session validation at `auth` (ADR 0002). On the Raspberry Pi 5 this runs on every dashboard load. It is accepted at friend-group scale (a few groups per member, 3–15 members per group).
- Upgrade path, additive and non-breaking: add `GET /api/lobbies` (or optional `from`/`to` filters on a lobby list) to `calendar`, which returns the lobbies of all the caller's groups in one query. Do it when a member has many groups or the dashboard is measurably slow on the Raspberry Pi. This is a contract change in `api/calendar/openapi.yaml` and needs no new ADR unless a service boundary changes.
- `calendar` gains `joinedByMe` on `Lobby` (point 5). The glossary has the term "Joined by me".
- The product owner aligns REQ-0012 with point 6: the dashboard is at `/`, the group list at `/groups`.

## Alternatives considered
- **New cross-group endpoint in `calendar` now.** One request and a server-side filter. Rejected for now: a new public contract and use case for a load we do not have yet (YAGNI). It is the upgrade path above.
- **A new `dashboard` service.** It would own no data and only join two services. Rejected: no bounded capability and no own data (CLAUDE.md, microservices).
- **Partial dashboard when one group fails.** Rejected: it would hide lobbies silently.
- **Join state from a detail call per lobby.** Rejected: N extra calls on the card. `joinedByMe` costs one boolean in the list query.
- **Drop Join/Leave from the card and open the group view instead.** Rejected for the MVP: the sketch session approved the buttons on the card. This is the fallback if `joinedByMe` is not accepted.
- **Dashboard at `/dashboard`.** Rejected: one more route and a redirect after login, with no gain.
