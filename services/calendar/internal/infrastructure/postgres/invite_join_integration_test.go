//go:build integration

package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/internal/infrastructure/cryptotoken"
	"openlobby/services/calendar/internal/infrastructure/systemclock"
)

// newJoins wires the join use cases to this store, as main.go does.
func newJoins(store *Store) *application.InviteLinks {
	return application.NewInviteLinks(store.Groups(), store.Groups(), store.InviteLinks(), cryptotoken.Generator{}, systemclock.Clock{})
}

// roleOf returns the user's role in the group, or "" when the user is not a member.
func roleOf(t *testing.T, store *Store, groupID, userID string) string {
	t.Helper()
	var role string
	err := store.db.QueryRowContext(context.Background(), `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return ""
	}
	if err != nil {
		t.Fatal(err)
	}
	return role
}

// useCountOf reads the use count straight from the table, so the check does not use the code under test.
func useCountOf(t *testing.T, store *Store, token string) int {
	t.Helper()
	var count int
	if err := store.db.QueryRowContext(context.Background(), `SELECT use_count FROM invite_links WHERE token = $1`, token).Scan(&count); err != nil {
		t.Fatal(err)
	}
	return count
}

func TestFindLinkByTokenReturnsLinkWithGroupName(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, fridayID, "found", alexID, "1 hour", 3, 1)

	lookup, found, err := store.InviteLinks().FindLinkByToken(context.Background(), "found")

	if err != nil || !found {
		t.Fatalf("found %v, error %v; want the link", found, err)
	}
	if lookup.Group != (domain.Group{ID: fridayID, Name: "Friday"}) || lookup.Link.GroupID != fridayID || lookup.Link.MaxUses != 3 || lookup.Link.UseCount != 1 {
		t.Fatalf("lookup %+v, want Friday and the stored values", lookup)
	}
}

// An unknown token, and a token that cannot be stored (a NUL byte), are both not found and no error (ADR 0007).
func TestFindLinkByTokenNotFoundIsNoError(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)

	for _, token := range []string{"no-such-token", "bad\x00token", "bad\xfftoken"} {
		_, found, err := store.InviteLinks().FindLinkByToken(context.Background(), token)
		if err != nil || found {
			t.Fatalf("token %q: found %v, error %v; want not found and no error", token, found, err)
		}
	}
}

// The join creates the membership and counts the use in one transaction (ADR 0007).
func TestJoinCreatesMembershipAndCountsOneUse(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, fridayID, "joinable", alexID, "1 hour", 10, 0)

	group, err := newJoins(store).Join(context.Background(), "joinable", otherID)

	if err != nil || group != (domain.Group{ID: fridayID, Name: "Friday"}) {
		t.Fatalf("group %+v, error %v; want Friday", group, err)
	}
	if role := roleOf(t, store, fridayID, otherID); role != string(domain.RoleMember) {
		t.Fatalf("role %q, want member", role)
	}
	if count := useCountOf(t, store, "joinable"); count != 1 {
		t.Fatalf("use count %d, want 1", count)
	}
}

// An existing admin who opens the link keeps the role and the link is not counted (ADR 0007).
func TestJoinByExistingMemberKeepsRoleAndIsNotCounted(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, fridayID, "again", alexID, "1 hour", 10, 0)

	if _, err := newJoins(store).Join(context.Background(), "again", alexID); err != nil {
		t.Fatal(err)
	}

	if role := roleOf(t, store, fridayID, alexID); role != string(domain.RoleAdmin) {
		t.Fatalf("role %q, want admin", role)
	}
	if count := useCountOf(t, store, "again"); count != 0 {
		t.Fatalf("use count %d, want 0", count)
	}
}

// userIDFor gives a distinct user ID per index, so each join in the race test is a new member.
func userIDFor(index int) string {
	return fmt.Sprintf("00000000-0000-4000-8000-%012d", index+1)
}

// Many links, each with one use, and two new joins per link at the same time. The group lock serializes all of them:
// per link exactly one join wins and the other gets invite_invalid. Without the lock both could win.
func TestConcurrentJoinsOnLastUseOfEachLinkLetOneIn(t *testing.T) {
	const linkCount = 20
	store := migratedStore(t)
	seedGroups(t, store)
	joins := newJoins(store)
	tokens := make([]string, linkCount)
	for i := range tokens {
		tokens[i] = fmt.Sprintf("last-%d", i)
		insertLink(t, store, fridayID, tokens[i], alexID, "1 hour", 1, 0)
	}

	errs := make([]error, 2*linkCount)
	var wg sync.WaitGroup
	for i := range errs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, errs[i] = joins.Join(context.Background(), tokens[i/2], userIDFor(i))
		}()
	}
	wg.Wait()

	for i, token := range tokens {
		if won := countWins(t, errs[2*i:2*i+2]); won != 1 || useCountOf(t, store, token) != 1 {
			t.Fatalf("link %s: %d joins won and use count %d, want exactly one of each", token, won, useCountOf(t, store, token))
		}
	}
}

// The use count is the last write of the join. When it fails, the membership written before it is rolled back too,
// so the caller is not a member and the use count is unchanged (ADR 0007, one transaction).
func TestJoinRollsBackMembershipWhenUseCountFails(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, fridayID, "atomic", alexID, "1 hour", 10, 0)
	if _, err := store.db.ExecContext(context.Background(), `
		CREATE FUNCTION fail_use() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'use count refused'; END $$;
		CREATE TRIGGER fail_use BEFORE UPDATE ON invite_links FOR EACH ROW EXECUTE FUNCTION fail_use();`); err != nil {
		t.Fatal(err)
	}

	_, err := newJoins(store).Join(context.Background(), "atomic", otherID)

	if err == nil || errors.Is(err, domain.ErrInviteInvalid) {
		t.Fatalf("error %v, want the write failure", err)
	}
	if role := roleOf(t, store, fridayID, otherID); role != "" {
		t.Fatalf("role %q after a failed join, want no membership", role)
	}
	if count := useCountOf(t, store, "atomic"); count != 0 {
		t.Fatalf("use count %d after a failed join, want 0", count)
	}
}

// countWins counts the joins that succeeded. Every other join must have been refused as invite_invalid.
func countWins(t *testing.T, errs []error) int {
	t.Helper()
	won := 0
	for _, err := range errs {
		switch {
		case err == nil:
			won++
		case !errors.Is(err, domain.ErrInviteInvalid):
			t.Fatalf("unexpected error %v", err)
		}
	}
	return won
}
