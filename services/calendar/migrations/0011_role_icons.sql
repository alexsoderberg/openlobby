-- +goose Up
-- The icon of a game role and of a lobby's role slot (REQ-0023, ADR 0024). NULL means not chosen yet, 'none' means the
-- admin chose "No icon". The list is the safety net here; domain.RoleIcons() is the Go list. No backfill: existing roles
-- keep NULL and get the suggestion in the game form. Numbered after 0010, which has already run: goose refuses an older
-- number added later.
ALTER TABLE game_roles ADD COLUMN role_icon text
    CONSTRAINT game_roles_role_icon_check CHECK (role_icon IN ('shield', 'medical-cross', 'dagger', 'crosshair', 'wrench', 'star', 'none'));
ALTER TABLE lobby_role_slots ADD COLUMN role_icon text
    CONSTRAINT lobby_role_slots_role_icon_check CHECK (role_icon IN ('shield', 'medical-cross', 'dagger', 'crosshair', 'wrench', 'star', 'none'));

-- +goose Down
-- Loses only the icons; the admin can choose them again. Code before 0011 ignores the columns.
ALTER TABLE lobby_role_slots DROP COLUMN role_icon;
ALTER TABLE game_roles DROP COLUMN role_icon;
