//go:build integration

package postgres

import (
	"context"
	"errors"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/internal/infrastructure/systemclock"
)

func leave(store *Store, groupID, userID string) error {
	return application.NewMemberships(store.Memberships(), systemclock.Clock{}).Leave(context.Background(), groupID, userID)
}

// seedFriday makes alex admin (oldest), other a member and a third member, in that join order.
func seedFriday(t *testing.T, store *Store) {
	t.Helper()
	seedGroups(t, store)
	for _, statement := range []string{
		`UPDATE group_members SET joined_at = now() - interval '3 days' WHERE group_id = '` + fridayID + `'`,
		`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ('` + fridayID + `', '` + otherID + `', 'member', now() - interval '2 days')`,
		`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ('` + fridayID + `', '` + nobodyID + `', 'member', now() - interval '1 day')`,
	} {
		if _, err := store.db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
}

func TestLeaveRemovesMembershipUpcomingPlayersAndOwnLinksButKeepsPastLobbies(t *testing.T) {
	store := migratedStore(t)
	seedFriday(t, store)
	now := time.Now()
	past := newLobby(fridayID, alexID, nil, "Past")
	past.StartsAt, past.EndsAt = now.Add(-3*time.Hour), now.Add(-time.Hour)
	past = insertLobby(t, store, past)
	upcoming := newLobby(fridayID, alexID, nil, "Upcoming")
	upcoming.StartsAt, upcoming.EndsAt = now.Add(time.Hour), now.Add(2*time.Hour)
	upcoming = insertLobby(t, store, upcoming)
	addPlayer(t, store, past.ID, otherID, now.Add(-4*time.Hour))
	addPlayer(t, store, upcoming.ID, otherID, now)
	insertLink(t, store, fridayID, "others-link", otherID, "1 hour", 10, 0)
	insertLink(t, store, fridayID, "alexs-link", alexID, "1 hour", 10, 0)

	if err := leave(store, fridayID, otherID); err != nil {
		t.Fatal(err)
	}

	if roleOf(t, store, fridayID, otherID) != "" {
		t.Fatal("other is still a member")
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND user_id = $2`, upcoming.ID, otherID); n != 0 {
		t.Fatalf("%d player rows on the upcoming lobby, want 0", n)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND user_id = $2`, past.ID, otherID); n != 1 {
		t.Fatalf("%d player rows on the past lobby, want 1", n)
	}
	if got := tokensOf(t, store, fridayID); len(got) != 1 || got[0] != "alexs-link" {
		t.Fatalf("tokens %v, want only alexs-link", got)
	}
	if roleOf(t, store, fridayID, alexID) != "admin" {
		t.Fatal("alex lost the admin role")
	}
}

func TestLeaveByTheLastAdminPromotesTheMemberWhoJoinedFirst(t *testing.T) {
	store := migratedStore(t)
	seedFriday(t, store)

	if err := leave(store, fridayID, alexID); err != nil {
		t.Fatal(err)
	}

	if got := roleOf(t, store, fridayID, otherID); got != "admin" {
		t.Fatalf("other has role %q, want admin", got)
	}
	if got := roleOf(t, store, fridayID, nobodyID); got != "member" {
		t.Fatalf("third member has role %q, want member", got)
	}
}

func TestLeaveByTheLastAdminPassesOverAnotherAdmin(t *testing.T) {
	store := migratedStore(t)
	seedFriday(t, store)
	if _, err := store.db.Exec(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, fridayID, nobodyID); err != nil {
		t.Fatal(err)
	}

	if err := leave(store, fridayID, alexID); err != nil {
		t.Fatal(err)
	}

	if got := roleOf(t, store, fridayID, otherID); got != "member" {
		t.Fatalf("other has role %q, want member while another admin remains", got)
	}
}

func TestLeaveByTheLastMemberDeletesTheGroupWithItsData(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	lobby := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Chess"))
	if _, err := store.db.Exec(`UPDATE lobbies SET ends_at = now() - interval '1 hour', starts_at = now() - interval '2 hours' WHERE id = $1`, lobby.ID); err != nil {
		t.Fatal(err)
	}
	insertLink(t, store, fridayID, "link", alexID, "1 hour", 10, 0)

	if err := leave(store, fridayID, alexID); err != nil {
		t.Fatal(err)
	}

	for _, query := range []string{
		`SELECT count(*) FROM groups WHERE id = $1`, `SELECT count(*) FROM group_members WHERE group_id = $1`,
		`SELECT count(*) FROM lobbies WHERE group_id = $1`, `SELECT count(*) FROM invite_links WHERE group_id = $1`,
	} {
		if n := count(t, store, query, fridayID); n != 0 {
			t.Fatalf("%q gives %d, want 0", query, n)
		}
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID); n != 0 {
		t.Fatalf("%d players left, want 0", n)
	}
	if n := count(t, store, `SELECT count(*) FROM groups WHERE id = $1`, sundayID); n != 1 {
		t.Fatal("another group was deleted")
	}
}

func TestLeaveRefusedChangesNothing(t *testing.T) {
	store := migratedStore(t)
	seedFriday(t, store)
	upcoming := newLobby(fridayID, otherID, nil, "Chess")
	upcoming.StartsAt, upcoming.EndsAt = time.Now().Add(time.Hour), time.Now().Add(2*time.Hour)
	insertLobby(t, store, upcoming)
	insertLink(t, store, fridayID, "others-link", otherID, "1 hour", 10, 0)

	creatorErr := leave(store, fridayID, otherID)
	strangerErr := leave(store, emptyID, otherID)
	missingErr := leave(store, "99999999-9999-4999-8999-999999999999", otherID)

	if !errors.Is(creatorErr, domain.ErrOwnUpcomingLobbiesExist) || !errors.Is(strangerErr, domain.ErrGroupNotFound) || !errors.Is(missingErr, domain.ErrGroupNotFound) {
		t.Fatalf("errors %v, %v, %v; want own_upcoming_lobbies_exist, then group_not_found twice", creatorErr, strangerErr, missingErr)
	}
	if roleOf(t, store, fridayID, otherID) != "member" || len(tokensOf(t, store, fridayID)) != 1 {
		t.Fatal("a refused leave changed the membership or the links")
	}
}

// A creator of only past lobbies may leave; the past lobby and its creator id stay.
func TestLeaveWithOnlyPastOwnLobbiesIsAllowed(t *testing.T) {
	store := migratedStore(t)
	seedFriday(t, store)
	past := newLobby(fridayID, otherID, nil, "Past")
	past.StartsAt, past.EndsAt = time.Now().Add(-3*time.Hour), time.Now().Add(-time.Hour)
	insertLobby(t, store, past)

	if err := leave(store, fridayID, otherID); err != nil {
		t.Fatal(err)
	}
	if n := count(t, store, `SELECT count(*) FROM lobbies WHERE group_id = $1`, fridayID); n != 1 {
		t.Fatalf("%d lobbies, want the past one to stay", n)
	}
}

// Rejoin is a fresh membership with the member role, also for a former admin.
func TestRejoinAfterLeavingIsAFreshMemberNotAdmin(t *testing.T) {
	store := migratedStore(t)
	seedFriday(t, store)
	insertLink(t, store, fridayID, "join-me", otherID, "1 hour", 10, 0)
	if err := leave(store, fridayID, alexID); err != nil {
		t.Fatal(err)
	}

	if _, err := newJoins(store).Join(context.Background(), "join-me", alexID); err != nil {
		t.Fatal(err)
	}

	if got := roleOf(t, store, fridayID, alexID); got != "member" {
		t.Fatalf("rejoined alex has role %q, want member", got)
	}
}
