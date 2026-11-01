# 0008. Operations: containers, PostgreSQL and resource budget
Status: Accepted (2026-11-01)

## Context
The system is to run with Docker Compose on a Raspberry Pi 5 with 8 GB RAM. It is a single node, and the services must be able to run and restart independently. Deployment affects the design: number of databases, connections, which containers exist and which dependencies are needed to start a service. Public entry and TLS are decided in ADR 0009.

## Decision

**Containers (one service = one container, one responsibility per container):**

| Container | Image | Stateful | Responsibility |
|---|---|---|---|
| `edge` | official Nginx | no | Public entry, TLS (ADR 0009) |
| `certbot` | official certbot | yes (certificate volume) | Renews certificates (ADR 0009) |
| `gateway` | own (Go) | no | Routing, session validation |
| `auth` | own (Go) | no | Identity and sessions |
| `calendar` | own (Go) | no | Groups, lobbies, players |
| `frontend` | static web server with built files | no | The user interface |
| `postgres` | official PostgreSQL 17 (`postgres:17`) | yes (volume) | Data |

Images for own services are built for `linux/arm64` (and `amd64` for development) in CI. Each own service has its own `Dockerfile`. Official images (`edge`, `certbot`, `postgres`, the frontend web server) use configuration in `infra/`.

**PostgreSQL:** one instance in one container, major version 17 (image tag `postgres:17`; minor updates come with the tag, a major upgrade is a data migration with its own plan). ADR 0006 needs 13 or later for `gen_random_uuid()`. Two databases, `auth` and `calendar`, each with a runtime role and a migration role (ADR 0006, ADR 0012). Configured with small values: `shared_buffers` about 128 MB and a low `max_connections`. Each service uses a pool with at most 5 connections, configurable via environment variable.

**Frontend image:** static web server (official nginx image) serving built files from `frontend/dist`. The configuration is a single file that replaces the image's `/etc/nginx/nginx.conf`, because the default file has `access_log ... main` (which writes `$request` with the query string and the invite token) and `error_log ... notice`, and Nginx logs to every `error_log` given at the same level. It sets `access_log off;` and `error_log /dev/stderr emerg;` (amendment review 5). New external dependency, approved here. The alternative was a small Go server of its own, but that is one more piece of code to maintain for the same task.

**Configuration and state:** all configuration from environment variables. Own services log JSON to stdout. The Nginx containers and PostgreSQL log to stdout or stderr as ADR 0009 and the amendment review 5 say. Stateful parts are the PostgreSQL volume and the certificate volume (ADR 0009). Sessions live in the database, not in the container, so a restart of `auth` does not log users out.

**Health:** `/healthz` answers whether the process is alive. `/readyz` checks only the service's own database. It does not check other services, so that a service does not become unusable because of a fault in another service. The gateway has no database, so its `/readyz` answers like `/healthz` (ADR 0002).

**Compose dependencies** (so that `docker compose up <service>` starts as little as possible):
- `edge` → `gateway`
- `gateway` → `auth`, `frontend`
- `auth` → `postgres`
- `calendar` → `postgres`, `auth`
- `frontend` → nothing
- `certbot` → nothing

**Resource budget (estimate, measured before MVP goes live):**

| Component | Target RAM |
|---|---|
| PostgreSQL (shared_buffers 128 MB) | about 250 MB |
| Each Go service (gateway, auth, calendar) | about 30 MB each |
| Frontend container | about 20 MB |
| Edge (Nginx) | about 10 MB |
| Certbot (sleeps between renewals) | about 40 MB |
| Total | about 460 MB of 8 GB |

**Security in operation:** only `edge` publishes ports on the host (80 and 443). `gateway`, `auth`, `calendar`, `frontend` and PostgreSQL are not published. For local development `gateway` may be published on `127.0.0.1` in a separate dev configuration, never on all interfaces.

## Consequences
- A single node is a simple point of failure. For 3–15 users this is acceptable.
- Each new container costs roughly a few tens of MB and a configuration file to maintain. This is a reason not to split without need (ADR 0004).
- If the Postgres instance needs to be moved, it is a volume copy and one environment variable per service, with no code changes.
- Certificate renewal is an operational responsibility that lies outside the code. Monitoring of the certificate's expiry date is the DevOps expert's responsibility.

## Alternatives considered
- **A PostgreSQL container per service:** three instances of the same thing on a Pi. Unnecessary resource use.
- **SQLite:** simpler operation, but the stack says PostgreSQL and several services write at the same time.
- **Kubernetes or k3s:** unreasonable for a Pi and five containers.

Amendment 2026-11-01: `/healthz` and `/readyz` are not in `api/`. They are described in this ADR, and for the gateway in ADR 0002. No client is generated from them, and the gateway does not forward them.

Amendment 2026-11-01 (review 2): the internal contracts (`api/*/internal.yaml`) are reached only on the internal Compose network `services` (amendment review 5). No port is published for `auth` or `calendar`. The gateway blocks `/internal/*` from clients (ADR 0002). DevOps keeps this in `compose*.yml` and in the edge configuration.

Amendment 2026-11-02 (review 5): network segmentation and secrets in logs. Decided by the architect after the fourth contract review.
- **Networks.** The trust model (ADR 0002, ADR 0011) rests on "only the gateway reaches the services". A single default Compose network would let `edge` or `frontend` reach `auth` and `calendar` directly, and those services trust `X-User-*`. Compose therefore defines these networks, and each container joins only the ones listed (Docker networks are symmetric: a shared network means both can connect):

  | Network | `internal` | Members | Why |
  |---|---|---|---|
  | `public` | no | `edge` | Published ports 80 and 443 need a non-internal network |
  | `edge-gateway` | yes | `edge`, `gateway` | `edge` reaches only `gateway` |
  | `gateway-frontend` | yes | `gateway`, `frontend` | `frontend` reaches only `gateway` |
  | `services` | yes | `gateway`, `auth`, `calendar` | Routing, session validation, name lookup (`calendar` → `auth`) |
  | `data` | yes | `postgres`, `auth`, `calendar`, `auth-migrate`, `calendar-migrate` | Only the services and their migration jobs reach the database |
  | `auth-egress` | no | `auth` | Outbound calls to Discord |
  | `certbot-egress` | no | `certbot` | Outbound calls to Let's Encrypt |

  `internal: true` networks have no route to the internet, so `gateway`, `calendar`, `frontend` and `postgres` have no outbound access. `certbot` needs no network contact with `edge`; they share volumes (ADR 0009). A development configuration that publishes `gateway` on `127.0.0.1` attaches it to an extra non-internal network for that purpose, never in production. `docker compose up <service>` still works, because Compose creates the networks a service needs.
- **PostgreSQL logs no bind values.** Bind parameters carry secrets (`code_verifier`, invite tokens, token hashes). The server configuration in `infra/` sets: `log_statement = 'none'`, `log_min_duration_statement = -1`, `log_parameter_max_length = 0`, `log_parameter_max_length_on_error = 0` and `log_error_verbosity = terse` (drops `DETAIL`, which repeats key values on a unique or check violation). Most of these are defaults; they are set explicitly so that a changed default or image cannot turn them on. Statement text in error lines (`log_min_error_statement`) then holds only `$1` placeholders, which requires parameterized queries over the extended protocol: the `pgx` connection must not use the simple protocol (`default_query_exec_mode=simple_protocol` or `prefer_simple_protocol`), because that writes the values into the statement text. DevOps verifies the settings on the pinned image with `SHOW` in the smoke test (ADR 0009 review 5).
- **Frontend logs.** The `frontend` container writes no access log and logs errors at `emerg` only (see "Frontend image" above). The gateway's access log already has every request to the frontend with method, masked path, status and request ID (ADR 0002), so nothing is lost.
- **Required test (DevOps):** in CI, after `docker compose up`, `docker network inspect` of each network lists exactly the members in the table. The secret-log smoke test is in ADR 0009 review 5.
