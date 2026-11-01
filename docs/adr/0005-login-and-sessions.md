# 0005. Login with Discord and session model
Status: Accepted (2026-11-01)

## Context
REQ-0001 requires login with Discord, logout that requires a new login at the next page view, and a return to the page the user wanted to reach. The user has confirmed that no Discord server is required. CLAUDE.md requires that Discord OAuth2 is used behind a port, and that login is vendor-independent in the data model.

## Decision

**Flow:** OAuth2 authorization code with PKCE, with the gateway as the public entry and `auth` as the confidential client. The details (browser binding, callback order, cleanup) are in the amendment review 5.
1. `GET /api/auth/login?returnTo=/groups/123` creates a `login_attempt`: a random `state` (stored as a SHA-256 hash), a random PKCE verifier (stored in plain text, because the provider needs it at the exchange), the validated `returnTo` and an expiry 10 minutes ahead. The response sets the cookie `ol_login` (value: `state`) and redirects to Discord with `state` and the PKCE challenge (S256).
2. Discord redirects to `GET /api/auth/callback?code&state`. `auth` checks that `ol_login` equals `state`, consumes the attempt (deletes it, so it works once), exchanges `code` with the stored verifier and fetches the user.
3. The user is created or updated. `display_name` is set from Discord at every login (assumption in REQ-0001).
4. A new session is created and the session cookie is set. `ol_login` is cleared. Redirect to `returnTo`.

**Returns to the right page:** `returnTo` is accepted only if it is a same-site relative path (rule `ReturnTo` below, amendment review 4). Otherwise `/` is used. This prevents open redirects.

**Discord adapter:**
- Scope: `identify` only. No `guilds`, because no server connection is required.
- `provider` = `"discord"`, `provider_subject_id` = the Discord user's ID.
- `display_name` = `global_name` if present, otherwise `username`.
- Avatar is not fetched. REQ-0001 excludes avatars, so the field is not introduced (YAGNI).
- The port `IdentityProvider` is defined in `auth/internal/application`. `ExternalIdentity{Provider, SubjectID, DisplayName}`. The Discord types stay in the adapter.

**On denied login** (Discord returns `error=access_denied`): redirect to `/?loginError=login_denied`. The frontend shows an understandable message.

**Session:**
- Token: 32 random bytes (`crypto/rand`), base64url-encoded. Stored as a SHA-256 hash in `sessions.token_hash`. SHA-256 is enough because the token has high entropy and is not a password.
- Cookie: name `ol_session`, `HttpOnly`, `Secure`, `SameSite=Lax` (required so that the cookie follows the redirect from Discord), `Path=/`.
- Expiry: 30 days from creation. No sliding renewal in MVP (YAGNI).
- Logout: the session row is deleted and the cookie is cleared. The next call with the same token gives 401. There is no `revoked_at` column: a deleted row and an unknown token give the same 401, and no requirement asks for a history of sessions.
- Validation happens in `auth` via `POST /internal/sessions/validate`. The gateway calls it per API call (see ADR 0002). The response contains `userId` and `isSystemAdmin`.
- The system admin role is stored neither in the session nor in the cookie. `auth` determines it at each validation from configuration (ADR 0011), so a removed system admin loses the role when `auth` is restarted with new configuration.
- `SameSite=Lax` also protects write methods (`POST`, `PUT`, `DELETE`) against calls from other sites, because the browser does not send the cookie then. It is not changed to `None`.

**Why an opaque token and not JWT:** REQ-0001 requires immediate logout. With a field in the database this is an update. With JWT a revocation list is required, which must still be checked, so the advantage disappears.

**Secrets:** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `DISCORD_REDIRECT_URI` are read from environment variables in `auth`. They never go into the repository.

## Consequences
- Discord is a new external dependency. It is motivated by the requirement and the stack.
- Each API call requires a validation call to `auth`. See ADR 0002.
- Because `Secure` is used, production requires HTTPS. Local development on `localhost` works with the browser's exception. The deployment question is handled in ADR 0009.
- The Discord redirect URI must be HTTPS in production. See ADR 0009.
- Changing provider (e.g. to another OIDC provider) is a new adapter behind `IdentityProvider` and a new `provider` value. No schema change and no change in `calendar`.

## Alternatives considered
- **JWT in a cookie:** faster validation, but logout requires a revocation list. See above.
- **Token in `localStorage`:** exposed to scripts. An `HttpOnly` cookie is safer.
- **Sessions in the gateway:** the gateway becomes stateful and gets a database. Conflicts with ADR 0002.
- **Login with email or password:** REQ-0001 excludes it. Discord is enough.
- **Discord server connection via `guilds`:** an assumption in REQ-0001 is that it is not needed. It also gives more permissions than necessary (least privilege).

Amendment 2026-11-01:
- The callback always redirects to the frontend, including on errors. If Discord returns `error=access_denied`, `login_denied` is given, regardless of `state`. All other errors give `/?loginError=login_failed` without a session cookie and without details: a different `error` parameter, missing `code` or `state`, unknown, expired or already used `state`, an error when exchanging the code or fetching the user from Discord, and database errors.
- `login` redirects in the same way with `login_failed` if the login attempt cannot be created. Login endpoints never answer with JSON errors to the browser.
- Errors are logged with category and `requestId`. Never `code`, `state`, a token, the PKCE verifier, a cookie value, `returnTo` (it can hold an invite token, ADR 0007) or a response body from the provider.
- `returnTo` is validated again at callback before the redirect.

Amendment 2026-11-01 (review 2): paths and names.
- **Public paths:** `GET /api/auth/login?returnTo=` (operationId `startLogin`) and `GET /api/auth/callback` (`completeLogin`). `POST /api/auth/logout` and `GET /api/auth/me` are unchanged. The steps of the flow above use these paths. The provider name is not in any public path, operationId or field name.
- **Redirect URI:** the URI registered in the Discord developer console is `<public origin>/api/auth/callback`. It is set in `DISCORD_REDIRECT_URI`, which is configuration of the Discord adapter. A new provider registers its own callback in its own console, and the public path does not change. The change is local to the adapter and to configuration (CLAUDE.md, replacement test).
- **`returnTo`** gets no separate length limit. The request line limit of `edge` (Nginx default 8 KB, ADR 0009) bounds it.
- **Cache:** the login and callback responses have `Cache-Control: no-store`, because they set cookies (`ol_login` and `ol_session`, amendment review 5).

Amendment 2026-11-01 (review 4): security and naming.
- **`returnTo` rule (replaces "starts with `/` and not with `//`", which let `/\evil.example` through: browsers read `\` as `/`, and strip tabs and newlines inside a URL).** `ReturnTo` is accepted only if all of these hold, otherwise `/` is used:
  1. it starts with exactly one `/`;
  2. the second character, if there is one, is neither `/` nor `\`;
  3. it contains no ASCII control character (U+0000 to U+001F and U+007F) and no whitespace (including space) anywhere.
  The rule is one domain function in `auth` (`domain` or `application`, not transport), used at login before the attempt is stored and again at callback before the redirect. This is smaller than resolving against the public origin, which would need the origin in the rule and a URL parser.
  The rule applies to the decoded value. Go's `URL.Query()` decodes the query once, so `?returnTo=/%5Cevil.example` reaches the function as `/\evil.example`.
  **Required tests** (a table test on the function, plus one test per endpoint that the redirect is `/`): `/\evil.example`, `//evil.example`, `///evil.example`, `/<TAB>/evil.example`, `/<LF>/evil.example`, `\evil.example`, `https://evil.example` and the empty value all give `/`. These stay as given: `/`, `/groups/123`, `/invite/abc?x=1`. Endpoint tests with the raw query `?returnTo=/%5Cevil.example` and `?returnTo=/%2F%2Fevil.example` store and redirect to `/`.
- **Port names (one decision for ADR 0003 and the backend expert's example):** `IdentityProvider` has `AuthorizationURL(state, codeChallenge string) string` and `Exchange(ctx, code, codeVerifier string) (ExternalIdentity, error)`. `ExternalIdentity` is `{Provider, SubjectID, DisplayName}`. There is no avatar field in MVP (YAGNI, see "Discord adapter" above). The `ExternalIdentity{..., AvatarURL}` in CLAUDE.md is a generic illustration of the rule "no vendor types leak", not this port.
- **Logs:** `code` and `state` are query parameters of the callback. No log of any service or of `edge` may contain a query string (ADR 0002 and ADR 0009, amendment review 4).

Amendment 2026-11-02 (review 5): browser binding, PKCE storage, cleanup and library. Decided by the architect after the fourth contract review.
- **Browser binding (login CSRF).** Without a binding, an attacker can send a victim a callback URL with the attacker's own `code` and `state`, and the victim is logged in as the attacker. PKCE does not stop this, because the attacker's attempt holds the attacker's verifier. Therefore `GET /api/auth/login` sets the cookie `ol_login` with the value of `state`: `HttpOnly`, `Secure`, `SameSite=Lax` (it must follow the top-level redirect back from Discord), `Path=/api/auth/callback`, `Max-Age=600`. The callback compares `ol_login` with the `state` parameter in constant time (`crypto/subtle`) before any database access. A missing or different cookie gives `/?loginError=login_failed`, no session, and the attempt is not touched (it expires). Every callback response clears `ol_login` (empty value, the same path, `Max-Age=0`). The cookie holds `state` itself, so no second random value and no extra column are needed. Another site cannot set a cookie for this origin. A subdomain run by someone else could, but it could set `ol_session` as well, so that is not a new exposure (ADR 0009 assumes an own domain name). The attempt lifetime and `Max-Age` are one named constant (10 minutes).
  Consequence: two logins started at the same time in two tabs leave only the newest `ol_login`. The older tab's callback gives `login_failed`, and the user starts again.
- **Callback order.** Each step that fails gives `/?loginError=login_failed`, except step 1 for `access_denied`:
  1. `error` is set: `access_denied` gives `/?loginError=login_denied`, any other value `login_failed`. No `state` or cookie check, because no session is created.
  2. `code` or `state` is missing.
  3. `ol_login` is missing or not equal to `state`.
  4. The attempt is consumed in one statement: `DELETE FROM login_attempts WHERE state_hash = $1 AND expires_at > $2 RETURNING code_verifier, return_to`. No row means unknown, expired or already used. The attempt is consumed before the exchange, so a failed exchange also uses it up, and two concurrent callbacks cannot both get it.
  5. `Exchange(ctx, code, codeVerifier)`, then the user is fetched (in the adapter).
  6. The user is created or updated and the session is created in one transaction, together with the session cleanup below.
  7. `returnTo` is validated again, and the response redirects with `Set-Cookie` for `ol_session` and for clearing `ol_login`.
  The exchange is not inside a database transaction, so no transaction waits on the provider.
- **PKCE verifier (`login_attempts.code_verifier`, ADR 0006).** Stored in plain text, because the provider needs the verifier itself at the exchange. It lives at most 10 minutes and is deleted with the row in step 4. The verifier is 32 random bytes from `TokenGenerator`, base64url without padding (43 characters, within RFC 7636). The S256 challenge (`base64url(SHA-256(verifier))`) is a pure function in `application`, tested with the example of RFC 7636 Appendix B. The port `IdentityProvider` is unchanged.
- **Cleanup (no background job).** When a login attempt is created, expired attempts are deleted in the same transaction (`DELETE FROM login_attempts WHERE expires_at <= $1`). When a session is created, expired sessions are deleted in the same transaction (`DELETE FROM sessions WHERE expires_at <= $1`). Logout deletes the session row. Both tables stay small at this scale, so there is no index on `expires_at`. `shortcut: expired rows stay until the next login of any user, upgrade with a periodic job if the tables grow`.
- **Invite token in `returnTo` (accepted).** A user without a session who opens `/invite/<token>` is sent to `GET /api/auth/login?returnTo=/invite/<token>`. The token is then in a query string and in `login_attempts.return_to`. ADR 0007 rejects tokens in query strings because of logs and browser history. Here: no log of `edge`, `gateway`, `frontend` or a service holds a query string (ADR 0002, ADR 0009), `auth` never logs `returnTo` (amendment 1 above), the browser history already holds `/invite/<token>`, `Referrer-Policy: same-origin` keeps the URL from Discord (ADR 0009), and the row lives at most 10 minutes and is deleted when used. Calendar already stores the token in plain text (ADR 0007), so the database holds nothing new. An opaque reference would need a second table or lookup for the same protection.
- **Existing session at login.** The callback always creates a new session token, so a session cannot be fixed in advance. An `ol_session` that the browser already had is overwritten in the browser and not deleted on the server. Only that browser had it, and the row expires and is removed by the cleanup.
- **Logout from another site.** A cross-site form `POST /api/auth/logout` carries no cookie (`SameSite=Lax`), so no session is deleted, but the response still clears the cookie in the browser. The user must log in again. Accepted: no data is read or changed.
- **Library (new dependency, approved here).** `golang.org/x/oauth2`, maintained by the Go project, in `infrastructure/discord` only, and only its root package (not the provider subpackages). It builds the authorize URL (with `code_challenge` and `code_challenge_method=S256`) and does the token exchange with the verifier. The user call (`GET /users/@me`) is plain `net/http` in the same adapter. The adapter's HTTP client has a timeout (named constant, 10 seconds); a timeout is an exchange failure (`login_failed`). `*oauth2.RetrieveError` carries the provider's response body in its `Error()` text, so the adapter maps it to an error category and never wraps or logs that text. Replacing the library changes only the adapter.
- **Parameter errors at the login endpoints.** A query parameter given twice (`state=a&state=b`) fails in the generated parameter binding, before the handler, and the generator's default answers 400 in plain text. `auth`'s public server sets `ErrorHandlerFunc` to the redirect `/?loginError=login_failed` with `Cache-Control: no-store` (ADR 0012 review 5).
- **Response type:** a successful callback sets two cookies, which the generated response type cannot do. Transport uses its own response type (ADR 0012 review 5).
- **Required tests (auth):**
  - a valid attempt and `state` without `ol_login` gives `login_failed`, no `ol_session` cookie, and the attempt still exists; an `ol_login` that differs from `state` gives the same;
  - a second callback with the same `state` gives `login_failed`; an expired attempt gives `login_failed`;
  - every callback response, including `login_denied` and `login_failed`, clears `ol_login`; `startLogin` sets it with the attributes above, and both responses have `Cache-Control: no-store`;
  - creating an attempt deletes an expired attempt; creating a session deletes an expired session; after logout the row is gone and the token gives 401;
  - the challenge function gives the RFC 7636 Appendix B value; the fake provider (`httptest.Server`) receives the stored verifier at the exchange;
  - `GET /api/auth/callback?code=A&state=B&state=C` gives 302 `login_failed`;
  - an error body from the fake provider that contains a marker string does not appear in any log line, and no log line contains the `state`, `code`, verifier, cookie values or `returnTo` used in the tests.
