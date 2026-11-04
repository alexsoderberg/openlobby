package transport_test

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	lobbiesPath = "/api/groups/" + fridayID + "/lobbies"
	chessGameID = "d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0"
	otherLobby  = "e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1"
	// aliceLobby is created by Alex, the admin of Friday.
	aliceLobby = "f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2"
)

// memoryLobbyRepo gives the lobby port over the memory store, with the rules of the adapter.
type memoryLobbyRepo struct{ store *memoryGroups }

func (r memoryLobbyRepo) WithLockedGroup(_ context.Context, groupID string, fn func(application.LobbyTx) error) error {
	r.store.calls++
	if r.store.err != nil {
		return r.store.err
	}
	if _, ok := r.store.groups[groupID]; !ok {
		return domain.ErrGroupNotFound
	}
	return fn(memoryLobbyTx(r))
}

type memoryLobbyTx struct{ store *memoryGroups }

func (t memoryLobbyTx) Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error) {
	return t.store.Membership(ctx, groupID, userID)
}

func (t memoryLobbyTx) InsertLobby(_ context.Context, lobby domain.Lobby) (domain.Lobby, error) {
	lobby.ID = createdID
	t.store.lobbies[lobby.ID] = lobby
	return lobby, nil
}

func (t memoryLobbyTx) CreatorOf(_ context.Context, groupID, lobbyID string) (string, bool, error) {
	lobby, ok := t.store.lobbies[lobbyID]
	if !ok || lobby.GroupID != groupID {
		return "", false, nil
	}
	return lobby.CreatedByUserID, true, nil
}

func (t memoryLobbyTx) DeleteLobby(_ context.Context, _, lobbyID string) error {
	delete(t.store.lobbies, lobbyID)
	return nil
}

func (m *memoryGroups) Find(_ context.Context, id string) (domain.Game, error) {
	m.calls++
	for _, game := range m.games {
		if game.ID == id {
			return game, m.err
		}
	}
	return domain.Game{}, application.ErrGameNotFound
}

// lobbyStore has Friday with its members, the game Chess, a lobby of Other and a lobby of Alex.
func lobbyStore() *memoryGroups {
	store := fridayStore()
	store.games = []domain.Game{{ID: chessGameID, Name: "Chess"}}
	store.lobbies = map[string]domain.Lobby{
		otherLobby: {ID: otherLobby, GroupID: fridayID, CreatedByUserID: otherID},
		aliceLobby: {ID: aliceLobby, GroupID: fridayID, CreatedByUserID: alexID},
	}
	return store
}

// lobbyJSON builds a request body. The clock is 2026-11-02T18:00Z. extra is added before the closing brace.
func lobbyJSON(startsAt, endsAt, extra string) string {
	return `{"startsAt":"` + startsAt + `","endsAt":"` + endsAt + `"` + extra + `}`
}

const (
	validStart = "2026-11-02T19:00:00Z"
	validEnd   = "2026-11-02T21:00:00Z"
	withChess  = `,"gameId":"` + chessGameID + `"`
)

func TestCreateLobbyReturns201WithTheContractShape(t *testing.T) {
	tests := []struct {
		name      string
		body      string
		wantGame  string
		wantMax   any
		wantStart string
	}{
		{name: "game of the list without max", body: lobbyJSON(validStart, validEnd, withChess), wantGame: "Chess", wantStart: validStart},
		{name: "custom name with max, offset time shown in UTC", body: lobbyJSON("2026-11-02T20:00:00+01:00", validEnd, `,"customGameName":"  Go  ","maxPlayers":4`),
			wantGame: "Go", wantMax: float64(4), wantStart: validStart},
		{name: "explicit null max and null game id", body: lobbyJSON(validStart, validEnd, `,"gameId":null,"customGameName":"Go","maxPlayers":null`), wantGame: "Go", wantStart: validStart},
		{name: "largest max", body: lobbyJSON(validStart, validEnd, withChess+`,"maxPlayers":2147483647`), wantGame: "Chess", wantMax: float64(2147483647), wantStart: validStart},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := lobbyStore()

			response := call(newRouter(store, fridayDirectory()), http.MethodPost, lobbiesPath, asUser(otherID), tc.body)

			if response.Code != http.StatusCreated {
				t.Fatalf("status %d, want 201; body %q", response.Code, response.Body.String())
			}
			var got map[string]any
			if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			want := map[string]any{
				"id": createdID, "gameName": tc.wantGame, "maxPlayers": tc.wantMax, "startsAt": tc.wantStart,
				"endsAt": validEnd, "createdByUserId": otherID, "playerCount": float64(1),
			}
			for key, value := range want {
				if got[key] != value {
					t.Errorf("%s = %v, want %v", key, got[key], value)
				}
			}
			if len(got) != len(want) {
				t.Errorf("body %v has fields other than %v", got, want)
			}
			if store.lobbies[createdID].CreatedByUserID != otherID {
				t.Fatalf("stored lobby %+v, want Other as creator", store.lobbies[createdID])
			}
		})
	}
}

func TestCreateLobbyGivesTheContractErrors(t *testing.T) {
	longName := strings.Repeat("a", 51)
	tests := []struct {
		name     string
		caller   string
		target   string
		body     string
		wantCode string
		want     int
	}{
		{name: "invalid JSON", body: `{`, wantCode: "invalid_request", want: 400},
		{name: "wrong JSON type", body: `{"startsAt":5,"endsAt":"x"}`, wantCode: "invalid_request", want: 400},
		{name: "start missing", body: `{"endsAt":"` + validEnd + `"` + withChess + `}`, wantCode: "invalid_request", want: 400},
		{name: "end null", body: `{"startsAt":"` + validStart + `","endsAt":null` + withChess + `}`, wantCode: "invalid_request", want: 400},
		{name: "start not RFC 3339", body: lobbyJSON("tomorrow", validEnd, withChess), wantCode: "invalid_request", want: 400},
		{name: "max players beyond int64", body: lobbyJSON(validStart, validEnd, withChess+`,"maxPlayers":99999999999999999999`), wantCode: "invalid_request", want: 400},
		{name: "max players is a string", body: lobbyJSON(validStart, validEnd, withChess+`,"maxPlayers":"5"`), wantCode: "invalid_request", want: 400},
		{name: "non-member with invalid JSON gets invalid_request first", caller: missingID, body: `{`, wantCode: "invalid_request", want: 400},
		{name: "non-member", caller: missingID, body: lobbyJSON(validStart, validEnd, withChess), wantCode: "group_not_found", want: 404},
		{name: "non-member with a lobby in the past gets group_not_found", caller: missingID, body: lobbyJSON("2026-11-01T19:00:00Z", validEnd, withChess), wantCode: "group_not_found", want: 404},
		{name: "unknown group", target: "/api/groups/" + missingID + "/lobbies", body: lobbyJSON(validStart, validEnd, withChess), wantCode: "group_not_found", want: 404},
		{name: "malformed group ID", target: "/api/groups/" + malformedUUIDs + "/lobbies", body: lobbyJSON(validStart, validEnd, withChess), wantCode: "group_not_found", want: 404},
		{name: "start in the past", body: lobbyJSON("2026-11-02T18:00:00Z", validEnd, withChess), wantCode: "lobby_in_past", want: 400},
		{name: "end equal to start", body: lobbyJSON(validStart, validStart, withChess), wantCode: "lobby_end_not_after_start", want: 400},
		{name: "end before start", body: lobbyJSON(validStart, "2026-11-02T18:30:00Z", withChess), wantCode: "lobby_end_not_after_start", want: 400},
		{name: "exactly 24 hours", body: lobbyJSON(validStart, "2026-11-03T19:00:00Z", withChess), wantCode: "lobby_too_long", want: 400},
		{name: "no game", body: lobbyJSON(validStart, validEnd, ""), wantCode: "invalid_game", want: 400},
		{name: "both game and custom name", body: lobbyJSON(validStart, validEnd, withChess+`,"customGameName":"Go"`), wantCode: "invalid_game", want: 400},
		{name: "unknown game", body: lobbyJSON(validStart, validEnd, `,"gameId":"`+missingID+`"`), wantCode: "invalid_game", want: 400},
		{name: "game id that is not a uuid", body: lobbyJSON(validStart, validEnd, `,"gameId":"chess"`), wantCode: "invalid_game", want: 400},
		{name: "blank custom name", body: lobbyJSON(validStart, validEnd, `,"customGameName":"   "`), wantCode: "invalid_game", want: 400},
		{name: "custom name over 50 characters", body: lobbyJSON(validStart, validEnd, `,"customGameName":"`+longName+`"`), wantCode: "invalid_game", want: 400},
		{name: "zero max players", body: lobbyJSON(validStart, validEnd, withChess+`,"maxPlayers":0`), wantCode: "invalid_capacity", want: 400},
		{name: "max players above the limit", body: lobbyJSON(validStart, validEnd, withChess+`,"maxPlayers":2147483648`), wantCode: "invalid_capacity", want: 400},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := lobbyStore()
			caller := tc.caller
			if caller == "" {
				caller = otherID
			}
			target := tc.target
			if target == "" {
				target = lobbiesPath
			}

			response := call(newRouter(store, fridayDirectory()), http.MethodPost, target, asUser(caller), tc.body)

			assertErrorEnvelope(t, response, tc.want, tc.wantCode)
			if len(store.lobbies) != 2 {
				t.Fatalf("%d lobbies after a refused request, want 2", len(store.lobbies))
			}
		})
	}
}

func TestCreateLobbyNeedsALoggedInUser(t *testing.T) {
	response := call(newRouter(lobbyStore(), fridayDirectory()), http.MethodPost, lobbiesPath, nil, lobbyJSON(validStart, validEnd, withChess))

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
}

func TestCreateLobbyAnswers503WhenDatabaseDown(t *testing.T) {
	store := lobbyStore()
	store.err = domain.ErrUnavailable

	response := call(newRouter(store, fridayDirectory()), http.MethodPost, lobbiesPath, asUser(otherID), lobbyJSON(validStart, validEnd, withChess))

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestDeleteLobbyReturns204ForTheCreator(t *testing.T) {
	store := lobbyStore()

	response := call(newRouter(store, fridayDirectory()), http.MethodDelete, lobbiesPath+"/"+otherLobby, asUser(otherID), "")

	if response.Code != http.StatusNoContent {
		t.Fatalf("status %d, want 204; body %q", response.Code, response.Body.String())
	}
	if _, ok := store.lobbies[otherLobby]; ok || len(store.lobbies) != 1 {
		t.Fatalf("lobbies %v, want only the lobby of Alex", store.lobbies)
	}
}

func TestDeleteLobbyGivesTheContractErrors(t *testing.T) {
	tests := []struct {
		name     string
		caller   string
		target   string
		wantCode string
		want     int
	}{
		{name: "member who is not the creator", caller: otherID, target: lobbiesPath + "/" + aliceLobby, wantCode: "not_allowed", want: 403},
		{name: "group admin who is not the creator", caller: alexID, target: lobbiesPath + "/" + otherLobby, wantCode: "not_allowed", want: 403},
		{name: "non-member", caller: missingID, target: lobbiesPath + "/" + otherLobby, wantCode: "group_not_found", want: 404},
		{name: "non-member on a missing lobby", caller: missingID, target: lobbiesPath + "/" + missingID, wantCode: "group_not_found", want: 404},
		{name: "missing lobby", caller: otherID, target: lobbiesPath + "/" + missingID, wantCode: "lobby_not_found", want: 404},
		{name: "malformed lobby ID", caller: otherID, target: lobbiesPath + "/" + malformedUUIDs, wantCode: "lobby_not_found", want: 404},
		{name: "malformed group and lobby ID gives the group first", caller: otherID, target: "/api/groups/" + malformedUUIDs + "/lobbies/" + malformedUUIDs, wantCode: "group_not_found", want: 404},
		{name: "unknown group", caller: otherID, target: "/api/groups/" + missingID + "/lobbies/" + otherLobby, wantCode: "group_not_found", want: 404},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := lobbyStore()

			response := call(newRouter(store, fridayDirectory()), http.MethodDelete, tc.target, asUser(tc.caller), "")

			assertErrorEnvelope(t, response, tc.want, tc.wantCode)
			if len(store.lobbies) != 2 {
				t.Fatalf("%d lobbies after a refused delete, want 2", len(store.lobbies))
			}
		})
	}
}

func TestDeleteLobbyNeedsALoggedInUserAndADatabase(t *testing.T) {
	target := lobbiesPath + "/" + otherLobby
	assertErrorEnvelope(t, call(newRouter(lobbyStore(), fridayDirectory()), http.MethodDelete, target, nil, ""),
		http.StatusUnauthorized, "unauthenticated")

	store := lobbyStore()
	store.err = domain.ErrUnavailable
	assertErrorEnvelope(t, call(newRouter(store, fridayDirectory()), http.MethodDelete, target, asUser(otherID), ""),
		http.StatusServiceUnavailable, "service_unavailable")
}
