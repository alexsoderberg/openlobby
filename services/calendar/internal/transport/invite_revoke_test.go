package transport_test

import (
	"context"
	"net/http"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/domain"
)

const (
	sundayID       = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
	sundayLinkID   = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	malformedUUIDs = "not-a-uuid"
)

// DeleteInviteLink removes the link from its group, as the database's DELETE does (ADR 0006 rule 12).
func (m *memoryGroups) DeleteInviteLink(_ context.Context, groupID, linkID string) error {
	m.calls++
	m.links[groupID] = slices.DeleteFunc(m.links[groupID], func(link domain.InviteLink) bool { return link.ID == linkID })
	return m.err
}

func revokeTarget(linkID string) string { return linksPath + "/" + linkID }

func TestRevokeInviteLinkReturns204AndDeletesLink(t *testing.T) {
	tests := []struct {
		name   string
		caller string
	}{
		{name: "admin revokes another member's link", caller: alexID},
		{name: "creator revokes own link", caller: otherID},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := liveLinksOfFriday()

			response := call(newRouter(store, fridayDirectory()), http.MethodDelete, revokeTarget(otherLinkID), asUser(tc.caller), "")

			if response.Code != http.StatusNoContent {
				t.Fatalf("status %d, want 204; body %q", response.Code, response.Body.String())
			}
			if links := store.links[fridayID]; len(links) != 2 || slices.ContainsFunc(links, func(l domain.InviteLink) bool { return l.ID == otherLinkID }) {
				t.Fatalf("links after revoke %v, want only the other two", links)
			}
		})
	}
}

// A member who is neither the creator nor an admin is refused and no link changes (ADR 0007, REQ-0007).
func TestRevokeInviteLinkRefusesOtherMemberWith403(t *testing.T) {
	store := liveLinksOfFriday()

	response := call(newRouter(store, fridayDirectory()), http.MethodDelete, revokeTarget(linkID), asUser(otherID), "")

	assertErrorEnvelope(t, response, http.StatusForbidden, "not_allowed")
	if len(store.links[fridayID]) != 3 {
		t.Fatalf("%d links after a refused revoke, want 3", len(store.links[fridayID]))
	}
}

func TestRevokeInviteLinkGivesTheContractErrors(t *testing.T) {
	tests := []struct {
		name     string
		target   string
		caller   string
		wantCode string
	}{
		{name: "non-member", target: revokeTarget(linkID), caller: missingID, wantCode: "group_not_found"},
		{name: "malformed group ID", target: "/api/groups/" + malformedUUIDs + "/invite-links/" + linkID, caller: alexID, wantCode: "group_not_found"},
		{name: "malformed group ID and link ID gives the group first", target: "/api/groups/" + malformedUUIDs + "/invite-links/" + malformedUUIDs, caller: alexID, wantCode: "group_not_found"},
		{name: "unknown group", target: "/api/groups/" + missingID + "/invite-links/" + linkID, caller: alexID, wantCode: "group_not_found"},
		{name: "malformed link ID", target: revokeTarget(malformedUUIDs), caller: alexID, wantCode: "invite_invalid"},
		{name: "unknown link", target: revokeTarget(missingID), caller: alexID, wantCode: "invite_invalid"},
		{name: "expired link", target: revokeTarget(expiredLinkID), caller: alexID, wantCode: "invite_invalid"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(liveLinksOfFriday(), fridayDirectory()), http.MethodDelete, tc.target, asUser(tc.caller), "")

			assertErrorEnvelope(t, response, http.StatusNotFound, tc.wantCode)
		})
	}
}

// A link of another group is the same 404 as a missing one, even for an admin of the path's group (ADR 0006 rule 12).
func TestRevokeInviteLinkIgnoresLinkOfAnotherGroup(t *testing.T) {
	store := liveLinksOfFriday()
	store.groups[sundayID] = domain.Group{ID: sundayID, Name: "Sunday"}
	store.members[sundayID] = []domain.Member{{UserID: alexID, Role: domain.RoleAdmin}}
	store.links[sundayID] = []domain.InviteLink{{ID: sundayLinkID, GroupID: sundayID, Token: "sunday", CreatedByUserID: alexID, ExpiresAt: clockNow.Add(time.Hour), MaxUses: 10}}

	response := call(newRouter(store, fridayDirectory()), http.MethodDelete, revokeTarget(sundayLinkID), asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusNotFound, "invite_invalid")
	if len(store.links[sundayID]) != 1 {
		t.Fatal("link of another group was deleted")
	}
}

func TestRevokeInviteLinkAnswers503WhenDatabaseDown(t *testing.T) {
	store := liveLinksOfFriday()
	store.err = domain.ErrUnavailable

	response := call(newRouter(store, fridayDirectory()), http.MethodDelete, revokeTarget(linkID), asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}
