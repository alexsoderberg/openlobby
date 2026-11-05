package transport_test

import (
	"context"
	"net/http"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// memoryMemberships serves the leave port from the memory store. It only approximates the database rules (it ignores ends_at, MakeAdmin and RemoveLeaverData change nothing); the real rules are tested in the postgres integration tests.
type memoryMemberships struct{ store *memoryGroups }

func (r memoryMemberships) WithLockedGroup(_ context.Context, groupID string, fn func(application.LeaveTx) error) error {
	r.store.calls++
	if r.store.err != nil {
		return r.store.err
	}
	if _, ok := r.store.groups[groupID]; !ok {
		return domain.ErrGroupNotFound
	}
	return fn(memoryLeaveTx{r.store})
}

type memoryLeaveTx struct{ *memoryGroups }

func (m memoryLeaveTx) HasUpcomingLobbyBy(_ context.Context, groupID, userID string, _ time.Time) (bool, error) {
	for _, lobby := range m.lobbies {
		if lobby.GroupID == groupID && lobby.CreatedByUserID == userID {
			return true, nil
		}
	}
	return false, nil
}

func (m memoryLeaveTx) RemoveLeaverData(_ context.Context, groupID, userID string, _ time.Time) error {
	m.members[groupID] = slices.DeleteFunc(m.members[groupID], func(member domain.Member) bool { return member.UserID == userID })
	return nil
}

func (m memoryLeaveTx) MakeAdmin(context.Context, string, string) error { return nil }

func (m memoryLeaveTx) DeleteGroup(_ context.Context, groupID string) error {
	delete(m.groups, groupID)
	delete(m.members, groupID)
	return nil
}

const membershipPath = "/api/groups/" + fridayID + "/membership"

func TestLeaveGroupReturns204AndRemovesTheCaller(t *testing.T) {
	store := fridayStore()

	response := call(newRouter(store, fridayDirectory()), http.MethodDelete, membershipPath, asUser(otherID), "")

	if response.Code != http.StatusNoContent || response.Body.Len() != 0 {
		t.Fatalf("status %d, body %q; want 204 and no body", response.Code, response.Body.String())
	}
	if len(store.members[fridayID]) != 1 || store.members[fridayID][0].UserID != alexID {
		t.Fatalf("members %v, want only alex", store.members[fridayID])
	}
}

func TestLeaveGroupGivesTheContractErrors(t *testing.T) {
	tests := []struct {
		name   string
		target string
		caller string
	}{
		{name: "non-member", target: membershipPath, caller: missingID},
		{name: "unknown group", target: "/api/groups/" + missingID + "/membership", caller: alexID},
		{name: "malformed group ID", target: "/api/groups/" + malformedUUIDs + "/membership", caller: alexID},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := fridayStore()

			response := call(newRouter(store, fridayDirectory()), http.MethodDelete, tc.target, asUser(tc.caller), "")

			assertErrorEnvelope(t, response, http.StatusNotFound, "group_not_found")
			if len(store.members[fridayID]) != 2 {
				t.Fatalf("members %v, want both to stay", store.members[fridayID])
			}
		})
	}
}

func TestLeaveGroupRefusesACreatorOfAnUpcomingLobbyWith409(t *testing.T) {
	store := fridayStore()
	store.lobbies = map[string]domain.Lobby{"l1": {ID: "l1", GroupID: fridayID, CreatedByUserID: otherID}}

	response := call(newRouter(store, fridayDirectory()), http.MethodDelete, membershipPath, asUser(otherID), "")

	assertErrorEnvelope(t, response, http.StatusConflict, "own_upcoming_lobbies_exist")
	if len(store.members[fridayID]) != 2 {
		t.Fatalf("members %v, want both to stay", store.members[fridayID])
	}
}

func TestLeaveGroupWithoutIdentityIs401(t *testing.T) {
	response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodDelete, membershipPath, nil, "")

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
}

func TestLeaveGroupIs503WhenTheDatabaseDoesNotAnswer(t *testing.T) {
	store := fridayStore()
	store.err = domain.ErrUnavailable

	response := call(newRouter(store, fridayDirectory()), http.MethodDelete, membershipPath, asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}
