# 0011. System admin: role, configuration and trust
Status: Accepted (2026-11-01)

## Context
The game list is managed by a system admin in the app (ADR 0010, REQ-0010, F-025). System admin is a role for the whole system, separate from group admin (ADR 0004, REQ-0002, REQ-0008). In the ADRs "admin" is the short form for group admin. The role must reach `calendar`, the frontend must be able to show the page, and no client may make itself system admin.

Configuration must not contain vendor names in the domain (CLAUDE.md). It identifies users via `provider` and `provider_subject_id`, because the internal user ID (uuid) is not known when the configuration is written. Only `auth` can link an external identity to an internal user.

## Decision

**Who is system admin:** one or more users are named in the environment variable `SYSTEM_ADMINS` in `auth`. The format is a comma-separated list of `provider:provider_subject_id`, for example `discord:<discord-user-id>`. An empty or missing variable means no one is system admin. There is no management in the app. The value is personal data (a Discord ID). It belongs to the operations `.env`, which is already ignored by git, and does not go into the repository. It is not a secret, but it is also not something that should be versioned.

**Where the role is decided: `auth`.** Only `auth` knows which internal user has a given `(provider, provider_subject_id)`. If `calendar` were to decide the role itself, it would have to read `auth`'s data or ask `auth` a new question for each write. Both variants break the rule that a service reads only its own data.
- `cmd/auth/main.go` reads `SYSTEM_ADMINS` and builds the value type `SystemAdmins` (the domain). The value is a list of pairs `(provider, subjectId)`, without vendor types.
- An unknown `provider` (not wired in `main.go`) or an empty `provider_subject_id` gives an error at startup (fail fast). A misspelled value must not silently grant or remove a role.
- `SystemAdmins.Includes(user) bool` compares `user.Provider` and `user.ProviderSubjectID` with the list. It is pure domain logic. No port is needed, because no external boundary exists.
- The role is decided at each validation and at `GET /api/auth/me`. It is not stored in `users`, `sessions` or the cookie. Then there is no copy of the configuration in data, and no migration is needed to grant or remove the role. Changing the variable requires a restart of `auth`.

**How the role reaches `calendar`: via the gateway (ADR 0002).**
1. `POST /internal/sessions/validate` returns `{userId, isSystemAdmin}` (ADR 0003).
2. `gateway` removes all incoming `X-User-*` headers on all routes.
3. With a valid session `gateway` sets `X-User-Id` and `X-User-System-Admin` to `true` or `false`.
4. `calendar` builds `Actor{UserID, IsSystemAdmin}` in `transport`. Only the exact value `true` gives system admin. A missing or invalid `X-User-Id` gives 401.

Trust rests on the same model as `X-User-Id` in ADR 0002: `calendar` is not published and the gateway is the only way in.

**What the role gives, and what it does not:**
- Gives the right to create, change and delete games in the game list (ADR 0010) and to open the game list page.
- Gives no right in a group. Group and lobby checks ignore `Actor.IsSystemAdmin` (ADR 0004 rule 11). A system admin who is not a member gets `404 group_not_found`, just like anyone else.
- Gives no possibility to appoint other system admins in the app. Changes happen only in the configuration.

**Frontend:** `GET /api/auth/me` returns `isSystemAdmin` (ADR 0003). The frontend shows the link to `/systemadmin/games` only when the value is true. This is a convenience. The server always checks, and a hidden button is not a protection.

**Login:** the system admin logs in with the same Discord login as everyone else (REQ-0001). There is no separate account or password. A system admin who has not logged in once has no user row and therefore no role, which is intentional.

**Security review:**

| Threat | Countermeasure |
|---|---|
| Client sends its own `X-User-System-Admin: true` | The gateway removes `X-User-*` on all routes. `calendar` is not reached directly: it is not published, and only `gateway` and `auth` share a network with it (ADR 0008 review 5). |
| The gateway or `auth` is down | Protected calls give 401 or 503. No role is assumed (fail closed). |
| Old role remains after removal from the configuration | The role is decided at each call from the configuration `auth` loaded at startup, and is not stored (see "decided at each validation" above). A removal takes effect when `auth` is restarted with the new configuration, and from then on at the next call of every existing session. |
| System admin used to read groups | The role gives no group permission (rule 11). Groups require membership. |
| CSRF on writes (`POST`, `PUT`, `DELETE`) | `SameSite=Lax` on the cookie (ADR 0005). The browser does not send the cookie on calls from another site. |
| Misspelled value in the configuration | A misspelled subject ID matches no user, so no one gets the role (fail closed). An unknown provider gives an error at startup. |
| Traceability | Every change to the game list is logged with `actorUserId` (ADR 0010). |
| Excessive or malformed input | Validation in `application` and a limit on request size in `transport`. |
| Unnecessary access for operations roles | The runtime role `calendar` gets only DML on `games`. The operations role `calendar_ops` is removed (ADR 0010). |

**Secrets:** no new secret. `SYSTEM_ADMINS` is configuration. The Discord client secrets in ADR 0005 are not affected.

## Consequences
- A change of the gateway's header rule (ADR 0002), an extended response from `POST /internal/sessions/validate` (ADR 0003) and a new field in `GET /api/auth/me` (ADR 0003). All three are additive.
- `SYSTEM_ADMINS` must be set in the operations `.env` on the Pi. The DevOps expert adds the variable to `compose` and `.env.example` without a value.
- Adding or replacing a system admin requires `auth` to be restarted. No other service is affected.
- If a system admin loses their Discord account or the configuration is wrong, the operator must change the configuration. There is no fallback path in the app. That is intentional, because such a path would be a new attack surface.
- The role has large power over the game list and none over groups. This is accepted for the owner of the project.

## Alternatives considered
- **Column `is_system_admin` in `users`:** a second source for the same configuration (DRY). Changing it requires a migration or a UI to set the flag.
- **Configuration with the internal user ID:** the uuid is not known when the configuration is written. Also the ID must be linked to an identity, which only `auth` can do.
- **`calendar` reads the configuration itself:** `calendar` cannot link an identity to a uuid without `auth`. That gives two sources for identity.
- **The gateway decides the role:** the gateway would then make authorization decisions, which ADR 0002 explicitly forbids, and would need the configuration itself.
- **Role in a JWT:** delayed logout and removed role (ADR 0002 and 0005).
- **Calendar asks `auth` at every write:** an extra synchronous hop for every write, for a decision question the gateway already has the answer to.
- **Role in group membership (`group_members.role = 'system_admin'`):** mixes group permission with the system role. Conflicts with the requirement that the system role is separate from group admin.
- **Separate login for system admin:** conflicts with REQ-0001 (Discord login) and gives a second account to protect.
- **An admin UI to appoint system admins:** a new surface for rights without a requirement in MVP (YAGNI). A configuration change is enough.

## Open questions
- None. REQ-0010 and the glossary in CLAUDE.md are consistent with this ADR. The operator can appoint more than one system admin.
