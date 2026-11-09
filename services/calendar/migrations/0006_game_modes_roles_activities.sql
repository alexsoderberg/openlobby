-- +goose Up
-- Game modes, game roles and named activities of the game list (ADR 0017 section 1). Nothing reads them yet (PR1 is
-- schema only). The runtime role gets DML through default privileges (infra/postgres/init), so no GRANT is needed.
-- The names use the trimmed form and the check of games.name (migration 0003). The rules between the tables (sum of
-- slots equals max players) are in the domain, not here.
-- shortcut: the name checks use the whitespace class of PostgreSQL, so an exotic Unicode space can pass them while the
-- application trims all Unicode whitespace (ADR 0004 rule 1); upgrade if such a name ever gets in.
CREATE TABLE game_modes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id     uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    name        text NOT NULL CONSTRAINT game_modes_name_check CHECK (name !~ '^\s|\s$' AND char_length(name) BETWEEN 1 AND 50),
    max_players integer NOT NULL CONSTRAINT game_modes_max_players_check CHECK (max_players BETWEEN 1 AND 2147483647),
    sort_order  integer NOT NULL
);

CREATE UNIQUE INDEX game_modes_game_name_key ON game_modes (game_id, lower(name));
-- Target of the composite foreign key of game_roles: a role of a mode cannot name another game than the mode's.
CREATE UNIQUE INDEX game_modes_id_game_id_key ON game_modes (id, game_id);

-- The owner is the game when game_mode_id is NULL, otherwise the mode. A NULL game_mode_id skips the composite key
-- (MATCH SIMPLE), so a game-level role needs only the plain game_id key.
CREATE TABLE game_roles (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id      uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    game_mode_id uuid,
    name         text NOT NULL CONSTRAINT game_roles_name_check CHECK (name !~ '^\s|\s$' AND char_length(name) BETWEEN 1 AND 30),
    slots        integer NOT NULL CONSTRAINT game_roles_slots_check CHECK (slots >= 1),
    sort_order   integer NOT NULL,
    CONSTRAINT game_roles_mode_game_fkey FOREIGN KEY (game_mode_id, game_id)
        REFERENCES game_modes (id, game_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX game_roles_game_name_key ON game_roles (game_id, lower(name)) WHERE game_mode_id IS NULL;
CREATE UNIQUE INDEX game_roles_mode_name_key ON game_roles (game_mode_id, lower(name)) WHERE game_mode_id IS NOT NULL;

CREATE TABLE activities (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_mode_id uuid NOT NULL REFERENCES game_modes (id) ON DELETE CASCADE,
    name         text NOT NULL CONSTRAINT activities_name_check CHECK (name !~ '^\s|\s$' AND char_length(name) BETWEEN 1 AND 50),
    sort_order   integer NOT NULL
);

CREATE UNIQUE INDEX activities_mode_name_key ON activities (game_mode_id, lower(name));

-- +goose Down
-- Loses every mode, game role and activity of the game list. Lobbies are not touched (they hold copies, and migration
-- 0007 must be rolled back first because it is newer). Right only to roll back this release or on a fresh install.
DROP TABLE activities;
DROP TABLE game_roles;
DROP TABLE game_modes;
