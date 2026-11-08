package transport_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

const (
	overwatchID   = "7e9a4d35-1616-4f25-9828-fc6e2383b07b"
	createdGameID = "9a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
	gameRoot      = "/api/games"
	gamePath      = gameRoot + "/" + overwatchID
	// adminHeader is the gateway's flag for a system admin (ADR 0011).
	adminHeader = "X-User-System-Admin"
)

// memoryEditor writes the game list of memoryGroups with the rules of the adapter: a name is taken when another game has
// it ignoring case, and an unknown ID is not found. It is separate from memoryGroups, which already has a Create for groups.
type memoryEditor struct{ store *memoryGroups }

func (e memoryEditor) Create(_ context.Context, game domain.Game) (domain.Game, error) {
	e.store.calls++
	if e.store.err != nil {
		return domain.Game{}, e.store.err
	}
	if e.store.gameNameTaken(game.Name, "") {
		return domain.Game{}, application.ErrGameTaken
	}
	game.ID = createdGameID
	e.store.games = append(e.store.games, game)
	return game, nil
}

func (e memoryEditor) Replace(_ context.Context, game domain.Game) error {
	e.store.calls++
	index := e.store.gameIndex(game.ID)
	switch {
	case e.store.err != nil:
		return e.store.err
	case index < 0:
		return application.ErrGameNotFound
	case e.store.gameNameTaken(game.Name, game.ID):
		return application.ErrGameTaken
	}
	e.store.games[index] = game
	return nil
}

func (e memoryEditor) Delete(_ context.Context, id string) error {
	e.store.calls++
	index := e.store.gameIndex(id)
	switch {
	case e.store.err != nil:
		return e.store.err
	case index < 0:
		return application.ErrGameNotFound
	}
	e.store.games = append(e.store.games[:index], e.store.games[index+1:]...)
	return nil
}

func (m *memoryGroups) List(_ context.Context) ([]domain.Game, error) {
	m.calls++
	return append([]domain.Game(nil), m.games...), m.err
}

func (m *memoryGroups) gameIndex(id string) int {
	for i, game := range m.games {
		if game.ID == id {
			return i
		}
	}
	return -1
}

func (m *memoryGroups) gameNameTaken(name, exceptID string) bool {
	for _, game := range m.games {
		if game.ID != exceptID && strings.EqualFold(game.Name, name) {
			return true
		}
	}
	return false
}

// gameStore is a game list with two games and no groups, as the admin endpoints need it.
func gameStore() *memoryGroups {
	return &memoryGroups{games: []domain.Game{
		{ID: counterStrikeID, Name: "Counter-Strike 2", DefaultMaxPlayers: maxOf(5)},
		{ID: overwatchID, Name: "Overwatch", DefaultMaxPlayers: maxOf(5)},
	}}
}

func gameRouter(store *memoryGroups) http.Handler {
	return newRouter(store, &fakeDirectory{})
}

func asAdminUser(userID string) map[string]string {
	headers := asUser(userID)
	headers[adminHeader] = "true"
	return headers
}

// The list goes to a system admin, with a missing default max shown as null, in the order the use case gives.
func TestListGamesReturnsWholeListToSystemAdmin(t *testing.T) {
	store := gameStore()
	store.games = append(store.games, domain.Game{ID: chessID, Name: "Chess"})

	response := call(gameRouter(store), http.MethodGet, gameRoot, asAdminUser(alexID), "")

	var list []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	want := []map[string]any{
		{"id": counterStrikeID, "name": "Counter-Strike 2", "defaultMaxPlayers": float64(5), "genre": nil},
		{"id": overwatchID, "name": "Overwatch", "defaultMaxPlayers": float64(5), "genre": nil},
		{"id": chessID, "name": "Chess", "defaultMaxPlayers": nil, "genre": nil},
	}
	if response.Code != http.StatusOK || !reflect.DeepEqual(list, want) {
		t.Fatalf("status %d, list %v; want 200 and %v", response.Code, list, want)
	}
}

// Only the exact value "true" is a system admin (ADR 0011). Anything else, and no header, is refused before the list is read.
func TestListGamesRefusesNonAdminWithoutReadingTheList(t *testing.T) {
	for _, value := range []string{"", "false", "True", "1", "yes"} {
		t.Run("header "+value, func(t *testing.T) {
			store := gameStore()
			headers := asUser(alexID)
			if value != "" {
				headers[adminHeader] = value
			}

			response := call(gameRouter(store), http.MethodGet, gameRoot, headers, "")

			assertErrorEnvelope(t, response, http.StatusForbidden, "not_allowed")
			if store.calls != 0 {
				t.Fatalf("game list read %d times for a non-admin", store.calls)
			}
		})
	}
}

func TestGameEndpointsRefuseMissingIdentityBeforeTheUseCase(t *testing.T) {
	tests := []struct{ method, path string }{
		{http.MethodGet, gameRoot},
		{http.MethodPost, gameRoot},
		{http.MethodPut, gamePath},
		{http.MethodDelete, gamePath},
	}
	for _, tc := range tests {
		t.Run(tc.method, func(t *testing.T) {
			store := gameStore()

			response := call(gameRouter(store), tc.method, tc.path, nil, `{"name":"Chess"}`)

			assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
			if store.calls != 0 {
				t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
			}
		})
	}
}

// A database that does not answer gives 503, and any other error gives 500 without details (ADR 0001).
func TestGameEndpointsAnswer503AndNoDetailOnFailure(t *testing.T) {
	calls := map[string]struct{ method, path, body string }{
		"list":    {http.MethodGet, gameRoot, ""},
		"create":  {http.MethodPost, gameRoot, `{"name":"Chess"}`},
		"replace": {http.MethodPut, gamePath, `{"name":"Chess"}`},
		"delete":  {http.MethodDelete, gamePath, ""},
	}
	for name, tc := range calls {
		t.Run(name, func(t *testing.T) {
			unavailable := gameStore()
			unavailable.err = domain.ErrUnavailable
			assertErrorEnvelope(t, call(gameRouter(unavailable), tc.method, tc.path, asAdminUser(alexID), tc.body),
				http.StatusServiceUnavailable, "service_unavailable")

			internal := gameStore()
			internal.err = errors.New("secret detail")
			response := call(gameRouter(internal), tc.method, tc.path, asAdminUser(alexID), tc.body)
			assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
			if strings.Contains(response.Body.String(), "secret detail") {
				t.Fatalf("500 body leaks the error: %q", response.Body.String())
			}
		})
	}
}

func TestCreateGameAddsGameWithGeneratedIDForSystemAdmin(t *testing.T) {
	store := gameStore()

	response := call(gameRouter(store), http.MethodPost, gameRoot, asAdminUser(alexID), `{"name":"  Chess  ","defaultMaxPlayers":2}`)

	want := map[string]any{"id": createdGameID, "name": "Chess", "defaultMaxPlayers": float64(2), "genre": nil}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	if response.Code != http.StatusCreated || !reflect.DeepEqual(body, want) {
		t.Fatalf("status %d, body %v; want 201 and %v", response.Code, body, want)
	}
	if len(store.games) != 3 {
		t.Fatalf("%d games after create, want 3", len(store.games))
	}
}

func TestCreateGameWithoutDefaultMaxIsNull(t *testing.T) {
	for _, body := range []string{`{"name":"Chess"}`, `{"name":"Chess","defaultMaxPlayers":null}`} {
		response := call(gameRouter(gameStore()), http.MethodPost, gameRoot, asAdminUser(alexID), body)

		if response.Code != http.StatusCreated || !strings.Contains(response.Body.String(), `"defaultMaxPlayers":null`) {
			t.Fatalf("body %s: status %d, response %q; want 201 with null max", body, response.Code, response.Body.String())
		}
	}
}

// The name and default max are checked before any write, so an invalid input saves nothing (ADR 0010).
func TestCreateAndReplaceRefuseInvalidInputAndSaveNothing(t *testing.T) {
	long := strings.Repeat("x", 51)
	tests := []struct {
		name string
		body string
		code string
	}{
		{name: "name omitted", body: `{"defaultMaxPlayers":5}`, code: "invalid_game"},
		{name: "name null", body: `{"name":null}`, code: "invalid_game"},
		{name: "empty name", body: `{"name":""}`, code: "invalid_game"},
		{name: "only spaces", body: `{"name":"   "}`, code: "invalid_game"},
		{name: "fifty-one characters", body: `{"name":"` + long + `"}`, code: "invalid_game"},
		{name: "reserved name", body: `{"name":"Other"}`, code: "invalid_game"},
		{name: "reserved name in other case with spaces", body: `{"name":"  oTHER "}`, code: "invalid_game"},
		{name: "max zero", body: `{"name":"Chess","defaultMaxPlayers":0}`, code: "invalid_capacity"},
		{name: "max negative", body: `{"name":"Chess","defaultMaxPlayers":-3}`, code: "invalid_capacity"},
		{name: "max above int4", body: `{"name":"Chess","defaultMaxPlayers":2147483648}`, code: "invalid_capacity"},
		{name: "max far above int4", body: `{"name":"Chess","defaultMaxPlayers":3000000000}`, code: "invalid_capacity"},
		{name: "max beyond int64", body: `{"name":"Chess","defaultMaxPlayers":99999999999999999999}`, code: "invalid_request"},
		{name: "max not an integer", body: `{"name":"Chess","defaultMaxPlayers":2.5}`, code: "invalid_request"},
		{name: "max is text", body: `{"name":"Chess","defaultMaxPlayers":"five"}`, code: "invalid_request"},
		{name: "invalid JSON", body: `{"name":`, code: "invalid_request"},
		{name: "empty body", body: ``, code: "invalid_request"},
	}
	for _, tc := range tests {
		t.Run("create "+tc.name, func(t *testing.T) {
			store := gameStore()

			response := call(gameRouter(store), http.MethodPost, gameRoot, asAdminUser(alexID), tc.body)

			assertErrorEnvelope(t, response, http.StatusBadRequest, tc.code)
			if len(store.games) != 2 {
				t.Fatalf("%d games after refused create, want 2", len(store.games))
			}
		})
		t.Run("replace "+tc.name, func(t *testing.T) {
			store := gameStore()

			response := call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), tc.body)

			assertErrorEnvelope(t, response, http.StatusBadRequest, tc.code)
			if store.games[1].Name != "Overwatch" {
				t.Fatalf("game renamed by a refused replace: %+v", store.games[1])
			}
		})
	}
}

// A duplicate name ignoring case gives 409 and saves nothing (ADR 0010).
func TestCreateGameGives409ForTakenName(t *testing.T) {
	store := gameStore()

	response := call(gameRouter(store), http.MethodPost, gameRoot, asAdminUser(alexID), `{"name":"OVERWATCH"}`)

	assertErrorEnvelope(t, response, http.StatusConflict, "game_taken")
	if len(store.games) != 2 {
		t.Fatalf("%d games after refused create, want 2", len(store.games))
	}
}

// The shape of the body is checked before the permission, so a non-admin with broken JSON gets 400, and a non-admin
// with a valid body gets 403 and nothing is written (ADR 0001 order of checks).
func TestCreateGameChecksShapeBeforePermission(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{name: "broken JSON", body: `{"name":`, wantStatus: http.StatusBadRequest, wantCode: "invalid_request"},
		{name: "wrong type", body: `{"name":5}`, wantStatus: http.StatusBadRequest, wantCode: "invalid_request"},
		{name: "valid body", body: `{"name":"Chess"}`, wantStatus: http.StatusForbidden, wantCode: "not_allowed"},
		{name: "invalid name still gives permission first", body: `{"name":""}`, wantStatus: http.StatusForbidden, wantCode: "not_allowed"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := gameStore()

			response := call(gameRouter(store), http.MethodPost, gameRoot, asUser(otherID), tc.body)

			assertErrorEnvelope(t, response, tc.wantStatus, tc.wantCode)
			if len(store.games) != 2 || store.calls != 0 {
				t.Fatalf("game list changed or written by a non-admin: %d games, %d calls", len(store.games), store.calls)
			}
		})
	}
}

// PUT replaces the game and keeps its ID. A game may keep its own name in another case (ADR 0010).
func TestReplaceGameReplacesNameAndMaxAndKeepsID(t *testing.T) {
	store := gameStore()

	response := call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), `{"name":"overwatch","defaultMaxPlayers":6}`)

	want := map[string]any{"id": overwatchID, "name": "overwatch", "defaultMaxPlayers": float64(6), "genre": nil}
	var body map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	if response.Code != http.StatusOK || !reflect.DeepEqual(body, want) {
		t.Fatalf("status %d, body %v; want 200 and %v", response.Code, body, want)
	}
}

// An omitted or null max on PUT means unlimited, because PUT replaces the whole game.
func TestReplaceGameOmittedMaxMeansUnlimited(t *testing.T) {
	response := call(gameRouter(gameStore()), http.MethodPut, gamePath, asAdminUser(alexID), `{"name":"Overwatch"}`)

	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"defaultMaxPlayers":null`) {
		t.Fatalf("status %d, body %q; want 200 with null max", response.Code, response.Body.String())
	}
}

func TestReplaceGameGives409ForNameOfAnotherGame(t *testing.T) {
	store := gameStore()

	response := call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), `{"name":"counter-strike 2"}`)

	assertErrorEnvelope(t, response, http.StatusConflict, "game_taken")
}

// "Other" on an unknown ID gives 400, because the name is checked before the game is looked up (ADR 0001).
func TestReplaceGameChecksNameBeforeExistence(t *testing.T) {
	response := call(gameRouter(gameStore()), http.MethodPut, gameRoot+"/"+missingID, asAdminUser(alexID), `{"name":"Other"}`)

	assertErrorEnvelope(t, response, http.StatusBadRequest, "invalid_game")
}

func TestReplaceGameGives404ForUnknownGame(t *testing.T) {
	response := call(gameRouter(gameStore()), http.MethodPut, gameRoot+"/"+missingID, asAdminUser(alexID), `{"name":"Chess"}`)

	assertErrorEnvelope(t, response, http.StatusNotFound, "game_not_found")
}

// Path IDs that are not canonical uuids give 404 before anything else, for a non-admin too (ADR 0001 step 1).
func TestGamePathWithMalformedIDIsNotFoundForEveryCaller(t *testing.T) {
	for _, id := range []string{"not-a-uuid", strings.ToUpper(overwatchID)} {
		store := gameStore()
		router := gameRouter(store)

		put := call(router, http.MethodPut, gameRoot+"/"+id, asUser(otherID), `{"name":5}`)
		deleted := call(router, http.MethodDelete, gameRoot+"/"+id, asUser(otherID), "")
		adminPut := call(router, http.MethodPut, gameRoot+"/"+id, asAdminUser(alexID), `{"name":"Chess"}`)

		assertErrorEnvelope(t, put, http.StatusNotFound, "game_not_found")
		assertErrorEnvelope(t, deleted, http.StatusNotFound, "game_not_found")
		assertErrorEnvelope(t, adminPut, http.StatusNotFound, "game_not_found")
		if store.calls != 0 {
			t.Fatalf("repository called %d times for a malformed game ID", store.calls)
		}
	}
}

// A non-admin is refused with 403 and the game is unchanged (REQ-0010).
func TestReplaceGameRefusesNonAdminAndChangesNothing(t *testing.T) {
	store := gameStore()

	response := call(gameRouter(store), http.MethodPut, gamePath, asUser(alexID), `{"name":"Chess"}`)

	assertErrorEnvelope(t, response, http.StatusForbidden, "not_allowed")
	if store.games[1].Name != "Overwatch" || store.calls != 0 {
		t.Fatalf("game changed by a non-admin: %+v", store.games[1])
	}
}

// A non-admin with broken JSON gets 400, because the shape comes before the permission (ADR 0001).
func TestReplaceGameChecksShapeBeforePermission(t *testing.T) {
	response := call(gameRouter(gameStore()), http.MethodPut, gamePath, asUser(alexID), `{"name":`)

	assertErrorEnvelope(t, response, http.StatusBadRequest, "invalid_request")
}

func TestDeleteGameRemovesGameForSystemAdmin(t *testing.T) {
	store := gameStore()

	response := call(gameRouter(store), http.MethodDelete, gamePath, asAdminUser(alexID), "")

	if response.Code != http.StatusNoContent || len(store.games) != 1 || store.games[0].ID != counterStrikeID {
		t.Fatalf("status %d, games %+v; want 204 and Overwatch removed", response.Code, store.games)
	}
}

// Permission comes before existence: a non-admin gets 403 for an unknown game too, so the list is not revealed.
func TestDeleteGameRefusesNonAdminEvenForUnknownGame(t *testing.T) {
	store := gameStore()
	router := gameRouter(store)

	existing := call(router, http.MethodDelete, gamePath, asUser(otherID), "")
	unknown := call(router, http.MethodDelete, gameRoot+"/"+missingID, asUser(otherID), "")

	assertErrorEnvelope(t, existing, http.StatusForbidden, "not_allowed")
	assertErrorEnvelope(t, unknown, http.StatusForbidden, "not_allowed")
	if len(store.games) != 2 {
		t.Fatalf("%d games after refused delete, want 2", len(store.games))
	}
}

func TestDeleteGameGives404ForUnknownGameToAdmin(t *testing.T) {
	response := call(gameRouter(gameStore()), http.MethodDelete, gameRoot+"/"+missingID, asAdminUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusNotFound, "game_not_found")
}

// The largest allowed default max is the PostgreSQL integer maximum (ADR 0010 Amendment 2026-11-04).
func TestCreateAndReplaceAcceptTheLargestDefaultMax(t *testing.T) {
	body := `{"name":"Chess","defaultMaxPlayers":2147483647}`

	created := call(gameRouter(gameStore()), http.MethodPost, gameRoot, asAdminUser(alexID), body)
	replaced := call(gameRouter(gameStore()), http.MethodPut, gamePath, asAdminUser(alexID), body)

	if created.Code != http.StatusCreated || replaced.Code != http.StatusOK {
		t.Fatalf("create %d, replace %d; want 201 and 200", created.Code, replaced.Code)
	}
}

func TestGameGenreIsWrittenAndReturned(t *testing.T) {
	store := gameStore()

	created := call(gameRouter(store), http.MethodPost, gameRoot, asAdminUser(alexID), `{"name":"Chess","genre":"strategy"}`)
	replaced := call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), `{"name":"Overwatch","genre":"shooter"}`)
	cleared := call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), `{"name":"Overwatch"}`)

	for response, want := range map[*httptest.ResponseRecorder]string{created: `"genre":"strategy"`, replaced: `"genre":"shooter"`, cleared: `"genre":null`} {
		if !strings.Contains(response.Body.String(), want) {
			t.Fatalf("status %d, body %q; want %s", response.Code, response.Body.String(), want)
		}
	}
}

func TestGameGenreRefusesWrongValueAndType(t *testing.T) {
	tests := []struct{ name, body, code string }{
		{name: "unknown genre", body: `{"name":"Chess","genre":"puzzle"}`, code: "invalid_genre"},
		{name: "capital letter", body: `{"name":"Chess","genre":"Shooter"}`, code: "invalid_genre"},
		{name: "number", body: `{"name":"Chess","genre":5}`, code: "invalid_request"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := gameStore()

			response := call(gameRouter(store), http.MethodPost, gameRoot, asAdminUser(alexID), tc.body)

			assertErrorEnvelope(t, response, http.StatusBadRequest, tc.code)
			response = call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), tc.body)
			assertErrorEnvelope(t, response, http.StatusBadRequest, tc.code)
		})
	}
}

// The Go list and the contract enum are kept equal (ADR 0016 section 2).
func TestDomainGenresEqualTheContractEnum(t *testing.T) {
	contract := []publicapi.Genre{publicapi.Moba, publicapi.Party, publicapi.Racing, publicapi.Rpg, publicapi.Shooter, publicapi.Sports, publicapi.Strategy, publicapi.Survival}
	var fromContract, fromDomain []string
	for _, genre := range contract {
		fromContract = append(fromContract, string(genre))
	}
	for _, genre := range domain.Genres() {
		fromDomain = append(fromDomain, string(genre))
	}
	slices.Sort(fromContract)
	slices.Sort(fromDomain)

	if !slices.Equal(fromContract, fromDomain) {
		t.Fatalf("contract genres %v, domain genres %v; want equal sets", fromContract, fromDomain)
	}
}
