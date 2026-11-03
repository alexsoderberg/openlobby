//go:build integration

package postgres

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// insertLink writes a link straight in SQL, so a test controls its expiry and uses. expiresIn is an interval from now().
func insertLink(t *testing.T, store *Store, groupID, token, creatorID, expiresIn string, maxUses, useCount int) {
	t.Helper()
	_, err := store.db.ExecContext(context.Background(),
		`INSERT INTO invite_links (group_id, token, created_by_user_id, created_at, expires_at, max_uses, use_count)
		VALUES ($1, $2, $3, now(), now() + $4::interval, $5, $6)`,
		groupID, token, creatorID, expiresIn, maxUses, useCount)
	if err != nil {
		t.Fatal(err)
	}
}

// tokensOf reads the tokens of a group straight from the table, so the check does not use the code under test.
func tokensOf(t *testing.T, store *Store, groupID string) []string {
	t.Helper()
	rows, err := store.db.QueryContext(context.Background(), `SELECT token FROM invite_links WHERE group_id = $1`, groupID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := rows.Close(); err != nil {
			t.Errorf("close rows: %v", err)
		}
	}()
	var tokens []string
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			t.Fatal(err)
		}
		tokens = append(tokens, token)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	slices.Sort(tokens)
	return tokens
}

// insertLinkAt writes a link with an exact expiry time, so a test can place it on a boundary of IsActive.
func insertLinkAt(t *testing.T, store *Store, groupID, token, creatorID string, expiresAt time.Time, maxUses, useCount int) {
	t.Helper()
	_, err := store.db.ExecContext(context.Background(),
		`INSERT INTO invite_links (group_id, token, created_by_user_id, created_at, expires_at, max_uses, use_count)
		VALUES ($1, $2, $3, now(), $4, $5, $6)`,
		groupID, token, creatorID, expiresAt, maxUses, useCount)
	if err != nil {
		t.Fatal(err)
	}
}

// Create deletes the inactive links of the group in the same locked transaction (ADR 0007). The predicate in SQL
// must match domain.InviteLink.IsActive at the boundaries: expiry at exactly now is inactive, one second before expiry
// with uses left is active, and used up is inactive (ADR 0007 amendment 2026-11-03).
func TestCleanupOnCreateMatchesIsActiveAtBoundaries(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Microsecond)
	tests := []struct {
		name     string
		expires  time.Time
		maxUses  int
		useCount int
		kept     bool
	}{
		{name: "expires exactly now is deleted", expires: now, maxUses: 10, kept: false},
		{name: "one second left with uses left is kept", expires: now.Add(time.Second), maxUses: 10, kept: true},
		{name: "used up is deleted", expires: now.Add(time.Hour), maxUses: 1, useCount: 1, kept: false},
		{name: "one use left is kept", expires: now.Add(time.Hour), maxUses: 2, useCount: 1, kept: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := migratedStore(t)
			seedGroups(t, store)
			insertLinkAt(t, store, fridayID, "boundary", alexID, tc.expires, tc.maxUses, tc.useCount)

			err := store.Groups().WithLockedGroup(context.Background(), fridayID, func(tx application.GroupTx) error {
				return tx.DeleteInactiveInviteLinks(context.Background(), fridayID, now)
			})

			if err != nil {
				t.Fatal(err)
			}
			kept := slices.Contains(tokensOf(t, store, fridayID), "boundary")
			if kept != tc.kept {
				t.Fatalf("link kept %v, want %v", kept, tc.kept)
			}
		})
	}
}

// Cleanup is per group: another group's inactive link is not touched.
func TestCleanupOnCreateLeavesOtherGroupsAlone(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, sundayID, "other-group", otherID, "-1 minute", 10, 0)

	err := store.Groups().WithLockedGroup(context.Background(), fridayID, func(tx application.GroupTx) error {
		return tx.DeleteInactiveInviteLinks(context.Background(), fridayID, time.Now())
	})

	if err != nil {
		t.Fatal(err)
	}
	if got := tokensOf(t, store, sundayID); !slices.Equal(got, []string{"other-group"}) {
		t.Fatalf("Sunday tokens %v, want its expired link untouched", got)
	}
}

func TestWithLockedGroupRefusesMissingGroup(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)

	err := store.Groups().WithLockedGroup(context.Background(), nobodyID, func(application.GroupTx) error {
		t.Fatal("the transaction ran for a missing group")
		return nil
	})

	if !errors.Is(err, domain.ErrGroupNotFound) {
		t.Fatalf("error %v, want ErrGroupNotFound", err)
	}
}

// Each list is scoped to the group and, for members, to the creator (ADR 0006 rule 12, ADR 0007).
func TestListsAreScopedToGroupAndCreator(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	insertLink(t, store, fridayID, "alex-friday", alexID, "1 hour", 10, 0)
	insertLink(t, store, fridayID, "other-friday", otherID, "1 hour", 10, 0)
	insertLink(t, store, sundayID, "alex-sunday", alexID, "1 hour", 10, 0)

	admin, err := store.InviteLinks().AllLinks(ctx, fridayID)
	if err != nil || !slices.Equal(tokensOfLinks(admin), []string{"alex-friday", "other-friday"}) {
		t.Fatalf("admin list %v, error %v; want every link of Friday", tokensOfLinks(admin), err)
	}
	own, err := store.InviteLinks().LinksCreatedBy(ctx, fridayID, alexID)
	if err != nil || !slices.Equal(tokensOfLinks(own), []string{"alex-friday"}) {
		t.Fatalf("member list %v, error %v; want Alex's link of Friday", tokensOfLinks(own), err)
	}
	other, err := store.InviteLinks().LinksCreatedBy(ctx, sundayID, otherID)
	if err != nil || len(other) != 0 {
		t.Fatalf("list %v, error %v; want no link of another group", tokensOfLinks(other), err)
	}
}

// tokensOfLinks returns the sorted tokens, so a test can compare the lists without caring about their order.
func tokensOfLinks(links []domain.InviteLink) []string {
	tokens := make([]string, len(links))
	for i, link := range links {
		tokens[i] = link.Token
	}
	slices.Sort(tokens)
	return tokens
}

// The values come back as they were stored: the max uses, the use count and the creator.
func TestListReturnsStoredValues(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	insertLink(t, store, fridayID, "stored", alexID, "1 hour", 3, 1)

	links, err := store.InviteLinks().AllLinks(context.Background(), fridayID)

	if err != nil || len(links) != 1 {
		t.Fatalf("links %v, error %v; want one link", links, err)
	}
	link := links[0]
	if link.Token != "stored" || link.CreatedByUserID != alexID || link.MaxUses != 3 || link.UseCount != 1 {
		t.Fatalf("link %+v, want the stored values", link)
	}
	if !link.ExpiresAt.After(time.Now()) {
		t.Fatalf("expires %v, want a time in the future", link.ExpiresAt)
	}
}

// Cleanup and insert run in one locked transaction that commits: the inactive link is gone and the new one is stored.
func TestCleanupThenInsertInOneTransactionCommits(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	insertLink(t, store, fridayID, "live", alexID, "1 hour", 10, 0)
	insertLink(t, store, fridayID, "expired", alexID, "-1 minute", 10, 0)
	now := time.Now().UTC().Truncate(time.Microsecond)

	err := store.Groups().WithLockedGroup(ctx, fridayID, func(tx application.GroupTx) error {
		if err := tx.DeleteInactiveInviteLinks(ctx, fridayID, now); err != nil {
			return err
		}
		_, err := tx.InsertInviteLink(ctx, domain.InviteLink{
			GroupID: fridayID, Token: "fresh", CreatedByUserID: alexID,
			CreatedAt: now, ExpiresAt: now.Add(domain.InviteLinkLifetime), MaxUses: 10,
		})
		return err
	})

	if err != nil {
		t.Fatal(err)
	}
	if got := tokensOf(t, store, fridayID); !slices.Equal(got, []string{"fresh", "live"}) {
		t.Fatalf("Friday tokens %v, want the live link and the new one", got)
	}
}
