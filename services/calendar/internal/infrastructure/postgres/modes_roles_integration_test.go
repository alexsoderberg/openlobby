//go:build integration

package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

const (
	gameID        = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	modeID        = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	roleID        = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
	activityID    = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
	lobbyID       = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
	otherGame     = "ffffffff-ffff-4fff-8fff-ffffffffffff"
	newRoleID     = "99999999-9999-4999-8999-999999999999"
	missingRoleID = "88888888-8888-4888-8888-888888888888"
)

// execAll runs the statements in order and returns the first error.
func execAll(ctx context.Context, store *Store, statements ...string) error {
	for _, statement := range statements {
		if _, err := store.db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

// seedModes adds two games, a mode and an activity of the first, and an empty lobby in the Friday group.
func seedModes(t *testing.T, store *Store) {
	t.Helper()
	if err := execAll(context.Background(), store,
		`INSERT INTO games (id, name) VALUES ('`+gameID+`', 'Game A'), ('`+otherGame+`', 'Game B')`,
		`INSERT INTO game_modes (id, game_id, name, max_players, sort_order) VALUES ('`+modeID+`', '`+gameID+`', 'Raid', 10, 0)`,
		`INSERT INTO activities (id, game_mode_id, name, sort_order) VALUES ('`+activityID+`', '`+modeID+`', 'Castle', 0)`,
		`INSERT INTO lobbies (id, group_id, created_by_user_id, game_name, starts_at, ends_at, created_at)
			VALUES ('`+lobbyID+`', '`+fridayID+`', '`+alexID+`', 'Game A', now() + interval '1 hour', now() + interval '2 hours', now())`,
	); err != nil {
		t.Fatalf("seed: %v", err)
	}
}

// The database alone accepts or rejects each row (ADR 0017 section 1). A rejected case names the SQLSTATE and the
// constraint, because PR2 translates violations by constraint name; a NOT NULL violation has no constraint name.
func TestModesRolesConstraints(t *testing.T) {
	const (
		checkViolation  = "23514/"
		uniqueViolation = "23505/"
		foreignKey      = "23503/"
		notNull         = "23502/"
	)
	text := func(value string) string { return "'" + value + "'" }
	// lobby builds an insert from game_id, game_name, game_mode_id, mode_name, activity_id and activity_name.
	lobby := func(values string) string {
		return fmt.Sprintf(`INSERT INTO lobbies (group_id, created_by_user_id, game_id, game_name, game_mode_id, mode_name,
			activity_id, activity_name, starts_at, ends_at, created_at)
			VALUES ('%s', '%s', %s, now() + interval '1 hour', now() + interval '2 hours', now())`, fridayID, alexID, values)
	}
	// lobbyWith fills game, mode and activity so that only the two names under test vary.
	lobbyWith := func(modeName, activityName string) string {
		return lobby(text(gameID) + `, 'Game A', ` + text(modeID) + `, ` + modeName + `, ` + text(activityID) + `, ` + activityName)
	}
	mode := func(game, name, maxPlayers string) string {
		return `INSERT INTO game_modes (game_id, name, max_players, sort_order) VALUES (` + game + `, ` + text(name) + `, ` + maxPlayers + `, 1)`
	}
	role := func(mode, name, slots string) string {
		return `INSERT INTO game_roles (game_id, game_mode_id, name, slots, sort_order) VALUES ('` + gameID + `', ` + mode + `, ` + text(name) + `, ` + slots + `, 0)`
	}
	activity := func(mode, name string) string {
		return `INSERT INTO activities (game_mode_id, name, sort_order) VALUES (` + mode + `, ` + text(name) + `, 1)`
	}
	slot := func(name, slots, roleID string) string {
		return `INSERT INTO lobby_role_slots (lobby_id, game_role_id, name, slots, sort_order) VALUES ('` + lobbyID + `', '` + roleID + `', ` + text(name) + `, ` + slots + `, 0)`
	}
	game, modeRef := text(gameID), text(modeID)
	long30, long31 := strings.Repeat("x", 30), strings.Repeat("x", 31)
	long50, long51 := strings.Repeat("x", 50), strings.Repeat("x", 51)
	tests := []struct {
		name   string
		sql    string
		reject string // empty means accepted; otherwise "SQLSTATE/constraint"
	}{
		{"mode accepted", mode(game, "Dungeon", "5"), ""},
		{"mode max players 2147483647 accepted", mode(game, "Dungeon", "2147483647"), ""},
		{"mode with max 0 rejected", mode(game, "Dungeon", "0"), checkViolation + "game_modes_max_players_check"},
		{"mode name padded rejected", mode(game, " Dungeon", "5"), checkViolation + "game_modes_name_check"},
		{"mode name empty rejected", mode(game, "", "5"), checkViolation + "game_modes_name_check"},
		{"mode name of 50 accepted", mode(game, long50, "5"), ""},
		{"mode name of 51 rejected", mode(game, long51, "5"), checkViolation + "game_modes_name_check"},
		{"mode without game rejected", mode("NULL", "Dungeon", "5"), notNull},
		{"mode with unknown game rejected", mode(text(lobbyID), "Dungeon", "5"), foreignKey + "game_modes_game_id_fkey"},
		{"duplicate mode name ignoring case rejected", mode(game, "RAID", "5"), uniqueViolation + "game_modes_game_name_key"},
		{"same mode name on another game accepted", mode(text(otherGame), "Raid", "5"), ""},

		{"game role on a game accepted", role("NULL", "Tank", "1"), ""},
		{"game role on a mode accepted", role(modeRef, "Tank", "2"), ""},
		{"game role with 0 slots rejected", role("NULL", "Tank", "0"), checkViolation + "game_roles_slots_check"},
		{"game role name of 30 accepted", role("NULL", long30, "1"), ""},
		{"game role name of 31 rejected", role("NULL", long31, "1"), checkViolation + "game_roles_name_check"},
		{"game role name padded rejected", role("NULL", "Tank ", "1"), checkViolation + "game_roles_name_check"},
		{"game role of a mode of another game rejected",
			`INSERT INTO game_roles (game_id, game_mode_id, name, slots, sort_order) VALUES ('` + otherGame + `', '` + modeID + `', 'Tank', 1, 0)`,
			foreignKey + "game_roles_mode_game_fkey"},
		{"duplicate game role name on the game rejected", role("NULL", "Tank", "1") + `; ` + role("NULL", "tank", "1"), uniqueViolation + "game_roles_game_name_key"},
		{"duplicate game role name on the mode rejected", role(modeRef, "Tank", "1") + `; ` + role(modeRef, "tank", "1"), uniqueViolation + "game_roles_mode_name_key"},
		{"same game role name on the game and on its mode accepted", role("NULL", "Tank", "1") + `; ` + role(modeRef, "Tank", "1"), ""},

		{"activity accepted", activity(modeRef, "Keep"), ""},
		{"activity name of 50 accepted", activity(modeRef, long50), ""},
		{"activity name of 51 rejected", activity(modeRef, long51), checkViolation + "activities_name_check"},
		{"activity name padded rejected", activity(modeRef, "Keep "), checkViolation + "activities_name_check"},
		{"activity without mode rejected", activity("NULL", "Keep"), notNull},
		{"duplicate activity name ignoring case rejected", activity(modeRef, "CASTLE"), uniqueViolation + "activities_mode_name_key"},

		{"lobby role slot accepted", slot("Tank", "1", newRoleID), ""},
		{"lobby role slot name of 30 accepted", slot(long30, "1", newRoleID), ""},
		{"lobby role slot name of 31 rejected", slot(long31, "1", newRoleID), checkViolation + "lobby_role_slots_name_check"},
		{"lobby role slot name padded rejected", slot(" Tank", "1", newRoleID), checkViolation + "lobby_role_slots_name_check"},
		{"lobby role slot name empty rejected", slot("", "1", newRoleID), checkViolation + "lobby_role_slots_name_check"},
		{"lobby role slot with 0 slots rejected", slot("Tank", "0", newRoleID), checkViolation + "lobby_role_slots_slots_check"},
		{"two game roles in one lobby accepted", slot("Tank", "1", newRoleID) + `; ` + slot("Healer", "1", missingRoleID), ""},
		{"duplicate lobby role slot rejected", slot("Tank", "1", newRoleID) + `; ` + slot("Healer", "1", newRoleID), uniqueViolation + "lobby_role_slots_pkey"},
		{"lobby role slot of unknown lobby rejected",
			`INSERT INTO lobby_role_slots (lobby_id, game_role_id, name, slots, sort_order) VALUES ('` + otherGame + `', '` + newRoleID + `', 'Tank', 1, 0)`,
			foreignKey + "lobby_role_slots_lobby_id_fkey"},

		{"lobby without game accepted", lobby(`NULL, NULL, NULL, NULL, NULL, NULL`), ""},
		{"lobby with game, mode and activity accepted", lobbyWith(text("Raid"), text("Castle")), ""},
		{"lobby with game_id but no game_name rejected", lobby(game + `, NULL, NULL, NULL, NULL, NULL`), checkViolation + "lobbies_game_id_needs_name_check"},
		{"lobby with padded game_name rejected", lobby(`NULL, 'Game A ', NULL, NULL, NULL, NULL`), checkViolation + "lobbies_game_name_check"},
		{"lobby with mode but no game rejected", lobby(`NULL, 'Other', ` + modeRef + `, 'Raid', NULL, NULL`), checkViolation + "lobbies_mode_needs_game_check"},
		{"lobby with mode_name but no mode rejected", lobby(game + `, 'Game A', NULL, 'Raid', NULL, NULL`), checkViolation + "lobbies_mode_name_pair_check"},
		{"lobby with mode but no mode_name rejected", lobby(game + `, 'Game A', ` + modeRef + `, NULL, NULL, NULL`), checkViolation + "lobbies_mode_name_pair_check"},
		{"lobby with padded mode_name rejected", lobbyWith(text("Raid "), text("Castle")), checkViolation + "lobbies_mode_name_check"},
		{"lobby with mode_name of 50 accepted", lobbyWith(text(long50), text("Castle")), ""},
		{"lobby with mode_name of 51 rejected", lobbyWith(text(long51), text("Castle")), checkViolation + "lobbies_mode_name_check"},
		{"lobby with activity but no mode rejected", lobby(game + `, 'Game A', NULL, NULL, ` + text(activityID) + `, 'Castle'`), checkViolation + "lobbies_activity_needs_mode_check"},
		{"lobby with activity but no activity_name rejected", lobbyWith(text("Raid"), "NULL"), checkViolation + "lobbies_activity_name_pair_check"},
		{"lobby with padded activity_name rejected", lobbyWith(text("Raid"), text("Castle ")), checkViolation + "lobbies_activity_name_check"},
		{"lobby with activity_name of 50 accepted", lobbyWith(text("Raid"), text(long50)), ""},
		{"lobby with activity_name of 51 rejected", lobbyWith(text("Raid"), text(long51)), checkViolation + "lobbies_activity_name_check"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := migratedStore(t)
			seedGroups(t, store)
			seedModes(t, store)
			// A statement without arguments runs as one simple query, so the ';' cases are all-or-nothing.
			err := execAll(context.Background(), store, tc.sql)
			var pgErr *pgconn.PgError
			switch {
			case tc.reject == "" && err != nil:
				t.Fatalf("rejected: %v", err)
			case tc.reject != "" && !errors.As(err, &pgErr):
				t.Fatalf("error %v, want %s", err, tc.reject)
			case tc.reject != "" && pgErr.Code+"/"+pgErr.ConstraintName != tc.reject:
				t.Fatalf("error %s/%s, want %s", pgErr.Code, pgErr.ConstraintName, tc.reject)
			}
		})
	}
}

// Deleting a lobby's role slot makes the player flex and keeps the player (the rule "every player becomes flex").
func TestDeletingRoleSlotMakesPlayerFlex(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	seedGroups(t, store)
	seedModes(t, store)
	if err := execAll(ctx, store,
		`INSERT INTO lobby_role_slots (lobby_id, game_role_id, name, slots, sort_order) VALUES ('`+lobbyID+`', '`+roleID+`', 'Tank', 1, 0)`,
		`INSERT INTO lobby_players (lobby_id, user_id, joined_at, game_role_id) VALUES ('`+lobbyID+`', '`+alexID+`', now(), '`+roleID+`')`,
	); err != nil {
		t.Fatal(err)
	}
	if err := execAll(ctx, store, `INSERT INTO lobby_players (lobby_id, user_id, joined_at, game_role_id)
		VALUES ('`+lobbyID+`', '`+otherID+`', now(), '`+missingRoleID+`')`); err == nil {
		t.Fatal("player with a game role that has no slot in the lobby was accepted")
	}

	if err := execAll(ctx, store, `DELETE FROM lobby_role_slots WHERE lobby_id = '`+lobbyID+`'`); err != nil {
		t.Fatal(err)
	}
	var players, flex int
	if err := store.db.QueryRowContext(ctx,
		`SELECT count(*), count(*) FILTER (WHERE game_role_id IS NULL) FROM lobby_players WHERE lobby_id = $1`, lobbyID).Scan(&players, &flex); err != nil {
		t.Fatal(err)
	}
	if players != 1 || flex != 1 {
		t.Fatalf("players %d, flex %d, want 1 and 1", players, flex)
	}
}

// Down and up repeat on an empty schema, and the down of 0007 fails loudly while a lobby without a game exists.
func TestLobbyModesRolesDown(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	migrateDownTo(t, store, 5)
	if err := store.Migrate(ctx, false); err != nil {
		t.Fatalf("up again: %v", err)
	}
	seedGroups(t, store)
	if err := execAll(ctx, store, `INSERT INTO lobbies (group_id, created_by_user_id, game_name, starts_at, ends_at, created_at)
		VALUES ('`+fridayID+`', '`+alexID+`', NULL, now() + interval '1 hour', now() + interval '2 hours', now())`); err != nil {
		t.Fatal(err)
	}
	migrateDownTo(t, store, 7)
	if err := store.Migrate(ctx, true); err == nil {
		t.Fatal("down of 0007 succeeded with a lobby without a game")
	}
	if err := execAll(ctx, store, `DELETE FROM lobbies WHERE game_name IS NULL`); err != nil {
		t.Fatal(err)
	}
	migrateDownTo(t, store, 5)
}
