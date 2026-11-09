package transport_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

const (
	counterStrikeID = "ce3ff9c1-dabb-4270-b5e0-7b34de37410b"
	chessID         = "c0ffee00-0000-4000-8000-000000000001"
	gamesPath       = "/api/groups/" + fridayID + "/games"
)

func maxOf(players int) *int { return &players }

// The use case sorts the list (ADR 0010), and a missing default max is shown as null.
func TestListGroupGamesReturnsTheListInOrderWithNullMax(t *testing.T) {
	store := fridayStore()
	store.games = []domain.Game{
		{ID: counterStrikeID, Name: "Counter-Strike 2", DefaultMaxPlayers: maxOf(5)},
		{ID: chessID, Name: "Chess"},
	}

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, gamesPath, asUser(alexID), "")

	var list []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	want := []map[string]any{
		{"id": chessID, "name": "Chess", "defaultMaxPlayers": nil, "genre": nil, "gameRoles": []any{}, "modes": []any{}},
		{"id": counterStrikeID, "name": "Counter-Strike 2", "defaultMaxPlayers": float64(5), "genre": nil, "gameRoles": []any{}, "modes": []any{}},
	}
	if response.Code != http.StatusOK || !reflect.DeepEqual(list, want) {
		t.Fatalf("status %d, list %v; want 200 and %v", response.Code, list, want)
	}
}

func TestListGroupGamesIsEmptyListNotNull(t *testing.T) {
	response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodGet, gamesPath, asUser(alexID), "")

	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "[]" {
		t.Fatalf("status %d, body %q; want 200 and an empty list", response.Code, response.Body.String())
	}
}

// A non-member and an unknown group get the same 404, and the list is not read for a non-member (ADR 0004 rule 2).
func TestListGroupGamesGivesTheSame404ForNonMemberAndUnknownGroup(t *testing.T) {
	store := fridayStore()
	store.games = []domain.Game{{ID: counterStrikeID, Name: "Counter-Strike 2", DefaultMaxPlayers: maxOf(5)}}
	router := newRouter(store, fridayDirectory())

	nonMember := call(router, http.MethodGet, gamesPath, asUser(missingID), "")
	unknown := call(router, http.MethodGet, "/api/groups/"+missingID+"/games", asUser(alexID), "")

	assertErrorEnvelope(t, nonMember, http.StatusNotFound, "group_not_found")
	assertErrorEnvelope(t, unknown, http.StatusNotFound, "group_not_found")
	if !reflect.DeepEqual(errorWithoutRequestID(t, nonMember), errorWithoutRequestID(t, unknown)) {
		t.Fatalf("bodies differ: %q and %q", nonMember.Body.String(), unknown.Body.String())
	}
	if strings.Contains(nonMember.Body.String(), "Counter-Strike") {
		t.Fatalf("non-member sees the list: %q", nonMember.Body.String())
	}
}

func TestListGroupGamesGives404ForMalformedGroupIDBeforeTheUseCase(t *testing.T) {
	store := fridayStore()

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, "/api/groups/not-a-uuid/games", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusNotFound, "group_not_found")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for a malformed group ID", store.calls)
	}
}

func TestListGroupGamesRefusesMissingIdentityBeforeTheUseCase(t *testing.T) {
	store := fridayStore()

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, gamesPath, nil, "")

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
	}
}

func TestListGroupGamesAnswers503AndNoDetailOnFailure(t *testing.T) {
	unavailable := fridayStore()
	unavailable.err = domain.ErrUnavailable
	assertErrorEnvelope(t, call(newRouter(unavailable, fridayDirectory()), http.MethodGet, gamesPath, asUser(alexID), ""),
		http.StatusServiceUnavailable, "service_unavailable")

	internal := fridayStore()
	internal.err = errors.New("secret detail")
	response := call(newRouter(internal, fridayDirectory()), http.MethodGet, gamesPath, asUser(alexID), "")
	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
	if strings.Contains(response.Body.String(), "secret detail") {
		t.Fatalf("500 body leaks the error: %q", response.Body.String())
	}
}
