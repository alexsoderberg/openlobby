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

const (
	overwatchID = "7e9a4d35-1616-4f25-9828-fc6e2383b07b"
	missingGame = "66666666-6666-4666-8666-666666666666"
)

// List is sorted by name ignoring case, then ID (ADR 0010), so a lower-case name sorts among the others.
func TestListSortsByNameIgnoringCase(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	if _, err := store.db.ExecContext(ctx, `INSERT INTO games (name, default_max_players) VALUES ('apex legends', NULL)`); err != nil {
		t.Fatal(err)
	}

	games, err := store.Games().List(ctx)

	var names []string
	for _, game := range games {
		names = append(names, game.Name)
	}
	want := []string{"apex legends", "Counter-Strike 2", "League of Legends", "Overwatch", "World of Warcraft"}
	if err != nil || !reflect.DeepEqual(names, want) {
		t.Fatalf("names %v, error %v; want %v", names, err, want)
	}
}

// Create stores the game and the database generates its ID (ADR 0010, review 3).
func TestCreateStoresGameWithGeneratedID(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	created, err := store.Games().Create(ctx, domain.Game{Name: "Chess", DefaultMaxPlayers: intPtr(2)})

	if err != nil || created.ID == "" || created.Name != "Chess" || *created.DefaultMaxPlayers != 2 {
		t.Fatalf("created %+v, error %v; want a generated ID", created, err)
	}
	games, err := store.Games().List(ctx)
	if err != nil || len(games) != len(startingGames)+1 {
		t.Fatalf("list %+v, error %v; want the new game in the list", games, err)
	}
}

func TestCreateWithoutDefaultMaxStoresNull(t *testing.T) {
	store := migratedStore(t)

	created, err := store.Games().Create(context.Background(), domain.Game{Name: "Chess"})

	if err != nil || created.DefaultMaxPlayers != nil {
		t.Fatalf("created %+v, error %v; want no default max", created, err)
	}
}

// The unique index on lower(name) gives the duplicate error, whatever the case (ADR 0010).
func TestCreateRejectsNameTakenIgnoringCase(t *testing.T) {
	store := migratedStore(t)

	_, err := store.Games().Create(context.Background(), domain.Game{Name: "OVERWATCH", DefaultMaxPlayers: intPtr(5)})

	if !errors.Is(err, application.ErrGameTaken) {
		t.Fatalf("error %v, want ErrGameTaken", err)
	}
}

// Replace keeps the ID, and a game may keep its own name in another case (ADR 0010).
func TestReplaceKeepsIDAndAllowsOwnNameInOtherCase(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	_, err := store.Games().Replace(ctx, domain.Game{ID: overwatchID, Name: "OVERWATCH"})

	games, listErr := store.Games().List(ctx)
	if err != nil || listErr != nil {
		t.Fatalf("replace error %v, list error %v", err, listErr)
	}
	for _, game := range games {
		if game.ID == overwatchID && (game.Name != "OVERWATCH" || game.DefaultMaxPlayers != nil) {
			t.Fatalf("game %+v, want the new name and no default max", game)
		}
	}
}

func TestReplaceRejectsUnknownGame(t *testing.T) {
	store := migratedStore(t)

	_, err := store.Games().Replace(context.Background(), domain.Game{ID: missingGame, Name: "Chess"})

	if !errors.Is(err, application.ErrGameNotFound) {
		t.Fatalf("error %v, want ErrGameNotFound", err)
	}
}

func TestReplaceRejectsNameOfAnotherGame(t *testing.T) {
	store := migratedStore(t)

	_, err := store.Games().Replace(context.Background(), domain.Game{ID: overwatchID, Name: "league of legends"})

	if !errors.Is(err, application.ErrGameTaken) {
		t.Fatalf("error %v, want ErrGameTaken", err)
	}
}

func TestDeleteRemovesGame(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	err := store.Games().Delete(ctx, overwatchID)

	games, listErr := store.Games().List(ctx)
	if err != nil || listErr != nil || len(games) != len(startingGames)-1 {
		t.Fatalf("delete error %v, list error %v, games %+v; want one game fewer", err, listErr, games)
	}
}

func TestDeleteRejectsUnknownGame(t *testing.T) {
	store := migratedStore(t)

	err := store.Games().Delete(context.Background(), missingGame)

	if !errors.Is(err, application.ErrGameNotFound) {
		t.Fatalf("error %v, want ErrGameNotFound", err)
	}
}

// A malformed ID names no game, so Replace and Delete give ErrGameNotFound, not a database error (ADR 0010).
func TestReplaceAndDeleteMapMalformedIDToNotFound(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	_, replaceErr := store.Games().Replace(ctx, domain.Game{ID: "not-a-uuid", Name: "Chess"})
	deleteErr := store.Games().Delete(ctx, "not-a-uuid")

	if !errors.Is(replaceErr, application.ErrGameNotFound) || !errors.Is(deleteErr, application.ErrGameNotFound) {
		t.Fatalf("replace error %v, delete error %v; want ErrGameNotFound for both", replaceErr, deleteErr)
	}
}
