-- +goose Up
-- Lobbies and their players (ADR 0006, ADR 0004 rule 6). The runtime role gets DML through default privileges
-- (infra/postgres/init), so no GRANT is needed here. The checks are the database's last line of defense; the rules
-- live in domain.NewLobby.
-- game_id and game_name have no foreign key to games on purpose: removing a game must not change or block a lobby
-- (ADR 0006, ADR 0010).
-- shortcut: the game_name check uses the whitespace class of PostgreSQL, so an exotic Unicode space can pass it while
-- application trims all Unicode whitespace (ADR 0004 rule 1); upgrade if such a name ever gets in.
CREATE TABLE lobbies (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id           uuid NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
    created_by_user_id uuid NOT NULL,
    game_id            uuid,
    game_name          text NOT NULL CHECK (game_name !~ '^\s|\s$' AND char_length(game_name) BETWEEN 1 AND 50),
    max_players        integer CHECK (max_players IS NULL OR max_players >= 1),
    starts_at          timestamptz NOT NULL,
    ends_at            timestamptz NOT NULL,
    created_at         timestamptz NOT NULL,
    CHECK (ends_at > starts_at AND ends_at - starts_at < interval '24 hours')
);

-- group_id leads, so the group's lobby queries use it too. The count of lobbies per game in a group (ADR 0010) is an
-- index-only lookup.
CREATE INDEX lobbies_group_id_game_id_idx ON lobbies (group_id, game_id);

CREATE TABLE lobby_players (
    lobby_id  uuid NOT NULL REFERENCES lobbies (id) ON DELETE CASCADE,
    user_id   uuid NOT NULL,
    joined_at timestamptz NOT NULL,
    PRIMARY KEY (lobby_id, user_id)
);

-- Mirror of domain.NewGroupName: the name is stored trimmed. Safe for existing rows because every write trims first
-- (domain.NewGroupName) and no other writer exists; a row that breaks it makes this migration fail and roll back.
ALTER TABLE groups ADD CONSTRAINT groups_name_trimmed CHECK (name !~ '^\s|\s$');

-- +goose Down
-- Drops all lobbies and players. Only for rollback of a fresh install: the data is lost.
ALTER TABLE groups DROP CONSTRAINT groups_name_trimmed;
DROP TABLE lobby_players;
DROP TABLE lobbies;
