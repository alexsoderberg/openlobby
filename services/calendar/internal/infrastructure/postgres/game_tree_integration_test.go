//go:build integration

package postgres

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// raidGame is a game with game roles of its own and two modes: one with a max and one with game roles and activities.
func raidGame() domain.Game {
	return domain.Game{
		Name:      "Raid Game",
		GameRoles: []domain.GameRole{{Name: "Scout", Slots: 1}},
		Modes: []domain.GameMode{
			{Name: "Ranked", MaxPlayers: intPtr(5)},
			{
				Name: "Raid", MaxPlayers: intPtr(5),
				GameRoles:  []domain.GameRole{{Name: "Tank", Slots: 1}, {Name: "Healer", Slots: 4}},
				Activities: []domain.Activity{{Name: "Castle"}, {Name: "Vault"}},
			},
		},
	}
}

func createRaidGame(t *testing.T, store *Store) domain.Game {
	t.Helper()
	created, err := store.Games().Create(context.Background(), raidGame())
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return created
}

func names[T any](list []T, name func(T) string) []string {
	result := make([]string, 0, len(list))
	for _, entry := range list {
		result = append(result, name(entry))
	}
	return result
}

func roleName(role domain.GameRole) string { return role.Name }
func modeName(mode domain.GameMode) string { return mode.Name }

func TestCreateStoresTheTreeInOrderWithGeneratedIDs(t *testing.T) {
	store := migratedStore(t)

	created := createRaidGame(t, store)

	raid := created.Modes[1]
	if created.ID == "" || raid.ID == "" || raid.GameRoles[0].ID == "" || raid.Activities[0].ID == "" || created.GameRoles[0].ID == "" {
		t.Fatalf("missing generated IDs in %+v", created)
	}
	if !reflect.DeepEqual(names(created.Modes, modeName), []string{"Ranked", "Raid"}) ||
		!reflect.DeepEqual(names(raid.GameRoles, roleName), []string{"Tank", "Healer"}) ||
		!reflect.DeepEqual(names(raid.Activities, func(a domain.Activity) string { return a.Name }), []string{"Castle", "Vault"}) {
		t.Fatalf("order not kept: %+v", created)
	}
}

func TestListAndListForGroupReturnTheTree(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)

	games, err := store.Games().List(context.Background())
	usages, usageErr := store.Games().ListForGroup(context.Background(), fridayID)

	var listed, grouped domain.Game
	for _, game := range games {
		if game.ID == created.ID {
			listed = game
		} else if game.GameRoles == nil || game.Modes == nil {
			t.Fatalf("game %q has a nil list, which would read as unchanged", game.Name)
		}
	}
	grouped = usagesByID(usages)[created.ID].Game
	if err != nil || usageErr != nil || !reflect.DeepEqual(listed, created) || !reflect.DeepEqual(grouped, created) {
		t.Fatalf("list %+v (%v), group %+v (%v); want %+v", listed, err, grouped, usageErr, created)
	}
}

// A swap of two names in one request never meets the unique index half way (ADR 0017 section 6).
func TestReplaceSwapsNamesInOneRequest(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)
	swapped := created
	swapped.GameRoles = created.GameRoles
	swapped.Modes = []domain.GameMode{created.Modes[0], created.Modes[1]}
	swapped.Modes[0].Name, swapped.Modes[1].Name = "Raid", "Ranked"
	raid := swapped.Modes[1]
	raid.GameRoles = []domain.GameRole{{ID: raid.GameRoles[0].ID, Name: "Healer", Slots: 1}, {ID: raid.GameRoles[1].ID, Name: "Tank", Slots: 4}}
	raid.Activities = []domain.Activity{{ID: raid.Activities[0].ID, Name: "Vault"}, {ID: raid.Activities[1].ID, Name: "Castle"}}
	swapped.Modes[1] = raid

	stored, err := store.Games().Replace(context.Background(), swapped)

	if err != nil {
		t.Fatalf("swap: %v", err)
	}
	if stored.Modes[0].ID != created.Modes[0].ID || stored.Modes[0].Name != "Raid" || stored.Modes[1].Name != "Ranked" {
		t.Fatalf("modes %+v; want the same IDs with swapped names", stored.Modes)
	}
	got := stored.Modes[1]
	if got.GameRoles[0].ID != raid.GameRoles[0].ID || got.GameRoles[0].Name != "Healer" || got.Activities[1].Name != "Castle" || got.Activities[1].ID != raid.Activities[1].ID {
		t.Fatalf("roles and activities %+v; want the same IDs with swapped names", got)
	}
}

func TestReplaceWithOmittedListsKeepsThem(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)

	stored, err := store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: "Renamed", DefaultMaxPlayers: created.DefaultMaxPlayers})

	if err != nil || stored.Name != "Renamed" || !reflect.DeepEqual(stored.Modes, created.Modes) || !reflect.DeepEqual(stored.GameRoles, created.GameRoles) {
		t.Fatalf("stored %+v, error %v; want the modes and roles of %+v", stored, err, created)
	}
}

func TestReplaceWithEmptyListsRemovesThem(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)

	stored, err := store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: created.Name, Modes: []domain.GameMode{}})
	if err != nil || len(stored.Modes) != 0 || len(stored.GameRoles) != 1 {
		t.Fatalf("stored %+v, error %v; want no modes and the game role kept", stored, err)
	}
	stored, err = store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: created.Name, GameRoles: []domain.GameRole{}})
	if err != nil || len(stored.GameRoles) != 0 || stored.Modes == nil || stored.GameRoles == nil {
		t.Fatalf("stored %+v, error %v; want no roles and empty, not nil, lists", stored, err)
	}
	var left int
	if err := store.db.QueryRowContext(context.Background(), `SELECT (SELECT count(*) FROM game_modes) + (SELECT count(*) FROM game_roles) + (SELECT count(*) FROM activities)`).Scan(&left); err != nil || left != 0 {
		t.Fatalf("%d rows left, error %v; want the cascade to remove the roles and activities of the modes", left, err)
	}
}

func TestReplaceRefusesRepeatedAndForeignIDs(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)
	other, err := store.Games().Create(context.Background(), raidGame2())
	if err != nil {
		t.Fatal(err)
	}
	ranked, raid := created.Modes[0], created.Modes[1]
	tests := []struct {
		name  string
		modes []domain.GameMode
		roles []domain.GameRole
	}{
		{name: "duplicate mode ID", modes: []domain.GameMode{{ID: ranked.ID, Name: "A", MaxPlayers: intPtr(1)}, {ID: ranked.ID, Name: "B", MaxPlayers: intPtr(1)}}},
		{name: "mode of another game", modes: []domain.GameMode{{ID: other.Modes[0].ID, Name: "A", MaxPlayers: intPtr(1)}}},
		{name: "unknown mode ID", modes: []domain.GameMode{{ID: missingGame, Name: "A", MaxPlayers: intPtr(1)}}},
		{name: "role of another game", roles: []domain.GameRole{{ID: other.GameRoles[0].ID, Name: "A", Slots: 1}}},
		{name: "role of a mode on the game", roles: []domain.GameRole{{ID: raid.GameRoles[0].ID, Name: "A", Slots: 1}}},
		{name: "role of another mode", modes: []domain.GameMode{{ID: ranked.ID, Name: "A", GameRoles: []domain.GameRole{{ID: raid.GameRoles[0].ID, Name: "A", Slots: 1}}}}},
		{name: "role of another game's mode", modes: []domain.GameMode{{ID: raid.ID, Name: "A", GameRoles: []domain.GameRole{{ID: other.Modes[0].GameRoles[0].ID, Name: "A", Slots: 1}}}}},
		{name: "activity of another mode", modes: []domain.GameMode{{ID: ranked.ID, Name: "A", MaxPlayers: intPtr(1), Activities: []domain.Activity{{ID: raid.Activities[0].ID, Name: "A"}}}}},
		{name: "duplicate role ID", roles: []domain.GameRole{{ID: created.GameRoles[0].ID, Name: "A", Slots: 1}, {ID: created.GameRoles[0].ID, Name: "B", Slots: 1}}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: created.Name, Modes: tc.modes, GameRoles: tc.roles})

			if !errors.Is(err, domain.ErrInvalidID) {
				t.Fatalf("error %v, want ErrInvalidID", err)
			}
			again, err := store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: created.Name})
			if err != nil || !reflect.DeepEqual(again.Modes, created.Modes) {
				t.Fatalf("refused write changed the game: %+v, %v", again, err)
			}
		})
	}
}

func raidGame2() domain.Game {
	return domain.Game{
		Name:      "Other Raid Game",
		GameRoles: []domain.GameRole{{Name: "Scout", Slots: 1}},
		Modes:     []domain.GameMode{{Name: "Raid", MaxPlayers: intPtr(3), GameRoles: []domain.GameRole{{Name: "Tank", Slots: 3}}}},
	}
}

func TestCreateRefusesGivenIDs(t *testing.T) {
	store := migratedStore(t)

	_, err := store.Games().Create(context.Background(), domain.Game{Name: "Chess", GameRoles: []domain.GameRole{{ID: missingGame, Name: "A", Slots: 1}}})

	if !errors.Is(err, domain.ErrInvalidID) {
		t.Fatalf("error %v, want ErrInvalidID", err)
	}
}

// A game without modes and with game roles stores the sum as its default max; a rename that sends the old sum keeps it
// and any other value is refused (ADR 0017 section 6).
func TestRenameOfGameWithRolesKeepsTheSum(t *testing.T) {
	store := migratedStore(t)
	roles := []domain.GameRole{{Name: "Tank", Slots: 2}, {Name: "Healer", Slots: 3}}
	created, err := store.Games().Create(context.Background(), domain.Game{Name: "Squad", GameRoles: roles})
	if err != nil || created.DefaultMaxPlayers == nil || *created.DefaultMaxPlayers != 5 {
		t.Fatalf("created %+v, error %v; want the sum 5 as default max", created, err)
	}

	renamed, err := store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: "Squad 2", DefaultMaxPlayers: intPtr(5)})
	if err != nil || renamed.Name != "Squad 2" || *renamed.DefaultMaxPlayers != 5 || len(renamed.GameRoles) != 2 {
		t.Fatalf("renamed %+v, error %v", renamed, err)
	}
	_, err = store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: "Squad 3", DefaultMaxPlayers: intPtr(6)})
	if !errors.Is(err, domain.ErrInvalidCapacity) {
		t.Fatalf("error %v, want ErrInvalidCapacity", err)
	}
	cleared, err := store.Games().Replace(context.Background(), domain.Game{ID: created.ID, Name: "Squad 2"})
	if err != nil || *cleared.DefaultMaxPlayers != 5 {
		t.Fatalf("cleared %+v, error %v; want the sum when the value is omitted", cleared, err)
	}
}

// Each unique index gives its own error (ADR 0017 section 5).
func TestUniqueViolationsAreTranslatedByConstraintName(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)
	ranked, raid := created.Modes[0], created.Modes[1]
	tests := []struct {
		name string
		game domain.Game
		want error
	}{
		{name: "game name", game: domain.Game{ID: created.ID, Name: "overwatch"}, want: application.ErrGameTaken},
		{name: "mode name ignoring case", game: domain.Game{ID: created.ID, Name: created.Name, Modes: []domain.GameMode{{Name: "Raid", MaxPlayers: intPtr(1)}, {Name: "RAID", MaxPlayers: intPtr(1)}}}, want: application.ErrModeTaken},
		{name: "game role name on the game", game: domain.Game{ID: created.ID, Name: created.Name, GameRoles: []domain.GameRole{{Name: "Tank", Slots: 1}, {Name: "tank", Slots: 1}}}, want: application.ErrGameRoleTaken},
		{name: "game role name on a mode", game: domain.Game{ID: created.ID, Name: created.Name, Modes: []domain.GameMode{{ID: raid.ID, Name: "Raid", MaxPlayers: intPtr(2), GameRoles: []domain.GameRole{{Name: "Tank", Slots: 1}, {Name: "TANK", Slots: 1}}}}}, want: application.ErrGameRoleTaken},
		{name: "activity name", game: domain.Game{ID: created.ID, Name: created.Name, Modes: []domain.GameMode{{ID: ranked.ID, Name: "Ranked", MaxPlayers: intPtr(5), Activities: []domain.Activity{{Name: "Castle"}, {Name: "castle"}}}}}, want: application.ErrActivityTaken},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := store.Games().Replace(context.Background(), tc.game)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
}

// The same role name is fine on two owners, and the same mode name in two games (ADR 0017 section 2).
func TestSameNamesOnDifferentOwnersAreAllowed(t *testing.T) {
	store := migratedStore(t)
	createRaidGame(t, store)

	_, err := store.Games().Create(context.Background(), raidGame2())

	if err != nil {
		t.Fatalf("second game with the same mode and role names: %v", err)
	}
}

func TestReplaceUnknownGameWithTreeIsNotFound(t *testing.T) {
	store := migratedStore(t)

	_, err := store.Games().Replace(context.Background(), domain.Game{ID: missingGame, Name: "Chess", Modes: []domain.GameMode{{Name: "A", MaxPlayers: intPtr(1)}}})

	if !errors.Is(err, application.ErrGameNotFound) {
		t.Fatalf("error %v, want ErrGameNotFound", err)
	}
}

// The default max rule comes before game_not_found, and game_not_found before the identity check (ADR 0017 section 6).
func TestReplaceUnknownGameAnswersInTheOrderOfTheADR(t *testing.T) {
	store := migratedStore(t)
	mismatch := domain.Game{ID: missingGame, Name: "Chess", DefaultMaxPlayers: intPtr(9), GameRoles: []domain.GameRole{{Name: "Tank", Slots: 2}}}
	repeated := domain.Game{ID: missingGame, Name: "Chess", Modes: []domain.GameMode{{ID: missingGame, Name: "A", MaxPlayers: intPtr(1)}, {ID: missingGame, Name: "B", MaxPlayers: intPtr(1)}}}

	_, capacityErr := store.Games().Replace(context.Background(), mismatch)
	_, notFoundErr := store.Games().Replace(context.Background(), repeated)

	if !errors.Is(capacityErr, domain.ErrInvalidCapacity) || !errors.Is(notFoundErr, application.ErrGameNotFound) {
		t.Fatalf("errors %v and %v; want ErrInvalidCapacity and ErrGameNotFound", capacityErr, notFoundErr)
	}
}

func TestFindLoadsTheTree(t *testing.T) {
	store := migratedStore(t)
	created := createRaidGame(t, store)

	found, err := store.Games().Find(context.Background(), created.ID)

	if err != nil || !reflect.DeepEqual(found, created) {
		t.Fatalf("found %+v, error %v; want %+v", found, err, created)
	}
	plain, err := store.Games().Find(context.Background(), startingGames[0].ID)
	if err != nil || plain.GameRoles == nil || plain.Modes == nil {
		t.Fatalf("plain game %+v, error %v; want empty, not nil, lists", plain, err)
	}
}
