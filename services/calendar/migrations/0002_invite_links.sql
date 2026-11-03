-- +goose Up
-- Invite links of the calendar service (ADR 0006, ADR 0007). The check on max_uses mirrors
-- domain.InviteLinkMaxUsesLimit: change both in the same step, with a new migration. The runtime role gets DML
-- through default privileges (infra/postgres/init), so no GRANT is needed here.
CREATE TABLE invite_links (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id           uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    token              text NOT NULL UNIQUE,
    created_by_user_id uuid NOT NULL,
    created_at         timestamptz NOT NULL,
    expires_at         timestamptz NOT NULL,
    max_uses           integer NOT NULL CHECK (max_uses BETWEEN 1 AND 10),
    use_count          integer NOT NULL DEFAULT 0 CHECK (use_count >= 0 AND use_count <= max_uses)
);

-- PostgreSQL does not index foreign keys by itself: this serves the cascade delete and the list of a group's links.
CREATE INDEX invite_links_group_id_idx ON invite_links (group_id);

-- +goose Down
-- Drops all invite links, and with them every live token. Only for rollback of a fresh install: the data is lost.
DROP TABLE invite_links;
