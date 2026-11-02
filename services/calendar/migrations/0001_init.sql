-- +goose Up
-- Groups and memberships of the calendar service (ADR 0006). The runtime role gets DML through default privileges
-- (infra/postgres/init), so no GRANT is needed here.
CREATE TABLE groups (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
    group_id  uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    user_id   uuid NOT NULL,
    role      text NOT NULL CHECK (role IN ('admin', 'member')),
    joined_at timestamptz NOT NULL,
    PRIMARY KEY (group_id, user_id)
);

-- The primary key starts with group_id, so "the groups of a user" needs its own index on user_id.
CREATE INDEX group_members_user_id_idx ON group_members (user_id);

-- The runtime role must not change the migration history (ADR 0012, operations base item 2).
REVOKE ALL ON goose_db_version FROM calendar;

-- +goose Down
-- Drops all groups and memberships. Only for rollback of a fresh install: the data is lost.
DROP TABLE group_members;
DROP TABLE groups;
