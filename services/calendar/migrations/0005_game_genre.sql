-- +goose Up
-- The genre of a game (REQ-0014, ADR 0016). NULL means no genre. The list is the safety net here;
-- domain.Genres() is the Go list. Existing games get NULL, so nothing else changes.
ALTER TABLE games ADD COLUMN genre text
    CONSTRAINT games_genre_check CHECK (genre IN ('shooter', 'moba', 'racing', 'strategy', 'survival', 'party', 'rpg', 'sports'));

-- +goose Down
-- Loses the genre of every game, which is the only data this migration adds. Right only to roll back this release
-- (code before 0005 ignores the column) or on a fresh install; running up again gives every game no genre.
ALTER TABLE games DROP COLUMN genre;
