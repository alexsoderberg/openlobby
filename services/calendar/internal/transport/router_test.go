package transport_test

import (
	"net/http"
	"testing"
)

// Each path ID in invalid form gives the not-found code of its resource (ADR 0001 step 1): after the 401 check, before
// the body is read (a non-admin with a broken body still gets 404, not 400 or 403), and with no repository call.
func TestMalformedPathIDIsNotFoundBeforeBodyAndPermission(t *testing.T) {
	const group = "/api/groups/" + overwatchID
	tests := []struct {
		param  string
		method string
		target string
		code   string
	}{
		{param: "groupId", method: http.MethodPost, target: "/api/groups/not-a-uuid/invite-links", code: "group_not_found"},
		{param: "userId", method: http.MethodPut, target: group + "/admins/not-a-uuid", code: "member_not_found"},
		{param: "linkId", method: http.MethodDelete, target: group + "/invite-links/not-a-uuid", code: "invite_invalid"},
		{param: "lobbyId", method: http.MethodGet, target: group + "/lobbies/not-a-uuid", code: "lobby_not_found"},
		{param: "gameId", method: http.MethodPut, target: gameRoot + "/not-a-uuid", code: "game_not_found"},
	}
	for _, tc := range tests {
		t.Run(tc.param, func(t *testing.T) {
			store := gameStore()
			router := gameRouter(store)

			notFound := call(router, tc.method, tc.target, asUser(otherID), `{"name":`)
			unauthenticated := call(router, tc.method, tc.target, nil, `{"name":`)

			assertErrorEnvelope(t, notFound, http.StatusNotFound, tc.code)
			assertErrorEnvelope(t, unauthenticated, http.StatusUnauthorized, "unauthenticated")
			if store.calls != 0 {
				t.Fatalf("repository called %d times for a malformed %s", store.calls, tc.param)
			}
		})
	}
}

// A valid path ID with a broken body is the ordinary shape error (400 invalid_request).
func TestValidPathIDWithBrokenBodyIsInvalidRequest(t *testing.T) {
	response := call(gameRouter(gameStore()), http.MethodPut, gamePath, asAdminUser(alexID), `{"name":`)

	assertErrorEnvelope(t, response, http.StatusBadRequest, "invalid_request")
}
