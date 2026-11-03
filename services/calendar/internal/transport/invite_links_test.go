package transport_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	linkID        = "88888888-8888-4888-8888-888888888888"
	otherLinkID   = "99999999-9999-4999-8999-999999999999"
	expiredLinkID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	issuedToken   = "issued-token-for-tests"
	linksPath     = "/api/groups/" + fridayID + "/invite-links"
)

// fixedTokens gives the same token every time, so a test can check the response.
type fixedTokens struct{}

func (fixedTokens) NewToken() (string, error) { return issuedToken, nil }

// The memory store also serves the locked transaction and the link reads, with the same rules as the database.
func (m *memoryGroups) WithLockedGroup(_ context.Context, groupID string, fn func(tx application.GroupTx) error) error {
	m.calls++
	if m.err != nil {
		return m.err
	}
	if _, ok := m.groups[groupID]; !ok {
		return domain.ErrGroupNotFound
	}
	return fn(m)
}

func (m *memoryGroups) DeleteInactiveInviteLinks(_ context.Context, groupID string, now time.Time) error {
	var active []domain.InviteLink
	for _, link := range m.links[groupID] {
		if link.IsActive(now) {
			active = append(active, link)
		}
	}
	m.links[groupID] = active
	return nil
}

func (m *memoryGroups) InsertInviteLink(_ context.Context, link domain.InviteLink) (domain.InviteLink, error) {
	m.calls++
	link.ID = linkID
	m.links[link.GroupID] = append(m.links[link.GroupID], link)
	return link, nil
}

func (m *memoryGroups) AllLinks(_ context.Context, groupID string) ([]domain.InviteLink, error) {
	m.calls++
	return append([]domain.InviteLink(nil), m.links[groupID]...), m.err
}

func (m *memoryGroups) LinksCreatedBy(_ context.Context, groupID, userID string) ([]domain.InviteLink, error) {
	m.calls++
	var own []domain.InviteLink
	for _, link := range m.links[groupID] {
		if link.CreatedByUserID == userID {
			own = append(own, link)
		}
	}
	return own, m.err
}

// inviteLinkJSON is the response shape of an invite link (api/calendar/openapi.yaml).
type inviteLinkJSON struct {
	ID              string `json:"id"`
	Token           string `json:"token"`
	CreatedByUserID string `json:"createdByUserId"`
	ExpiresAt       string `json:"expiresAt"`
	UseCount        int    `json:"useCount"`
	MaxUses         int    `json:"maxUses"`
}

// liveLinksOfFriday has one active link of Alex, one of Other, and one expired link of Alex.
func liveLinksOfFriday() *memoryGroups {
	store := fridayStore()
	store.links = map[string][]domain.InviteLink{fridayID: {
		{ID: linkID, GroupID: fridayID, Token: "alex-live", CreatedByUserID: alexID, ExpiresAt: clockNow.Add(time.Hour), MaxUses: 10},
		{ID: otherLinkID, GroupID: fridayID, Token: "other-live", CreatedByUserID: otherID, ExpiresAt: clockNow.Add(time.Hour), MaxUses: 10},
		{ID: expiredLinkID, GroupID: fridayID, Token: "alex-expired", CreatedByUserID: alexID, ExpiresAt: clockNow, MaxUses: 10},
	}}
	return store
}

func decodeLinks(t *testing.T, response *httptest.ResponseRecorder) []inviteLinkJSON {
	t.Helper()
	var links []inviteLinkJSON
	if err := json.Unmarshal(response.Body.Bytes(), &links); err != nil {
		t.Fatalf("body %q is not a list of links: %v", response.Body.String(), err)
	}
	return links
}

func TestCreateInviteLinkReturns201WithTokenAndNoStore(t *testing.T) {
	store := fridayStore()
	response := call(newRouter(store, fridayDirectory()), http.MethodPost, linksPath, asUser(alexID), "")

	if response.Code != http.StatusCreated {
		t.Fatalf("status %d, want 201; body %q", response.Code, response.Body.String())
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("create response is not no-store")
	}
	var link inviteLinkJSON
	if err := json.Unmarshal(response.Body.Bytes(), &link); err != nil {
		t.Fatal(err)
	}
	want := inviteLinkJSON{ID: linkID, Token: issuedToken, CreatedByUserID: alexID, ExpiresAt: clockNow.Add(2 * time.Hour).Format(time.RFC3339), MaxUses: 10}
	if link != want {
		t.Fatalf("link %+v, want %+v", link, want)
	}
}

func TestCreateInviteLinkTakesMaxUsesOrDefault(t *testing.T) {
	tests := []struct {
		name string
		body string
		want int
	}{
		{name: "empty body gives the default", body: "", want: 10},
		{name: "empty object gives the default", body: `{}`, want: 10},
		{name: "null gives the default", body: `{"maxUses":null}`, want: 10},
		{name: "chosen value is kept", body: `{"maxUses":3}`, want: 3},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodPost, linksPath, asUser(alexID), tc.body)

			var link inviteLinkJSON
			if err := json.Unmarshal(response.Body.Bytes(), &link); err != nil || response.Code != http.StatusCreated {
				t.Fatalf("status %d, body %q, error %v", response.Code, response.Body.String(), err)
			}
			if link.MaxUses != tc.want || link.UseCount != 0 {
				t.Fatalf("max uses %d and use count %d, want %d and 0", link.MaxUses, link.UseCount, tc.want)
			}
		})
	}
}

func TestCreateInviteLinkRefusesBadBodyWithItsCode(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		wantCode string
	}{
		{name: "above limit", body: `{"maxUses":11}`, wantCode: "invalid_max_uses"},
		{name: "zero", body: `{"maxUses":0}`, wantCode: "invalid_max_uses"},
		{name: "text", body: `{"maxUses":"5"}`, wantCode: "invalid_request"},
		{name: "decimal", body: `{"maxUses":5.5}`, wantCode: "invalid_request"},
		{name: "not JSON", body: `not json`, wantCode: "invalid_request"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := fridayStore()
			response := call(newRouter(store, fridayDirectory()), http.MethodPost, linksPath, asUser(alexID), tc.body)

			assertErrorEnvelope(t, response, http.StatusBadRequest, tc.wantCode)
			if len(store.links[fridayID]) != 0 {
				t.Fatal("a refused request saved a link")
			}
		})
	}
}

// The order of the checks: the shape of the body first, then membership, then the max uses (contract, ADR 0007).
func TestCreateInviteLinkChecksShapeThenMembershipThenMaxUses(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{name: "malformed body before membership", body: `not json`, wantStatus: http.StatusBadRequest, wantCode: "invalid_request"},
		{name: "membership before max uses", body: `{"maxUses":11}`, wantStatus: http.StatusNotFound, wantCode: "group_not_found"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodPost, linksPath, asUser(missingID), tc.body)

			assertErrorEnvelope(t, response, tc.wantStatus, tc.wantCode)
		})
	}
}

func TestCreateInviteLinkGives404ForUnknownOrMalformedGroup(t *testing.T) {
	tests := []struct {
		name   string
		target string
		caller string
	}{
		{name: "malformed group ID", target: "/api/groups/not-a-uuid/invite-links", caller: alexID},
		{name: "unknown group", target: "/api/groups/" + missingID + "/invite-links", caller: alexID},
		{name: "non-member of the group", target: linksPath, caller: missingID},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodPost, tc.target, asUser(tc.caller), `{}`)

			assertErrorEnvelope(t, response, http.StatusNotFound, "group_not_found")
		})
	}
}

func TestCreateInviteLinkAnswers503AndNoDetailOnFailure(t *testing.T) {
	unavailable := fridayStore()
	unavailable.err = domain.ErrUnavailable
	internal := fridayStore()
	internal.err = errors.New("secret detail")

	first := call(newRouter(unavailable, fridayDirectory()), http.MethodPost, linksPath, asUser(alexID), "")
	second := call(newRouter(internal, fridayDirectory()), http.MethodPost, linksPath, asUser(alexID), "")

	assertErrorEnvelope(t, first, http.StatusServiceUnavailable, "service_unavailable")
	assertErrorEnvelope(t, second, http.StatusInternalServerError, "internal_error")
	if strings.Contains(second.Body.String(), "secret detail") {
		t.Fatal("internal error leaked its detail")
	}
}

// A member sees their own active links; an admin sees all active links of the group (ADR 0007).
func TestListInviteLinksShowsMemberOwnAndAdminAllActiveLinks(t *testing.T) {
	tests := []struct {
		name   string
		caller string
		want   []string
	}{
		{name: "member sees own active link", caller: otherID, want: []string{"other-live"}},
		{name: "admin sees all active links", caller: alexID, want: []string{"alex-live", "other-live"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(liveLinksOfFriday(), fridayDirectory()), http.MethodGet, linksPath, asUser(tc.caller), "")

			if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" {
				t.Fatalf("status %d, Cache-Control %q; want 200 and no-store", response.Code, response.Header().Get("Cache-Control"))
			}
			links := decodeLinks(t, response)
			if len(links) != len(tc.want) {
				t.Fatalf("%d links, want %d", len(links), len(tc.want))
			}
			for i, link := range links {
				if link.Token != tc.want[i] {
					t.Fatalf("link %d token %q, want %q", i, link.Token, tc.want[i])
				}
			}
		})
	}
}

func TestListInviteLinksGivesEmptyListAndRefusesNonMember(t *testing.T) {
	empty := call(newRouter(fridayStore(), fridayDirectory()), http.MethodGet, linksPath, asUser(alexID), "")
	if empty.Code != http.StatusOK || empty.Body.String() != "[]\n" {
		t.Fatalf("status %d, body %q; want 200 and an empty list", empty.Code, empty.Body.String())
	}
	refused := call(newRouter(liveLinksOfFriday(), fridayDirectory()), http.MethodGet, linksPath, asUser(missingID), "")
	assertErrorEnvelope(t, refused, http.StatusNotFound, "group_not_found")
}

func TestListInviteLinksAnswers503WhenDatabaseDown(t *testing.T) {
	store := liveLinksOfFriday()
	store.err = domain.ErrUnavailable

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, linksPath, asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestListInviteLinksGives404ForUnknownOrMalformedGroup(t *testing.T) {
	tests := []struct {
		name   string
		target string
	}{
		{name: "malformed group ID", target: "/api/groups/not-a-uuid/invite-links"},
		{name: "unknown group", target: "/api/groups/" + missingID + "/invite-links"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(liveLinksOfFriday(), fridayDirectory()), http.MethodGet, tc.target, asUser(alexID), "")

			assertErrorEnvelope(t, response, http.StatusNotFound, "group_not_found")
		})
	}
}

func TestListInviteLinksAnswers500WithoutDetail(t *testing.T) {
	store := liveLinksOfFriday()
	store.err = errors.New("secret detail")

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, linksPath, asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
	if strings.Contains(response.Body.String(), "secret detail") {
		t.Fatal("internal error leaked its detail")
	}
}
