# 0002. Service: gateway
Status: Accepted (2026-11-01)

## Context
All external calls must go through an API gateway (CLAUDE.md). The gateway must validate the session for protected calls, but it must not own user data or authorization rules. Each new feature must not require a change in the gateway.

## Decision
`gateway` is a stateless Go service with one responsibility: **routing and session validation**.

The gateway:
- routes to `frontend` (all non-API paths), `auth` and `calendar` according to an explicit route table (allowlist). An unknown path gives 404.
- blocks all `/internal/*` paths with 404.
- validates the session for all `/api/*` except the public auth routes (see below). Validation happens through a call to `auth`'s `POST /internal/sessions/validate` with the cookie value.
- on **all** routes, including public ones, removes all incoming `X-User-*` headers. With a valid session it sets `X-User-Id` and `X-User-System-Admin` (`true` or `false`) from the response (ADR 0011). An invalid or missing session gives 401 without the call reaching the service.
- generates or validates `X-Request-Id` and writes an access log. The log never contains the query string, and it masks the invite token in the paths `/api/invites/{token}`, `/api/invites/{token}/join` and `/invite/{token}` (see the amendment review 4 below and ADR 0007).
- trusts `X-Forwarded-For` and `X-Forwarded-Proto` only from `edge` (ADR 0009). The gateway is not published, so other calls cannot reach it. The values are used for logging and never for decisions about session or authorization.
- exposes `/healthz` and `/readyz`. The gateway has no database, so `/readyz` answers 200 as soon as the server listens, like `/healthz`. It does not check `auth` or other upstreams (ADR 0008): a down `auth` gives 503 on protected calls instead. `edge` forwards both paths like any other path; they reveal only that the gateway process runs.

Public routes (no session requirement): `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/logout`.

The gateway does **not**: perform authorization checks against groups or lobbies (that is `calendar`'s responsibility), cache sessions, rate limit (the login endpoints are limited in `edge`, ADR 0009; invite endpoints are not limited, ADR 0007), or terminate TLS (that is in `edge`, see ADR 0009).

**Implementation:** the standard library's `net/http` and `httputil.ReverseProxy`. No external router or framework.

**Ports:** `gateway` defines `SessionValidator` (`Validate(ctx, sessionToken) (Session, error)`, where `Session{UserID, IsSystemAdmin}`) in the package that uses it. The adapter `authclient` makes the HTTP call to `auth`. Changing the session model affects only the adapter, as long as the port is kept.

**Trust model:** downstream services trust `X-User-Id` and `X-User-System-Admin` and no other headers for identity or role. This is because the gateway is the only way in and the services are not published. The Compose networks enforce it: `auth` and `calendar` share a network only with `gateway`, with each other and with `postgres`, never with `edge` or `frontend` (ADR 0008 review 5). The gateway removes the client's `X-User-*` on all routes, so a client cannot forge them. If this changes (e.g. a service is exposed), the identity must be carried by a signed token. That requires its own ADR.

**Routes for the game list:** `/api/games` and `/api/games/*` go to `calendar` for all methods. Authorization is decided in `calendar`, not in the gateway (ADR 0010, 0011).

## Consequences
- Each API call costs one extra HTTP call to `auth`. On a Pi with a few users this is negligible.
- If `auth` is down, the gateway answers 503 on protected calls. It never lets unsigned requests through (fail closed).
- The gateway has no database and no session state. It can be restarted or run in several instances.
- A new service requires a row in the route table and an ADR. A new public route in an existing service requires only the route table.

## Alternatives considered
- **Validate JWT locally in the gateway:** faster, but logout is not immediate without a revocation list. REQ-0001 requires that the next page view after logout requires a new login. A fixed validation call is simpler.
- **Cache sessions in the gateway:** can be added later if load requires it. It gives delayed logout, so it is not introduced now (YAGNI).
- **The gateway reads `auth`'s database:** breaks the rule that a service reads only its own data.
- **Auth logic in the gateway:** mixes routing and identity. Auth gets its own service (ADR 0003).

Amendment 2026-11-01: the gateway's own error responses follow ADR 0001. An unknown `/api/*` path and all `/internal/*` give 404 `not_found`. The wrong method on a known path gives 405 `method_not_allowed`.

Amendment 2026-11-01 (review 2):
- Public routes without session: `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/logout`. `GET /api/auth/me` needs a session. The paths name no login provider (ADR 0005, ADR 0001).
- The route table lists path and method for every route. For a known path with the wrong method the gateway answers `405 method_not_allowed` itself. For an unknown path and for every `/internal/*` path it answers `404 not_found` (ADR 0001). Neither reaches a service.
- The gateway forwards the `Cookie` header to `auth` only. `calendar` and the frontend never receive the session cookie.
- For routes that need a session, including `GET /api/auth/me`, the gateway sets `X-User-Id` and `X-User-System-Admin`. `auth` reads `X-User-Id` on `/me` (ADR 0003).

Amendment 2026-11-01 (review 4): secrets in logs. This extends the access-log rule in "The gateway" above.
- The gateway's access log writes: method, **path without query string**, status, duration, `requestId`. It never writes `RawQuery`, `RequestURI` or `URL.String()`. The callback carries `code` and `state` in the query (ADR 0005), and the query of other routes is not needed in the log.
- In the path, the token segment of `/api/invites/{token}`, `/api/invites/{token}/join` and `/invite/{token}` (the frontend page also carries the token) is written as `:token`.
- One function in `pkg/httpapi` ("path for logging") builds the logged path and is used by every service that writes a request log. It is shared infrastructure, not domain logic. Nothing else builds a log path by hand.
- **Required tests (gateway, unit):** `/api/auth/callback?code=A&state=B` is logged as `/api/auth/callback`; `/api/invites/TOKEN/join?x=1` as `/api/invites/:token/join`; `/invite/TOKEN` as `/invite/:token`. Each test asserts that the captured log line contains none of the secret values.
- `auth` and `calendar` use the same function if they log requests, with the same test on their log output (ADR 0007).

Amendment 2026-11-02 (review 5): upstream failures and timeouts. New decision; it closes a gap that left the answer to an unreachable `calendar` or `frontend` open.
- **Session validation call:** the `authclient` adapter calls `POST /internal/sessions/validate` with a timeout (named constant, 5 seconds). No answer, a connection error or the timeout gives 503 `service_unavailable` (fail closed, unchanged). The call only reads, so the 503 is always true.
- **Proxied calls:** the `httputil.ReverseProxy` has one `ErrorHandler`. A failure to connect to the upstream (name lookup, connection refused, connect timeout) gives 503 `service_unavailable`: nothing reached the service, so nothing was committed, as the shared `ServiceUnavailable` text says. Every other proxy error (the connection breaks, or the response header timeout passes after the request was sent) gives 500 `internal_error`, because the service may have committed. The response header timeout is a named constant of 30 seconds, below `edge`'s `proxy_read_timeout` of 60 seconds (Nginx default), so the client gets the JSON envelope and not an Nginx page.
- **Login routes:** for the route entries `GET /api/auth/login` and `GET /api/auth/callback` the error handler answers `302` to `/?loginError=login_failed` with `Cache-Control: no-store` instead of JSON, so that login endpoints always redirect, also when `auth` is down (ADR 0005). It is a flag on the two route entries in the route table, not a path check in the handler.
- **One `X-Request-Id` downstream:** the gateway replaces the header on every forwarded call, so a service always receives exactly one value. Two values from a client count as invalid, and a new ID is generated (ADR 0001).
- **Required tests (gateway):** with the upstream address on a closed port: `GET /api/groups` with a valid session gives 503 `service_unavailable`; `GET /api/auth/login` and `GET /api/auth/callback?code=A&state=B` give 302 to `/?loginError=login_failed` with `Cache-Control: no-store`. An upstream that accepts the request and closes the connection without an answer gives 500 `internal_error`. A validation endpoint that does not answer within the timeout gives 503. The log lines of these tests contain no query string (review 4).

Amendment 2026-11-02 (review 6): 405 on the login paths.
- The login-route flag of review 5 applies only to the error handler for proxied calls on the route entries `GET /api/auth/login` and `GET /api/auth/callback`. A wrong method on these paths (for example `POST /api/auth/login`) gets `405 method_not_allowed` as JSON, like every other known path (review 2). The redirect rule in ADR 0005 covers the login flow, which only uses `GET` (ADR 0005, amendment review 6).
- **Required tests (gateway):** `POST /api/auth/login` and `POST /api/auth/callback?code=A&state=B` give `405 method_not_allowed` as JSON, with the same headers as a wrong method on any other known path (for example `POST /api/groups/{groupId}/lobbies/{lobbyId}/players/me`), and reach no upstream. Their log lines contain no query string (review 4).

Amendment 2026-11-02 (REQ-0001 implementation). Decision on the open question of pkg/httpapi.

**7. The path for request logs is built with the gateway (confirmed).** The function that returns the request path for logs (no query string, invite token masked, as ADR 0002 review 4 and ADR 0009 require) is not built in `auth` now. `auth` logs no request paths, so there is no caller. It is built in `pkg/httpapi` in the same change as the gateway's request log middleware, because the gateway is its first consumer. It lives in `pkg/`, not in the gateway, because `calendar` also sees `/api/invites/{token}` and must log the same masked path. Both use the same function, so the masking rule is written once.
- Backend: when the gateway is built, add one function to `pkg/httpapi` (for example `LogPath(r *http.Request) string`: the path without query, with the segment after `/api/invites/` replaced by a fixed placeholder) with a table test, and use it in the gateway's request log. `calendar` uses it when it logs paths.
- Frontend and DevOps: none. The `edge` access log has its own masking (ADR 0009).

Amendment 2026-11-02 (REQ-0001 calendar). Decided by the architect on the gateway points raised with the calendar service and the gateway code.

**1. The route table covers the whole public contract now (decided).** The gateway's route table lists every path and method of `api/auth/openapi.yaml` (public) and `api/calendar/openapi.yaml`, not only the operations that are built. An unbuilt calendar operation reaches `calendar`, which answers `500 internal_error` until it is built (ADR 0001, Amendment 2026-11-02 (REQ-0001 calendar), item 2). Reason: the table is the list of the contract and is needed for the `405` rule. Adding each route when its requirement lands would be a second edit with no protection gained.

**2. Forwarded headers (confirmed).** The gateway passes `X-Forwarded-For`, `X-Forwarded-Host` and `X-Forwarded-Proto` from `edge` through unchanged and adds none. The proxy uses `httputil.ReverseProxy` with `Rewrite` and does not call `SetXForwarded`. Only the access log reads them. No service reads them and no decision uses them (ADR 0009: `edge` sets them and replaces the client's values). A service that needs the client address needs a new decision with its own ADR.

**3. Error logging through the default logger (confirmed with a rule).** Only `cmd/<service>/main.go` calls `slog.SetDefault`. Code whose constructor receives a `*slog.Logger` uses that logger (the routers and handlers of `calendar` and `auth`, and `pkg/httpapi.InternalErrorHandler(logger)`). Helpers without such a parameter (`pkg/httpapi.WriteError`, and the gateway's session-validation middleware when it has no logger in its constructor) log with `slog.*Context` on the default logger. Reason: those helpers would otherwise need a logger parameter at every call site. The reviewer checks that no other package calls `SetDefault` and that no package-level logger variable is added. Backend: if the gateway's session middleware is built with a logger in scope, it uses that logger.

Amendment 2026-11-10 (proposed, ADR 0018, 0019, 0020; applies when those are accepted): three routes are added to the route table, each with a session: `GET /api/users/{userId}/avatar` to `calendar`, `GET /api/groups/{groupId}/feed` to `calendar`, and `GET /api/live-updates` to `calendar`. The live-updates route is streamed: the gateway clears the server write deadline for it and passes the body through without buffering (ADR 0019, point 8). The gateway still keeps no state and does not cache sessions.
