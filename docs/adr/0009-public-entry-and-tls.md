# 0009. Public entry and TLS
Status: Accepted (2026-11-01)

## Context
The system is to be reached from the internet via the home Pi (ADR 0008). Discord requires HTTPS for the redirect URI in production (ADR 0005), the `Secure` cookie requires HTTPS, and REQ-0001 requires that data between browsers and the app is protected by an encrypted connection. The gateway keeps routing and session validation (ADR 0002) and should not handle TLS. The user has decided that Nginx terminates TLS and forwards the traffic to the gateway.

## Decision

**Container `edge`:** official Nginx image. One responsibility: public entry. It does TLS, HTTP→HTTPS redirect, security headers and forwarding to `gateway`. It has no application logic, serves no built files and does not route to other services. The configuration lives in `infra/edge/` and is owned by the DevOps expert. No keys or certificates in the repository.

**Flow:** browser → `edge` (443) → `gateway` → `frontend`, `auth` or `calendar`. Port 80 is used only for the redirect and for the ACME challenge.

**Why a separate Nginx container and not the frontend's:**
- The responsibility differs: `edge` is TLS and public entry, `frontend` is built files. They change at different pace and for different reasons (certificate configuration and UI build respectively).
- The frontend container must be replaceable without touching the TLS configuration, and vice versa.
- A combined container would contain both TLS keys and frontend artifacts. It would also become the public entry for static files, which breaks "all traffic via the gateway".
- The cost is about 10 MB RAM and an extra hop of a few milliseconds. This is the simplest option that follows "one container, one responsibility".

**Ports:** `edge` publishes 80 and 443 on the host. No other container is published (ADR 0008).

**HTTP→HTTPS:** all traffic on port 80 is answered with `301` to the same address on https. The exception is `/.well-known/acme-challenge/`, which is served from a webroot volume for the ACME challenge.

**TLS:**
- Only TLS 1.2 and 1.3.
- Certificates from Let's Encrypt (assumption, see below), obtained with certbot in HTTP-01 mode.
- The container `certbot` (official image) runs `certbot renew` at a fixed interval (suggestion: 12 hours). It writes certificates to the volume `certs`, which `edge` reads in read-only mode. `certbot` and `edge` share the volume `acme-webroot`.
- Private keys and the ACME account key live only in the volumes. They are never in the repository, in an image or in an environment variable.
- Let's Encrypt certificates are valid for 90 days and are renewed when 30 days remain. Edge rereads the certificate on reload. The DevOps expert chooses the reload mechanism after renewal, e.g. a cron job on the host that runs `docker compose kill -s HUP edge`. The margin is 30 days.
- First certificate: `edge` does not start with HTTPS until a certificate exists. The DevOps expert describes a bootstrap step for the first installation.

**HSTS:** `Strict-Transport-Security` is set on HTTPS responses. Introduced in two steps: `max-age=300` until HTTPS is stable, then `max-age=31536000`. No `includeSubDomains` and no preload in MVP, because they bind the whole domain for longer than needed.

**Forwarded headers (edge → gateway):** `edge` always sets these values and replaces the client's own:
- `X-Forwarded-Proto: https`
- `X-Forwarded-For: $remote_addr`
- `X-Forwarded-Host: $host`

The gateway uses them only in the access log (ADR 0002). They are never used for decisions about session or authorization. `X-Request-Id` is passed on unchanged, and the gateway validates it (ADR 0001).

**Security headers:** `Referrer-Policy: same-origin` is set by `edge` for all responses. It is the only place for that header (ADR 0007). Content policy (CSP) is the frontend's decision.

**Proxy configuration:**
- The address of `gateway` comes from an environment variable, not hard-coded. Nginx image template support can be used for that.
- Nginx resolves the host name via Docker's built-in DNS at each call (variable in `proxy_pass` and `resolver`), not only at startup. Otherwise `edge` gets an old IP when `gateway` is restarted, which breaks the requirement that containers can be restarted without follow-on failures.

**Assumptions not decided by the user:**
- ASSUMPTION: an own domain name (or a DDNS name) that points to the home's public IPv4, and that ports 80 and 443 are forwarded from the router to the Pi.
- ASSUMPTION: Let's Encrypt with HTTP-01. DNS-01 requires an API token with the DNS provider, which is another secret. It is chosen first if port 80 cannot be reached.
- If the internet provider uses CGNAT (no public IPv4) or blocks 80/443, there is no direct way in. Then a tunnel (new external dependency, its own ADR) or another solution is required. A question for the user, because it decides whether the design can be deployed.

**Impact on other ADRs:** ADR 0001 (one entry point is now `edge`), ADR 0002 (TLS termination is not the gateway's; the gateway trusts `X-Forwarded-*` from `edge`), ADR 0005 (the operational question is referred here), ADR 0008 (containers, ports and resource budget). None of them is affected by the product's assumptions.

## Consequences
- Two Nginx configurations (`edge` and `frontend`) must be maintained. Accepted for the separation.
- An extra hop per call. Negligible for 3–15 users.
- The gateway cannot be reached from outside, because it is not published. `X-Forwarded-*` can therefore be trusted as they are set by `edge`.
- Certificate renewal is an operational responsibility. A missed reload causes no outage until the margin (30 days) runs out, but it must be monitored.
- Changing the TLS solution (e.g. to Caddy or a tunnel) affects only `infra/` and the container `edge`. No code in the services changes.
- Stateful: the certificate volume. It is part of the operations backup decision (ADR 0008).

## Alternatives considered
- **Nginx in the frontend container:** mixes responsibilities, TLS keys and build artifacts, and makes the frontend container the public entry.
- **`edge` serves the frontend directly, bypassing the gateway:** breaks the requirement that all external traffic goes through the gateway and that routing lives there.
- **Caddy:** automatic TLS in a container, fewer moving parts. Technically simpler. The user has chosen Nginx. A change is local to `infra/` and `edge` and can be made later without code changes.
- **Traefik or k3s ingress:** too large for a Pi (ADR 0008).
- **Certbot as a cron job on the host:** the certificate then lies outside the versioned container operation. The container is simpler to move and maintain.
- **TLS in the gateway (Go):** the gateway becomes a TLS server with certificate management and must be restarted at renewal. Mixes routing with operations.
- **External tunnel (e.g. Cloudflare Tunnel):** requires an external provider and its own ADR. Not chosen now, used only if CGNAT blocks a direct way in.

Amendment 2026-11-01 (rate limiting on login). Decides the open point "rate limiting on login and callback" (it was in `docs/services.md` and in the backend expert's guidelines, with no ADR).
- **Where:** `edge` (Nginx `limit_req`), not Go code. Reason: `edge` already sees every request first and holds the real client address (`$binary_remote_addr`), the limit needs no state in the services, and a change of limit is a configuration change in `infra/edge/`.
- **Which paths:** exactly `/api/auth/login` and `/api/auth/callback`. These are the only unauthenticated endpoints that cause outbound calls to the identity provider and database writes (`login_attempts`, ADR 0003). All other endpoints require a session. Logout and invite endpoints are not limited (ADR 0007).
- **Limit:** one zone shared by the two paths, 10 requests per minute per client address, `burst=5`, `nodelay`. Starting values for 3–15 users, tuned in operations. They are named in `infra/edge/`, not in the services.
- **Response:** the limit answers with a redirect to `/?loginError=login_failed` (`limit_req_status 429` and `error_page 429 =302 /?loginError=login_failed`, DevOps verifies the exact directive), because login endpoints never show raw errors (ADR 0005). No new error code and no frontend change. A limited request is logged by Nginx at `warn` (`limit_req_log_level warn`), which the error log level `emerg` of the amendment review 5 suppresses; the access log shows it with status 302.
- **Impact:** no change to the contracts in `api/`, the gateway or the services. ADR 0002 stays: the gateway does not rate limit. Replacing Nginx changes only `infra/edge/`.
- **Tests (DevOps):** a smoke test that the 7th request in quick succession to `/api/auth/login` gets the redirect and that `/api/auth/me` is not limited.

Amendment 2026-11-01 (review 4): `edge` must not log secrets. Secrets that pass through `edge`: `code` and `state` (query of `/api/auth/callback`, ADR 0005) and the invite token (path of `/api/invites/{token}`, `/api/invites/{token}/join` and the frontend page `/invite/{token}`, ADR 0007).
- **Access log:** one named `log_format` for all `server` blocks, built only from these variables: `$remote_addr`, `$request_method`, a masked path (below), `$status`, `$body_bytes_sent`, `$request_time`, `$upstream_status` and `$sent_http_x_request_id` (the ID the gateway validated, never the client's `$http_x_request_id`). Forbidden in any log format: `$request`, `$request_uri`, `$args`, `$query_string`, `$is_args`, `$http_referer`, `$http_cookie`, `$http_authorization`.
- **Masked path:** a `map $uri $log_path` that turns `/api/invites/<segment>...` and `/invite/<segment>...` into the same path with `:token` as the segment, and passes every other `$uri` through unchanged. `$uri` has no query string. DevOps writes the exact regular expression and verifies it. A sketch: `~^(/api/invites/|/invite/)[^/]+(.*)$  "$1:token$2";`.
- **Error log:** Nginx writes the full request line (with query and token) in error log lines that belong to a request, and that format cannot be changed. The level is `emerg` (amendment review 5, which replaces the level `crit` first chosen here). `limit_req_log_level` stays at `warn` and is not written.
- **Impact:** configuration in `infra/edge/` only. No change to the contracts or the services.
- **Required test (DevOps, smoke test):** replaced by the smoke test in the amendment review 5, which covers every container.

Amendment 2026-11-02 (review 5): error log level, temporary files and the smoke test for every container. Decided by the architect after the fourth contract review.
- **Error log level `emerg` in both Nginx containers (`edge` and `frontend`).** Level `crit` is not enough: Nginx also writes `crit` and `alert` lines with the request line, for example a failed `open()` of a temporary file (`crit`) or `socket() failed` when file descriptors run out (`alert`). `emerg` covers configuration, startup and certificate loading, also at a reload, which are the errors needed to operate `edge`. Runtime failures stay visible without request text: as 5xx with status, time and request ID in `edge`'s access log and in the gateway's log. Each container's configuration replaces the image's `/etc/nginx/nginx.conf`, which has `error_log ... notice` and an `access_log` with `$request`; Nginx would otherwise log to both. The only `error_log` directive is `error_log /dev/stderr emerg;` in the main context.
- **No response temporary files in `edge`:** `proxy_max_temp_file_size 0;`. Responses that do not fit in the proxy buffers are passed on synchronously instead of being written to disk. This keeps response bodies with invite tokens off the container's disk and removes the temporary-file error path. Request bodies of the API are at most 16 KiB (ADR 0001) and fit in Nginx's default `client_body_buffer_size` (16 KiB on 64-bit), so they are not written to disk either.
- **Body size at `edge`:** Nginx's default `client_max_body_size` (1 MiB) stays. A larger body gets 413 from `edge` before it reaches the gateway. Bodies between 16 KiB and 1 MiB reach the service and get 400 `invalid_request` as the contracts say. No client sends such bodies, so no extra configuration is added.
- **Frontend:** `access_log off;` and `error_log /dev/stderr emerg;` (ADR 0008 review 5). The access log rules of the amendment review 4 apply to `edge` only.
- **Required smoke test (DevOps, replaces the test of the amendment review 4).** The whole stack runs with Compose. Send through `edge`:
  - (a) `GET /api/auth/callback?code=SECRETCODE&state=SECRETSTATE` with `Cookie: ol_login=SECRETSTATE`, at least 7 times in quick succession, so that the rate limit answers;
  - (b) `GET /api/auth/login?returnTo=/invite/SECRETTOKEN`;
  - (c) `GET /api/invites/SECRETTOKEN`, `POST /api/invites/SECRETTOKEN/join` and `GET /invite/SECRETTOKEN?q=SECRETQUERY`;
  - (d) (b) and (c) again with `gateway` stopped, and `GET /invite/SECRETTOKEN?q=SECRETQUERY` again with `frontend` stopped and `gateway` running.
  Then assert:
  - the captured stdout and stderr of `edge`, `gateway`, `frontend`, `auth`, `calendar` and `postgres` contain none of `SECRETCODE`, `SECRETSTATE`, `SECRETTOKEN`, `SECRETQUERY`, `code=` or `state=`;
  - the access log of `edge` and the log of `gateway` contain `/api/invites/:token` and `/invite/:token`;
  - effective configuration: `nginx -T` in `edge` and in `frontend` shows exactly one `error_log` directive, `error_log /dev/stderr emerg;`; in `edge` every `access_log` uses the named `log_format` of the amendment review 4, and `proxy_max_temp_file_size 0;` is set; in `frontend` the only `access_log` directive is `access_log off;`;
  - in `postgres`, `SHOW` gives the five logging values of ADR 0008 review 5.
  Steps (d) exercise the error paths: with level `emerg` they write nothing, and the assertion on the configuration shows that no lower level is active anywhere.

Amendment 2026-11-02 (operations base): users, certbot, development key and request bodies. Decided by the architect on the open questions of the DevOps expert. Item 4 corrects the amendment review 5 above.
1. **`edge`: the master process runs as root (exception to the non-root rule, ADR 0008 item 1).** The official Nginx image starts the master as root. The master binds ports 80 and 443 and reads the private key at start and at reload. The workers run as `nginx` (uid 101), because `infra/edge/nginx.conf` sets `user nginx;` explicitly. The master accepts no client connections and handles no requests. Rejected alternative: `nginx-unprivileged` on ports 8080 and 8443, published as 80 and 443. It needs the certbot key readable by uid 101, which needs a certbot deploy hook that changes the key's group on every renewal. It also gives no real protection, because the master loads the key before it forks the workers, so a worker has the key in its memory anyway. Mitigation in `infra/compose.yaml`: `cap_drop: [ALL]` and `cap_add: [CHOWN, SETGID, SETUID, NET_BIND_SERVICE]`, plus `no-new-privileges` (already set). CHOWN lets Nginx set the owner of its cache directories at start, SETUID and SETGID let it switch to user `nginx`, NET_BIND_SERVICE allows ports 80 and 443. If startup fails with a permission error, DevOps adds only the capability named in the error and records it in this amendment.
2. **`certbot` runs as root.** It writes root-owned certificates and keys into the `certs` volume, and `edge` reads them as root. Mitigation: `cap_drop: [ALL]` and `security_opt: [no-new-privileges:true]`. The bootstrap run (`infra/README.md`, first certificate) uses the same service definition, so it verifies this. If renewal fails with a permission error, the same rule as in item 1 applies.
3. **Development key.** `make dev-certs` sets the mode of `infra/dev-certs/privkey.pem` to 0644. Without `CAP_DAC_OVERRIDE`, root in the container can read a key only if its owner is root or its mode allows it, and a key created by the host user at mode 0600 is not readable. The same applies to the CI job `make nginx-test`. The file is for development and the smoke test only.
4. **Request bodies (corrects amendment review 5).** The sentence that bodies between 16 KiB and 1 MiB are not written to disk is wrong. Nginx's default `client_body_buffer_size` (16 KiB) is kept. A body over 16 KiB is written to `client_temp` in the container's writable layer. Nginx deletes it when the request ends. The size is bounded by `client_max_body_size 1m`. Memory is not used, neither `client_body_buffer_size 1m` nor a tmpfs: both take RAM from the 32 MB limit, and a few concurrent 1 MB uploads would kill the container. No secret travels in an API request body: invite tokens are in the path, and the login flow has no body (ADR 0005, ADR 0007). The temporary files therefore hold no secret, and nothing survives a restart. `edge` is not `read_only`. `shortcut: request bodies over 16 KiB use the container disk, limit concurrent uploads with limit_conn if the disk or the memory is ever under pressure`.
