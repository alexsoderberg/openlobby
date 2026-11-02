# 0012. Code generation, migrations and database driver
Status: Accepted (2026-11-01)

## Context
ADR 0001 requires that types are generated from the contracts in `api/` to Go and TypeScript, and asked the backend expert to present alternatives before the first contract. This ADR does that and also answers the three dependencies that ADR 0006 and ADR 0008 left open: migration tool, PostgreSQL driver and which database role runs migrations.

Requirements that guide the choice:
- Standard library first. Each new dependency requires this ADR and must sit behind an adapter.
- Generated types must not leak into the domain. They are used only in transport and in the adapter that calls another service.
- Migrations are reversible (`down`), run before the service and give the least possible database privileges (CLAUDE.md, ADR 0006, ADR 0008).
- Everything must work on `linux/arm64` (Raspberry Pi 5). All chosen tools are pure Go or Node tools without CGO.
- Minimal code. No custom generator, no custom migration runner.

Version numbers are not stated here. They are pinned in `go.mod` (`tool` directive) and `package.json`/lockfiles. The assessment of active maintenance is made from the projects' public releases at the time of writing. It has not been verified against current releases in this session, so backend checks it when pinning.

## Decision

### 1. Go generation from OpenAPI
**Tool:** `oapi-codegen` (v2), run via the `tool` directive in `go.mod` (Go 1.24+). This pins the generator's version without `tools.go`. The targets are `types`, `std-http-server` and `strict-server`. Exact target names and configuration keys are verified by the backend when pinning.

**Server in the standard library's `net/http`.** The generated code registers the routes in an `*http.ServeMux` (Go 1.22+ patterns). No router dependency. Strict mode gives a typed response type per status code in the contract, so that a missing code path gives a compile error.

**Generated packages:**
- Server: `services/<service>/internal/transport/gen/public/` and `.../gen/internal/`, one directory per contract (`api/<service>/openapi.yaml` and `internal.yaml`).
- Client to another service: `services/<consumer>/internal/infrastructure/<vendor>client/gen/`. Example: `authclient` in `calendar` and in `gateway`, generated from `api/auth/internal.yaml`. The client is an adapter, so the generated code lives in `infrastructure/`, not in `transport/`.
- Configuration file per target lives next to the contract in `api/<service>/`, so that the contract and its generation belong together.

**Rules:**
- Generated types are imported only by `transport` (server) and by the adapter that uses the client. `domain` and `application` never import a `gen` package.
- `transport` maps gen types to the application's types. No gen type passes a port.
- `format: uuid` is generated as `openapi_types.UUID` (from `github.com/google/uuid`) and is used only inside `gen` packages; transport converts it to `string` (review 2, decision 1). Path IDs, and request uuids where a malformed value must give a domain code, are `type: string` in the contracts and are checked in transport with the canonical uuid form in `pkg/httpapi`. The domain only receives validated values.
- `//go:generate go tool oapi-codegen ...` lives in a file in the parent directory of each `gen` directory. The generator is run by the developer when a contract changes. Generated files are never changed by hand (the header `Code generated ... DO NOT EDIT.` marks them).
- The gateway has no server code. It proxies, and its only generated code is the client to `auth`.

**Runtime dependencies:** `github.com/oapi-codegen/runtime` (small, same project) and the two modules it imports, `github.com/google/uuid` and `github.com/apapsch/go-jsonmerge/v2`. These three are what the generated code adds to the executable binary (checked with `go list -deps` on the generated packages, review 5).

### 2. TypeScript generation
**Tools:** `openapi-typescript` (devDependency, generates `paths` and `components` types, no runtime code) and `openapi-fetch` (runtime dependency with no dependencies of its own, typed client per path and method, returns `{ data, error }` instead of throwing).

**Files:** `frontend/src/api/gen/auth.ts` and `frontend/src/api/gen/calendar.ts`, one file per contract. The frontend sees both via `gateway`. The client is created once in `frontend/src/api/index.ts` with `createClient` and a `paths` type that is the intersection of the two generated types. No hand-written merging of contracts.

**Rules:**
- Script `gen:api` in `package.json` runs the generators.
- Components import from `src/api/index.ts`, not from `gen/` directly (the module rule in CLAUDE.md).
- No data-fetching library (e.g. React Query) is decided here (YAGNI).

**Alternative for TS:** `orval` generates ready-made clients and hooks. It gives more generated code and pulls in an HTTP library by default, so it is rejected (see below).

### 3. Migrations
**Tool:** `goose` (library and CLI), via `database/sql`.

**Format:** one file per migration, `services/<service>/migrations/NNNN_<name>.sql`, with the sections `-- +goose Up` and `-- +goose Down`. The sequence number is the next in order (ADR 0010, `*_games`). Each migration runs in a transaction, which goose does by default. `-- +goose NO TRANSACTION` is used only with a justification in a comment. This clarifies ADR 0006's requirement for a "down file": the requirement is met by a `Down` section in the same file. ADR 0006 is not changed.

**Embedding:** `services/<service>/migrations/migrations.go` contains `//go:embed *.sql` and exports `embed.FS`. The file lives in the same directory, because `embed` cannot reach across directory boundaries.

**Running as a one-off job.** The same image as the service, with the command `<service> migrate up` (`cmd/<service>/main.go`). Compose dependencies:
- `<service>-migrate` → `postgres` (healthy).
- `<service>` → `<service>-migrate` (`service_completed_successfully`).

Migrations are not run at service startup. Then the service process would need DDL privileges. `down` and `down-to` are run only manually, via the same job with an explicit argument.

**Two roles per database (least privilege):**
- `<service>_migrate`: owns the tables and runs DDL. Used only by the one-off job.
- `<service>`: DML (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on its tables. No DDL, no ownership. This is the runtime role that ADR 0006 and ADR 0010 describe.
- `CREATE` on the schema `public` is not granted to either role beyond the migration role.
Roles are created in `infra/` (DevOps). Passwords come from environment variables or a secret store.

**Rollback plan:** each migration has a `Down` section that is tested. If `Down` deletes data (a dropped column or table with rows), a line is written in the migration's comment saying what is lost and when `down` is the right path.

**Test:** each service with migrations has an integration test against real PostgreSQL: `up`, `down`, `up`. It runs in CI against a PostgreSQL service container (amendment review 5).

### 4. PostgreSQL driver
**Choice:** `database/sql` with the driver `github.com/jackc/pgx/v5/stdlib`. It is one dependency (pgx), and pgx provides the stdlib adapter in the same module.

**Rules:**
- Repository adapters live in `infrastructure/postgres` and implement the ports (`UserRepository`, `GameCatalog`, etc.). Only the adapters import `database/sql` and `pgx`.
- `*sql.DB` is configured from environment variables: at most 5 connections (ADR 0008).
- SQL is written by hand. Transactions start with `BeginTx` at the default level `READ COMMITTED` (ADR 0006).
- `*sql.Tx` and pgx types (e.g. `*pgconn.PgError`, SQLSTATE `23505`) are not visible outside the adapter. The transaction boundary (the group lock in ADR 0006) is expressed as a port in `application`. Backend formulates the port.
- `uuid` and `timestamptz` reach the application as `string` and `time.Time`. The adapter does the conversion.

**Changing driver:** switching the driver changes only the adapter's opening function and the DSN. This is a local change under CLAUDE.md's replacement test. Switching database engine is a larger change, because the SQL uses PostgreSQL features (`FOR UPDATE`, `gen_random_uuid()`, `check` constraints). That is accepted.

### 5. Handling of generated code
**Decision: generated code is checked in.** Reasons:
- Docker builds and local builds need no generator step. The build on the Pi needs no network to fetch the generator.
- Changes in generated code are visible in the PR, so the reviewer sees what a contract change does.
- IDE and `go build` work directly after cloning.

**Sync check in CI:**
1. Run the generators (`go generate` in each module with `gen` code and `npm run gen:api` in `frontend/`).
2. Run `git status --porcelain`. If the output is not empty (changed or new files, even if not committed), the build fails.

Pinning the generator in `go.mod` and the lockfile makes the output identical on all machines.

**Workflow for a contract change:** change `api/<service>/*.yaml`, run the generators, implement the change and check in everything in the same commit.

**Consequences for `.gitignore` (DevOps):**
- No new patterns. Generated directories must not be matched by any pattern in `.gitignore`.
- Existing `node_modules/` and `dist/` are enough.
- ESLint and Prettier ignore `frontend/src/api/gen/` (UI/UX expert and DevOps, in their respective configurations). Generated code is not formatted by Prettier, because the sync check compares raw generator output.
- golangci-lint skips files with the `DO NOT EDIT` header by default. No exclusion is needed in Go.
- Optional, COULD: `.gitattributes` with `*/gen/** linguist-generated=true`, so that diffs are collapsed on GitHub. No `-diff` (that would hide the review).

**Import rules:** a `depguard` rule in golangci-lint must forbid `*/gen` in `domain/` and `application/`, and `database/sql`, `jackc/pgx`, `pressly/goose` and `golang.org/x/oauth2` outside `infrastructure/` (goose may also be imported by `cmd/<service>` for the `migrate` command). The architect formulates the rule when the configuration file exists. Until then, the reviewer checks the rule manually.

## Consequences
- **New dependencies (all behind an adapter or within a service):** `oapi-codegen` (tool only, not in the binary), `github.com/oapi-codegen/runtime` (runtime, generator code) with its imports `github.com/google/uuid` (via `oapi-codegen/runtime/types`, used by generated code only, item 1 of review 3) and `github.com/apapsch/go-jsonmerge/v2` (review 5), `github.com/jackc/pgx/v5` (adapter in `calendar` and `auth`), `github.com/pressly/goose/v3` (migration job), `openapi-typescript` (devDependency), `openapi-fetch` (frontend, runtime). The other approved Go dependency is `golang.org/x/oauth2` in `auth`'s Discord adapter (ADR 0005 review 5).
- **One-off jobs in Compose:** `auth-migrate` and `calendar-migrate` are added as one-off services with the same image. It is not a new Dockerfile or new service. It is the same service in another process that runs and exits. ADR 0008's dependency list is read as: `auth` → `auth-migrate` → `postgres`, and `calendar` → `calendar-migrate` → `postgres`. Gateway and frontend are not affected.
- **Two roles per database:** `auth_migrate`/`auth` and `calendar_migrate`/`calendar`. ADR 0006's "one role per service" is extended with the migration role. DevOps creates the roles in `infra/`.
- **Gateway** gets a generated client to `auth` and no database and no server code.
- **Contract test between services:** client and server are generated from the same contract file, so that errors are caught at compile time. The runtime check is an `httptest` test of the adapter, which responds with gen types. It does not validate against the schema at runtime. That is a shortcut with a known limit: upgrade to schema validation if a wrong response gets through. The shortcut is commented in the code with the `shortcut:` form.
- **Migrations:** one `Down` per migration, tested in CI with `up`, `down`, `up`. Rollback plan in a comment when data can be lost.
- **ADR 0001:** the generator question is answered here.
- **Open question:** module structure (one `go.mod` per service or one shared). It decides where the `tool` directive lives. Recommendation: one `go.mod` per service, because each service is built and deployed on its own. Decided by the architect at the first backend PR and documented as an addition here.

## Alternatives considered

**Go generation:**
- **ogen:** generates server and client with its own router and its own optional types. More generated code and a larger surface to read in transport. The standard library handles it without. Rejected.
- **No generators (hand-written types):** writes the contract twice, against CLAUDE.md's rule "Contracts are generated, not written by hand twice". Rejected.
- **oapi-codegen without strict mode:** works, but responses per status code are then not checked at compile time. Fallback if strict mode gives too much generated code.
- **Runtime validation of the schema (middleware):** an extra dependency for something that strict mode and the domain's validation rules already cover. Rejected (YAGNI).

**TypeScript generation:**
- **orval:** ready-made clients and hooks, more generated code and an HTTP library by default. Rejected.
- **Types only, own fetch wrapper:** zero runtime dependencies, but a hand-written client that maps paths and errors. More own code than `openapi-fetch`. Rejected.

**Migrations:**
- **golang-migrate:** two files per migration (`.up.sql`, `.down.sql`) and no transaction by default. An error in the middle of a migration leaves the database in "dirty" state and requires manual action. Rejected in favor of goose.
- **Own migration runner with `embed`:** requires a version table, a lock, running `down` and tests. It is a codebase of its own to maintain for a task that finished tools already solve. Rejected.
- **Migration at service startup with a DDL role:** the service process would have DDL privileges in operation. Breaks least privilege. Rejected.
- **Same role for migration and runtime:** the same break. Rejected.

**Driver:**
- **pgxpool (native):** same pool and good performance, but all database code is bound to pgx's API. Switching driver would then be a rewrite of the adapter. Rejected to keep the change local. No measurement justifies the performance at 3–15 users.
- **lib/pq:** older driver. pgx is the more actively developed one. Rejected.
- **ORM (GORM) or sqlc:** an ORM hides SQL and puts a layer between adapter and database. sqlc is yet another generator for a few queries. Rejected (YAGNI).
- **Generated code in `.gitignore` and generation in the build:** requires the generator in every build step, including Docker on the Pi. Rejected in favor of checked-in code with a sync check.

Amendment 2026-11-01 (review 2). The architect checked the generator behaviour with oapi-codegen v2.8.2 in a scratch module outside the repository. The findings below are the basis of the decisions.

**Findings:**
- A required nullable integer is generated as `*int` with a JSON tag without `omitempty`. A missing key and `null` decode to the same value. Only a custom decoder could tell them apart, which costs more code than the rule buys (ADR 0001, "A missing or `null` nullable field is `null`").
- `format: uuid` is generated as `openapi_types.UUID` from `github.com/oapi-codegen/runtime/types`, which is `github.com/google/uuid`. v2.8.2 has no configuration option that maps every uuid to `string`. The only per-property mechanism is `x-go-type`, which is not used.
- `allOf` with one `$ref` and `nullable: true` is generated as a pointer to the referenced type. This is the form used for optional references.
- The strict server decodes the body before the handler. Decode errors go to `RequestErrorHandlerFunc`, errors returned by the handler go to `ResponseErrorHandlerFunc`.

**Decisions:**
1. **uuid:** `openapi_types.UUID` is used only inside `gen` packages. The transport converts it to `string` with `.String()`. No other package imports `google/uuid`. Replaces "generated as `string` via type mapping".
2. **Path IDs:** path parameters are `type: string` in the contracts. `pkg/httpapi` holds one regular expression for the canonical uuid form and a function that checks it. Both services use it in transport. An invalid form gives the not-found code of the resource (ADR 0001, step 1).
3. **Generator configuration:** one YAML file per target, next to the contract. Each `gen` directory has a `go:generate` line in its parent directory, which runs `go tool oapi-codegen -config <file> -o gen/gen.go <contract>`. The paths are relative to that directory.
   - `api/auth/oapi-codegen-public.yaml`: `package: publicapi`; `generate: {models: true, std-http-server: true, strict-server: true}`. Output: `services/auth/internal/transport/gen/publicapi/`.
   - `api/auth/oapi-codegen-internal.yaml`: `package: internalapi`; the same `generate`. Output: `services/auth/internal/transport/gen/internalapi/`.
   - `api/auth/oapi-codegen-client.yaml`: `package: gen`; `generate: {models: true, client: true}`. Output: `services/calendar/internal/infrastructure/authclient/gen/` and `services/gateway/internal/infrastructure/authclient/gen/`. Both consumers use the same file.
   - `api/calendar/oapi-codegen-public.yaml`: `package: publicapi`; the same `generate` as the auth public file. Output: `services/calendar/internal/transport/gen/publicapi/`.
4. **Error handlers:** the transport passes `RequestErrorHandlerFunc` (400 `invalid_request`) and `ResponseErrorHandlerFunc` (log with category and `requestId`, no details; 500 `internal_error`) to the strict handler. Both are written by `pkg/httpapi`. The generator defaults are not used.
5. **Constraints are not checked at runtime.** The `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `maxItems` and `enum` constraints of request bodies are documentation and TypeScript types. The domain enforces them (ADR 0004, ADR 0010), and each limit needs a domain test.
   `shortcut: contract constraints on request bodies are not enforced at runtime, upgrade with a validation middleware if a constraint exists only in the contract`.
6. **Contract layout:** each contract is self-contained, with no `$ref` to another file. The error envelope (`ErrorResponse`, `ErrorBody` without its `code` enum, `RequestIdHeader`, `InternalError`) is copied into each contract, and the copies must be identical. The Rule of Three is not applied across contracts: each contract is generated and linted on its own, and a cross-file `$ref` would couple the generators and Redocly, which has not been verified. Revisit at a fourth copy.
   Each `code` enum lists the codes that the contract may return. The two public contracts also list `not_found` and `method_not_allowed` (gateway only). Every operation documents `500` with `InternalError`, except `startLogin` and `completeLogin`, which always redirect (ADR 0001 review 3).
7. **Contract lint (tooling, not runtime):** Redocly CLI is a development dependency at the repository root.
   - `package.json` at the root, `"private": true`, with only `devDependencies`. `@redocly/cli` is pinned to an exact version (`--save-exact`).
   - `package-lock.json` at the root, committed.
   - Script `lint:api`: `redocly lint api/auth/openapi.yaml api/auth/internal.yaml api/calendar/openapi.yaml`. The file list is explicit, because npm on Windows does not expand globs.
   - CI runs `npm ci` and `npm run lint:api` at the root. `redocly.yaml` is read from the root.
   - Why the root and not `frontend/`: the contracts and `redocly.yaml` are at the root, and the API lint must not need a frontend install. The frontend keeps its own `package.json` for `openapi-typescript` and `openapi-fetch`.
   - The new-dependency adapter rule (ADR 0012, Consequences) covers production code. Redocly is development tooling, not part of a service or the frontend bundle, so it has no port.

Amendment 2026-11-01 (review 3). Decisions after backend applied the change lists and the lint ran.
- **Nullable schemas carry `type`.** A schema with `nullable: true` also has `type` in the same schema object, including when it uses `allOf`. Redocly's `nullable-type-sibling` rule requires it. The lint configuration is not changed, because the linter is authoritative (CLAUDE.md). The review 2 rule "no `type` next to `nullable`" is withdrawn.
- **`required` follows the domain rule.** A field is `required` in a schema only when a missing value gives `invalid_request` (ADR 0001). Where ADR 0003 gives a domain answer for a missing value, the field is not `required`. Example: `ValidateSessionRequest.token`, where a missing or empty token gives 401 (ADR 0003).
- **Shared copies have one wording.** The copies of `RequestIdHeader` and of `ErrorBody.requestId` in `api/auth/openapi.yaml`, `api/auth/internal.yaml` and `api/calendar/openapi.yaml` have identical descriptions. The text is set in the review 3 change list.
- **Nullable uuids in request bodies carry no `format: uuid`** when a malformed value must give a domain code (ADR 0010 amendment review 3, `gameId`). The generated decoder would otherwise answer `invalid_request`.
- **Defaults and lobby limits are two schemas.** `MaxPlayers` (a lobby's max, set at creation) and `DefaultMaxPlayers` (the game list's default, changed by the system admin) are not shared, so that the description of each stays true.

Amendment 2026-11-01 (consolidated). The `required` rule, the shared-copy rule and the order of checks are in ADR 0001 "Amendment 2026-11-01 (consolidated)". It replaces the review 3 sentence "The text is set in the review 3 change list" and refines decision 6. Verified in a scratch module with oapi-codegen v2.8.2, openapi-typescript 7.13.0 and Redocly 2.72.1.

**1. Schema names must not collide with generated names.** oapi-codegen generates, per operation, the types `<OperationId>Response`, `<OperationId>Params`, `<OperationId>JSONRequestBody`, `<OperationId>RequestObject` and `<OperationId>ResponseObject` (with the operationId in upper camel case), and per status code `<OperationId><Status>JSONResponse`. A schema in `components.schemas` must not have one of those names. Example that failed: the schema `LookupUsersResponse` and the operation `lookupUsers` (client wrapper `LookupUsersResponse`). It is renamed `UserNameList`. Schemas named `<OperationId>Request` (for example `CreateLobbyRequest` for `createLobby`) are allowed, because no such name is generated. The reviewer checks new schemas against the list, and the generation step catches a clash at compile time.

**2. Generated nullable and `required` forms (verified).** A `required` `date-time` is `time.Time` and a missing or `null` value decodes to the zero value (transport checks `IsZero`, ADR 0001 consolidated item 2). A field that is not `required` is a pointer with `omitempty`. A nullable `$ref` to an integer schema is `*int`. In TypeScript, a field that is not `required` is optional (`name?: string`).

**3. Redocly warnings.** The five `operation-2xx-response` and `operation-4xx-response` warnings on `startLogin`, `completeLogin` and `logout` are turned off for `api/auth/openapi.yaml` only, in `redocly.yaml` under `apis.auth-public`, with a comment. `operation-2xx-response` warns on `startLogin` and `completeLogin`; `operation-4xx-response` warns on all three. Reason: `startLogin` and `completeLogin` always answer with a 302 and never with JSON (ADR 0005), and `logout` has no 4xx response (its success is 204; its 500 and 503 are JSON, ADR 0001), so the rules cannot be satisfied without inventing responses. The rules stay on for the internal and calendar contracts. The override matches by the path given to `redocly lint`, which is how `lint:api` calls it. `npm run lint:api` is free of findings.

**4. Generator configuration files (exact content).** Each file is next to its contract. The `go:generate` line in the parent directory of each `gen` directory passes the output file, so `output` is not set in the file (paths are relative to that directory).
- `api/auth/oapi-codegen-public.yaml`: `package: publicapi`; `generate: {models: true, std-http-server: true, strict-server: true}`. Run for `api/auth/openapi.yaml`, output `services/auth/internal/transport/gen/publicapi/gen.go`.
- `api/auth/oapi-codegen-internal.yaml`: `package: internalapi`; the same `generate`. Run for `api/auth/internal.yaml`, output `services/auth/internal/transport/gen/internalapi/gen.go`.
- `api/auth/oapi-codegen-client.yaml`: `package: gen`; `generate: {models: true, client: true}`. Run for `api/auth/internal.yaml`, output `services/calendar/internal/infrastructure/authclient/gen/gen.go` and `services/gateway/internal/infrastructure/authclient/gen/gen.go`.
- `api/calendar/oapi-codegen-public.yaml`: `package: publicapi`; the same `generate` as the auth public file. Run for `api/calendar/openapi.yaml`, output `services/calendar/internal/transport/gen/publicapi/gen.go`.
The checked-in files `api/auth/oapi-codegen-public.yaml`, `api/auth/oapi-codegen-internal.yaml`, `api/auth/oapi-codegen-client.yaml` and `api/calendar/oapi-codegen-public.yaml` are the source of their exact text.

**5. Shared copies.** Decision 6 is refined by ADR 0001 consolidated item 4: five blocks are identical, `code.description`, `code.enum`, `Unauthenticated` and `info` are not.

Amendment 2026-11-02 (review 5). Decisions after the fourth contract review. Verified in a scratch module with oapi-codegen v2.8.2 and the repository's four configuration files.

**1. Parameter binding errors go to `ErrorHandlerFunc`, not to the strict handlers.** The generated `ServerInterfaceWrapper` binds query, header and cookie parameters before the strict handler runs. A binding error (for example a query parameter given twice, `state=a&state=b`, or two `X-Request-Id` headers) goes to `StdHTTPServerOptions.ErrorHandlerFunc`. Its default answers 400 with plain text (`Invalid format for parameter state: multiple values for single value parameter 'state'`), which breaks both the error envelope and the login redirect. Every generated server therefore passes `ErrorHandlerFunc` to `HandlerWithOptions`:
- `calendar` public and `auth` internal: the `pkg/httpapi` handler that answers 400 `invalid_request` with the envelope (the same as `RequestErrorHandlerFunc`, decision 4 of review 2);
- `auth` public: the redirect `/?loginError=login_failed` with `Cache-Control: no-store` (ADR 0005 review 5). Only `startLogin` and `completeLogin` have parameters a client controls; the gateway sends exactly one `X-Request-Id`. The two login handlers never return an error to the strict handler, because `ResponseErrorHandlerFunc` would answer JSON: they map every error to the redirect themselves (ADR 0001 review 3).
Required tests: two `X-Request-Id` headers to a `calendar` operation give 400 `invalid_request` with the envelope; `GET /api/auth/callback?state=a&state=b` gives 302 to `/?loginError=login_failed`.

**2. A response with two cookies uses its own response type.** For a header named `Set-Cookie`, the generator makes one `SetCookie *string` and writes it with `Header().Set`, so a response can carry only one cookie. A successful `completeLogin` sets `ol_session` and clears `ol_login`. Transport returns its own type that implements the generated `CompleteLoginResponseObject` interface and writes each cookie with `http.SetCookie`. All cookies are built as `http.Cookie` values (with `http.SetCookie` or `Cookie.String()`), never by string concatenation. Verified: the strict handler accepts the type, and the response carries both cookies.

**3. Integration tests against PostgreSQL use a CI service container, not testcontainers.** Integration tests have the Go build tag `integration` and read the database address from `TEST_DATABASE_URL`. With the tag set and the variable missing, the test fails (it does not skip). CI runs `go test -tags=integration ./...` with a GitHub Actions service container on the same image tag as production (`postgres:17`, ADR 0008). Locally, `docker compose up postgres` gives the database. `go test ./...` without the tag needs no database. Reason: no new Go dependency and no Docker socket access from tests; testcontainers would add a module tree for what CI already provides.

**4. The driver uses the extended protocol.** `pgx` sends parameters separately from the statement by default. Neither the code nor the DSN (an environment variable, DevOps) sets `default_query_exec_mode=simple_protocol` or `prefer_simple_protocol`, because the simple protocol puts the values into the statement text, which PostgreSQL writes into its error log (ADR 0008 review 5).

**5. Corrections in place:** the uuid mapping (decision list above), the runtime dependencies (`go-jsonmerge`), the import rule (`golang.org/x/oauth2`) and the reference to the configuration files (the H-list was a working document and is not in the repository).

Amendment 2026-11-02 (review 7): corrected the logout wording.

Amendment 2026-11-02 (operations base): subcommands, migration history and sequences. Decided by the architect on the open questions of the DevOps expert. The container contract and the environment are in ADR 0008 (operations base).
1. **Subcommands.** The migration job runs `migrate up` and `migrate down`. `down` rolls back one migration. `down-to` is not built in MVP (YAGNI). A rollback of several migrations is several `migrate down` runs, each with the check of the lost data in the migration's comment. This replaces "`down` and `down-to`" in the section "Running as a one-off job". `serve` and `migrate` are subcommands of the same binary (ADR 0008 operations base).
2. **The runtime role cannot change the migration history.** The default privileges in `infra/postgres/init` give the runtime role DML on every table that the migration role creates. That includes goose's version table `goose_db_version`, which goose creates before migration 0001 runs. A DML grant on the history would let a compromised service rewrite which migrations count as applied, so it is revoked. Decision: the first migration of each service (`0001_*.sql`, `auth` and `calendar`) ends with `REVOKE ALL ON goose_db_version FROM <service>;`. Because the revoke runs after goose has created the table, it removes the default grant. Required test: the integration test (`up`, `down`, `up`) also asserts, after `up`, that the runtime role has no privilege on `goose_db_version` (`has_table_privilege` is false for INSERT, UPDATE and DELETE). The migration role keeps its rights as owner.
3. **Sequences.** The default privileges grant no sequence rights, and the services use uuid keys (ADR 0006). A migration that adds a `serial` or identity column grants `USAGE` on that sequence to `<service>` in the same file. Without the grant the runtime role cannot insert into the table.
