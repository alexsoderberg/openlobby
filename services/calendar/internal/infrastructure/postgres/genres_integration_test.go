//go:build integration

package postgres

import (
	"context"
	"errors"
	"slices"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

// Every genre of the domain list is stored and read back; the CHECK of migration 0005 accepts exactly that list.
func TestEveryDomainGenreIsStoredAndRead(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	for _, genre := range domain.Genres() {
		created, err := store.Games().Create(ctx, domain.Game{Name: "Game " + string(genre), Genre: &genre})
		if err != nil {
			t.Fatalf("create with %q: %v", genre, err)
		}
		found, err := store.Games().Find(ctx, created.ID)
		if err != nil || found.Genre == nil || *found.Genre != genre {
			t.Fatalf("found %+v, error %v; want genre %q", found, err, genre)
		}
	}
}

func TestDatabaseCheckListsExactlyTheDomainGenres(t *testing.T) {
	store := migratedStore(t)
	var accepted []domain.Genre
	for _, value := range []string{"shooter", "moba", "racing", "strategy", "survival", "party", "rpg", "sports", "puzzle", "Shooter", ""} {
		tx, err := store.db.Begin()
		if err != nil {
			t.Fatal(err)
		}
		if _, err := tx.Exec(`INSERT INTO games (name, genre) VALUES ('probe', $1)`, value); err == nil {
			accepted = append(accepted, domain.Genre(value))
		}
		if err := tx.Rollback(); err != nil {
			t.Fatal(err)
		}
	}

	if !slices.Equal(accepted, domain.Genres()) {
		t.Fatalf("database accepted %v, want %v", accepted, domain.Genres())
	}
}

func TestReplaceWithoutGenreClearsItAndExistingGamesHaveNone(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	before, err := store.Games().Find(ctx, overwatchID)
	if err != nil || before.Genre != nil {
		t.Fatalf("game %+v, error %v; want a seeded game without genre", before, err)
	}
	racing := domain.Genre("racing")
	if _, err := store.Games().Replace(ctx, domain.Game{ID: overwatchID, Name: "Overwatch", Genre: &racing}); err != nil {
		t.Fatal(err)
	}

	if _, err := store.Games().Replace(ctx, domain.Game{ID: overwatchID, Name: "Overwatch"}); err != nil {
		t.Fatal(err)
	}

	after, err := store.Games().Find(ctx, overwatchID)
	if err != nil || after.Genre != nil {
		t.Fatalf("game %+v, error %v; want the genre cleared", after, err)
	}
}

// The lobby read model joins the genre from the game list at each read (ADR 0016).
func TestLobbyGameGenreFollowsTheGame(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	gameID := counterStrikeID
	byGame := insertLobby(t, store, newLobby(fridayID, alexID, &gameID, "Counter-Strike 2"))
	custom := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	genreOf := func(lobbyID string) *domain.Genre {
		t.Helper()
		lobby, _, err := store.Lobbies().Lobby(ctx, fridayID, lobbyID, alexID, joinedAt)
		if err != nil {
			t.Fatal(err)
		}
		return lobby.GameGenre
	}

	if genreOf(byGame.ID) != nil {
		t.Fatal("lobby of a game without genre has a genre")
	}
	shooter := domain.Genre("shooter")
	if _, err := store.Games().Replace(ctx, domain.Game{ID: counterStrikeID, Name: "Counter-Strike 2", Genre: &shooter}); err != nil {
		t.Fatal(err)
	}
	if got := genreOf(byGame.ID); got == nil || *got != shooter {
		t.Fatalf("genre %v after the game changed, want shooter", got)
	}
	upcoming, err := store.Lobbies().Upcoming(ctx, fridayID, alexID, joinedAt)
	if err != nil {
		t.Fatal(err)
	}
	for _, lobby := range upcoming {
		if (lobby.ID == byGame.ID) != (lobby.GameGenre != nil) {
			t.Fatalf("lobby %s has genre %v in the list", lobby.ID, lobby.GameGenre)
		}
	}
	if genreOf(custom.ID) != nil {
		t.Fatal("lobby with a custom name has a genre")
	}
	if err := store.Games().Delete(ctx, counterStrikeID); err != nil {
		t.Fatal(err)
	}
	if genreOf(byGame.ID) != nil {
		t.Fatal("lobby of a removed game has a genre")
	}
	if _, _, err := store.Lobbies().Lobby(ctx, fridayID, byGame.ID, alexID, joinedAt); errors.Is(err, domain.ErrLobbyNotFound) {
		t.Fatal("lobby of a removed game disappeared")
	}
}
