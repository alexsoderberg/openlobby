package transport_test

import (
	"context"
	"encoding/json"
	"net/http"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

const (
	choiceGameID      = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"
	choiceModeID      = "a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2"
	choiceTankID      = "a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3"
	choiceHiddenID    = "a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4"
	choiceScoutGameID = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1"
	choiceScoutID     = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2"
	noRolesGameID     = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1"
)

// memoryChoices keeps the choices in the store and, like the adapter, refuses an ID that is not an effective game role.
type memoryChoices struct{ store *memoryGroups }

func (c memoryChoices) ChosenGameRoleIDs(_ context.Context, userID string) ([]string, error) {
	return slices.Clone(c.store.choices[userID]), c.store.err
}

func (c memoryChoices) Replace(_ context.Context, userID string, gameRoleIDs []string) error {
	effective := map[string]bool{}
	for _, game := range c.store.games {
		for _, role := range game.EffectiveGameRoles() {
			effective[role.ID] = true
		}
	}
	for _, id := range gameRoleIDs {
		if !effective[id] {
			return domain.ErrInvalidGameRole
		}
	}
	c.store.choices[userID] = slices.Clone(gameRoleIDs)
	return c.store.err
}

// choicesStore has no group at all, a game with a mode and a hidden game-level role, a game without modes, and a game
// without roles. alex has chosen the tank.
func choicesStore() *memoryGroups {
	return &memoryGroups{choices: map[string][]string{alexID: {choiceTankID}}, games: []domain.Game{
		{ID: noRolesGameID, Name: "Chess", GameRoles: []domain.GameRole{}, Modes: []domain.GameMode{}},
		{ID: choiceGameID, Name: "Raid", GameRoles: []domain.GameRole{{ID: choiceHiddenID, Name: "Scout", Slots: 1}}, Modes: []domain.GameMode{
			{ID: choiceModeID, Name: "Raid", MaxPlayers: intp(5), GameRoles: []domain.GameRole{{ID: choiceTankID, Name: "Tank", Slots: 5}}, Activities: []domain.Activity{}},
		}},
		{ID: choiceScoutGameID, Name: "Scout", GameRoles: []domain.GameRole{{ID: choiceScoutID, Name: "Scout", Slots: 2}}, Modes: []domain.GameMode{}},
	}}
}

// everyFourDigits writes the ID with a dash after every four hex digits, a spelling PostgreSQL also reads as a uuid.
func everyFourDigits(id string) string {
	digits := strings.ReplaceAll(id, "-", "")
	var groups []string
	for i := 0; i < len(digits); i += 4 {
		groups = append(groups, digits[i:i+4])
	}
	return strings.Join(groups, "-")
}

type choicesResponse struct {
	GameRoleIDs []string `json:"gameRoleIds"`
	Games       []struct {
		ID        string            `json:"id"`
		GameRoles []json.RawMessage `json:"gameRoles"`
	} `json:"games"`
}

func decodeChoices(t *testing.T, status int, body []byte) choicesResponse {
	t.Helper()
	var got choicesResponse
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("status %d, body %q; want 200 with the choices", status, body)
	}
	return got
}

// A person in no group reads their own choices; there is no membership check (ADR 0022 point 4).
func TestGetPreferredGameRolesOffersOnlyEffectiveGameRoles(t *testing.T) {
	response := call(newRouter(choicesStore(), &fakeDirectory{}), http.MethodGet, "/api/users/me/preferred-game-roles", asUser(alexID), "")

	got := decodeChoices(t, response.Code, response.Body.Bytes())
	if !slices.Equal(got.GameRoleIDs, []string{choiceTankID}) || len(got.Games) != 2 || got.Games[0].ID != choiceGameID || got.Games[1].ID != choiceScoutGameID {
		t.Fatalf("body %q; want the tank chosen and the games Raid and Scout", response.Body.String())
	}
	if got.Games[0].GameRoles == nil || len(got.Games[0].GameRoles) != 0 || len(got.Games[1].GameRoles) != 1 {
		t.Fatalf("body %q; want gameRoles [] for the game with modes", response.Body.String())
	}
}

func TestGetPreferredGameRolesWithoutChoicesSendsEmptyLists(t *testing.T) {
	response := call(newRouter(&memoryGroups{}, &fakeDirectory{}), http.MethodGet, "/api/users/me/preferred-game-roles", asUser(otherID), "")

	if response.Code != http.StatusOK || response.Body.String() != `{"gameRoleIds":[],"games":[]}`+"\n" {
		t.Fatalf("status %d, body %q; want empty lists", response.Code, response.Body.String())
	}
}

func TestPreferredGameRolesNeedAnIdentity(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodPut} {
		response := call(newRouter(choicesStore(), &fakeDirectory{}), method, "/api/users/me/preferred-game-roles", nil, `{"gameRoleIds":[]}`)

		assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	}
}

func TestReplacePreferredGameRolesReturnsTheStoredStateForTheCallerOnly(t *testing.T) {
	store := choicesStore()
	router := newRouter(store, &fakeDirectory{})

	response := call(router, http.MethodPut, "/api/users/me/preferred-game-roles", asUser(otherID), `{"gameRoleIds":["`+choiceScoutID+`","`+choiceTankID+`"]}`)

	got := decodeChoices(t, response.Code, response.Body.Bytes())
	if !slices.Equal(got.GameRoleIDs, []string{choiceTankID, choiceScoutID}) || len(got.Games) != 2 {
		t.Fatalf("body %q; want both roles in game order with the games", response.Body.String())
	}
	if !slices.Equal(store.choices[alexID], []string{choiceTankID}) {
		t.Fatalf("alex's choices changed to %v", store.choices[alexID])
	}
}

// An upper-case ID in the standard form is stored in lower case.
func TestReplacePreferredGameRolesStoresAnUpperCaseIDInLowerCase(t *testing.T) {
	store := choicesStore()

	response := call(newRouter(store, &fakeDirectory{}), http.MethodPut, "/api/users/me/preferred-game-roles", asUser(alexID),
		`{"gameRoleIds":["`+strings.ToUpper(choiceScoutID)+`"]}`)

	if got := decodeChoices(t, response.Code, response.Body.Bytes()); !slices.Equal(got.GameRoleIDs, []string{choiceScoutID}) ||
		!slices.Equal(store.choices[alexID], []string{choiceScoutID}) {
		t.Fatalf("body %q, stored %v; want the scout in lower case", response.Body.String(), store.choices[alexID])
	}
}

func TestReplacePreferredGameRolesWithAnEmptyListClears(t *testing.T) {
	store := choicesStore()

	response := call(newRouter(store, &fakeDirectory{}), http.MethodPut, "/api/users/me/preferred-game-roles", asUser(alexID), `{"gameRoleIds":[]}`)

	if got := decodeChoices(t, response.Code, response.Body.Bytes()); len(got.GameRoleIDs) != 0 || len(store.choices[alexID]) != 0 {
		t.Fatalf("body %q, stored %v; want no choices", response.Body.String(), store.choices[alexID])
	}
}

func TestReplacePreferredGameRolesRefusalsKeepTheChoices(t *testing.T) {
	tests := []struct {
		name string
		body string
		code string
	}{
		{name: "missing gameRoleIds", body: `{}`, code: "invalid_request"},
		{name: "null gameRoleIds", body: `{"gameRoleIds":null}`, code: "invalid_request"},
		{name: "null body", body: `null`, code: "invalid_request"},
		{name: "wrong type", body: `{"gameRoleIds":"` + choiceTankID + `"}`, code: "invalid_request"},
		{name: "repeated ID", body: `{"gameRoleIds":["` + choiceTankID + `","` + choiceTankID + `"]}`, code: "invalid_request"},
		{name: "repeated ID in upper case", body: `{"gameRoleIds":["` + choiceTankID + `","` + strings.ToUpper(choiceTankID) + `"]}`, code: "invalid_request"},
		{name: "repeat comes before a malformed entry", body: `{"gameRoleIds":["tank","` + choiceTankID + `","` + choiceTankID + `"]}`, code: "invalid_request"},
		{name: "in braces", body: `{"gameRoleIds":["{` + choiceTankID + `}"]}`, code: "invalid_game_role"},
		{name: "without dashes", body: `{"gameRoleIds":["` + strings.ReplaceAll(choiceTankID, "-", "") + `"]}`, code: "invalid_game_role"},
		{name: "a dash after every four digits", body: `{"gameRoleIds":["` + everyFourDigits(choiceTankID) + `"]}`, code: "invalid_game_role"},
		{name: "not a uuid", body: `{"gameRoleIds":["tank"]}`, code: "invalid_game_role"},
		{name: "unknown ID", body: `{"gameRoleIds":["` + missingID + `"]}`, code: "invalid_game_role"},
		{name: "game-level role of a game with modes", body: `{"gameRoleIds":["` + choiceHiddenID + `"]}`, code: "invalid_game_role"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := choicesStore()

			response := call(newRouter(store, &fakeDirectory{}), http.MethodPut, "/api/users/me/preferred-game-roles", asUser(alexID), tc.body)

			assertErrorEnvelope(t, response, http.StatusBadRequest, tc.code)
			if !slices.Equal(store.choices[alexID], []string{choiceTankID}) {
				t.Fatalf("choices changed to %v", store.choices[alexID])
			}
		})
	}
}

// visibleChoices gives alex a mode role and a role of a game with no modes, in the adapter's order; other has none.
func visibleChoices() map[string][]domain.PreferredGameRole {
	raid := "Raid"
	return map[string][]domain.PreferredGameRole{alexID: {
		{GameRoleID: choiceTankID, Name: "Tank", GameName: "Raid", ModeName: &raid},
		{GameRoleID: choiceScoutID, Name: "Scout", GameName: "Scout"},
	}}
}

// choicesByUser keys the people of a getGroup or getLobby body by user ID, decoded into the generated contract types.
// A nil pointer means the body had null or no preferredGameRoles, which the contract does not allow.
type choicesByUser map[openapi_types.UUID]*[]publicapi.PreferredGameRole

func groupChoices(t *testing.T, body []byte) choicesByUser {
	t.Helper()
	var group publicapi.GetGroup200JSONResponse
	if err := json.Unmarshal(body, &group); err != nil {
		t.Fatalf("decode %q: %v", body, err)
	}
	byUser := choicesByUser{}
	for _, member := range group.Members {
		byUser[member.UserId] = member.PreferredGameRoles
	}
	return byUser
}

func lobbyChoices(t *testing.T, body []byte) choicesByUser {
	t.Helper()
	var lobby publicapi.GetLobby200JSONResponse
	if err := json.Unmarshal(body, &lobby); err != nil {
		t.Fatalf("decode %q: %v", body, err)
	}
	byUser := choicesByUser{}
	for _, player := range lobby.Players {
		byUser[player.UserId] = player.PreferredGameRoles
	}
	return byUser
}

func TestGroupAndLobbyShowTheVisibleChoicesInTheContractShape(t *testing.T) {
	tests := []struct {
		name, path string
		decode     func(*testing.T, []byte) choicesByUser
	}{
		{name: "getGroup", path: "/api/groups/" + fridayID, decode: groupChoices},
		{name: "getLobby", path: lobbiesPath + "/" + otherLobby, decode: lobbyChoices},
	}
	raid := "Raid"
	wantAlex := []publicapi.PreferredGameRole{
		{GameRoleId: uuid.MustParse(choiceTankID), Name: "Tank", GameName: "Raid", ModeName: &raid},
		{GameRoleId: uuid.MustParse(choiceScoutID), Name: "Scout", GameName: "Scout", ModeName: nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := upcomingStore()
			store.visible = visibleChoices()

			response := call(newRouter(store, fridayDirectory()), http.MethodGet, tc.path, asUser(otherID), "")

			if response.Code != http.StatusOK {
				t.Fatalf("status %d, body %q; want 200", response.Code, response.Body.String())
			}
			got := tc.decode(t, response.Body.Bytes())
			alex, other := got[uuid.MustParse(alexID)], got[uuid.MustParse(otherID)]
			if alex == nil || !reflect.DeepEqual(*alex, wantAlex) {
				t.Fatalf("alex's choices %v, want %v", alex, wantAlex)
			}
			if other == nil || len(*other) != 0 {
				t.Fatalf("other's choices %v, want [] (never null)", other)
			}
			// Decoding gives a nil ModeName for both null and a missing key; the contract sends null.
			if !strings.Contains(response.Body.String(), `"modeName":null,"name":"Scout"`) {
				t.Fatalf("body %q, want modeName null on the role of a game with no modes", response.Body.String())
			}
		})
	}
}
