# Project instructions

This project is run by a team of agents. The main session is the **orchestrator** and delegates work to the specialist agents in `.claude/agents/`. All agents follow the rules in this file.

@.claude/agents/orchestrator.md

---

## Language

The repository is in English: code, comments, documentation (ADRs, service map, product documents, agent files, this file) and commit messages. Agents report to the orchestrator in English.

## Team

| Agent | File | Responsibility | Owns |
|---|---|---|---|
| Orchestrator | `orchestrator.md` | Plans, delegates, coordinates, closes tasks | Task flow |
| Product owner | `product-owner.md` | Decides what is built, prevents duplicate functionality, requirement specification | `docs/product/` |
| Architect | `architect.md` | Design, service boundaries, ADRs, interpretation of the rules | `docs/adr/`, `docs/services.md`, code standard |
| Reviewer | `reviewer.md` | Strict review of all code against architecture and code principles | Review reports (changes no code) |
| UI/UX expert | `ui-ux-expert.md` | Interface, user flows, accessibility | `frontend/` |
| Backend expert | `backend-expert.md` | Services, API, domain logic, auth, database | `services/`, `api/`, `pkg/` |
| DevOps expert | `devops-expert.md` | Build, CI/CD, operations, environments, monitoring | `infra/`, `.github/`, Dockerfiles, `compose*.yml` |

An agent only changes files within its own area. If a change is needed outside it, send it as a request to the orchestrator.

## Glossary

This is the single shared vocabulary. Use these exact English terms in documents, code, API contracts, database schemas and error codes. Product documents use the same terms. If a term is missing, the architect adds it here before it is used elsewhere.

| Term | Technical form | Notes |
|---|---|---|
| Group | `groups` | |
| Member | `group_members` | |
| Join (membership starts) | `joined_at` | |
| Leave group | `DELETE /api/groups/{groupId}/membership` | |
| Group admin | role value `admin` | |
| System admin | `isSystemAdmin`, `X-User-System-Admin` | Set in configuration only (ADR 0011) |
| Invite link | `invite_links`, `/api/invites/{token}` | |
| Link creator | `createdByUserId` | |
| Max uses | `maxUses` | 1–10, default 1, set at creation |
| Use (of a link) | `useCount` | Increases by 1 per join via the link |
| Link expiry | `expiresAt` | 10 minutes after creation |
| Join group via link | `POST /api/invites/{token}/join` | |
| Is member | `isMember` | In `InviteInfo` |
| Lobby | `lobbies`, `lobbyId`, schemas `Lobby` / `LobbyDetail` | A bookable slot in a group |
| Creator | `createdByUserId` | Creator of a lobby |
| Player | `lobby_players`, `players`, `playerCount` | A person who has joined a lobby |
| Join a lobby | `PUT /api/groups/{groupId}/lobbies/{lobbyId}/players/me` | |
| Leave a lobby | `DELETE /api/groups/{groupId}/lobbies/{lobbyId}/players/me` | |
| Spot / max players | `maxPlayers` | Shown as "3/5 players" |
| Game | `gameId`, `gameName` | |
| Game list | `games` | Managed by system admin |
| Other | `customGameName` | Free-text game name |
| Genre | `genre` (on a game), `gameGenre` (on a lobby) | Fixed-list category of a game, one per game, optional; `null` means no genre. The values are the `Genre` schema in `api/calendar/openapi.yaml`. Names are UI text (ADR 0016) |
| Genre theme | frontend only (`GenreTheme`, `themeForGenre`, `genreThemes.ts`) | The look of a genre: accent color, background pattern, icon and 3D motif. Lobbies without a genre get the neutral theme. The backend knows only the genre value (ADR 0016) |
| Dashboard | `/` when logged in (ADR 0014) | The home screen after login: Next up and This week across all the user's groups (REQ-0012). Not the group list |
| Next up | frontend only (`nextUp`), no API field | The card on the dashboard with the lobby that starts first among all lobbies of the user's groups. Running lobbies count |
| This week | frontend only (`thisWeek`) | The dashboard section with the lobbies that start in the current week (Monday to Sunday, local time), across all groups |
| Running | derived from `startsAt` and `endsAt` | Lobby state from start time until end time. Shown on Next up instead of the countdown |
| Ended | derived from `endsAt` | Lobby state after the end time (REQ-0005). Joining then gives `lobby_has_ended` |
| Joined by me | `joinedByMe` | `true` when the caller is a player of the lobby. On `Lobby` (ADR 0014) |
| Group list | `GET /api/groups`, page `/groups` | The groups the user is a member of, opened by the Groups tab. Not the Game list |
| Group view | `/groups/{groupId}` | A group's page inside the app shell: upcoming lobbies, members and invite links |
| Game mode | `game_modes`, `gameModes`, `modeId`, `modeName` | A kind of play within a game, with its own limit: its game roles (their sum is max players) or a max players value. Entered by the system admin. Avoid: type, category, difficulty, queue, playlist (REQ-0015, ADR 0017) |
| Named activity | `activities`, `activityId`, `activityName` | A specific thing played in a mode, e.g. a particular dungeon. Optional, at most one per lobby, belongs to exactly one mode. Avoid: instance, content, map, boss, target. Do not use the bare word "activity" for anything else. Today it means the order of permission checks in `api/calendar/openapi.yaml` (line 295), its generated copy `frontend/src/api/gen/calendar.ts` (line 140) and `services/calendar/internal/application/invite_links.go` (lines 128, 162); PR2 of ADR 0017 rewords them |
| Open lobby | no `modeId` (`lobbies.game_mode_id` NULL) | A lobby with no mode: with no game (shown as "Open") or with a game only. Game and mode can be set later (REQ-0015, ADR 0017). Avoid: free lobby, unnamed lobby, drop-in |
| Label | frontend only (no API field) | The text a lobby shows in lists, Next up, This week and on its page: "game › mode › activity", or "Open" with no game (ADR 0017). Avoid: title (a lobby has no title field) |
| Game role | `game_roles`, `gameRoles`, `gameRoleId` (on a player; `null` means flex) | A named role of a game, or of a mode of a game, with slots, e.g. "Tank". Entered by the system admin. Not the group role `role` (`admin`, `member`). Avoid: role (alone), position, class (REQ-0011, ADR 0017) |
| Role slot | `lobby_role_slots`, `roleSlots`, `slots` | The number of players a lobby allows in one game role, shown as "Tank 0/1". A copy of the game role in the lobby. Avoid: spot (spot means a place in the lobby total) |
| Flex (any game role) | `gameRoleId` null on `lobby_players`, `flexCount`, request field `flex: true` | A player who takes one spot of the lobby total without a role slot, shown as "Flex N". Avoid: any role, wildcard, fill |
| Seat | request fields `gameRoleId` or `flex: true` (create and join) | The choice a player makes when joining a lobby with game roles: one game role, or flex. Avoid: spot (spot means a place in the lobby total), slot (slot means a role slot) (ADR 0017) |
| Avatar | `hasAvatar` (on `UserRef`, `AuthUser`), table `user_avatars` (auth), `GET /api/users/{userId}/avatar`, frontend `PersonAvatar` | A person's picture next to their name: the Discord picture taken at login. Without one, the initials are shown. Never a group's picture, which stays initials. Avoid: photo, profile picture (ADR 0018) |
| Live update | `GET /api/live-updates` (server-sent events), event `groupChanged`, data = group ID | The signal that a group's lobbies changed, sent while the page is visible. The screen then loads its data again. The signal carries no lobby data. Avoid: push, real-time, socket, sync (REQ-0017, ADR 0019) |
| Group feed | `GET /api/groups/{groupId}/feed`, frontend "Group feed" | The recent feed events of one group, newest first: seven days, at most 20. Not the history of lobbies (F-020). Avoid: activity feed, timeline, history, log. Do not use the bare word "activity" (REQ-0018, ADR 0020) |
| Feed event | `group_events`, `FeedEvent`, `kind`: `lobby_created`, `player_joined`, `player_left`, `lobby_full` | One recorded event of the group feed. Recorded in the same transaction as the lobby change that caused it. Keeps the game, mode and named activity names of its lobby as they were then. Holds user IDs only. The frontend composes its text and label. Avoid: activity, notification, log entry (ADR 0020) |
| Icon | frontend only (`Icon`, `IconName`, `ui/Icon.tsx`) | The only way the frontend draws an icon. Names are the project's own (e.g. `pencil`). Only `ui/Icon.tsx` imports the icon library. Avoid: glyph, svg icon, symbol (ADR 0021) |
| Tooltip | frontend only (`Tooltip`, `ui/Tooltip.tsx`) | Short text shown above an element on hover or keyboard focus. Used by `IconButton` only. Closed with Escape. Hidden on touch (coarse pointer), where the label is shown on the button instead. Avoid: hint, popup, title attribute (ADR 0021) |
| Button variant | `.button` (primary), `.button--secondary`, `.button-ghost`, `.button--danger` | The colour style of a text button. One variant per button. One size per pointer type. Destructive actions are always `danger`, with visible text. Avoid: button type, kind, style (ADR 0021) |
| Icon-only button | `IconButton` (`ui/IconButton.tsx`), `.button--icon` | A ghost button with an Icon and a label. Mouse and keyboard: the Icon alone, with the label as Tooltip. Touch: the Icon with the label beside it. Its accessible name is the label. For secondary actions only (edit, copy). Avoid: icon button, round button (ADR 0021) |

Notes:
- "Time" in the sense of a clock time or timestamp is "time" (`startsAt`, `endsAt`, time zone). Only the bookable slot is a "lobby".

**Error codes** (renamed from the Swedish-era codes, all others unchanged):

| Old | New |
|---|---|
| `time_in_past` | `lobby_in_past` |
| `time_end_not_after_start` | `lobby_end_not_after_start` |
| `time_too_long` | `lobby_too_long` |
| `time_has_ended` | `lobby_has_ended` |
| `time_full` | `lobby_full` |
| `time_not_found` | `lobby_not_found` |
| `own_upcoming_times_exist` | `own_upcoming_lobbies_exist` |

**Status words:**
- ADR: `Proposed` / `Accepted` (keep the date).
- Architect and product handover: `DONE` / `BLOCKED` / `PARTIAL` / `ESCALATE`.
- Review result: `APPROVED` / `NOT APPROVED`.
- Review level: `BLOCKER` / `SHOULD` / `COULD`.
- Markers in documents: `ASSUMPTION` / `DECISION`. "Amendment 2026-11-01" is written as "Amendment 2026-11-01".
- Requirement status: `Draft` / `Decided` / `Implemented` / `Rejected`. Feature status: `Proposed` / `Decided` / `In progress` / `Done` / `Removed`. Priority: `Must` / `Should` / `Could`. Product owner verdict: `NEW` / `EXTEND F-NNN` / `DUPLICATE OF F-NNN` / `REJECTED` / `NEEDS ANSWER`.

## Model selection

Agents use the weakest model that can handle the task. Each task starts at step 1 (UI and backend tasks at step 3, see below) and moves up one step at a time only when needed.

| Step | Model | Effort | Used |
|---|---|---|---|
| 1 | Haiku (`haiku`) | medium | Always first (except UI and backend tasks) |
| 2 | Sonnet (`sonnet`) | medium | After escalation from step 1 |
| 3 | Opus 5.5 (`opus`) | medium | After escalation from step 2, and the start step for UI and backend tasks. **Highest allowed level.** |

- Agent files have `model: haiku` and `effort: medium` by default. Exception: `ui-ux-expert.md` and `backend-expert.md` have `model: opus`.
- **UI and backend tasks start at step 3.** Tasks for the UI/UX expert and the backend expert start at `opus`, because `haiku` work there needed two or more review rounds almost every time, and the ADR 0017 slices at `sonnet` needed escalation to `opus` after two rejections (PR3b, PR5a, PR5b; decided by the user 2026-11-11). There is no step above, so a rejection twice at step 3 means the orchestrator stops and asks the user.
- Effort is never higher than `medium`. Models above Opus 5.5 (e.g. Fable or Mythos) and effort `high` or higher are never used.
- **Escalation** happens when:
  - the agent itself returns `Status: ESCALATE` with a reason (it cannot handle the task or cannot judge it safely), or
  - the result is rejected by the reviewer or by tests twice at the same step, or
  - the orchestrator judges that the result clearly does not meet the bar.
- The orchestrator then reruns the same task with the next model (the `model` parameter when starting the agent) and gives it the previous agent's result and problems as context.
- Never skip a step when escalating. If step 3 fails, the orchestrator stops and asks the user.
- The next task starts at step 1 again (step 3 for UI and backend tasks), including for the same agent.
- The main session (orchestrator) also runs on at most Opus 5.5 with effort medium. It is selected in the session with `/model` and `/effort`.
- Use the model names (`haiku`, `sonnet`, `opus`) in agent files. Check in Claude Code that they point to the versions you want.

## Stack

Agents build on this and do not choose their own frameworks. A deviation requires an ADR approved by the architect.

- **Architecture:** microservices behind an API gateway
- **Backend:** Go (latest stable version). Standard library first.
- **Frontend:** React + TypeScript (Vite). Another tool only if React cannot solve the need, and then with an ADR that justifies why.
- **Login:** Discord OAuth2. Other login methods only if Discord does not suffice for a concrete requirement.
- **Database:** PostgreSQL, one database (or schema) per service
- **Operations:** Docker / Docker Compose on Raspberry Pi 5 8GB
- **CI:** GitHub Actions

## Skills first

Before an agent solves a task itself, it checks whether a suitable skill exists (list the available skills; in Claude Code via `/skills` or the skill list in the session). If one fits, it must be used and its instructions followed.

- **ponytail** is used whenever code is written, to keep the amount of code as small as possible.
- Other skills are used when they match the task (e.g. frontend-design for UI, a skill for document formats, testing, security).
- If a skill conflicts with `CLAUDE.md`, `CLAUDE.md` wins. Flag the conflict to the architect.
- The handover states which skills were used.

## Microservices

- **One service = one bounded capability** (bounded context), not a technical layer. "users-service" and "db-service" are the wrong split.
- **Start with few services.** Split when a boundary is clear and justified (different pace of change, ownership, scaling needs). Each new service requires an ADR. Better one service too few than one too many.
- **Starting set:** `gateway` (routing, session validation) and `auth` (Discord OAuth, sessions). Domain services are added as needed.
- **Own data:** a service reads and writes only its own database. No service reads another service's tables directly.
- **Communication:** synchronous via HTTP/JSON with contracts in `api/`. Asynchronous events (queue/broker) only when a concrete need exists, and then with an ADR.
- **Contract first:** API contracts (OpenAPI) live in `api/<service>/` and are the source for types in both Go and TypeScript. Contracts are generated, not written by hand twice.
- **Shared code** in `pkg/` only for pure infrastructure (logging, configuration, HTTP middleware). No shared domain logic between services, because that couples them.
- **Independent deployment:** each service is built, tested and deployed on its own.
- **One service = one container.** Each microservice has its own `Dockerfile` and runs in its own container with one process. The frontend and PostgreSQL also run in their own containers; a service never embeds another service or its database in the same container.
- **Containers are stateless and replaceable.** All configuration comes from environment variables, logs go to stdout, and no state is saved in the container's filesystem. A container must be able to be stopped, restarted or run in several instances without data loss.
- **Each service can run alone.** `docker compose up <service>` starts the service with only the dependencies it needs. Services find each other via service names and addresses from environment variables, never via hard-coded host names or `localhost`.
- Each service has `/healthz` and `/readyz`, structured logging and a correlation ID that is passed on in all calls.

### Directory structure

```
api/<service>/openapi.yaml       contract
services/<service>/
  cmd/<service>/main.go          startup and wiring of dependencies
  internal/                      transport, application, domain, infrastructure
  migrations/                    the service's own migrations
  Dockerfile                     the service's own image
pkg/                             shared infrastructure code (not domain)
frontend/                        React app
infra/                           compose, operations configuration
docs/adr/                        architecture decisions
docs/services.md                 service map: responsibility, owned data, dependencies
docs/product/                    vision, feature register, backlog, requirements
```

## Code principles

These apply to all code in the project. The architect interprets them in case of disagreement.

### Minimal code
- The best code is the code that does not need to be written. Use the standard library, existing code and skills (ponytail) before writing something new.
- No layers, abstractions or configuration options that no requirement needs.

### SOLID
- **S: Single Responsibility**: a module, type or function has one reason to change. Do not mix HTTP handling, business logic and database access in the same unit. At service level: a service has one responsibility.
- **O: Open/Closed**: extend behavior through new implementations, not by adding `if` branches to existing code.
- **L: Liskov Substitution**: an implementation of an interface can be swapped out without the caller noticing a difference in the contract (including error behavior).
- **I: Interface Segregation**: small, focused interfaces defined where they are *used*, not where they are implemented (idiomatic in Go).
- **D: Dependency Inversion**: domain logic depends on abstractions. Concrete dependencies (database, external APIs, clock) are injected in `main.go`. See the section on modularity below.

### DRY
- Knowledge has a single authoritative place: validation rules, constants, types, configuration, API contracts.
- Duplicate twice rather than abstract too early. At the third occurrence: extract (*Rule of Three*).
- DRY applies to knowledge, not to code that happens to look alike. Between services some duplication is acceptable, because it is better than coupling them.

### Also
- **KISS**: the simplest solution that meets the requirement wins.
- **YAGNI**: do not build for hypothetical future needs.
- **Separation of concerns**: layers within a service: transport → application → domain ← infrastructure. The domain never imports from infrastructure.
- **Fail fast**: validate at system boundaries, trust data inside.

## Modularity and vendor independence

Code must be clearly separated and must not be bound to specific vendors, libraries or frameworks. Each external dependency must be replaceable by writing a new adapter, without touching domain or application code.

### Ports and adapters
- **Port:** an interface that describes what the code needs, in the domain's own language (e.g. `IdentityProvider`, `UserRepository`, `Clock`). The port is defined in the layer that uses it.
- **Adapter:** an implementation of the port against a specific technology (e.g. `discordIdentityProvider`, `postgresUserRepository`). Adapters live in `infrastructure/`.
- The connection between port and adapter is made in one place only: in `main.go` for Go, and in a provider / composition root for the frontend.

### Where interfaces are used
Interfaces are used **at boundaries**, not everywhere:
- toward all external systems: identity provider (Discord), database, other services, email, storage, queues
- toward things that make code hard to test: time, randomness, filesystem, environment
- between modules that must be able to change independently

Interfaces are **not** used for pure domain logic with a single implementation and no external dependency. An interface with one implementation and no boundary to protect is unnecessary code.

### Rules
- **No vendor types leak.** Types from Discord, `pgx`, HTTP frameworks or UI libraries may only appear in the adapter. The port uses the project's own types (e.g. `ExternalIdentity{Provider, SubjectID, DisplayName}` instead of a Discord user).
- **No provider names in the domain.** Domain and application code never mentions Discord, Postgres or similar. The data model stores e.g. `provider` + `provider_subject_id` instead of `discord_id`, so that more login providers can be added without a schema change.
- **One new dependency = one adapter.** A new library or a new external service is introduced behind a port, not directly in domain or application code.
- **Replacement stays local.** The test question: if we change provider, does only the adapter and the wiring in `main.go` change? If the answer is no, the separation is wrong.
- **Standards before vendors.** Use open standards and formats where possible: OAuth2/OIDC, SQL without vendor-specific features when not needed, OpenAPI, OCI images, OpenTelemetry-compatible logging and metrics.
- **Modules have clear public surfaces.** In Go the implementation lives in `internal/` and only what is needed is exported. In the frontend each module exports through its own index and does not import other modules' internal files.

## Code standard

- Names describe *what*, not *how*. No abbreviations beyond established ones (`id`, `url`, `db`, `ctx`).
- Functions are kept short (guideline: under 30 lines) and at one level of abstraction. For React components whose length is mostly JSX markup, the guideline is a `COULD` in review, never a `SHOULD` or `BLOCKER`; it stays a `SHOULD` for logic, hooks and Go code.
- No magic numbers or strings; use named constants.
- Comments explain *why*, not *what*.
- Errors are handled explicitly; no silent `catch` and no ignored `err`. Log with context and never expose internal details to the client.
  - **Expected browser refusals** are the one exception to "log with context". A `catch` around a browser API that the user's browser may refuse (`localStorage`, `navigator.clipboard`) is explicit handling when all of these hold:
    1. the `try` covers only that call, or the property access that can throw;
    2. the catch returns a fallback that the requirement describes, and a one-line comment in the catch names the fallback and cites the requirement (e.g. `REQ-0012`);
    3. a test makes the browser refuse and asserts the fallback.
  - Such refusals are not logged: the fallback is the expected outcome and nobody can act on it. A catch whose comment only says "nothing to report" does not qualify, because the fallback is not named.
  - API and network errors are never covered by this exception. They are converted to a typed error and rethrown, or shown to the user (see `frontend/src/api/httpApiClient.ts`). A catch that returns a default for an error nobody named is a `BLOCKER`.
  - If the team later needs refusal rates, the architect adds one shared `reportError` (ADR). Until then there is none (YAGNI).
- No dead code, commented-out code, or TODO without an issue reference.
- Linters and formatters are authoritative (`gofmt`, `golangci-lint`, ESLint, Prettier).

## Tests

- Every change of behavior has tests. A bug fix starts with a test that reproduces the bug.
- Test pyramid: many unit tests on domain logic, fewer integration tests against a real database, few end-to-end tests.
- Contract tests between services: a service that calls another is tested against the contract in `api/`.
- Tests depend on interfaces, not implementations.

## Workflow

1. **The product owner** decides whether and why something should be built, checks that the functionality does not already exist, and writes the requirement with acceptance criteria.
2. **The orchestrator** breaks the requirement down into sub-tasks and states which skills are relevant.
3. **The architect** reviews the plan if it touches service boundaries, new services, new dependencies, the data model or API contracts. Decisions are documented as ADRs. If the plan touches none of these, the architect is skipped and the specialists start directly.
4. **The specialists** implement within their areas, with relevant skills and tests.
5. **The reviewer** reviews all changed code strictly against the architecture and code principles. Findings are classified: `BLOCKER` / `SHOULD` / `COULD`. The review happens **once per requirement**, on the whole change after all sub-tasks are done, not after each sub-task. On `NOT APPROVED` the task goes back to the owning agent and is reviewed again after the fix. If a rule is unclear, the architect decides. **Docs-only changes** (no code, contract or config) are `APPROVED` when there is no `BLOCKER`; `SHOULD` and `COULD` findings are recorded as follow-ups instead of blocking the change. An approved requirement may still be shipped as several small PRs.
6. **The orchestrator** checks the Definition of Done, and **the product owner** updates the status in the feature register.

Pure bug fixes and technical improvements without new functionality may go directly to step 2. No code skips step 5.

**Responsibility boundaries:**
- The product owner avoids duplicate *functionality* (the same need solved twice).
- The architect designs and owns the rules, and avoids duplicate *code* (the same knowledge in several places).
- The reviewer checks that the rules are followed, but does not change rules or code.

## Definition of Done

- [ ] The acceptance criteria in the requirement are met
- [ ] The feature register (`docs/product/features.md`) is up to date
- [ ] Relevant skills have been used
- [ ] Tests written and green locally and in CI
- [ ] Lint and type checks without errors
- [ ] The reviewer has given `APPROVED` (no `BLOCKER`, every `SHOULD` fixed or justified; for docs-only changes, no `BLOCKER`)
- [ ] No secrets in the code
- [ ] Migrations are reversible or have a documented rollback plan
- [ ] API contracts, `docs/services.md` and ADRs updated where something changed

## Handover format

When an agent hands work back to the orchestrator:

```
## Result: <task>
Status: DONE | BLOCKED | PARTIAL | ESCALATE
Model: <haiku | sonnet | opus>
Escalation reason: <only for ESCALATE: what did not work and why>
Service(s): <affected services>
Changed files: <list>
Skills used: <list>
Tests: <what was added / run>
Decisions needing ADR: <yes/no + short>
Dependencies on other agents: <what is needed, from whom>
Open questions: <list>
```

## Security (applies to everyone)

- Secrets only via environment variables or a secret store, never in the repository.
- All external input is validated at the boundary.
- Least privilege for services, database roles and CI tokens.
- Internal services are not exposed publicly; all external traffic goes through the gateway.
- Identity and role reach the services only as `X-User-*` headers set by the gateway. The gateway removes the client's `X-User-*` on all routes. Services trust these headers and no other header for identity or role (ADR 0002, 0011). Roles in a service are checked in `application`, never only in the UI.
