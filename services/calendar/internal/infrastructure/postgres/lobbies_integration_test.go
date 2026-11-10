//go:build integration

package postgres

import (
	"context"
	"errors"
	"maps"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// checkViolation is the SQLSTATE of a failed CHECK constraint.
const checkViolation = "23514"

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
	const insert = `INSERT INTO lobbies (group_id, created_by_user_id, game_name, max_players, starts_at, ends_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`
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
			_, err := store.db.Exec(insert, fridayID, alexID, tc.game, tc.max, start, tc.end, joinedAt)
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != checkViolation {
				t.Fatalf("error %v, want a check violation (23514)", err)
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
		if _, err := store.db.Exec(insert, fridayID, alexID, "Go", tc.max, start, tc.end, joinedAt); err != nil {
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

// addPlayer writes a player row directly, to set up a lobby without going through the join rules.
func addPlayer(t *testing.T, store *Store, lobbyID, userID string, at time.Time) {
	t.Helper()
	if _, err := store.db.Exec(`INSERT INTO lobby_players (lobby_id, user_id, joined_at) VALUES ($1, $2, $3)`, lobbyID, userID, at); err != nil {
		t.Fatal(err)
	}
}

func TestUpcomingFiltersOnEndSortsAndCountsPlayers(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	at := joinedAt.Add(2 * time.Hour)
	mk := func(group string, start, end time.Time) domain.Lobby {
		lobby := newLobby(group, alexID, nil, "Go")
		lobby.StartsAt, lobby.EndsAt = start, end
		return insertLobby(t, store, lobby)
	}
	later := mk(fridayID, at.Add(time.Hour), at.Add(2*time.Hour))
	endsNow := mk(fridayID, at.Add(-time.Hour), at)
	running := mk(fridayID, at.Add(-time.Hour), at.Add(time.Minute))
	sooner := mk(fridayID, at.Add(30*time.Minute), at.Add(time.Hour))
	mk(sundayID, at.Add(time.Minute), at.Add(time.Hour))
	addPlayer(t, store, sooner.ID, nobodyID, joinedAt)
	addPlayer(t, store, sooner.ID, otherID, joinedAt)

	lobbies, err := store.Lobbies().Upcoming(context.Background(), fridayID, alexID, at)

	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	counts := map[string]int{}
	for _, lobby := range lobbies {
		ids = append(ids, lobby.ID)
		counts[lobby.ID] = lobby.PlayerCount
	}
	if want := []string{running.ID, sooner.ID, later.ID}; !slices.Equal(ids, want) {
		t.Fatalf("lobbies %v (ended-now was %s), want %v", ids, endsNow.ID, want)
	}
	if counts[sooner.ID] != 3 || counts[running.ID] != 1 {
		t.Fatalf("player counts %v, want 3 for the lobby with two joiners and 1 for the other", counts)
	}
	if lobbies[0].GroupID != fridayID || lobbies[0].CreatedByUserID != alexID || lobbies[0].GameName != "Go" {
		t.Fatalf("lobby %+v not filled in", lobbies[0])
	}
}

func TestUpcomingOfAnEmptyGroupIsEmpty(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)

	lobbies, err := store.Lobbies().Upcoming(context.Background(), fridayID, alexID, joinedAt)

	if err != nil || len(lobbies) != 0 {
		t.Fatalf("lobbies %v, error %v; want none", lobbies, err)
	}
}

func TestLobbyIsScopedToTheGroupAndNotEnded(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	lobby := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	ctx := context.Background()

	got, _, err := store.Lobbies().Lobby(ctx, fridayID, lobby.ID, alexID, lobby.StartsAt)
	if err != nil || got.ID != lobby.ID || got.PlayerCount != 1 || got.GroupID != fridayID {
		t.Fatalf("lobby %+v, error %v; want the lobby with one player", got, err)
	}
	for name, tc := range map[string]struct {
		groupID, lobbyID string
		at               time.Time
	}{
		"other group": {sundayID, lobby.ID, lobby.StartsAt},
		"ended":       {fridayID, lobby.ID, lobby.EndsAt},
		"unknown":     {fridayID, nobodyID, lobby.StartsAt},
		"not a uuid":  {fridayID, "not-a-uuid", lobby.StartsAt},
	} {
		_, _, err := store.Lobbies().Lobby(ctx, tc.groupID, tc.lobbyID, alexID, tc.at)
		if name == "not a uuid" {
			// The router answers a malformed ID before the use case runs; the adapter must not report it as found.
			if err == nil {
				t.Fatalf("%s: no error", name)
			}
			continue
		}
		if !errors.Is(err, domain.ErrLobbyNotFound) {
			t.Fatalf("%s: error %v, want ErrLobbyNotFound", name, err)
		}
	}
}

func TestPlayersAreSortedByJoinTimeThenUserID(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	lobby := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	addPlayer(t, store, lobby.ID, otherID, joinedAt)
	addPlayer(t, store, lobby.ID, nobodyID, joinedAt.Add(-time.Minute))

	_, players, err := store.Lobbies().Lobby(context.Background(), fridayID, lobby.ID, alexID, joinedAt)

	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, player := range players {
		ids = append(ids, player.UserID)
	}
	want := []string{nobodyID, otherID, alexID} // otherID sorts before alexID
	if !slices.Equal(ids, want) {
		t.Fatalf("players %v, want %v", ids, want)
	}
}

func TestLobbyReaderMembershipAndUnavailable(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()

	if member, ok, err := store.Lobbies().Membership(ctx, fridayID, alexID); err != nil || !ok || member.Role != domain.RoleAdmin {
		t.Fatalf("Alex: %+v %v %v, want an admin member", member, ok, err)
	}
	if _, ok, err := store.Lobbies().Membership(ctx, fridayID, otherID); err != nil || ok {
		t.Fatalf("Other: %v %v, want no membership", ok, err)
	}
}

func TestLobbiesTellWhetherTheCallerIsAPlayer(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	mine := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	joined := insertLobby(t, store, newLobby(fridayID, nobodyID, nil, "Go"))
	notMine := insertLobby(t, store, newLobby(fridayID, nobodyID, nil, "Go"))
	addPlayer(t, store, joined.ID, alexID, joinedAt)

	lobbies, err := store.Lobbies().Upcoming(ctx, fridayID, alexID, joinedAt)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, lobby := range lobbies {
		got[lobby.ID] = lobby.JoinedByMe
	}
	if want := map[string]bool{mine.ID: true, joined.ID: true, notMine.ID: false}; !maps.Equal(got, want) {
		t.Fatalf("list joinedByMe %v, want %v", got, want)
	}
	one, _, err := store.Lobbies().Lobby(ctx, fridayID, notMine.ID, alexID, joinedAt)
	if err != nil || one.JoinedByMe {
		t.Fatalf("lobby %+v, error %v; want joinedByMe false", one, err)
	}
}

func addMember(t *testing.T, store *Store, groupID, userID string) {
	t.Helper()
	if _, err := store.db.Exec(`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, 'member', now())`, groupID, userID); err != nil {
		t.Fatal(err)
	}
}

// joinAt joins through the application use case with the clock fixed at now.
func joinAt(store *Store, groupID, lobbyID, userID string, now time.Time) error {
	ctx := context.Background()
	return application.NewLobbies(store.Lobbies(), store.Lobbies(), nil, nil, fixedNow{now}).Join(ctx, groupID, lobbyID, userID, domain.Seat{})
}

type fixedNow struct{ at time.Time }

func (c fixedNow) Now() time.Time { return c.at }

func TestJoinAndLeaveUpdateThePlayers(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	lobby := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	addMember(t, store, fridayID, otherID)
	lobbies := application.NewLobbies(store.Lobbies(), store.Lobbies(), nil, nil, fixedNow{joinedAt})
	ctx := context.Background()

	for range 2 {
		if err := lobbies.Join(ctx, fridayID, lobby.ID, otherID, domain.Seat{}); err != nil {
			t.Fatal(err)
		}
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID); n != 2 {
		t.Fatalf("%d players after joining twice, want 2", n)
	}
	for range 2 {
		if err := lobbies.Leave(ctx, fridayID, lobby.ID, otherID); err != nil {
			t.Fatal(err)
		}
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID); n != 1 {
		t.Fatalf("%d players after leaving twice, want the creator only", n)
	}
}

func TestJoinRefusesAnEndedLobbyAndANonMemberWithoutWriting(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	lobby := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	other := insertLobby(t, store, newLobby(sundayID, nobodyID, nil, "Go"))
	addMember(t, store, fridayID, otherID)

	ended := joinAt(store, fridayID, lobby.ID, otherID, lobby.EndsAt)
	stranger := joinAt(store, fridayID, lobby.ID, nobodyID, joinedAt)
	elsewhere := joinAt(store, fridayID, other.ID, otherID, joinedAt)

	if !errors.Is(ended, domain.ErrLobbyHasEnded) || !errors.Is(stranger, domain.ErrGroupNotFound) || !errors.Is(elsewhere, domain.ErrLobbyNotFound) {
		t.Fatalf("errors %v, %v, %v; want has ended, group not found, lobby not found", ended, stranger, elsewhere)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players`); n != 2 {
		t.Fatalf("%d player rows, want only the two creators", n)
	}
}

// Two joins race for the last spot: the group lock lets exactly one win, and the count never passes max_players.
func TestConcurrentJoinsNeverPassMaxPlayers(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	request := newLobby(fridayID, alexID, nil, "Go")
	request.MaxPlayers = intPtr(2)
	lobby := insertLobby(t, store, request)
	users := []string{otherID, "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"}
	for _, user := range users {
		addMember(t, store, fridayID, user)
	}
	results := make(chan error, len(users))

	for _, user := range users {
		go func() { results <- joinAt(store, fridayID, lobby.ID, user, joinedAt) }()
	}
	succeeded, full := 0, 0
	for range users {
		switch err := <-results; {
		case err == nil:
			succeeded++
		case errors.Is(err, domain.ErrLobbyFull):
			full++
		default:
			t.Fatalf("unexpected error %v", err)
		}
	}

	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID); n != 2 || succeeded != 1 || full != 2 {
		t.Fatalf("players %d, succeeded %d, full %d; want 2, 1 and 2", n, succeeded, full)
	}
}

// Two joins race while there are spots for both: both succeed and the count is 3 with the creator.
func TestConcurrentJoinsWithSpareSpotsBothSucceed(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	request := newLobby(fridayID, alexID, nil, "Go")
	request.MaxPlayers = intPtr(3)
	lobby := insertLobby(t, store, request)
	users := []string{otherID, "33333333-3333-4333-8333-333333333333"}
	for _, user := range users {
		addMember(t, store, fridayID, user)
	}
	results := make(chan error, len(users))

	for _, user := range users {
		go func() { results <- joinAt(store, fridayID, lobby.ID, user, joinedAt) }()
	}
	for range users {
		if err := <-results; err != nil {
			t.Fatalf("join failed: %v", err)
		}
	}

	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID); n != 3 {
		t.Fatalf("%d players, want 3", n)
	}
}
