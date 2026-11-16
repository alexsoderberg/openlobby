-- +goose Up
-- The logo and cover of a game (ADR 0026). Both kinds are allowed from the start, so the cover needs no migration. The
-- size limit mirrors domain.MaxGameImageBytes and the version is the hex SHA-256 of the image. The runtime role gets DML
-- through default privileges (infra/postgres/init). A removed game takes its images with it.
-- 0009 is reserved for ADR 0024 (role icons). goose allows the gap, but refuses a 0009 added after this one has run, so
-- whichever of the two merges second takes the next free number (ADR 0026 point 2).
CREATE TABLE game_images (
    game_id    uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    kind       text NOT NULL CONSTRAINT game_images_kind_check CHECK (kind IN ('logo', 'cover')),
    media_type text NOT NULL CONSTRAINT game_images_media_type_check CHECK (media_type IN ('image/png', 'image/jpeg', 'image/webp')),
    version    text NOT NULL CONSTRAINT game_images_version_check CHECK (version ~ '^[0-9a-f]{64}$'),
    image      bytea NOT NULL CONSTRAINT game_images_size_check CHECK (octet_length(image) BETWEEN 1 AND 524288),
    PRIMARY KEY (game_id, kind)
);

-- +goose Down
-- Loses only the uploaded images; games and lobbies are untouched and the frontend falls back to the monogram (ADR 0026).
DROP TABLE game_images;
