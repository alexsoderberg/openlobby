package transport_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

const (
	questGameID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"
	raidModeID  = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2"
	tankRoleID  = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3"
	dpsRoleID   = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4"
	keepID      = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5"
	roleLobby   = "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6"
)

// assertNoRoleSlots checks that the lobby body has an empty roleSlots list and removes it, so that a test can compare
// the other fields as plain values.
func assertNoRoleSlots(t *testing.T, body map[string]any) {
	t.Helper()
	slots, ok := body["roleSlots"].([]any)
	if !ok || len(slots) != 0 {
		t.Fatalf("roleSlots = %v, want an empty list", body["roleSlots"])
	}
	delete(body, "roleSlots")
}

// questStore has a game with a mode Raid (Tank 1, DPS 2, one activity) and a lobby of that mode where Tank is full.
func questStore() *memoryGroups {
	store := upcomingStore()
	raid := domain.GameMode{ID: raidModeID, Name: "Raid", MaxPlayers: intp(3),
		GameRoles:  []domain.GameRole{{ID: tankRoleID, Name: "Tank", Slots: 1}, {ID: dpsRoleID, Name: "DPS", Slots: 2}},
		Activities: []domain.Activity{{ID: keepID, Name: "The Keep"}}}
	store.games = append(store.games, domain.Game{ID: questGameID, Name: "Quest", Modes: []domain.GameMode{raid}})
	store.lobbies[roleLobby] = domain.Lobby{ID: roleLobby, GroupID: fridayID, CreatedByUserID: alexID, GameName: "Quest", MaxPlayers: intp(3),
		EndsAt: store.lobbies[aliceLobby].EndsAt, PlayerCount: 1,
		RoleSlots: []domain.RoleSlot{{GameRoleID: tankRoleID, Name: "Tank", Slots: 1, PlayerCount: 1}, {GameRoleID: dpsRoleID, Name: "DPS", Slots: 2}}}
	return store
}

func intp(value int) *int { return &value }

func TestCreateLobbyWithModeActivityAndSeatReturnsTheNewFields(t *testing.T) {
	extra := `,"gameId":"` + questGameID + `","modeId":"` + raidModeID + `","activityId":"` + keepID + `","gameRoleId":"` + tankRoleID +
		`","roleSlots":[{"gameRoleId":"` + tankRoleID + `","slots":1},{"gameRoleId":"` + dpsRoleID + `","slots":1}]`

	response := call(newRouter(questStore(), fridayDirectory()), http.MethodPost, lobbiesPath, asUser(otherID), lobbyJSON(validStart, validEnd, extra))

	if response.Code != http.StatusCreated {
		t.Fatalf("status %d, want 201; body %q", response.Code, response.Body.String())
	}
	var got struct {
		GameID       string `json:"gameId"`
		ModeID       string `json:"modeId"`
		ModeName     string `json:"modeName"`
		ActivityID   string `json:"activityId"`
		ActivityName string `json:"activityName"`
		MaxPlayers   int    `json:"maxPlayers"`
		FlexCount    int    `json:"flexCount"`
		RoleSlots    []struct {
			GameRoleID  string `json:"gameRoleId"`
			Name        string `json:"name"`
			Slots       int    `json:"slots"`
			PlayerCount int    `json:"playerCount"`
		} `json:"roleSlots"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.GameID != questGameID || got.ModeID != raidModeID || got.ModeName != "Raid" || got.ActivityID != keepID || got.ActivityName != "The Keep" ||
		got.MaxPlayers != 2 || got.FlexCount != 0 || len(got.RoleSlots) != 2 || got.RoleSlots[0].Name != "Tank" || got.RoleSlots[0].PlayerCount != 1 || got.RoleSlots[1].Slots != 1 {
		t.Fatalf("body %q, want mode Raid with activity The Keep, max 2 and Tank 1/1 and DPS 0/1", response.Body.String())
	}
}

func TestCreateLobbyGivesTheLobbyErrorsOfModesAndRoles(t *testing.T) {
	quest := `"gameId":"` + questGameID + `"`
	tests := []struct {
		name     string
		extra    string
		wantCode string
	}{
		{name: "unknown mode", extra: `,` + quest + `,"modeId":"` + keepID + `","maxPlayers":2`, wantCode: "invalid_mode"},
		{name: "malformed mode", extra: `,` + quest + `,"modeId":"not-a-uuid"`, wantCode: "invalid_mode"},
		{name: "mode with a custom game name", extra: `,"customGameName":"Go","modeId":"` + raidModeID + `"`, wantCode: "invalid_mode"},
		{name: "activity of no mode", extra: `,` + quest + `,"activityId":"` + keepID + `"`, wantCode: "invalid_activity"},
		{name: "malformed game role", extra: `,` + quest + `,"modeId":"` + raidModeID + `","gameRoleId":"not-a-uuid"`, wantCode: "invalid_game_role"},
		{name: "no seat in a lobby with roles", extra: `,` + quest + `,"modeId":"` + raidModeID + `"`, wantCode: "invalid_game_role"},
		{name: "flex and a role", extra: `,` + quest + `,"modeId":"` + raidModeID + `","flex":true,"gameRoleId":"` + tankRoleID + `"`, wantCode: "invalid_game_role"},
		{name: "unknown role in roleSlots", extra: `,` + quest + `,"modeId":"` + raidModeID + `","flex":true,"roleSlots":[{"gameRoleId":"` + keepID + `","slots":1}]`, wantCode: "invalid_game_role"},
		{name: "maxPlayers with roles", extra: `,` + quest + `,"modeId":"` + raidModeID + `","flex":true,"maxPlayers":3`, wantCode: "invalid_capacity"},
		{name: "all slots 0", extra: `,` + quest + `,"modeId":"` + raidModeID + `","flex":true,"roleSlots":[]`, wantCode: "invalid_capacity"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(questStore(), fridayDirectory()), http.MethodPost, lobbiesPath, asUser(otherID), lobbyJSON(validStart, validEnd, tc.extra))

			assertErrorEnvelope(t, response, http.StatusBadRequest, tc.wantCode)
		})
	}
}

func TestCreateLobbyWithAWrongTypeForTheNewFieldsIsInvalidRequest(t *testing.T) {
	for _, extra := range []string{`,"flex":"yes"`, `,"roleSlots":{}`, `,"roleSlots":[{"gameRoleId":"x","slots":"two"}]`, `,"modeId":5`} {
		response := call(newRouter(questStore(), fridayDirectory()), http.MethodPost, lobbiesPath, asUser(otherID), lobbyJSON(validStart, validEnd, withChess+extra))

		assertErrorEnvelope(t, response, http.StatusBadRequest, "invalid_request")
	}
}

func TestJoinLobbyTakesTheSeatFromTheBody(t *testing.T) {
	path := lobbiesPath + "/" + roleLobby + "/players/me"
	tests := []struct {
		name     string
		body     string
		want     int
		wantCode string
	}{
		{name: "free role", body: `{"gameRoleId":"` + dpsRoleID + `"}`, want: http.StatusNoContent},
		{name: "flex", body: `{"flex":true}`, want: http.StatusNoContent},
		{name: "full role", body: `{"gameRoleId":"` + tankRoleID + `"}`, want: http.StatusConflict, wantCode: "game_role_full"},
		{name: "no body in a lobby with roles", body: ``, want: http.StatusBadRequest, wantCode: "invalid_game_role"},
		{name: "empty body in a lobby with roles", body: `{}`, want: http.StatusBadRequest, wantCode: "invalid_game_role"},
		{name: "flex false is no seat", body: `{"flex":false}`, want: http.StatusBadRequest, wantCode: "invalid_game_role"},
		{name: "malformed role", body: `{"gameRoleId":"not-a-uuid"}`, want: http.StatusBadRequest, wantCode: "invalid_game_role"},
		{name: "both", body: `{"flex":true,"gameRoleId":"` + dpsRoleID + `"}`, want: http.StatusBadRequest, wantCode: "invalid_game_role"},
		{name: "wrong type", body: `{"flex":"yes"}`, want: http.StatusBadRequest, wantCode: "invalid_request"},
		{name: "invalid JSON", body: `{`, want: http.StatusBadRequest, wantCode: "invalid_request"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(questStore(), fridayDirectory()), http.MethodPut, path, asUser(otherID), tc.body)

			if tc.wantCode == "" {
				if response.Code != tc.want {
					t.Fatalf("status %d, want %d; body %q", response.Code, tc.want, response.Body.String())
				}
				return
			}
			assertErrorEnvelope(t, response, tc.want, tc.wantCode)
		})
	}
}

func TestJoinLobbyWithASeatInALobbyWithoutRolesIsRefused(t *testing.T) {
	response := call(newRouter(questStore(), fridayDirectory()), http.MethodPut, playerPath, asUser(otherID), `{"flex":true}`)

	assertErrorEnvelope(t, response, http.StatusBadRequest, "invalid_game_role")
}

func intpStr(value string) *string { return &value }

// A lobby without a mode sends null for the optional IDs and names, and a flex player sends a null game role (ADR 0017).
func TestLobbyBodiesSendNullForUnsetFields(t *testing.T) {
	response := call(newRouter(upcomingStore(), fridayDirectory()), http.MethodGet, lobbiesPath+"/"+otherLobby, asUser(otherID), "")

	var got struct {
		Lobby   map[string]any
		Players []map[string]any `json:"players"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got.Lobby); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"gameId", "modeId", "modeName", "activityId", "activityName"} {
		if value, present := got.Lobby[key]; !present || value != nil {
			t.Errorf("%s = %v (present %v), want null", key, value, present)
		}
	}
	if len(got.Players) != 2 {
		t.Fatalf("players = %v, want 2", got.Players)
	}
	if value, present := got.Players[0]["gameRoleId"]; !present || value != nil {
		t.Errorf("flex player gameRoleId = %v (present %v), want null", value, present)
	}
	if got.Players[1]["gameRoleId"] != tankRoleID {
		t.Errorf("Alex gameRoleId = %v, want Tank", got.Players[1]["gameRoleId"])
	}
}
