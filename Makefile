# Shared commands for developers and CI (CLAUDE.md). Run from the repository root.
COMPOSE := docker compose -f infra/compose.yaml
COMPOSE_DEV := $(COMPOSE) -f infra/compose.dev.yaml
# Optional: make dev SERVICE=calendar starts one service with its dependencies.
SERVICE ?=

.PHONY: config dev-certs dev nginx-test smoke

# Validates the Compose files and their interpolation against the placeholder values.
config:
	$(COMPOSE) --env-file infra/.env.example config --quiet
	$(COMPOSE) -f infra/compose.dev.yaml --env-file infra/.env.example config --quiet
	$(COMPOSE) -f infra/compose.bootstrap.yaml --env-file infra/.env.example config --quiet

# Self-signed certificate for localhost, used only in development and in the smoke test. The key is readable
# by root in the edge container, which has no CAP_DAC_OVERRIDE (ADR 0009, item 3).
infra/dev-certs/fullchain.pem:
	mkdir -p infra/dev-certs
	openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=localhost" \
		-keyout infra/dev-certs/privkey.pem -out infra/dev-certs/fullchain.pem
	chmod 0644 infra/dev-certs/privkey.pem

dev-certs: infra/dev-certs/fullchain.pem

dev: dev-certs
	$(COMPOSE_DEV) up --build --wait $(SERVICE)

# Syntax check of the Nginx configurations. The frontend file is tested without its built files.
nginx-test: dev-certs
	$(COMPOSE_DEV) run --rm --no-deps edge nginx -t
	docker run --rm -v "$(CURDIR)/infra/frontend/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.31.2-alpine nginx -t

smoke: dev-certs
	bash infra/smoke-test.sh
