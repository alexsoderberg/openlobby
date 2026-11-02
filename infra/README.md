# Operations (infra)

The stack runs with Docker Compose on one Raspberry Pi 5 (ADR 0008, ADR 0009). It needs Docker Compose 2.24 or later, GNU make, bash, curl and openssl. Configuration comes from `infra/.env` (see `.env.example`).

## Local start

1. Create a Discord application for development (not the production one). Register `https://localhost/api/auth/callback` as its redirect URI.
2. Run `make dev-certs`. It creates a self-signed certificate for `localhost` in `infra/dev-certs/` (git ignores it).
3. Copy `infra/.env.example` to `infra/.env` and fill in the values.
4. Run `make dev`, or `make dev SERVICE=calendar` for one service with its dependencies. Open https://localhost and accept the warning for the self-signed certificate.

Only `edge` publishes ports (80 and 443). `auth` (Discord) and `certbot` (Let's Encrypt) also have an egress network; every other container sits on an internal network (ADR 0008 review 5).

Database role passwords are set only when the `pgdata` volume is first initialised, by `infra/postgres/init`. Changing a value in `infra/.env` later does not change the role. To change a password, run `ALTER ROLE <role> PASSWORD '<value>';` in the postgres container, then update `infra/.env` and recreate the service that uses it.

## Discord redirect URIs

| Environment | Redirect URI | Discord application |
|---|---|---|
| Local | `https://localhost/api/auth/callback` | development |
| Production | `https://<domain>/api/auth/callback` | production |

## Production: first certificate (ADR 0009)

1. Point the DNS name at the home's public IPv4 and forward ports 80 and 443 from the router to the Pi.
2. Start `edge` with the bootstrap override, which serves only the ACME challenge:
   `docker compose -f infra/compose.yaml -f infra/compose.bootstrap.yaml up -d edge`
3. Obtain the certificate. The lineage is named `openlobby`, which is the path edge reads:
   `docker compose -f infra/compose.yaml run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/acme --cert-name openlobby -d <domain> -m <email> --agree-tos --no-eff-email`
4. Start everything: `docker compose -f infra/compose.yaml up -d --build --wait`. The new `edge` replaces the bootstrap one.

## Certificate renewal

The `certbot` container runs `certbot renew` every 12 hours. Nginx reads the certificate only at start or reload, so run a reload on the host once a day (a reload without a change does nothing):

`30 4 * * * cd <repository> && docker compose -f infra/compose.yaml kill -s HUP edge`

Monitoring of the expiry date is not set up yet.

## Container users and capabilities (ADR 0008, 0009 operations base)

- `edge`: the Nginx master runs as root (it binds 80 and 443 and reads the key at start and reload). The workers run as `nginx` (uid 101). The container drops all capabilities and adds only `CHOWN`, `SETGID`, `SETUID` and `NET_BIND_SERVICE`. If startup fails with a permission error, add only the capability named in the error and record it in ADR 0009.
- `certbot`: runs as root with all capabilities dropped. It writes the root-owned certificates that edge reads.
- `frontend`: runs as uid 101 with all capabilities dropped.
- PostgreSQL runs as the image's `postgres` user. The Go services will run as the `nonroot` user of their base image (uid 65532).
- `make dev-certs` sets the development key to mode 0644. Edge runs as root without `CAP_DAC_OVERRIDE`, so a key with mode 0600 owned by the host user cannot be read.

Known limits, each a shortcut in the ADRs:
- Traffic between the services and PostgreSQL uses `sslmode=disable` on the internal `data` network (ADR 0008, item 8).
- Request bodies over 16 KiB are written to Nginx's temporary directory on the container disk. The temporary files hold no secret and are removed when the request ends (ADR 0009, item 4).

## Smoke test

`make smoke` starts the stack with the development certificate and checks the Nginx configuration, the network members, the login rate limit, that no secret reaches a log and the PostgreSQL logging settings. The test cannot pass until the gateway, auth, calendar and frontend images exist.

## Rollback

Set `OPENLOBBY_VERSION` in `infra/.env` to the previous tag, and run `docker compose -f infra/compose.yaml up -d --wait`. The previous images must still exist. Schema changes are rolled back by hand, only when needed: `docker compose -f infra/compose.yaml run --rm auth-migrate migrate down` (or `calendar-migrate`), after reading the comment at the top of that migration for lost data.
