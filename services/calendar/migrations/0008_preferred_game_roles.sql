-- +goose Up
-- The game roles a person usually plays (ADR 0022). The runtime role gets DML through default privileges
-- (infra/postgres/init).
-- No foreign key to game_roles: the admin write deletes and re-inserts every game role (ADR 0017 section 6), so a cascade
-- would wipe the choices on each save, and a plain foreign key would block it. The admin write removes the choices of
-- a removed role in its own transaction instead. user_id has no foreign key either, as in group_members: auth owns users.
CREATE TABLE preferred_game_roles (
    user_id      uuid NOT NULL,
    game_role_id uuid NOT NULL,
    PRIMARY KEY (user_id, game_role_id)
);
-- No current query uses this index: the primary key starts with user_id, so it cannot serve a lookup by game role. It is
-- for the joins of the member and lobby views (ADR 0022 point 3, PR3).
CREATE INDEX preferred_game_roles_game_role_id_idx ON preferred_game_roles (game_role_id);

-- +goose Down
-- Loses every person's choices. Rollback plan: run this, then revert the code (ADR 0022 point 2).
DROP TABLE preferred_game_roles;
