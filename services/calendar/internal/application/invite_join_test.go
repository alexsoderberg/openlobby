package application_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const joinLinkID = "join-link"

// joinableLink is active at now: one hour left and uses left.
var joinableLink = domain.InviteLink{ID: joinLinkID, GroupID: fridayID, Token: "live", CreatedByUserID: aliceID, ExpiresAt: now.Add(time.Hour), MaxUses: 10}

// joinStore has the link under the token "live" both in the lookup and under the lock.
func joinStore(link domain.InviteLink) *linkStore {
	store := newLinkStore()
	store.links = []domain.InviteLink{link}
	store.tokens = map[string]application.LinkLookup{link.Token: {Link: link, Group: domain.Group{ID: fridayID, Name: "Friday"}}}
	return store
}

// inactiveCase is a token that must be refused with the same ErrInviteInvalid (ADR 0007).
type inactiveCase struct {
	name  string
	token string
	store *linkStore
}

func inactiveCases() []inactiveCase {
	usedUp := joinableLink
	usedUp.UseCount = int(joinableLink.MaxUses)
	expired := joinableLink
	expired.ExpiresAt = now
	return []inactiveCase{
		{name: "unknown token", token: "no-such-token", store: joinStore(joinableLink)},
		{name: "expired", token: "live", store: joinStore(expired)},
		{name: "used up", token: "live", store: joinStore(usedUp)},
		{name: "revoked", token: "live", store: newLinkStore()},
	}
}

func TestGetInviteShowsGroupAndMembership(t *testing.T) {
	tests := []struct {
		name       string
		caller     string
		wantMember bool
	}{
		{name: "member", caller: bobID, wantMember: true},
		{name: "non-member", caller: strangerID, wantMember: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := joinStore(joinableLink)

			group, isMember, err := newInviteLinks(store).Get(context.Background(), "live", tc.caller)

			if err != nil || group != (domain.Group{ID: fridayID, Name: "Friday"}) || isMember != tc.wantMember {
				t.Fatalf("group %+v, member %v, error %v; want Friday and member %v", group, isMember, err, tc.wantMember)
			}
		})
	}
}

// Every inactive case gives the same error and no group, so nobody can tell the cases apart (ADR 0007).
func TestGetInviteRefusesEveryInactiveLinkTheSame(t *testing.T) {
	for _, tc := range inactiveCases() {
		t.Run(tc.name, func(t *testing.T) {
			group, isMember, err := newInviteLinks(tc.store).Get(context.Background(), tc.token, bobID)

			if !errors.Is(err, domain.ErrInviteInvalid) || group != (domain.Group{}) || isMember {
				t.Fatalf("group %+v, member %v, error %v; want ErrInviteInvalid and no group", group, isMember, err)
			}
		})
	}
}

func TestJoinAddsNewMemberAndCountsOneUse(t *testing.T) {
	store := joinStore(joinableLink)

	group, err := newInviteLinks(store).Join(context.Background(), "live", strangerID)

	if err != nil || group != (domain.Group{ID: fridayID, Name: "Friday"}) {
		t.Fatalf("group %+v, error %v; want Friday", group, err)
	}
	if !slices.Equal(store.added, []string{strangerID}) || !store.addedAt.Equal(now) {
		t.Fatalf("added %v at %v, want the stranger at now", store.added, store.addedAt)
	}
	if !slices.Equal(store.counted, []string{joinLinkID}) {
		t.Fatalf("counted %v, want one use of the link", store.counted)
	}
}

// An existing member gets the same answer as a new join, but nothing is written and no use is counted (ADR 0007).
func TestJoinByExistingMemberChangesNothing(t *testing.T) {
	store := joinStore(joinableLink)

	group, err := newInviteLinks(store).Join(context.Background(), "live", bobID)

	if err != nil || group != (domain.Group{ID: fridayID, Name: "Friday"}) {
		t.Fatalf("group %+v, error %v; want Friday", group, err)
	}
	if len(store.added) != 0 || len(store.counted) != 0 {
		t.Fatalf("added %v and counted %v, want nothing written", store.added, store.counted)
	}
}

// The lookup has no lock, so the link is read again under the lock and that read decides, also for a member.
func TestJoinDecidesOnTheLinkReadUnderTheLock(t *testing.T) {
	usedUp := joinableLink
	usedUp.UseCount = int(joinableLink.MaxUses)
	for _, caller := range []string{strangerID, bobID} {
		store := joinStore(joinableLink)
		store.links = []domain.InviteLink{usedUp}

		_, err := newInviteLinks(store).Join(context.Background(), "live", caller)

		if !errors.Is(err, domain.ErrInviteInvalid) || len(store.added) != 0 || len(store.counted) != 0 {
			t.Fatalf("caller %s: error %v, added %v, counted %v; want ErrInviteInvalid and no write", caller, err, store.added, store.counted)
		}
	}
}

func TestJoinRefusesEveryInactiveLinkAndWritesNothing(t *testing.T) {
	for _, tc := range inactiveCases() {
		t.Run(tc.name, func(t *testing.T) {
			_, err := newInviteLinks(tc.store).Join(context.Background(), tc.token, strangerID)

			if !errors.Is(err, domain.ErrInviteInvalid) || len(tc.store.added) != 0 || len(tc.store.counted) != 0 {
				t.Fatalf("error %v, added %v, counted %v; want ErrInviteInvalid and no write", err, tc.store.added, tc.store.counted)
			}
		})
	}
}

// A group that is gone when the lock is taken gives the same answer as an unknown link (ADR 0007, step 2).
func TestJoinGroupGoneAtTheLockIsInvalid(t *testing.T) {
	store := joinStore(joinableLink)
	delete(store.groups, fridayID)

	_, err := newInviteLinks(store).Join(context.Background(), "live", strangerID)

	if !errors.Is(err, domain.ErrInviteInvalid) {
		t.Fatalf("error %v, want ErrInviteInvalid", err)
	}
}

// A failed use count is returned, not swallowed: the join must not report success without the count.
func TestJoinReturnsFailedUseCountError(t *testing.T) {
	errWrite := errors.New("write failed")
	store := joinStore(joinableLink)
	store.useErr = errWrite

	_, err := newInviteLinks(store).Join(context.Background(), "live", strangerID)

	if !errors.Is(err, errWrite) {
		t.Fatalf("error %v, want the write error", err)
	}
}
