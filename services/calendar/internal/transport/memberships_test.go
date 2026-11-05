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

// memoryMemberships serves the leave port from the memory store. It only approximates the database rules (it ignores ends_at and RemoveLeaverData); the real rules are tested in the postgres integration tests.
type memoryMemberships struct{ store *memoryGroups }

func (r memoryMemberships) WithLockedGroup(_ context.Context, groupID string, fn func(application.MembershipTx) error) error {
	r.store.calls++
	if r.store.err != nil {
		return r.store.err
	}
	if _, ok := r.store.groups[groupID]; !ok {
		return domain.ErrGroupNotFound
	}
	return fn(memoryMembershipTx{r.store})
}

type memoryMembershipTx struct{ *memoryGroups }

func (m memoryMembershipTx) HasUpcomingLobbyBy(_ context.Context, groupID, userID string, _ time.Time) (bool, error) {
	for _, lobby := range m.lobbies {
		if lobby.GroupID == groupID && lobby.CreatedByUserID == userID {
			return true, nil
		}
	}
	return false, nil
}

func (m memoryMembershipTx) RemoveLeaverData(_ context.Context, groupID, userID string, _ time.Time) error {
	m.members[groupID] = slices.DeleteFunc(m.members[groupID], func(member domain.Member) bool { return member.UserID == userID })
	return nil
}

func (m memoryMembershipTx) MakeAdmin(_ context.Context, groupID, userID string) error {
	for i := range m.members[groupID] {
		if m.members[groupID][i].UserID == userID {
			m.members[groupID][i].Role = domain.RoleAdmin
		}
	}
	return nil
}

func (m memoryMembershipTx) DeleteGroup(_ context.Context, groupID string) error {
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

const adminPath = "/api/groups/" + fridayID + "/admins/"

func TestMakeGroupAdminPromotesAMemberAndIsIdempotent(t *testing.T) {
	store := fridayStore()
	router := newRouter(store, fridayDirectory())

	for range 2 {
		response := call(router, http.MethodPut, adminPath+otherID, asUser(alexID), "")
		if response.Code != http.StatusNoContent || response.Body.Len() != 0 {
			t.Fatalf("status %d, body %q; want 204 and no body", response.Code, response.Body.String())
		}
	}
	if roleOfMember(store, otherID) != domain.RoleAdmin {
		t.Fatalf("members %v, want other to be admin", store.members[fridayID])
	}
}

func TestMakeGroupAdminGivesTheContractErrors(t *testing.T) {
	tests := []struct {
		name   string
		target string
		caller string
		status int
		code   string
	}{
		{name: "malformed user ID comes first", target: adminPath + malformedUUIDs, caller: missingID, status: http.StatusNotFound, code: "member_not_found"},
		{name: "caller is not a member", target: adminPath + otherID, caller: missingID, status: http.StatusNotFound, code: "group_not_found"},
		{name: "caller is not an admin", target: adminPath + otherID, caller: otherID, status: http.StatusForbidden, code: "not_allowed"},
		{name: "target is not a member", target: adminPath + missingID, caller: alexID, status: http.StatusNotFound, code: "member_not_found"},
		{name: "unknown group", target: "/api/groups/" + missingID + "/admins/" + otherID, caller: alexID, status: http.StatusNotFound, code: "group_not_found"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := fridayStore()

			response := call(newRouter(store, fridayDirectory()), http.MethodPut, tc.target, asUser(tc.caller), "")

			assertErrorEnvelope(t, response, tc.status, tc.code)
			if roleOfMember(store, otherID) != domain.RoleMember {
				t.Fatalf("members %v, want other to stay member", store.members[fridayID])
			}
		})
	}
}

func TestMakeGroupAdminWithoutIdentityIs401(t *testing.T) {
	response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodPut, adminPath+otherID, nil, "")

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
}

func TestMakeGroupAdminIs503WhenTheDatabaseDoesNotAnswer(t *testing.T) {
	store := fridayStore()
	store.err = domain.ErrUnavailable

	response := call(newRouter(store, fridayDirectory()), http.MethodPut, adminPath+otherID, asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func roleOfMember(store *memoryGroups, userID string) domain.Role {
	for _, member := range store.members[fridayID] {
		if member.UserID == userID {
			return member.Role
		}
	}
	return ""
}
