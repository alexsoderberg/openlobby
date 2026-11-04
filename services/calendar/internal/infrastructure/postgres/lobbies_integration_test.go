//go:build integration

package postgres

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const counterStrikeID = "ce3ff9c1-dabb-4270-b5e0-7b34de37410b"

func newLobby(groupID, creatorID string, gameID *string, gameName string) domain.Lobby {
	return domain.Lobby{
		GroupID: groupID, CreatedByUserID: creatorID, GameID: gameID, GameName: gameName,
		StartsAt: joinedAt.Add(time.Hour), EndsAt: joinedAt.Add(3 * time.Hour), CreatedAt: joinedAt, PlayerCount: 1,
	}
}

// insertLobby saves a lobby through the port, as the use case does.
func insertLobby(t *testing.T, store *Store, lobby domain.Lobby) domain.Lobby {
	t.Helper()
	ctx := context.Background()
	err := store.Lobbies().WithLockedGroup(ctx, lobby.GroupID, func(tx application.LobbyTx) (err error) {
		lobby, err = tx.InsertLobby(ctx, lobby)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	return lobby
}

func count(t *testing.T, store *Store, query string, args ...any) int {
	t.Helper()
	var n int
	if err := store.db.QueryRowContext(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestInsertLobbyStoresLobbyAndCreatorAsFirstPlayer(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	maxPlayers := 4
	request := newLobby(fridayID, alexID, nil, "Go")
	request.MaxPlayers = &maxPlayers

	lobby := insertLobby(t, store, request)

	if lobby.ID == "" {
		t.Fatal("lobby has no ID")
	}
	var gameName string
	var gotMax *int
	var startsAt, endsAt time.Time
	err := store.db.QueryRow(`SELECT game_name, max_players, starts_at, ends_at FROM lobbies
		WHERE id = $1 AND group_id = $2 AND created_by_user_id = $3 AND game_id IS NULL`,
		lobby.ID, fridayID, alexID).Scan(&gameName, &gotMax, &startsAt, &endsAt)
	if err != nil {
		t.Fatal(err)
	}
	if gameName != "Go" || gotMax == nil || *gotMax != 4 || !startsAt.Equal(request.StartsAt) || !endsAt.Equal(request.EndsAt) {
		t.Fatalf("stored %q %v %v %v, want Go, 4 and the requested moments", gameName, gotMax, startsAt, endsAt)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND user_id = $2 AND joined_at = $3`, lobby.ID, alexID, joinedAt); n != 1 {
		t.Fatalf("%d creator player rows, want 1", n)
	}
}

// The lobby and the player row are one transaction: a failure after the insert leaves nothing behind.
func TestLobbyWriteIsRolledBackWhenTheFunctionFails(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	boom := errors.New("boom")
	ctx := context.Background()

	err := store.Lobbies().WithLockedGroup(ctx, fridayID, func(tx application.LobbyTx) error {
		if _, err := tx.InsertLobby(ctx, newLobby(fridayID, alexID, nil, "Go")); err != nil {
			return err
		}
		return boom
	})

	if !errors.Is(err, boom) {
		t.Fatalf("error %v, want boom", err)
	}
	if n := count(t, store, `SELECT (SELECT count(*) FROM lobbies) + (SELECT count(*) FROM lobby_players)`); n != 0 {
		t.Fatalf("%d rows after a rolled back write, want 0", n)
	}
}

func TestLobbyWriteOnMissingGroupIsGroupNotFound(t *testing.T) {
	store := migratedStore(t)

	err := store.Lobbies().WithLockedGroup(context.Background(), fridayID, func(application.LobbyTx) error { return nil })

	if !errors.Is(err, domain.ErrGroupNotFound) {
		t.Fatalf("error %v, want ErrGroupNotFound", err)
	}
}

func TestCreatorOfAndDeleteLobbyAreScopedToTheGroup(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	lobby := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	ctx := context.Background()

	err := store.Lobbies().WithLockedGroup(ctx, sundayID, func(tx application.LobbyTx) error {
		if _, found, err := tx.CreatorOf(ctx, sundayID, lobby.ID); err != nil || found {
			t.Fatalf("lobby of Friday found through Sunday: %v, %v", found, err)
		}
		return tx.DeleteLobby(ctx, sundayID, lobby.ID)
	})
	if err != nil {
		t.Fatal(err)
	}
	if n := count(t, store, `SELECT count(*) FROM lobbies WHERE id = $1`, lobby.ID); n != 1 {
		t.Fatal("a delete through another group removed the lobby")
	}

	err = store.Lobbies().WithLockedGroup(ctx, fridayID, func(tx application.LobbyTx) error {
		creator, found, err := tx.CreatorOf(ctx, fridayID, lobby.ID)
		if err != nil || !found || creator != alexID {
			t.Fatalf("creator %q, found %v, error %v; want Alex", creator, found, err)
		}
		return tx.DeleteLobby(ctx, fridayID, lobby.ID)
	})
	if err != nil {
		t.Fatal(err)
	}
	if n := count(t, store, `SELECT (SELECT count(*) FROM lobbies) + (SELECT count(*) FROM lobby_players)`); n != 0 {
		t.Fatalf("%d rows after the delete, want the lobby and its players gone", n)
	}
}

func TestLobbyTxMembershipReadsUnderTheLock(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()

	err := store.Lobbies().WithLockedGroup(ctx, fridayID, func(tx application.LobbyTx) error {
		if member, ok, err := tx.Membership(ctx, fridayID, alexID); err != nil || !ok || member.Role != domain.RoleAdmin {
			t.Fatalf("Alex: %+v %v %v, want an admin member", member, ok, err)
		}
		if _, ok, err := tx.Membership(ctx, fridayID, otherID); err != nil || ok {
			t.Fatalf("Other: %v %v, want no membership", ok, err)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

// The checks of migration 0004 are the last line of defense behind domain.NewLobby.
func TestDatabaseRefusesWhatTheDomainRefuses(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	const insert = `INSERT INTO lobbies (group_id, created_by_user_id, game_name, max_players, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5, $6)`
	start := joinedAt.Add(time.Hour)
	refused := []struct {
		name string
		game string
		max  any
		end  time.Time
	}{
		{name: "exactly 24 hours", game: "Go", end: start.Add(24 * time.Hour)},
		{name: "end equal to start", game: "Go", end: start},
		{name: "end before start", game: "Go", end: start.Add(-time.Minute)},
		{name: "max players zero", game: "Go", max: 0, end: start.Add(time.Hour)},
		{name: "empty game name", game: "", end: start.Add(time.Hour)},
		{name: "game name with leading space", game: " Go", end: start.Add(time.Hour)},
		{name: "game name with trailing space", game: "Go ", end: start.Add(time.Hour)},
		{name: "game name over 50 characters", game: strings.Repeat("a", 51), end: start.Add(time.Hour)},
	}
	for _, tc := range refused {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := store.db.Exec(insert, fridayID, alexID, tc.game, tc.max, start, tc.end); err == nil {
				t.Fatal("database accepted the lobby")
			}
		})
	}
	accepted := []struct {
		name string
		max  any
		end  time.Time
	}{
		{name: "just under 24 hours", end: start.Add(24*time.Hour - time.Microsecond)},
		{name: "largest max players", max: 2147483647, end: start.Add(time.Hour)},
	}
	for _, tc := range accepted {
		if _, err := store.db.Exec(insert, fridayID, alexID, "Go", tc.max, start, tc.end); err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
	}
}

func TestDatabaseRefusesUntrimmedGroupName(t *testing.T) {
	store := migratedStore(t)
	for _, name := range []string{" Friday", "Friday ", " ", "\t"} {
		if _, err := store.db.Exec(`INSERT INTO groups (name) VALUES ($1)`, name); err == nil {
			t.Fatalf("database accepted the group name %q", name)
		}
	}
	if _, err := store.db.Exec(`INSERT INTO groups (name) VALUES ('Friday night')`); err != nil {
		t.Fatalf("database refused a trimmed name with an inner space: %v", err)
	}
}

// Deferred from REQ-0009 (ADR 0010): deleting a game leaves the lobbies made with it untouched.
func TestDeletingAGameLeavesItsLobbiesUntouched(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	gameID := counterStrikeID
	lobby := insertLobby(t, store, newLobby(fridayID, alexID, &gameID, "Counter-Strike 2"))

	if err := store.Games().Delete(context.Background(), counterStrikeID); err != nil {
		t.Fatal(err)
	}

	var name string
	var kept *string
	if err := store.db.QueryRow(`SELECT game_name, game_id::text FROM lobbies WHERE id = $1`, lobby.ID).Scan(&name, &kept); err != nil {
		t.Fatal(err)
	}
	if name != "Counter-Strike 2" || kept == nil || *kept != counterStrikeID {
		t.Fatalf("lobby after the game was deleted: %q %v, want it unchanged", name, kept)
	}
}

func TestFindReturnsTheGameOrNotFound(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()

	game, err := store.Games().Find(ctx, counterStrikeID)
	if err != nil || game.Name != "Counter-Strike 2" || game.DefaultMaxPlayers == nil || *game.DefaultMaxPlayers != 5 {
		t.Fatalf("game %+v, error %v; want Counter-Strike 2 with default max 5", game, err)
	}
	for _, id := range []string{nobodyID, "not-a-uuid", ""} {
		if _, err := store.Games().Find(ctx, id); !errors.Is(err, application.ErrGameNotFound) {
			t.Fatalf("Find(%q) error %v, want ErrGameNotFound", id, err)
		}
	}
}

// ListForGroup counts the lobbies of the group per game. Custom names and lobbies of other groups do not count.
func TestListForGroupCountsLobbiesOfTheGroupPerGame(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	gameID := counterStrikeID
	insertLobby(t, store, newLobby(fridayID, alexID, &gameID, "Counter-Strike 2"))
	insertLobby(t, store, newLobby(fridayID, alexID, &gameID, "Counter-Strike 2"))
	insertLobby(t, store, newLobby(fridayID, alexID, nil, "Counter-Strike 2"))
	insertLobby(t, store, newLobby(sundayID, alexID, &gameID, "Counter-Strike 2"))

	usages, err := store.Games().ListForGroup(context.Background(), fridayID)
	if err != nil {
		t.Fatal(err)
	}
	byID := usagesByID(usages)
	if len(usages) != len(startingGames) || byID[counterStrikeID].LobbyCount != 2 {
		t.Fatalf("%d usages, Counter-Strike count %d; want %d games and a count of 2", len(usages), byID[counterStrikeID].LobbyCount, len(startingGames))
	}
	for _, game := range startingGames {
		if game.ID != counterStrikeID && byID[game.ID].LobbyCount != 0 {
			t.Fatalf("%s count %d, want 0", game.Name, byID[game.ID].LobbyCount)
		}
	}
}
