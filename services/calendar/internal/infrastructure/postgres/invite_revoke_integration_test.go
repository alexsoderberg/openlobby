//go:build integration

package postgres

import (
	"context"
	"errors"
	"slices"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

// linkIDOf reads a link's ID by its token straight from the table, so the check does not use the code under test.
func linkIDOf(t *testing.T, store *Store, token string) string {
	t.Helper()
	var id string
	if err := store.db.QueryRowContext(context.Background(), `SELECT id FROM invite_links WHERE token = $1`, token).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestRevokeDeletesTheRow(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, fridayID, "to-revoke", alexID, "1 hour", 10, 0)

	err := newJoins(store).Revoke(context.Background(), fridayID, linkIDOf(t, store, "to-revoke"), alexID)

	if err != nil {
		t.Fatal(err)
	}
	if got := tokensOf(t, store, fridayID); len(got) != 0 {
		t.Fatalf("tokens %v after revoke, want the row deleted", got)
	}
}

// A member who is not an admin deletes the link they created (REQ-0007).
func TestRevokeByCreatorWhoIsNotAdminDeletesTheRow(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	if _, err := store.db.ExecContext(context.Background(),
		`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, 'member', now())`, fridayID, otherID); err != nil {
		t.Fatal(err)
	}
	insertLink(t, store, fridayID, "own-link", otherID, "1 hour", 10, 0)

	err := newJoins(store).Revoke(context.Background(), fridayID, linkIDOf(t, store, "own-link"), otherID)

	if err != nil {
		t.Fatal(err)
	}
	if got := tokensOf(t, store, fridayID); len(got) != 0 {
		t.Fatalf("tokens %v after revoke, want the row deleted", got)
	}
}

// Alex is admin of Friday, but the link belongs to Sunday: the revoke through Friday must not touch it.
func TestRevokeLeavesAnotherGroupsLinkAlone(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, sundayID, "sunday-link", otherID, "1 hour", 10, 0)

	err := newJoins(store).Revoke(context.Background(), fridayID, linkIDOf(t, store, "sunday-link"), alexID)

	if !errors.Is(err, domain.ErrInviteInvalid) {
		t.Fatalf("error %v, want ErrInviteInvalid", err)
	}
	if got := tokensOf(t, store, sundayID); !slices.Equal(got, []string{"sunday-link"}) {
		t.Fatalf("Sunday tokens %v, want its link untouched", got)
	}
}
