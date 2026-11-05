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

const carolID = "77777777-7777-4777-8777-777777777777"

// leaveStore records what Leave wrote. Members are in join order, as the port promises.
type leaveStore struct {
	*fakeStore
	hasLobby   bool
	removed    []string
	madeAdmin  string
	deletedGrp bool
}

func (s *leaveStore) WithLockedGroup(_ context.Context, groupID string, fn func(application.LeaveTx) error) error {
	if _, ok := s.groups[groupID]; !ok {
		return domain.ErrGroupNotFound
	}
	return fn(s)
}

func (s *leaveStore) HasUpcomingLobbyBy(context.Context, string, string, time.Time) (bool, error) {
	return s.hasLobby, nil
}

func (s *leaveStore) RemoveLeaverData(_ context.Context, _, userID string, _ time.Time) error {
	s.removed = append(s.removed, userID)
	return nil
}

func (s *leaveStore) MakeAdmin(_ context.Context, _, userID string) error {
	s.madeAdmin = userID
	return nil
}

func (s *leaveStore) DeleteGroup(context.Context, string) error {
	s.deletedGrp = true
	return nil
}

func newLeaveStore(members ...domain.Member) *leaveStore {
	return &leaveStore{fakeStore: &fakeStore{
		groups:  map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}},
		members: map[string][]domain.Member{fridayID: members},
	}}
}

func leave(store *leaveStore, callerID string) error {
	return application.NewMemberships(store, fixedClock{at: now}).Leave(context.Background(), fridayID, callerID)
}

func TestLeaveRemovesTheMemberAndKeepsRolesWhenAnotherAdminRemains(t *testing.T) {
	tests := []struct {
		name    string
		members []domain.Member
		caller  string
	}{
		{name: "member leaves", members: []domain.Member{{UserID: aliceID, Role: domain.RoleAdmin}, {UserID: bobID, Role: domain.RoleMember}}, caller: bobID},
		{name: "admin leaves while another admin remains", members: []domain.Member{{UserID: aliceID, Role: domain.RoleAdmin}, {UserID: bobID, Role: domain.RoleAdmin}}, caller: aliceID},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLeaveStore(tc.members...)

			if err := leave(store, tc.caller); err != nil {
				t.Fatal(err)
			}
			if !slices.Equal(store.removed, []string{tc.caller}) || store.madeAdmin != "" || store.deletedGrp {
				t.Fatalf("removed %v, new admin %q, group deleted %v; want only the caller removed", store.removed, store.madeAdmin, store.deletedGrp)
			}
		})
	}
}

// The members come in join order, so the one who has been in the group the longest is promoted.
func TestLeaveByTheLastAdminPromotesTheLongestMember(t *testing.T) {
	store := newLeaveStore(
		domain.Member{UserID: bobID, Role: domain.RoleMember},
		domain.Member{UserID: aliceID, Role: domain.RoleAdmin},
		domain.Member{UserID: carolID, Role: domain.RoleMember},
	)

	if err := leave(store, aliceID); err != nil {
		t.Fatal(err)
	}
	if store.madeAdmin != bobID {
		t.Fatalf("new admin %q, want %q", store.madeAdmin, bobID)
	}
}

func TestLeaveByTheLastMemberDeletesTheGroup(t *testing.T) {
	store := newLeaveStore(domain.Member{UserID: aliceID, Role: domain.RoleAdmin})

	if err := leave(store, aliceID); err != nil {
		t.Fatal(err)
	}
	if !store.deletedGrp {
		t.Fatal("group not deleted")
	}
}

// Each refused case changes nothing.
func TestLeaveRefusesWithoutChanges(t *testing.T) {
	tests := []struct {
		name     string
		caller   string
		hasLobby bool
		want     error
	}{
		{name: "non-member", caller: carolID, want: domain.ErrGroupNotFound},
		{name: "creator of an upcoming lobby", caller: aliceID, hasLobby: true, want: domain.ErrOwnUpcomingLobbiesExist},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLeaveStore(domain.Member{UserID: aliceID, Role: domain.RoleAdmin}, domain.Member{UserID: bobID, Role: domain.RoleMember})
			store.hasLobby = tc.hasLobby

			err := leave(store, tc.caller)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if len(store.removed) != 0 || store.madeAdmin != "" || store.deletedGrp {
				t.Fatalf("removed %v, new admin %q, group deleted %v; want nothing", store.removed, store.madeAdmin, store.deletedGrp)
			}
		})
	}
}

func TestLeaveOfAnUnknownGroupIsGroupNotFound(t *testing.T) {
	store := newLeaveStore()

	err := application.NewMemberships(store, fixedClock{at: now}).Leave(context.Background(), missingID, aliceID)

	if !errors.Is(err, domain.ErrGroupNotFound) {
		t.Fatalf("error %v, want ErrGroupNotFound", err)
	}
}
