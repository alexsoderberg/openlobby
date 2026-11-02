#!/bin/sh
# One database per service with two roles (ADR 0006, ADR 0012): the runtime role gets DML only, the migration
# role owns the database and runs DDL. Runs once, on an empty data volume.
# Passwords are passed as psql variables, which psql substitutes into the statement text it sends. The guard against
# the password reaching the server log is `SET log_min_error_statement = panic` at the start of each session.
# shortcut: psql echoes the failing statement, with its password, to stderr when an error has a position, which
# lands in the container log; upgrade to passwords read from a file with \password or a precomputed SCRAM hash when
# the init script handles passwords for more than the single Pi (or when the init log is shared more widely).
set -eu

: "${AUTH_DB_PASSWORD:?}" "${AUTH_MIGRATE_DB_PASSWORD:?}" "${CALENDAR_DB_PASSWORD:?}" "${CALENDAR_MIGRATE_DB_PASSWORD:?}"

create_service_database() {
    service=$1
    runtime_password=$2
    migrate_password=$3
    migrate_role="${service}_migrate"

    psql --username "$POSTGRES_USER" --dbname postgres -v ON_ERROR_STOP=1 \
        -v service="$service" -v migrate_role="$migrate_role" \
        -v runtime_password="$runtime_password" -v migrate_password="$migrate_password" <<'SQL'
SET log_min_error_statement = panic;
CREATE ROLE :"service" LOGIN PASSWORD :'runtime_password';
CREATE ROLE :"migrate_role" LOGIN PASSWORD :'migrate_password';
CREATE DATABASE :"service" OWNER :"migrate_role";
REVOKE CONNECT ON DATABASE :"service" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"service" TO :"service", :"migrate_role";
SQL

    # Default privileges give the runtime role DML on every table the migrations create, so no migration grants it.
    psql --username "$POSTGRES_USER" --dbname "$service" -v ON_ERROR_STOP=1 \
        -v service="$service" -v migrate_role="$migrate_role" <<'SQL'
SET log_min_error_statement = panic;
GRANT USAGE ON SCHEMA public TO :"service";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrate_role" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"service";
SQL
}

create_service_database auth "$AUTH_DB_PASSWORD" "$AUTH_MIGRATE_DB_PASSWORD"
create_service_database calendar "$CALENDAR_DB_PASSWORD" "$CALENDAR_MIGRATE_DB_PASSWORD"
