package transport_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	storedRoleID = "00000000-0000-4000-8000-0000000000a1"
	storedModeID = "00000000-0000-4000-8000-0000000000b1"
)

// numberEntries gives the entries of a new game IDs, as the database does.
func numberEntries(game *domain.Game) {
	count := 0
	next := func() string {
		count++
		return fmt.Sprintf("00000000-0000-4000-8000-%012d", count)
	}
	for i := range game.GameRoles {
		game.GameRoles[i].ID = next()
	}
	for i := range game.Modes {
		game.Modes[i].ID = next()
		for j := range game.Modes[i].GameRoles {
			game.Modes[i].GameRoles[j].ID = next()
		}
		for j := range game.Modes[i].Activities {
			game.Modes[i].Activities[j].ID = next()
		}
	}
}

func decode(t *testing.T, body string) map[string]any {
	t.Helper()
	var result map[string]any
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		t.Fatalf("decode %q: %v", body, err)
	}
	return result
}

// A game with game roles and modes is created and sent back with the IDs, the trimmed names and the stored max players
// (the sum for a mode with roles).
func TestCreateGameWithGameRolesAndModes(t *testing.T) {
	store := gameStore()
	body := `{"name":"Raid","gameRoles":[{"name":" Scout ","slots":2}],"modes":[
		{"name":"Ranked","maxPlayers":5},
		{"name":"Raid","gameRoles":[{"name":"Tank","slots":1},{"name":"Healer","slots":4}],"activities":[{"name":"Castle"}]}]}`

	response := call(gameRouter(store), http.MethodPost, gameRoot, asAdminUser(alexID), body)

	got := decode(t, response.Body.String())
	modes, _ := got["modes"].([]any)
	if response.Code != http.StatusCreated || len(modes) != 2 {
		t.Fatalf("status %d, body %q; want 201 with two modes", response.Code, response.Body.String())
	}
	raid := modes[1].(map[string]any)
	roles := raid["gameRoles"].([]any)
	if raid["maxPlayers"] != float64(5) || len(roles) != 2 || roles[1].(map[string]any)["slots"] != float64(4) || len(raid["activities"].([]any)) != 1 {
		t.Fatalf("raid mode %v; want max players 5 (the sum), two roles and one activity", raid)
	}
	if first := got["gameRoles"].([]any)[0].(map[string]any); first["name"] != "Scout" || first["id"] == "" {
		t.Fatalf("game role %v; want the trimmed name and an ID", first)
	}
}

func TestReplaceGameKeepsRolesAndModesWhenOmittedOrNull(t *testing.T) {
	for _, body := range []string{`{"name":"Renamed"}`, `{"name":"Renamed","gameRoles":null,"modes":null}`} {
		store := gameStore()
		store.games[1].GameRoles = []domain.GameRole{{ID: storedRoleID, Name: "Scout", Slots: 1}}
		store.games[1].Modes = []domain.GameMode{{ID: storedModeID, Name: "Ranked", MaxPlayers: maxOf(5), GameRoles: []domain.GameRole{}, Activities: []domain.Activity{}}}

		response := call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), body)

		got := decode(t, response.Body.String())
		if response.Code != http.StatusOK || len(got["modes"].([]any)) != 1 || len(got["gameRoles"].([]any)) != 1 {
			t.Fatalf("body %s: status %d, response %q; want the stored roles and modes", body, response.Code, response.Body.String())
		}
	}
}

func TestReplaceGameWithEmptyListsRemovesThem(t *testing.T) {
	store := gameStore()
	store.games[1].Modes = []domain.GameMode{{ID: storedModeID, Name: "Ranked", MaxPlayers: maxOf(5)}}

	response := call(gameRouter(store), http.MethodPut, gamePath, asAdminUser(alexID), `{"name":"Overwatch","modes":[],"gameRoles":[]}`)

	got := decode(t, response.Body.String())
	if response.Code != http.StatusOK || !reflect.DeepEqual(got["modes"], []any{}) || len(store.games[1].Modes) != 0 {
		t.Fatalf("status %d, response %q; want no modes", response.Code, response.Body.String())
	}
}

func TestGameWritesRefuseInvalidRolesModesAndActivities(t *testing.T) {
	tests := []struct {
		name string
		body string
		code string
	}{
		{name: "role name empty", body: `{"name":"G","gameRoles":[{"name":" ","slots":1}]}`, code: "invalid_game_role"},
		{name: "role name too long", body: `{"name":"G","gameRoles":[{"name":"` + strings.Repeat("x", 31) + `","slots":1}]}`, code: "invalid_game_role"},
		{name: "role slots zero", body: `{"name":"G","gameRoles":[{"name":"A","slots":0}]}`, code: "invalid_capacity"},
		{name: "role slots missing", body: `{"name":"G","gameRoles":[{"name":"A"}]}`, code: "invalid_capacity"},
		{name: "role name missing", body: `{"name":"G","gameRoles":[{"slots":1}]}`, code: "invalid_game_role"},
		{name: "sum above the limit", body: `{"name":"G","gameRoles":[{"name":"A","slots":2147483647},{"name":"B","slots":1}]}`, code: "invalid_capacity"},
		{name: "mode name empty", body: `{"name":"G","modes":[{"name":"","maxPlayers":2}]}`, code: "invalid_mode"},
		{name: "mode without max or roles", body: `{"name":"G","modes":[{"name":"M"}]}`, code: "invalid_capacity"},
		{name: "mode with null max and no roles", body: `{"name":"G","modes":[{"name":"M","maxPlayers":null}]}`, code: "invalid_capacity"},
		{name: "mode with max and roles", body: `{"name":"G","modes":[{"name":"M","maxPlayers":3,"gameRoles":[{"name":"A","slots":3}]}]}`, code: "invalid_capacity"},
		{name: "mode max zero", body: `{"name":"G","modes":[{"name":"M","maxPlayers":0}]}`, code: "invalid_capacity"},
		{name: "activity name empty", body: `{"name":"G","modes":[{"name":"M","maxPlayers":2,"activities":[{"name":""}]}]}`, code: "invalid_activity"},
		{name: "role of a mode invalid", body: `{"name":"G","modes":[{"name":"M","gameRoles":[{"name":"","slots":1}]}]}`, code: "invalid_game_role"},
		{name: "ID is not a uuid", body: `{"name":"G","modes":[{"id":"nope","name":"M","maxPlayers":2}]}`, code: "invalid_request"},
		{name: "modes is not a list", body: `{"name":"G","modes":{}}`, code: "invalid_request"},
	}
	for _, tc := range tests {
		for _, method := range []string{http.MethodPost, http.MethodPut} {
			t.Run(method+" "+tc.name, func(t *testing.T) {
				store := gameStore()
				path := gameRoot
				if method == http.MethodPut {
					path = gamePath
				}

				response := call(gameRouter(store), method, path, asAdminUser(alexID), tc.body)

				assertErrorEnvelope(t, response, http.StatusBadRequest, tc.code)
				if len(store.games) != 2 || len(store.games[1].Modes) != 0 || len(store.games[1].GameRoles) != 0 || store.calls != 0 {
					t.Fatalf("a refused write changed the list: %+v, %d calls", store.games, store.calls)
				}
			})
		}
	}
}

// The editor's answers for the database rules map to 400 and 409 codes.
func TestGameWritesTranslateEditorErrors(t *testing.T) {
	tests := []struct {
		err    error
		status int
		code   string
	}{
		{application.ErrModeTaken, http.StatusConflict, "mode_taken"},
		{application.ErrGameRoleTaken, http.StatusConflict, "game_role_taken"},
		{application.ErrActivityTaken, http.StatusConflict, "activity_taken"},
		{domain.ErrInvalidID, http.StatusBadRequest, "invalid_request"},
		{domain.ErrInvalidCapacity, http.StatusBadRequest, "invalid_capacity"},
	}
	body := `{"name":"Chess","modes":[{"name":"M","maxPlayers":2}]}`
	for _, tc := range tests {
		t.Run(tc.code, func(t *testing.T) {
			for _, method := range []string{http.MethodPost, http.MethodPut} {
				store := gameStore()
				store.err = tc.err
				path := gameRoot
				if method == http.MethodPut {
					path = gamePath
				}

				assertErrorEnvelope(t, call(gameRouter(store), method, path, asAdminUser(alexID), body), tc.status, tc.code)
			}
		})
	}
}

// A user who is not a system admin is denied writes with modes or game roles, and nothing is written (ADR 0017 tests).
func TestGameWritesWithModesOrRolesAreDeniedToNonAdmin(t *testing.T) {
	bodies := []string{
		`{"name":"G","modes":[{"name":"M","maxPlayers":2}]}`,
		`{"name":"G","gameRoles":[{"name":"A","slots":1}]}`,
		`{"name":"G","modes":[]}`,
	}
	for _, body := range bodies {
		for _, method := range []string{http.MethodPost, http.MethodPut} {
			store := gameStore()
			path := gameRoot
			if method == http.MethodPut {
				path = gamePath
			}

			response := call(gameRouter(store), method, path, asUser(otherID), body)

			assertErrorEnvelope(t, response, http.StatusForbidden, "not_allowed")
			if store.calls != 0 || len(store.games[1].Modes) != 0 {
				t.Fatalf("%s %s: a non-admin wrote to the list", method, body)
			}
		}
	}
}
