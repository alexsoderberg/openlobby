-- +goose Up
-- Removes the game cover (REQ-0026 Amendment 2026-11-25, ADR 0026 Amendment 2026-11-25). The cover rows are deleted and cannot be restored.
DELETE FROM game_images WHERE kind = 'cover';
ALTER TABLE game_images DROP CONSTRAINT game_images_kind_check;
ALTER TABLE game_images ADD CONSTRAINT game_images_kind_check CHECK (kind = 'logo');

-- +goose Down
-- Restores the constraint only. The cover rows deleted by Up are not restored (ADR 0026 Amendment 2026-11-25).
ALTER TABLE game_images DROP CONSTRAINT game_images_kind_check;
ALTER TABLE game_images ADD CONSTRAINT game_images_kind_check CHECK (kind IN ('logo', 'cover'));
