#!/usr/bin/env bash
# Smoke test of the whole stack with Docker Compose (ADR 0009 amendment review 5, ADR 0008 review 5, ADR 0009
# rate limit). Run from the repository root with `make smoke`. It starts the stack with the development
# certificate, then checks the effective configuration, the networks, the secret logging, the rate limit and the
# PostgreSQL settings. Exits 1 on any failure. It cannot pass until the gateway, auth, calendar and frontend images exist.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
# Git Bash rewrites arguments that start with a slash (for example /proc/1/status and the awk pattern /^Uid:/) into
# Windows paths. No effect on Linux.
export MSYS_NO_PATHCONV=1

BASE_URL=${BASE_URL:-https://localhost}
CALLBACK_URL="$BASE_URL/api/auth/callback?code=SECRETCODE&state=SECRETSTATE"
PROJECT=openlobby
failures=0

compose() { docker compose -f infra/compose.yaml -f infra/compose.dev.yaml "$@"; }
pass() { echo "ok    $*"; }
fail() { echo "FAIL  $*" >&2; failures=$((failures + 1)); }
# The secret values are in the URLs, so the responses are discarded and nothing is echoed.
send() { curl -sk --max-time 20 -o /dev/null "$@"; }

# Asserts that the directive occurs in the effective configuration only with the expected text.
assert_directive() { # service config directive expected
    local found
    found=$(grep -E "^\s*$3\s" <<<"$2" | sed 's/^\s*//')
    if [ "$found" = "$4" ]; then pass "$1: $3"; else fail "$1: $3 is '$found', expected '$4'"; fi
}

check_edge() {
    local config
    config=$(compose exec -T edge nginx -T 2>&1) || { fail "edge: nginx -T failed"; return; }
    assert_directive edge "$config" error_log "error_log /dev/stderr emerg;"
    assert_directive edge "$config" access_log "access_log /dev/stdout ol;"
    assert_directive edge "$config" proxy_max_temp_file_size "proxy_max_temp_file_size 0;"
}

check_frontend() {
    local config
    config=$(compose exec -T frontend nginx -T 2>&1) || { fail "frontend: nginx -T failed"; return; }
    assert_directive frontend "$config" error_log "error_log /dev/stderr emerg;"
    assert_directive frontend "$config" access_log "access_log off;"
}

# PID 1 of the frontend runs as uid 101, the nginx user of the official image (ADR 0008 operations base, item 11).
check_frontend_user() {
    local uid
    uid=$(compose exec -T frontend awk '/^Uid:/ {print $2}' /proc/1/status) || { fail "frontend: cannot read PID 1 status"; return; }
    if [ "$uid" = 101 ]; then pass "frontend: PID 1 runs as uid 101"; else fail "frontend: PID 1 runs as uid '$uid', expected 101"; fi
}

# The edge workers run as user nginx (ADR 0009 operations base, item 1). The master runs as root and is not checked.
check_edge_workers() {
    local ps_output workers
    ps_output=$(compose exec -T edge ps -o user,args 2>&1) || { fail "edge: ps failed"; return; }
    workers=$(grep 'nginx: worker' <<<"$ps_output")
    if [ -n "$workers" ] && ! grep -qv '^ *nginx ' <<<"$workers"; then
        pass "edge: worker processes run as user nginx"
    else
        fail "edge: worker processes are not all user nginx"
    fi
}

check_postgres_settings() {
    local name expected actual
    while IFS='=' read -r name expected; do
        # </dev/null: docker compose exec would otherwise read the settings list from the loop's stdin.
        actual=$(compose exec -T postgres psql -U postgres -tA -c "SHOW $name" </dev/null | tr -d '\r')
        if [ "$actual" = "$expected" ]; then pass "postgres: $name = $expected"; else fail "postgres: $name is '$actual', expected '$expected'"; fi
    done <<'SETTINGS'
listen_addresses=*
log_statement=none
log_min_duration_statement=-1
log_parameter_max_length=0
log_parameter_max_length_on_error=0
log_error_verbosity=terse
SETTINGS
}

# Service names of the containers attached to a network, sorted and comma separated.
members_of() { # network id
    local container
    for container in $(docker network inspect -f '{{range $id, $c := .Containers}}{{$id}} {{end}}' "$1"); do
        docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$container"
    done | sort | paste -sd, -
}

check_networks() {
    # Members are the services running after `up --wait`. One-shot migration jobs exit and are detached.
    local name internal members net_id actual_internal actual_members
    while IFS='|' read -r name internal members; do
        net_id=$(docker network ls -q --filter "label=com.docker.compose.project=$PROJECT" \
            --filter "label=com.docker.compose.network=$name")
        if [ -z "$net_id" ]; then fail "network $name does not exist"; continue; fi
        actual_internal=$(docker network inspect -f '{{.Internal}}' "$net_id")
        actual_members=$(members_of "$net_id")
        if [ "$actual_internal" = "$internal" ] && [ "$actual_members" = "$members" ]; then
            pass "network $name: $members (internal $internal)"
        else
            fail "network $name: members '$actual_members' internal '$actual_internal', expected '$members' internal '$internal'"
        fi
    done <<'NETWORKS'
public|false|edge
edge-gateway|true|edge,gateway
gateway-frontend|true|frontend,gateway
services|true|auth,calendar,gateway
data|true|auth,calendar,postgres
auth-egress|false|auth
certbot-egress|false|certbot
NETWORKS
}

# Requests whose URLs carry secrets (ADR 0009 amendment review 5, steps b and c). Reused by the error paths.
send_secret_requests() {
    send "$BASE_URL/api/auth/login?returnTo=/invite/SECRETTOKEN"
    send "$BASE_URL/api/invites/SECRETTOKEN"
    send -X POST "$BASE_URL/api/invites/SECRETTOKEN/join"
    send "$BASE_URL/invite/SECRETTOKEN?q=SECRETQUERY"
}

# Error paths write nothing with the secrets (step d): the same requests with gateway down, then with frontend down.
check_error_paths() {
    compose stop gateway >/dev/null
    send_secret_requests
    compose up -d --wait gateway >/dev/null
    compose stop frontend >/dev/null
    send_secret_requests
    compose up -d --wait frontend >/dev/null
}

# Login is limited to 10 per minute per address with burst 5 (ADR 0009). The 7th request is redirected, and the
# redirect carries Cache-Control: no-store (ADR 0005). /api/auth/me is not limited.
check_rate_limit() {
    local headers result
    for _ in 1 2 3 4 5 6; do
        send -H 'Cookie: ol_login=SECRETSTATE' "$CALLBACK_URL"
    done
    headers=$(curl -sk --max-time 20 -o /dev/null -D - -H 'Cookie: ol_login=SECRETSTATE' "$CALLBACK_URL")
    # The Location is the path form: an absolute URL would be built from the Host header (edge sets absolute_redirect off).
    if grep -q '^HTTP/[0-9.]* 302' <<<"$headers" && grep -qi '^location: /?loginError=login_failed' <<<"$headers"; then
        pass "rate limit: 7th login request is redirected to /?loginError=login_failed"
    else
        fail "rate limit: 7th login request is not a redirect to loginError=login_failed"
    fi
    if grep -qi '^cache-control: no-store' <<<"$headers"; then
        pass "rate limit: redirect carries Cache-Control: no-store"
    else
        fail "rate limit: redirect lacks Cache-Control: no-store"
    fi
    result=$(curl -sk --max-time 20 -o /dev/null -w '%{http_code}' "$BASE_URL/api/auth/me")
    if [ "$result" = 401 ]; then pass "rate limit: /api/auth/me is not limited"; else fail "rate limit: /api/auth/me gave $result, expected 401"; fi
}

check_logs() {
    local logs service path
    logs=$(compose logs --no-color --no-log-prefix edge gateway frontend auth calendar postgres 2>&1)
    if grep -qE 'SECRET(CODE|STATE|TOKEN|QUERY)|code=|state=' <<<"$logs"; then
        fail "logs: a secret value or a code=/state= parameter was logged"
    else
        pass "logs: no secret values and no code=/state= in any container"
    fi
    for service in edge gateway; do
        logs=$(compose logs --no-color --no-log-prefix "$service" 2>&1)
        for path in /api/invites/:token /invite/:token; do
            if grep -qF "$path" <<<"$logs"; then pass "$service logs $path"; else fail "$service does not log $path"; fi
        done
    done
}

main() {
    compose up -d --build --wait || { echo "FAIL  stack did not start" >&2; exit 1; }
    check_edge
    check_edge_workers
    check_frontend
    check_frontend_user
    check_postgres_settings
    check_networks
    send_secret_requests
    check_error_paths
    check_rate_limit
    check_logs
    if [ "$failures" -gt 0 ]; then echo "$failures check(s) failed" >&2; exit 1; fi
    echo "smoke test passed"
}

main
