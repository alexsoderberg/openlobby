# 0003. Service: auth
Status: Accepted (2026-11-01)

## Context
REQ-0001 requires login with Discord and a member account that is created at first login. Sessions must be validatable by the gateway and revocable at logout. Calendar needs display names for members. Identity is its own responsibility with its own pace of change (providers, session rules) and is shared by future domain services.

## Decision
`auth` is a Go service with the responsibility **identity and sessions**.

**Owns data (schema `auth`):**
- `users`: id (uuid), provider, provider_subject_id, display_name, created_at, updated_at. Unique on (provider, provider_subject_id).
- `sessions`: token_hash (primary key), user_id, created_at, expires_at. Logout deletes the row (ADR 0005).
- `login_attempts`: state_hash (primary key), code_verifier, return_to, expires_at. Used once during login and deleted when used (ADR 0005).

**Public endpoints** (via the gateway, see `api/auth/openapi.yaml`):
- `GET /api/auth/login?returnTo=` starts the login and redirects to the identity provider (Discord).
- `GET /api/auth/callback` receives the provider's response, creates or updates the user, sets the session cookie and redirects to `returnTo`.
- `POST /api/auth/logout` revokes the session and clears the cookie. Does not require a valid session.
- `GET /api/auth/me` returns `{userId, displayName, isSystemAdmin}`. `isSystemAdmin` only controls whether the frontend shows the game list page. The server always checks for itself (ADR 0011).

**Internal endpoints** (`api/auth/internal.yaml`, only for gateway and calendar):
- `POST /internal/sessions/validate` takes `{token}` and returns `{userId, isSystemAdmin}` or 401. The role is decided at every validation (ADR 0011).
- `POST /internal/users/lookup` takes `{userIds}` and returns `{users: [{userId, displayName}]}`. Calendar uses it to show names in member lists and players lists.

**Layers** (`services/auth/internal/`):
- `transport`: HTTP handlers, validation of input shape (token, ID lists), cookies. The `returnTo` rule is one function in `domain` or `application`, not in transport (ADR 0005 review 4).
- `application`: `LoginService`, `SessionService`, `UserDirectory` logic. Defines the ports:
  - `IdentityProvider` (`AuthorizationURL(state, codeChallenge)`, `Exchange(ctx, code, codeVerifier)`, PKCE per ADR 0005), returns `ExternalIdentity{Provider, SubjectID, DisplayName}`
  - `UserRepository`, `SessionRepository`, `LoginAttemptRepository`
  - `Clock`, `TokenGenerator`
- `domain`: `User`, `Session`, rules for expiry and revocation, and the value type `SystemAdmins` with `Includes(User) bool` (ADR 0011).
- `infrastructure`: `discord` (IdentityProvider), `postgres` (repositories), `systemclock`, `cryptotoken`.

Discord-specific types stay in `infrastructure/discord`. The domain knows about `provider` only as a string.

**Changing provider:** a new login provider is a new adapter behind `IdentityProvider` and a new value in `provider`. No schema change is required. The login method is decided in ADR 0005.

## Consequences
- Calendar depends on `auth` for name lookup. If `auth` is down, group and lobby views do not work. The gateway already depends on `auth` for all logged-in traffic, so this does not increase the total failure surface much.
- Names are updated at the next login (an assumption in REQ-0001). Since calendar looks up names in `auth` at every read, the latest name is always shown. A copy in calendar would have become stale.
- The `users` table is the only source for display names. No other service has a copy.

## Alternatives considered
- **Auth embedded in the gateway:** the gateway would then own a database and the OAuth flow, and lose its simplicity. It must be stateless.
- **User accounts in calendar:** identity would then live in the domain service. Future services would have to read calendar's tables or copy user data.
- **A copy of names in calendar** (updated at each login): removes the call on read, but introduces two sources for the same knowledge (DRY violation) and requires sync.

Amendment 2026-11-01:
- `GET /api/auth/me` and `UserName` in `POST /internal/users/lookup` use `userId` for the user's ID (ADR 0001). Not breaking, since no client exists yet.
- `userIds` has at most 100 IDs per call. More gives 400 `invalid_request`. Duplicates are ignored and unknown IDs are omitted. The limit is a named constant in auth. Calendar's adapter splits larger lists into calls of at most 100, so that a group can have more members than that.
- If the lookup does not respond, calendar's reads give 503 `service_unavailable`. A view is never shown without names.

Amendment 2026-11-01 (review 2):
- Public endpoints are renamed to remove the provider name from the path: `GET /api/auth/login?returnTo=` (operationId `startLogin`), `GET /api/auth/callback` (`completeLogin`), `POST /api/auth/logout` (`logout`) and `GET /api/auth/me` (`getCurrentUser`). The old `/api/auth/discord/*` paths are removed; no client exists yet (ADR 0005).
- `GET /api/auth/me`: `userId` is read from `X-User-Id`, which the gateway sets. `isSystemAdmin` is computed by `SystemAdmins.Includes` in `auth`'s domain (ADR 0011). The endpoint does not call `POST /internal/sessions/validate`.
- The login and callback responses have `Cache-Control: no-store`, because they set cookies (ADR 0005).
- `POST /internal/sessions/validate`: a missing or empty `token` gives 401 without a lookup. Any other value that matches no session also gives 401. `token` has no `maxLength`: a longer value cannot match a stored hash.
- `POST /internal/users/lookup`: a missing or empty `userIds` gives 200 with `users: []`. An invalid uuid, a wrong JSON type or more than 100 IDs gives 400 `invalid_request`. The limit 100 is `maxItems` in the contract. Each service keeps it as a named constant, and each service's tests check 100 (accepted) and 101 (rejected). No test parses the YAML file.
- The public `ErrorBody.code` enum loses `invalid_request` and gains `not_found` and `method_not_allowed` (ADR 0001).
- The `ServiceUnavailable` text in the contracts is generic: "A dependency does not respond. The request was refused before any change was committed."

Amendment 2026-11-01 (consolidated). The final cross-cutting rules are in ADR 0001 "Amendment 2026-11-01 (consolidated)". Service-specific points:
- `POST /internal/users/lookup`: `userIds` is not `required` in the contract (ADR 0001 consolidated, item 2). A missing, `null` or empty `userIds` gives 200 `users: []`, as the review 2 amendment says. The response schema is named `UserNameList` (it was `LookupUsersResponse`, which clashes with the client type that oapi-codegen generates for the operation `lookupUsers`, ADR 0012 consolidated).
- `POST /api/auth/logout`: a database failure gives the shared `ServiceUnavailable` response (503 `service_unavailable`), not an operation-specific text. The session is not revoked and the cookie is not cleared.
- `POST /internal/sessions/validate`: unchanged (`token` is not `required`, missing or empty gives 401).
