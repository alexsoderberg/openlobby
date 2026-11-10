package transport_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/domain"
)

const (
	duelModeID  = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b3"
	arenaID     = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e6"
	outsiderID  = "77777777-7777-4777-8777-777777777777"
	modePath    = lobbiesPath + "/" + roleLobby + "/mode"
	activityURL = lobbiesPath + "/" + roleLobby + "/activity"
)

// settingsStore is the quest store with the lobby in the mode Raid (activity The Keep), Alex as its only player, and a
// second mode Duel with the activity Arena.
func settingsStore() *memoryGroups {
	store := questStore()
	duel := domain.GameMode{ID: duelModeID, Name: "Duel", MaxPlayers: intp(2), Activities: []domain.Activity{{ID: arenaID, Name: "Arena"}}}
	quest := &store.games[len(store.games)-1]
	quest.Modes = append(quest.Modes, duel)
	lobby := store.lobbies[roleLobby]
	lobby.GameID, lobby.ModeID, lobby.ModeName = &quest.ID, strp(raidModeID), strp("Raid")
	lobby.ActivityID, lobby.ActivityName = strp(keepID), strp("The Keep")
	store.lobbies[roleLobby] = lobby
	store.joined = map[string]bool{roleLobby + "/" + alexID: true}
	return store
}

func strp(value string) *string { return &value }

// oversized pads a body past the body limit with trailing spaces, so the part that fits is still a whole JSON object.
func oversized(body string) string { return body + strings.Repeat(" ", httpapi.MaxBodyBytes) }

func modeBody(modeID, current string) string {
	return `{"modeId":"` + modeID + `","currentModeId":` + current + `}`
}

// The answer is the Lobby as saved, without player names, so no call to auth runs: auth being down cannot turn a saved
// change into a 503 (ADR 0017 section 10, Amendment 2026-11-09).
func TestSetLobbyModeReturnsTheLobbyWithoutAskingAuth(t *testing.T) {
	names := &fakeDirectory{err: domain.ErrUnavailable}

	response := call(newRouter(settingsStore(), names), http.MethodPut, modePath, asUser(alexID), modeBody(duelModeID, `"`+raidModeID+`"`))

	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body %q", response.Code, response.Body.String())
	}
	var got map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	slots, _ := got["roleSlots"].([]any)
	_, hasPlayers := got["players"]
	if got["modeId"] != duelModeID || got["modeName"] != "Duel" || got["activityId"] != nil || got["activityName"] != nil ||
		got["maxPlayers"] != float64(2) || slots == nil || len(slots) != 0 || hasPlayers || names.calls != 0 {
		t.Fatalf("body %q with %d name lookups, want the lobby in Duel with max 2, no activity, no role slots, no players key and no lookup",
			response.Body.String(), names.calls)
	}
}

func TestSettingsEndpointsRefuseABadShapeBeforeMembership(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		body   string
		status int
		code   string
	}{
		{name: "mode: invalid JSON", method: http.MethodPut, path: modePath, body: `{`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: no body", method: http.MethodPut, path: modePath, body: ``, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: missing modeId", method: http.MethodPut, path: modePath, body: `{"currentModeId":null}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: missing currentModeId", method: http.MethodPut, path: modePath, body: `{"modeId":"` + duelModeID + `"}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: null modeId", method: http.MethodPut, path: modePath, body: `{"modeId":null,"currentModeId":null}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: modeId is not a uuid", method: http.MethodPut, path: modePath, body: modeBody("nope", "null"), status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: currentModeId is not a uuid", method: http.MethodPut, path: modePath, body: modeBody(duelModeID, `"nope"`), status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: wrong type", method: http.MethodPut, path: modePath, body: `{"modeId":1,"currentModeId":null}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: oversized without currentModeId", method: http.MethodPut, path: modePath, body: oversized(`{"modeId":"` + duelModeID + `"}`), status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: oversized with valid keys", method: http.MethodPut, path: modePath, body: oversized(modeBody(duelModeID, "null")), status: http.StatusBadRequest, code: "invalid_request"},
		{name: "activity: oversized with valid key", method: http.MethodPut, path: activityURL, body: oversized(`{"activityId":"` + arenaID + `"}`), status: http.StatusBadRequest, code: "invalid_request"},
		{name: "activity: invalid JSON", method: http.MethodPut, path: activityURL, body: `{`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "activity: missing activityId", method: http.MethodPut, path: activityURL, body: `{}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "activity: null activityId", method: http.MethodPut, path: activityURL, body: `{"activityId":null}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "activity: not a uuid", method: http.MethodPut, path: activityURL, body: `{"activityId":"nope"}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "mode: invalid lobby ID", method: http.MethodPut, path: lobbiesPath + "/nope/mode", body: `{`, status: http.StatusNotFound, code: "lobby_not_found"},
		{name: "mode: invalid group ID", method: http.MethodPut, path: "/api/groups/nope/lobbies/" + roleLobby + "/mode", body: `{`, status: http.StatusNotFound, code: "group_not_found"},
		{name: "activity: invalid lobby ID", method: http.MethodDelete, path: lobbiesPath + "/nope/activity", status: http.StatusNotFound, code: "lobby_not_found"},
		{name: "clear: invalid group ID", method: http.MethodDelete, path: "/api/groups/nope/lobbies/" + roleLobby + "/activity", status: http.StatusNotFound, code: "group_not_found"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := settingsStore()

			// The caller is no member: a bad shape is still reported first.
			response := call(newRouter(store, fridayDirectory()), tc.method, tc.path, asUser(outsiderID), tc.body)

			assertErrorEnvelope(t, response, tc.status, tc.code)
			if store.calls != 0 {
				t.Fatalf("%d store calls, want none before the shape is valid", store.calls)
			}
		})
	}
}

// The check order and the answers of ADR 0017 section 10, for all three operations. The player is Alex; Bo is a member
// who is not a player.
func TestSettingsEndpointsAnswerTheContractStatuses(t *testing.T) {
	// An all-zero UUID is a well-formed ID that names no mode or activity, not a missing one.
	const zeroID = "00000000-0000-0000-0000-000000000000"
	staleView := `"` + duelModeID + `"`
	tests := []struct {
		name   string
		method string
		path   string
		body   string
		caller string
		setup  func(*memoryGroups)
		status int
		code   string
	}{
		{name: "mode: non-member", method: http.MethodPut, path: modePath, body: modeBody(duelModeID, `"`+raidModeID+`"`), caller: outsiderID, status: http.StatusNotFound, code: "group_not_found"},
		{name: "activity: non-member", method: http.MethodPut, path: activityURL, body: `{"activityId":"` + arenaID + `"}`, caller: outsiderID, status: http.StatusNotFound, code: "group_not_found"},
		{name: "clear: non-member", method: http.MethodDelete, path: activityURL, caller: outsiderID, status: http.StatusNotFound, code: "group_not_found"},
		{name: "mode: non-member with an all-zero modeId", method: http.MethodPut, path: modePath, body: modeBody(zeroID, "null"), caller: outsiderID, status: http.StatusNotFound, code: "group_not_found"},
		{name: "activity: non-member with an all-zero activityId", method: http.MethodPut, path: activityURL, body: `{"activityId":"` + zeroID + `"}`, caller: outsiderID, status: http.StatusNotFound, code: "group_not_found"},
		{name: "mode: not a player", method: http.MethodPut, path: modePath, body: modeBody(duelModeID, `"`+raidModeID+`"`), caller: otherID, status: http.StatusForbidden, code: "not_allowed"},
		{name: "activity: not a player", method: http.MethodPut, path: activityURL, body: `{"activityId":"` + keepID + `"}`, caller: otherID, status: http.StatusForbidden, code: "not_allowed"},
		{name: "clear: not a player", method: http.MethodDelete, path: activityURL, caller: otherID, status: http.StatusForbidden, code: "not_allowed"},
		{name: "mode: missing lobby", method: http.MethodPut, path: lobbiesPath + "/" + missingID + "/mode", body: modeBody(duelModeID, "null"), caller: alexID, status: http.StatusNotFound, code: "lobby_not_found"},
		{name: "clear: missing lobby", method: http.MethodDelete, path: lobbiesPath + "/" + missingID + "/activity", caller: alexID, status: http.StatusNotFound, code: "lobby_not_found"},
		{name: "mode: ended", method: http.MethodPut, path: lobbiesPath + "/" + endedLobby + "/mode", body: modeBody(duelModeID, "null"), caller: alexID, status: http.StatusConflict, code: "lobby_has_ended"},
		{name: "mode: unknown mode", method: http.MethodPut, path: modePath, body: modeBody(missingID, `"`+raidModeID+`"`), caller: alexID, status: http.StatusBadRequest, code: "invalid_mode"},
		{name: "activity: activity of another mode", method: http.MethodPut, path: activityURL, body: `{"activityId":"` + arenaID + `"}`, caller: alexID, status: http.StatusBadRequest, code: "invalid_activity"},
		{name: "mode: all-zero modeId", method: http.MethodPut, path: modePath, body: modeBody(zeroID, `"`+raidModeID+`"`), caller: alexID, status: http.StatusBadRequest, code: "invalid_mode"},
		{name: "activity: all-zero activityId", method: http.MethodPut, path: activityURL, body: `{"activityId":"` + zeroID + `"}`, caller: alexID, status: http.StatusBadRequest, code: "invalid_activity"},
		{name: "mode: stale view", method: http.MethodPut, path: modePath, body: modeBody(duelModeID, staleView), caller: alexID, status: http.StatusConflict, code: "lobby_changed"},
		{name: "mode: explicit null currentModeId is accepted", method: http.MethodPut, path: modePath, body: modeBody(duelModeID, "null"), caller: alexID, status: http.StatusConflict, code: "lobby_changed"},
		{name: "mode: more players", method: http.MethodPut, path: modePath, body: modeBody(duelModeID, `"`+raidModeID+`"`), caller: alexID,
			setup: func(s *memoryGroups) {
				lobby := s.lobbies[roleLobby]
				lobby.PlayerCount = 3
				s.lobbies[roleLobby] = lobby
			}, status: http.StatusConflict, code: "lobby_has_more_players"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := settingsStore()
			store.lobbies[endedLobby] = domain.Lobby{ID: endedLobby, GroupID: fridayID, CreatedByUserID: alexID}
			store.joined[endedLobby+"/"+alexID] = true
			if tc.setup != nil {
				tc.setup(store)
			}

			response := call(newRouter(store, fridayDirectory()), tc.method, tc.path, asUser(tc.caller), tc.body)

			assertErrorEnvelope(t, response, tc.status, tc.code)
		})
	}
}

func TestSetLobbyActivityAndClearReturnTheLobby(t *testing.T) {
	router := newRouter(settingsStore(), fridayDirectory())
	if response := call(router, http.MethodPut, modePath, asUser(alexID), modeBody(duelModeID, `"`+raidModeID+`"`)); response.Code != http.StatusOK {
		t.Fatalf("mode change: status %d; body %q", response.Code, response.Body.String())
	}

	set := call(router, http.MethodPut, activityURL, asUser(alexID), `{"activityId":"`+arenaID+`"}`)
	cleared := call(router, http.MethodDelete, activityURL, asUser(alexID), "")
	clearedAgain := call(router, http.MethodDelete, activityURL, asUser(alexID), "")

	for name, want := range map[string]struct {
		response string
		code     int
		activity any
	}{"set": {set.Body.String(), set.Code, "Arena"}, "clear": {cleared.Body.String(), cleared.Code, nil}, "clear again": {clearedAgain.Body.String(), clearedAgain.Code, nil}} {
		var got map[string]any
		if err := json.Unmarshal([]byte(want.response), &got); err != nil {
			t.Fatal(err)
		}
		_, hasPlayers := got["players"]
		if want.code != http.StatusOK || got["activityName"] != want.activity || got["modeName"] != "Duel" || hasPlayers {
			t.Fatalf("%s: status %d body %q, want 200 in Duel with activity %v and no players key", name, want.code, want.response, want.activity)
		}
	}
}

// A stored mode without a limit is corrupt data: the answer is a 500 without detail, not a 400 invalid_capacity.
func TestSetLobbyModeToACorruptModeIs500(t *testing.T) {
	store := settingsStore()
	quest := &store.games[len(store.games)-1]
	quest.Modes[len(quest.Modes)-1].MaxPlayers = nil

	response := call(newRouter(store, fridayDirectory()), http.MethodPut, modePath, asUser(alexID), modeBody(duelModeID, `"`+raidModeID+`"`))

	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
}
