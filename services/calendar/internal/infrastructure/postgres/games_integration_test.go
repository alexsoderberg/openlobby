//go:build integration

package postgres

import (
	"context"
	"database/sql"
	"reflect"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// The starting games of ADR 0010, with their fixed IDs.
var startingGames = []domain.Game{
	{ID: "ce3ff9c1-dabb-4270-b5e0-7b34de37410b", Name: "Counter-Strike 2", DefaultMaxPlayers: intPtr(5), GameRoles: []domain.GameRole{}, Modes: []domain.GameMode{}},
	{ID: "21d79e45-fc60-49b3-aa95-b44fa46a75b5", Name: "League of Legends", DefaultMaxPlayers: intPtr(5), GameRoles: []domain.GameRole{}, Modes: []domain.GameMode{}},
	{ID: "7e9a4d35-1616-4f25-9828-fc6e2383b07b", Name: "Overwatch", DefaultMaxPlayers: intPtr(5), GameRoles: []domain.GameRole{}, Modes: []domain.GameMode{}},
	{ID: "bd8fae98-29a7-4b2c-8b49-384ee7a75ff7", Name: "World of Warcraft", DefaultMaxPlayers: intPtr(5), GameRoles: []domain.GameRole{}, Modes: []domain.GameMode{}},
}

func intPtr(value int) *int { return &value }

// usagesByID indexes the rows by game ID, because the adapter does not promise an order.
func usagesByID(usages []application.GameUsage) map[string]application.GameUsage {
	byID := make(map[string]application.GameUsage, len(usages))
	for _, usage := range usages {
		byID[usage.Game.ID] = usage
	}
	return byID
}

// The adapter returns every game with its name and default max. The lobby count is 0 until REQ-0003 (shortcut in games.go).
func TestListForGroupReturnsEveryStartingGameWithZeroCount(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)

	usages, err := store.Games().ListForGroup(context.Background(), fridayID)
	if err != nil {
		t.Fatal(err)
	}
	want := make(map[string]application.GameUsage, len(startingGames))
	for _, game := range startingGames {
		want[game.ID] = application.GameUsage{Game: game}
	}
	if got := usagesByID(usages); len(usages) != len(want) || !reflect.DeepEqual(got, want) {
		t.Fatalf("usages %+v, want %+v", usages, want)
	}
}

// A NULL default max is read as nil, and a name is returned as stored, with its case.
func TestListForGroupReadsNullMaxAsNil(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	if _, err := store.db.ExecContext(ctx, `INSERT INTO games (name, default_max_players) VALUES ('apex legends', NULL)`); err != nil {
		t.Fatal(err)
	}

	usages, err := store.Games().ListForGroup(ctx, fridayID)
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, usage := range usages {
		if usage.Game.Name == "apex legends" {
			found = usage.Game.DefaultMaxPlayers == nil
		}
	}
	if len(usages) != len(startingGames)+1 || !found {
		t.Fatalf("usages %+v, want apex legends with no default max", usages)
	}
}

// The check on the name is the safety net of ADR 0004 rule 1 and ADR 0010. The unique index on lower(name) gives one game
// per name, ignoring case.
func TestGameColumnChecksAndUniqueNameIgnoringCase(t *testing.T) {
	tests := []struct {
		name       string
		gameName   string
		maxPlayers *int
		accepted   bool
	}{
		{name: "trailing space is rejected", gameName: "Chess ", accepted: false},
		{name: "leading space is rejected", gameName: " Chess", accepted: false},
		{name: "trailing tab is rejected", gameName: "Chess\t", accepted: false},
		{name: "only spaces are rejected", gameName: "   ", accepted: false},
		{name: "inner space is accepted", gameName: "Counter Strike", accepted: true},
		{name: "empty name is rejected", gameName: "", accepted: false},
		{name: "fifty-one characters are rejected", gameName: strings.Repeat("x", 51), accepted: false},
		{name: "fifty characters are accepted", gameName: strings.Repeat("x", 50), accepted: true},
		{name: "max players 0 is rejected", gameName: "Chess", maxPlayers: intPtr(0), accepted: false},
		{name: "max players 1 is accepted", gameName: "Chess", maxPlayers: intPtr(1), accepted: true},
		{name: "name of a starting game in other case is rejected", gameName: "OVERWATCH", maxPlayers: intPtr(5), accepted: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := migratedStore(t)
			_, err := store.db.ExecContext(context.Background(),
				`INSERT INTO games (name, default_max_players) VALUES ($1, $2)`, tc.gameName, tc.maxPlayers)

			if (err == nil) != tc.accepted {
				t.Fatalf("insert error %v, accepted want %v", err, tc.accepted)
			}
		})
	}
}

// Down of migration 0003 removes the table and up restores the starting games (ADR 0012).
func TestGamesDownDropsTableAndUpRestoresStartingGames(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	migrateDownTo(t, store, 2)
	var table sql.NullString
	if err := store.db.QueryRowContext(ctx, `SELECT to_regclass('games')::text`).Scan(&table); err != nil {
		t.Fatal(err)
	}
	if table.Valid {
		t.Fatalf("games still exists after down: %s", table.String)
	}
	if err := store.Migrate(ctx, false); err != nil {
		t.Fatalf("migrate up again: %v", err)
	}
	usages, err := store.Games().ListForGroup(ctx, fridayID)
	if err != nil || len(usages) != len(startingGames) {
		t.Fatalf("usages %+v, error %v; want the %d starting games", usages, err, len(startingGames))
	}
}
