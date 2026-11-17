//go:build integration

package postgres

import (
	"context"
	"reflect"
	"testing"
	"time"

	"openlobby/services/calendar/internal/domain"
)

// Group IDs of the overview tests. Their order as text is the order the tie-break on ID gives.
const (
	overviewGroupA = "a0000000-0000-4000-8000-000000000001"
	overviewGroupB = "a0000000-0000-4000-8000-000000000002"
	overviewGroupC = "a0000000-0000-4000-8000-000000000003"
	overviewGroupD = "a0000000-0000-4000-8000-000000000004"
	overviewGroupE = "a0000000-0000-4000-8000-000000000005"
)

// exec runs seed statements and fails the test on the first error.
func exec(t *testing.T, store *Store, query string, args ...any) {
	t.Helper()
	if _, err := store.db.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatalf("seed %q: %v", query, err)
	}
}

func overviews(t *testing.T, store *Store, userID string) []domain.GroupOverview {
	t.Helper()
	got, err := store.Groups().Overviews(context.Background(), userID, joinedAt)
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func TestOverviewsListTheCallersGroupsByNameIgnoringCaseThenID(t *testing.T) {
	store := migratedStore(t)
	exec(t, store, `INSERT INTO groups (id, name) VALUES ($1, 'beta'), ($2, 'alpha'), ($3, 'Alpha'), ($4, 'Aardvark')`,
		overviewGroupA, overviewGroupC, overviewGroupB, overviewGroupD)
	exec(t, store, `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES
		($1, $5, 'admin', now()), ($2, $5, 'member', now()), ($3, $5, 'member', now()), ($3, $6, 'admin', now()), ($4, $6, 'admin', now())`,
		overviewGroupA, overviewGroupB, overviewGroupC, overviewGroupD, alexID, otherID)

	var got []domain.Group
	var counts []int
	for _, overview := range overviews(t, store, alexID) {
		got = append(got, overview.Group)
		counts = append(counts, overview.MemberCount)
	}

	want := []domain.Group{{ID: overviewGroupB, Name: "Alpha"}, {ID: overviewGroupC, Name: "alpha"}, {ID: overviewGroupA, Name: "beta"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("groups %v, want %v (the non-member group Aardvark absent)", got, want)
	}
	if !reflect.DeepEqual(counts, []int{1, 2, 1}) {
		t.Fatalf("member counts %v, want [1 2 1] (the caller included)", counts)
	}
	if len(overviews(t, store, nobodyID)) != 0 {
		t.Fatal("a user in no group got overviews")
	}
}

func TestOverviewShowsTheFiveEarliestMembersWithTheTieOnUserID(t *testing.T) {
	store := migratedStore(t)
	exec(t, store, `INSERT INTO groups (id, name) VALUES ($1, 'Friday')`, fridayID)
	early, later := joinedAt.Add(-time.Hour), joinedAt
	// Six members: four tie on the earliest join time and are ordered by user ID; the caller joined last.
	ids := []string{
		"b0000000-0000-4000-8000-000000000004", "b0000000-0000-4000-8000-000000000002",
		"b0000000-0000-4000-8000-000000000003", "b0000000-0000-4000-8000-000000000001",
	}
	for _, id := range ids {
		exec(t, store, `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, 'member', $3)`, fridayID, id, early)
	}
	exec(t, store, `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, 'member', $3)`, fridayID, otherID, later)
	exec(t, store, `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, 'admin', $3)`, fridayID, alexID, later.Add(time.Minute))

	got := overviews(t, store, alexID)

	if len(got) != 1 || got[0].MemberCount != 6 {
		t.Fatalf("overviews %+v, want one group with 6 members", got)
	}
	var memberIDs []string
	for _, member := range got[0].Members {
		memberIDs = append(memberIDs, member.UserID)
	}
	want := []string{ids[3], ids[1], ids[2], ids[0], otherID}
	if !reflect.DeepEqual(memberIDs, want) {
		t.Fatalf("members %v, want %v", memberIDs, want)
	}
}

// insertLobbyRow stores a lobby with a known ID, so a test can rely on the tie-break on ID.
func insertLobbyRow(t *testing.T, store *Store, id, groupID string, gameID, gameName *string, maxPlayers *int, startsAt time.Time, length time.Duration) {
	t.Helper()
	exec(t, store, `INSERT INTO lobbies (id, group_id, created_by_user_id, game_id, game_name, max_players, starts_at, ends_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, groupID, alexID, gameID, gameName, maxPlayers, startsAt, startsAt.Add(length), startsAt.Add(-24*time.Hour))
}

func strPtr(value string) *string { return &value }

func TestOverviewNextLobby(t *testing.T) {
	store := migratedStore(t)
	exec(t, store, `INSERT INTO groups (id, name) VALUES ($1, 'A'), ($2, 'B'), ($3, 'C'), ($4, 'D'), ($5, 'E')`,
		overviewGroupA, overviewGroupB, overviewGroupC, overviewGroupD, overviewGroupE)
	exec(t, store, `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES
		($1, $6, 'admin', now()), ($2, $6, 'admin', now()), ($3, $6, 'admin', now()), ($4, $7, 'admin', now()), ($5, $6, 'admin', now())`,
		overviewGroupA, overviewGroupB, overviewGroupC, overviewGroupD, overviewGroupE, alexID, otherID)
	shooter := domain.Genre("shooter")
	if _, err := store.Games().Replace(context.Background(), domain.Game{ID: counterStrikeID, Name: "Counter-Strike 2", Genre: &shooter}); err != nil {
		t.Fatal(err)
	}
	now, five := joinedAt, 5
	const (
		ended         = "c0000000-0000-4000-8000-000000000001"
		deleted       = "c0000000-0000-4000-8000-000000000002"
		running       = "c0000000-0000-4000-8000-000000000003"
		laterA        = "c0000000-0000-4000-8000-000000000004"
		tieLow        = "c0000000-0000-4000-8000-000000000005"
		tieHigh       = "c0000000-0000-4000-8000-000000000006"
		strangerLobby = "c0000000-0000-4000-8000-000000000007"
		noGame        = "c0000000-0000-4000-8000-000000000008"
	)
	// A: an ended lobby, a deleted one that would start first, a running one with the game and a later one.
	insertLobbyRow(t, store, ended, overviewGroupA, nil, nil, nil, now.Add(-3*time.Hour), time.Hour)
	insertLobbyRow(t, store, deleted, overviewGroupA, nil, nil, nil, now.Add(-2*time.Hour), 3*time.Hour)
	exec(t, store, `DELETE FROM lobbies WHERE id = $1`, deleted)
	insertLobbyRow(t, store, running, overviewGroupA, strPtr(counterStrikeID), strPtr("Counter-Strike 2"), &five, now.Add(-time.Hour), 2*time.Hour)
	exec(t, store, `UPDATE lobbies SET game_mode_id = $2, mode_name = 'Ranked', activity_id = $2, activity_name = 'Vault' WHERE id = $1`, running, tieHigh)
	exec(t, store, `INSERT INTO lobby_players (lobby_id, user_id, joined_at) VALUES ($1, $2, $4), ($1, $3, $4)`, running, alexID, otherID, now)
	insertLobbyRow(t, store, laterA, overviewGroupA, nil, nil, nil, now.Add(time.Hour), time.Hour)
	// B: two lobbies that start at the same time; the one with the lower ID is a custom name ("Other"), with no players.
	insertLobbyRow(t, store, tieHigh, overviewGroupB, strPtr(counterStrikeID), strPtr("Counter-Strike 2"), nil, now.Add(2*time.Hour), time.Hour)
	insertLobbyRow(t, store, tieLow, overviewGroupB, nil, strPtr("Go"), nil, now.Add(2*time.Hour), time.Hour)
	// D is not the caller's group; its lobby starts first of all and must not show in C, which has none.
	insertLobbyRow(t, store, strangerLobby, overviewGroupD, nil, nil, nil, now.Add(-30*time.Minute), time.Hour)

	// E: a lobby with no game ("Open") and a max.
	three := 3
	insertLobbyRow(t, store, noGame, overviewGroupE, nil, nil, &three, now.Add(time.Hour), time.Hour)

	got := overviews(t, store, alexID)

	if len(got) != 4 {
		t.Fatalf("got %d overviews, want 4", len(got))
	}
	wantA := &domain.Lobby{
		GameName: strPtr("Counter-Strike 2"), GameGenre: &shooter, ModeName: strPtr("Ranked"), ActivityName: strPtr("Vault"),
		MaxPlayers: &five, StartsAt: now.Add(-time.Hour), EndsAt: now.Add(time.Hour), PlayerCount: 2,
	}
	wantB := &domain.Lobby{GameName: strPtr("Go"), StartsAt: now.Add(2 * time.Hour), EndsAt: now.Add(3 * time.Hour)}
	wantE := &domain.Lobby{MaxPlayers: &three, StartsAt: now.Add(time.Hour), EndsAt: now.Add(2 * time.Hour)}
	for i, want := range []*domain.Lobby{wantA, wantB, nil, wantE} {
		if lobby := got[i].NextLobby; !reflect.DeepEqual(utcLobby(lobby), want) {
			t.Errorf("group %s: next lobby %+v, want %+v", got[i].Group.Name, lobby, want)
		}
	}
}

// utcLobby makes the times comparable with DeepEqual, whatever location the driver reads them in.
func utcLobby(lobby *domain.Lobby) *domain.Lobby {
	if lobby == nil {
		return nil
	}
	copied := *lobby
	copied.StartsAt, copied.EndsAt = copied.StartsAt.UTC(), copied.EndsAt.UTC()
	return &copied
}
