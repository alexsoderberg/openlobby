-- +goose Up
-- The game list (ADR 0010). A system admin changes it in a later requirement (REQ-0010). The checks are the safety net
-- of ADR 0010; the reserved name "Other" is not a row and is checked in domain.NewGame (ADR 0010 amendment
-- 2026-11-03). The runtime role gets DML through default privileges (infra/postgres/init), so no GRANT is needed here.
-- shortcut: the name check uses the whitespace class of PostgreSQL, so an exotic Unicode space can pass it while
-- application trims all Unicode whitespace (ADR 0004 rule 1); upgrade if such a name ever gets in.
CREATE TABLE games (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL CHECK (name !~ '^\s|\s$' AND char_length(name) BETWEEN 1 AND 50),
    default_max_players integer CHECK (default_max_players IS NULL OR default_max_players >= 1)
);

CREATE UNIQUE INDEX games_name_lower_key ON games (lower(name));

-- Fixed IDs, so that every environment and every test has the same games (ADR 0010, amendment review 3).
INSERT INTO games (id, name, default_max_players) VALUES
    ('ce3ff9c1-dabb-4270-b5e0-7b34de37410b', 'Counter-Strike 2', 5),
    ('bd8fae98-29a7-4b2c-8b49-384ee7a75ff7', 'World of Warcraft', 5),
    ('21d79e45-fc60-49b3-aa95-b44fa46a75b5', 'League of Legends', 5),
    ('7e9a4d35-1616-4f25-9828-fc6e2383b07b', 'Overwatch', 5);

-- +goose Down
-- Drops the game list, including games that a system admin added. Only for rollback of a fresh install: the data is lost.
DROP TABLE games;
