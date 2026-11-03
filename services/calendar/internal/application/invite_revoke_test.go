package application_test

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

func (s *linkStore) DeleteInviteLink(_ context.Context, _, linkID string) error {
	s.deleted = append(s.deleted, linkID)
	return nil
}

// The creator of an active link and an admin may revoke it (ADR 0007, REQ-0007).
func TestRevokeDeletesActiveLinkForCreatorOrAdmin(t *testing.T) {
	tests := []struct {
		name   string
		caller string
	}{
		{name: "creator revokes own active link", caller: bobID},
		{name: "admin revokes another member's active link", caller: aliceID},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLinkStore()
			store.links = linksOfFriday

			err := newInviteLinks(store).Revoke(context.Background(), fridayID, "bob-live", tc.caller)

			if err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(store.deleted, []string{"bob-live"}) {
				t.Fatalf("deleted %v, want only bob-live", store.deleted)
			}
		})
	}
}

// Each refused case writes nothing. The order is membership, the link in this group, permission, then activity
// (ADR 0007), so an other member on an expired link gets not_allowed, and an unknown link gets invite_invalid.
func TestRevokeRefusesWithoutDeleting(t *testing.T) {
	tests := []struct {
		name    string
		groupID string
		caller  string
		linkID  string
		want    error
	}{
		{name: "other member is not allowed", caller: bobID, linkID: "alice-live", want: domain.ErrNotAllowed},
		{name: "non-member gets group not found", caller: strangerID, linkID: "bob-live", want: domain.ErrGroupNotFound},
		{name: "non-member on unknown link gets group not found", caller: strangerID, linkID: "no-such-link", want: domain.ErrGroupNotFound},
		{name: "missing group gets group not found", groupID: missingID, caller: aliceID, linkID: "bob-live", want: domain.ErrGroupNotFound},
		{name: "unknown link gets invite invalid", caller: aliceID, linkID: "no-such-link", want: domain.ErrInviteInvalid},
		{name: "other member on unknown link gets invite invalid", caller: bobID, linkID: "no-such-link", want: domain.ErrInviteInvalid},
		{name: "admin on expired link gets invite invalid", caller: aliceID, linkID: "alice-expired", want: domain.ErrInviteInvalid},
		{name: "other member on expired link is not allowed first", caller: bobID, linkID: "alice-expired", want: domain.ErrNotAllowed},
		{name: "creator on used up link gets invite invalid", caller: bobID, linkID: "bob-used-up", want: domain.ErrInviteInvalid},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLinkStore()
			store.links = linksOfFriday

			err := newInviteLinks(store).Revoke(context.Background(), cmp.Or(tc.groupID, fridayID), tc.linkID, tc.caller)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if len(store.deleted) != 0 {
				t.Fatalf("deleted %v, want nothing", store.deleted)
			}
		})
	}
}
