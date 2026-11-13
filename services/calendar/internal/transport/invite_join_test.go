package transport_test

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// FindLinkByToken is the unlocked lookup. Like the database's join with groups, a link whose group is gone is not found.
func (m *memoryGroups) FindLinkByToken(_ context.Context, token string) (application.LinkLookup, bool, error) {
	m.calls++
	for groupID, links := range m.links {
		group, ok := m.groups[groupID]
		if !ok {
			continue
		}
		for _, link := range links {
			if link.Token == token {
				return application.LinkLookup{Link: link, Group: group}, true, m.err
			}
		}
	}
	return application.LinkLookup{}, false, m.err
}

func (m *memoryGroups) LinkByID(_ context.Context, groupID, linkID string) (domain.InviteLink, bool, error) {
	m.calls++
	for _, link := range m.links[groupID] {
		if link.ID == linkID {
			return link, true, m.err
		}
	}
	return domain.InviteLink{}, false, m.err
}

func (m *memoryGroups) AddMember(_ context.Context, groupID, userID string, _ time.Time) error {
	m.calls++
	m.members[groupID] = append(m.members[groupID], domain.Member{UserID: userID, Role: domain.RoleMember})
	return m.err
}

func (m *memoryGroups) IncrementUse(_ context.Context, groupID, linkID string) error {
	m.calls++
	for i := range m.links[groupID] {
		if m.links[groupID][i].ID == linkID {
			m.links[groupID][i].UseCount++
		}
	}
	return m.err
}

// inviteCase is an input that must give the same 404 as every other invalid input (ADR 0007).
type inviteCase struct {
	name  string
	token string
	store *memoryGroups
}

// invalidInviteCases are an unknown and a malformed token, an expired, used up and revoked link, and a link whose group
// is gone. Every one must give the same answer.
func invalidInviteCases() []inviteCase {
	used := liveLinksOfFriday()
	used.links[fridayID][0].UseCount = 10
	revoked := liveLinksOfFriday()
	revoked.links[fridayID] = nil
	gone := liveLinksOfFriday()
	delete(gone.groups, fridayID)
	return []inviteCase{
		{name: "unknown token", token: "no-such-token", store: liveLinksOfFriday()},
		{name: "malformed token", token: "bad.token", store: liveLinksOfFriday()},
		{name: "invalid UTF-8 token", token: "bad%FFtoken", store: liveLinksOfFriday()},
		{name: "expired", token: "alex-expired", store: liveLinksOfFriday()},
		{name: "used up", token: "alex-live", store: used},
		{name: "revoked", token: "alex-live", store: revoked},
		{name: "group gone", token: "alex-live", store: gone},
	}
}

func TestGetInviteReturns200WithGroupAndMembershipAndNoStore(t *testing.T) {
	tests := []struct {
		name       string
		caller     string
		wantMember bool
	}{
		{name: "member", caller: otherID, wantMember: true},
		{name: "non-member", caller: missingID, wantMember: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(liveLinksOfFriday(), fridayDirectory()), http.MethodGet, "/api/invites/alex-live", asUser(tc.caller), "")

			var info map[string]any
			if err := json.Unmarshal(response.Body.Bytes(), &info); err != nil {
				t.Fatalf("decode %q: %v", response.Body.String(), err)
			}
			want := map[string]any{"groupId": fridayID, "groupName": "Friday", "isMember": tc.wantMember}
			if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" || !reflect.DeepEqual(info, want) {
				t.Fatalf("status %d, cache %q, body %q; want 200, no-store and %v", response.Code, response.Header().Get("Cache-Control"), response.Body.String(), want)
			}
		})
	}
}

func TestGetInviteGivesTheSame404ForEveryInvalidCase(t *testing.T) {
	for _, tc := range invalidInviteCases() {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(tc.store, fridayDirectory()), http.MethodGet, "/api/invites/"+tc.token, asUser(alexID), "")

			assertErrorEnvelope(t, response, http.StatusNotFound, "invite_invalid")
		})
	}
}

func TestGetInviteRefusesMissingIdentityBeforeTheLookup(t *testing.T) {
	store := liveLinksOfFriday()

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, "/api/invites/alex-live", nil, "")

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
	}
}

func TestGetInviteAnswers503WhenDatabaseDown(t *testing.T) {
	response := call(newRouter(&memoryGroups{err: domain.ErrUnavailable}, &fakeDirectory{}), http.MethodGet, "/api/invites/alex-live", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestJoinInviteReturns200WithGroupAndAddsMemberAndCountsOneUse(t *testing.T) {
	store := liveLinksOfFriday()

	response := call(newRouter(store, fridayDirectory()), http.MethodPost, "/api/invites/alex-live/join", asUser(missingID), "")

	var summary map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &summary); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	if response.Code != http.StatusOK || !reflect.DeepEqual(summary, map[string]string{"id": fridayID, "name": "Friday"}) {
		t.Fatalf("status %d, body %q; want 200 with the GroupSummary", response.Code, response.Body.String())
	}
	members := store.members[fridayID]
	if len(members) != 3 || !reflect.DeepEqual(members[2], domain.Member{UserID: missingID, Role: domain.RoleMember}) {
		t.Fatalf("members %v, want the caller added as member", members)
	}
	if store.links[fridayID][0].UseCount != 1 {
		t.Fatalf("use count %d, want 1", store.links[fridayID][0].UseCount)
	}
}

// A member who opens the link again gets the same 200, but nothing is written and no use is counted (ADR 0007).
func TestJoinInviteByMemberChangesNothing(t *testing.T) {
	store := liveLinksOfFriday()

	response := call(newRouter(store, fridayDirectory()), http.MethodPost, "/api/invites/alex-live/join", asUser(otherID), "")

	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body %q", response.Code, response.Body.String())
	}
	if len(store.members[fridayID]) != 2 || store.links[fridayID][0].UseCount != 0 {
		t.Fatalf("members %d and use count %d, want nothing changed", len(store.members[fridayID]), store.links[fridayID][0].UseCount)
	}
}

func TestJoinInviteGivesTheSame404ForEveryInvalidCase(t *testing.T) {
	for _, tc := range invalidInviteCases() {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(tc.store, fridayDirectory()), http.MethodPost, "/api/invites/"+tc.token+"/join", asUser(missingID), "")

			assertErrorEnvelope(t, response, http.StatusNotFound, "invite_invalid")
			if len(tc.store.members[fridayID]) != 2 {
				t.Fatalf("%d members after a refused join, want 2", len(tc.store.members[fridayID]))
			}
		})
	}
}

func TestJoinInviteRefusesMissingIdentityBeforeTheJoin(t *testing.T) {
	store := liveLinksOfFriday()

	response := call(newRouter(store, fridayDirectory()), http.MethodPost, "/api/invites/alex-live/join", nil, "")

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
	}
}

func TestJoinInviteAnswers503WhenDatabaseDown(t *testing.T) {
	response := call(newRouter(&memoryGroups{err: domain.ErrUnavailable}, &fakeDirectory{}), http.MethodPost, "/api/invites/alex-live/join", asUser(missingID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}
