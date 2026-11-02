-- +goose Up
-- Tables of the auth service (ADR 0003, ADR 0005, ADR 0006). The runtime role gets DML through default privileges
-- (infra/postgres/init), so no GRANT is needed here.
CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            text NOT NULL,
    provider_subject_id text NOT NULL,
    display_name        text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_subject_id)
);

CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users (id),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz NOT NULL
);

CREATE TABLE login_attempts (
    state_hash    bytea PRIMARY KEY,
    code_verifier text NOT NULL,
    return_to     text NOT NULL,
    expires_at    timestamptz NOT NULL
);

-- The runtime role must not change the migration history (ADR 0012, operations base item 2).
REVOKE ALL ON goose_db_version FROM auth;

-- +goose Down
-- Drops all data of the auth service. Only for rollback of a fresh install: logins and sessions are lost.
DROP TABLE login_attempts;
DROP TABLE sessions;
DROP TABLE users;
