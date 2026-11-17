//go:build integration

package postgres

import (
	"context"
	"slices"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

// A role written through the domain without an icon is stored as "none", a chosen icon is stored, and the game tree
// read of the list, the group list and one game returns the stored icon (ADR 0024).
func TestRoleIconIsStoredAndReadInTheGameTree(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	shield := domain.RoleIcon("shield")
	raw := raidGame()
	raw.Modes[1].GameRoles[0].RoleIcon = &shield
	raw.Modes[1].MaxPlayers = nil // a write of a mode with game roles gives no max; the sum is stored
	checked, err := domain.NewGame("", raw.Name, nil, nil, raw.GameRoles, raw.Modes)
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.Games().Create(ctx, checked)
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	found, err := store.Games().Find(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	listed, err := store.Games().List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	listedRaid := listed[slices.IndexFunc(listed, func(game domain.Game) bool { return game.ID == created.ID })]
	for name, game := range map[string]domain.Game{"find": found, "list": listedRaid} {
		want := []domain.RoleIcon{domain.RoleIconNone, shield, domain.RoleIconNone}
		got := []domain.RoleIcon{roleIconOf(t, game.GameRoles[0]), roleIconOf(t, game.Modes[1].GameRoles[0]), roleIconOf(t, game.Modes[1].GameRoles[1])}
		if !slices.Equal(got, want) {
			t.Fatalf("%s: icons %v, want %v", name, got, want)
		}
	}
}

func roleIconOf(t *testing.T, role domain.GameRole) domain.RoleIcon {
	t.Helper()
	if role.RoleIcon == nil {
		t.Fatalf("role %q has no icon, want one", role.Name)
	}
	return *role.RoleIcon
}

// A role stored before migration 0011 has NULL and is read with a nil icon: not chosen yet (ADR 0024 section 1).
func TestRoleWithoutIconIsReadAsNotChosen(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)
	if _, err := store.db.Exec(`UPDATE game_roles SET role_icon = NULL`); err != nil {
		t.Fatal(err)
	}

	found, err := store.Games().Find(context.Background(), created.ID)

	if err != nil || found.GameRoles[0].RoleIcon != nil {
		t.Fatalf("game %+v, error %v; want a role without icon", found, err)
	}
}

// The CHECK of migration 0011 accepts exactly the domain list and NULL. lobby_role_slots has the same CHECK.
func TestDatabaseCheckListsExactlyTheDomainRoleIcons(t *testing.T) {
	store := migratedStore(t)
	createRaidGame(t, store) // an UPDATE of no rows would accept anything
	var accepted []domain.RoleIcon
	for _, value := range []string{"shield", "medical-cross", "dagger", "crosshair", "wrench", "star", "none", "sword", "Shield", ""} {
		if roleIconAccepted(t, store, value) {
			accepted = append(accepted, domain.RoleIcon(value))
		}
	}
	if !slices.Equal(accepted, domain.RoleIcons()) || !roleIconAccepted(t, store, nil) {
		t.Fatalf("database accepted %v, want %v and NULL", accepted, domain.RoleIcons())
	}

	var gameRoles, lobbyRoleSlots string
	err := store.db.QueryRow(`SELECT pg_get_constraintdef(a.oid), pg_get_constraintdef(b.oid) FROM pg_constraint a, pg_constraint b
		WHERE a.conname = 'game_roles_role_icon_check' AND b.conname = 'lobby_role_slots_role_icon_check'
		AND a.connamespace = current_schema()::regnamespace AND b.connamespace = current_schema()::regnamespace`).Scan(&gameRoles, &lobbyRoleSlots)
	if err != nil || gameRoles != lobbyRoleSlots {
		t.Fatalf("checks %q and %q, error %v; want the same check on both tables", gameRoles, lobbyRoleSlots, err)
	}
}

func roleIconAccepted(t *testing.T, store *Store, value any) bool {
	t.Helper()
	tx, err := store.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := tx.Rollback(); err != nil {
			t.Fatal(err)
		}
	}()
	_, err = tx.Exec(`UPDATE game_roles SET role_icon = $1`, value)
	return err == nil
}

func TestRoleIconsDownDropsTheColumns(t *testing.T) {
	store := migratedStore(t)
	columns := func() int {
		var count int
		if err := store.db.QueryRow(`SELECT count(*) FROM information_schema.columns
			WHERE table_schema = current_schema() AND column_name = 'role_icon'`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		return count
	}
	if columns() != 2 {
		t.Fatal("migration 0011 did not add role_icon to game_roles and lobby_role_slots")
	}

	migrateDownTo(t, store, 10)

	if columns() != 0 {
		t.Fatal("down of 0011 left a role_icon column")
	}
}
