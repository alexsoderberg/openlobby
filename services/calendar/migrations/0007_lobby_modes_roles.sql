-- +goose Up
-- Open lobbies, modes, activities and role slots on lobbies (ADR 0017 section 1). Nothing reads the new columns yet
-- (PR1 is schema only). The runtime role gets DML through default privileges (infra/postgres/init).
-- Like game_id (migration 0004), the new id columns have no foreign key: removing or renaming a game, mode, activity or
-- game role must not change or block a lobby, which keeps its own copy of the name. The checks are the safety net;
-- the rules are in the domain.
-- NULL game_name means a lobby without a game. Existing rows all have a name, so they keep passing.
ALTER TABLE lobbies ALTER COLUMN game_name DROP NOT NULL;
ALTER TABLE lobbies DROP CONSTRAINT lobbies_game_name_check;
ALTER TABLE lobbies ADD CONSTRAINT lobbies_game_name_check
    CHECK (game_name IS NULL OR (game_name !~ '^\s|\s$' AND char_length(game_name) BETWEEN 1 AND 50));

ALTER TABLE lobbies
    ADD COLUMN game_mode_id uuid,
    ADD COLUMN mode_name text CONSTRAINT lobbies_mode_name_check
        CHECK (mode_name IS NULL OR (mode_name !~ '^\s|\s$' AND char_length(mode_name) BETWEEN 1 AND 50)),
    ADD COLUMN activity_id uuid,
    ADD COLUMN activity_name text CONSTRAINT lobbies_activity_name_check
        CHECK (activity_name IS NULL OR (activity_name !~ '^\s|\s$' AND char_length(activity_name) BETWEEN 1 AND 50)),
    ADD CONSTRAINT lobbies_game_id_needs_name_check CHECK (game_id IS NULL OR game_name IS NOT NULL),
    ADD CONSTRAINT lobbies_mode_needs_game_check CHECK (game_mode_id IS NULL OR game_id IS NOT NULL),
    ADD CONSTRAINT lobbies_mode_name_pair_check CHECK ((game_mode_id IS NULL) = (mode_name IS NULL)),
    ADD CONSTRAINT lobbies_activity_name_pair_check CHECK ((activity_id IS NULL) = (activity_name IS NULL)),
    ADD CONSTRAINT lobbies_activity_needs_mode_check CHECK (activity_id IS NULL OR game_mode_id IS NOT NULL);

-- A copy of a game role in the lobby. game_role_id has no foreign key (the game role may be removed); with
-- lobby_id it is the identity of the role in the lobby. A lobby has game roles if and only if it has rows here.
CREATE TABLE lobby_role_slots (
    lobby_id     uuid NOT NULL REFERENCES lobbies (id) ON DELETE CASCADE,
    game_role_id uuid NOT NULL,
    name         text NOT NULL CONSTRAINT lobby_role_slots_name_check CHECK (name !~ '^\s|\s$' AND char_length(name) BETWEEN 1 AND 30),
    slots        integer NOT NULL CONSTRAINT lobby_role_slots_slots_check CHECK (slots >= 1),
    sort_order   integer NOT NULL,
    CONSTRAINT lobby_role_slots_pkey PRIMARY KEY (lobby_id, game_role_id)
);

-- NULL means flex. SET NULL on game_role_id only (PostgreSQL 15 column list, the image is 17): deleting the lobby's
-- role slots makes its players flex, and lobby_id must stay because it is part of the player's own key.
ALTER TABLE lobby_players
    ADD COLUMN game_role_id uuid,
    ADD CONSTRAINT lobby_players_role_slot_fkey FOREIGN KEY (lobby_id, game_role_id)
        REFERENCES lobby_role_slots (lobby_id, game_role_id) ON DELETE SET NULL (game_role_id);

-- +goose Down
-- Loses the mode, activity and role information of every lobby; players keep their spots. It fails (and changes
-- nothing, goose runs it in one transaction) while a lobby without a game exists, because game_name cannot become
-- NOT NULL again. Rollback plan: delete the lobbies with game_name IS NULL first, or accept losing them, then retry.
-- Roll back 0007 before 0006 (it is newer).
ALTER TABLE lobby_players
    DROP CONSTRAINT lobby_players_role_slot_fkey,
    DROP COLUMN game_role_id;
DROP TABLE lobby_role_slots;

ALTER TABLE lobbies
    DROP CONSTRAINT lobbies_activity_needs_mode_check,
    DROP CONSTRAINT lobbies_activity_name_pair_check,
    DROP CONSTRAINT lobbies_mode_name_pair_check,
    DROP CONSTRAINT lobbies_mode_needs_game_check,
    DROP CONSTRAINT lobbies_game_id_needs_name_check,
    DROP COLUMN activity_name,
    DROP COLUMN activity_id,
    DROP COLUMN mode_name,
    DROP COLUMN game_mode_id;
ALTER TABLE lobbies DROP CONSTRAINT lobbies_game_name_check;
ALTER TABLE lobbies ALTER COLUMN game_name SET NOT NULL;
ALTER TABLE lobbies ADD CONSTRAINT lobbies_game_name_check
    CHECK (game_name !~ '^\s|\s$' AND char_length(game_name) BETWEEN 1 AND 50);
