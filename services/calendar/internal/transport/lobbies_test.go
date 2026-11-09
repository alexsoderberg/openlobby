package transport_test

import (
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"
	"time"

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

func (t memoryLobbyTx) JoinState(_ context.Context, groupID, lobbyID, userID string) (domain.JoinState, bool, error) {
	lobby, ok := t.store.lobbies[lobbyID]
	if !ok || lobby.GroupID != groupID {
		return domain.JoinState{}, false, nil
	}
	return domain.JoinState{EndsAt: lobby.EndsAt, MaxPlayers: lobby.MaxPlayers, PlayerCount: lobby.PlayerCount, IsPlayer: t.store.joined[lobbyID+"/"+userID],
		Roles: lobby.RoleSlots}, true, nil
}

func (t memoryLobbyTx) SavePlayer(_ context.Context, lobbyID, userID string, _ *string, _ time.Time) error {
	if t.store.joined == nil {
		t.store.joined = map[string]bool{}
	}
	t.store.joined[lobbyID+"/"+userID] = true
	lobby := t.store.lobbies[lobbyID]
	lobby.PlayerCount++
	t.store.lobbies[lobbyID] = lobby
	return nil
}

func (t memoryLobbyTx) RemovePlayer(_ context.Context, lobbyID, userID string) error {
	key := lobbyID + "/" + userID
	if t.store.joined[key] {
		delete(t.store.joined, key)
		lobby := t.store.lobbies[lobbyID]
		lobby.PlayerCount--
		t.store.lobbies[lobbyID] = lobby
	}
	return nil
}

func (t memoryLobbyTx) DeleteLobby(_ context.Context, _, lobbyID string) error {
	delete(t.store.lobbies, lobbyID)
	return nil
}

// Upcoming and the methods after it make memoryGroups the lobby reader. The clock of the router is the zero time, so
// every lobby with a later end is upcoming.
func (m *memoryGroups) Upcoming(_ context.Context, groupID, callerID string, at time.Time) ([]domain.Lobby, error) {
	var upcoming []domain.Lobby
	for _, lobby := range m.lobbies {
		if lobby.GroupID == groupID && lobby.EndsAt.After(at) {
			upcoming = append(upcoming, lobby)
		}
	}
	slices.SortFunc(upcoming, func(a, b domain.Lobby) int {
		return cmp.Or(a.StartsAt.Compare(b.StartsAt), cmp.Compare(a.ID, b.ID))
	})
	return upcoming, m.err
}

func (m *memoryGroups) Lobby(_ context.Context, groupID, lobbyID, callerID string, at time.Time) (domain.Lobby, error) {
	lobby, ok := m.lobbies[lobbyID]
	if !ok || lobby.GroupID != groupID || !lobby.EndsAt.After(at) {
		return domain.Lobby{}, domain.ErrLobbyNotFound
	}
	return lobby, m.err
}

// Players gives Other as flex and Alex in the Tank role.
func (m *memoryGroups) Players(_ context.Context, _ string) ([]domain.Player, error) {
	return []domain.Player{{UserID: otherID}, {UserID: alexID, GameRoleID: intpStr(tankRoleID)}}, m.err
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
			assertNoRoleSlots(t, got)
			want := map[string]any{
				"id": createdID, "gameName": tc.wantGame, "gameGenre": nil, "maxPlayers": tc.wantMax, "startsAt": tc.wantStart,
				"endsAt": validEnd, "createdByUserId": otherID, "playerCount": float64(1), "joinedByMe": true, "flexCount": float64(0),
				"gameId": nil, "modeId": nil, "modeName": nil, "activityId": nil, "activityName": nil,
			}
			if tc.wantGame == "Chess" {
				want["gameId"] = chessGameID
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

// upcomingStore adds an ended lobby to lobbyStore and gives the other two an end time. The router clock is the zero time.
func upcomingStore() *memoryGroups {
	store := lobbyStore()
	start := time.Date(2026, 11, 2, 19, 0, 0, 0, time.UTC)
	store.lobbies[otherLobby] = domain.Lobby{ID: otherLobby, GroupID: fridayID, CreatedByUserID: otherID, GameName: "Chess",
		StartsAt: start.Add(time.Hour), EndsAt: start.Add(2 * time.Hour), PlayerCount: 1, JoinedByMe: true}
	store.lobbies[aliceLobby] = domain.Lobby{ID: aliceLobby, GroupID: fridayID, CreatedByUserID: alexID, GameName: "Go",
		StartsAt: start, EndsAt: start.Add(time.Hour), PlayerCount: 2}
	store.lobbies[endedLobby] = domain.Lobby{ID: endedLobby, GroupID: fridayID, CreatedByUserID: alexID, GameName: "Old"}
	return store
}

const endedLobby = "a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3"

func TestListUpcomingLobbiesReturns200WithTheContractShape(t *testing.T) {
	response := call(newRouter(upcomingStore(), fridayDirectory()), http.MethodGet, lobbiesPath, asUser(otherID), "")

	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body %q", response.Code, response.Body.String())
	}
	var got []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0]["id"] != aliceLobby || got[1]["id"] != otherLobby {
		t.Fatalf("body %v, want the lobbies of Alex then Other, without the ended one", got)
	}
	assertNoRoleSlots(t, got[0])
	want := map[string]any{
		"id": aliceLobby, "gameName": "Go", "gameGenre": nil, "maxPlayers": nil, "startsAt": "2026-11-02T19:00:00Z",
		"endsAt": "2026-11-02T20:00:00Z", "createdByUserId": alexID, "playerCount": float64(2), "joinedByMe": false, "flexCount": float64(0),
		"gameId": nil, "modeId": nil, "modeName": nil, "activityId": nil, "activityName": nil,
	}
	for key, value := range want {
		if got[0][key] != value {
			t.Errorf("%s = %v, want %v", key, got[0][key], value)
		}
	}
	if len(got[0]) != len(want) {
		t.Errorf("body %v has fields other than %v", got[0], want)
	}
}

func TestListUpcomingLobbiesWithNoLobbiesIsAnEmptyList(t *testing.T) {
	store := lobbyStore()
	store.lobbies = map[string]domain.Lobby{}

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, lobbiesPath, asUser(otherID), "")

	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "[]" {
		t.Fatalf("status %d, body %q; want 200 and []", response.Code, response.Body.String())
	}
}

func TestGetLobbyReturns200WithPlayers(t *testing.T) {
	response := call(newRouter(upcomingStore(), fridayDirectory()), http.MethodGet, lobbiesPath+"/"+otherLobby, asUser(otherID), "")

	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body %q", response.Code, response.Body.String())
	}
	var got struct {
		ID         string `json:"id"`
		JoinedByMe bool   `json:"joinedByMe"`
		Players    []struct {
			UserID      string  `json:"userId"`
			DisplayName string  `json:"displayName"`
			GameRoleID  *string `json:"gameRoleId"`
		} `json:"players"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != otherLobby || !got.JoinedByMe || len(got.Players) != 2 || got.Players[0].UserID != otherID || got.Players[0].DisplayName == "" || got.Players[1].UserID != alexID ||
		got.Players[0].GameRoleID != nil || got.Players[1].GameRoleID == nil || *got.Players[1].GameRoleID != tankRoleID {
		t.Fatalf("body %q, want the lobby with Other and Alex as named players", response.Body.String())
	}
}

func TestUpcomingAndGetLobbyGiveTheContractErrors(t *testing.T) {
	tests := []struct {
		name     string
		caller   string
		target   string
		wantCode string
		want     int
	}{
		{name: "list: non-member", caller: missingID, target: lobbiesPath, wantCode: "group_not_found", want: 404},
		{name: "list: unknown group", caller: otherID, target: "/api/groups/" + missingID + "/lobbies", wantCode: "group_not_found", want: 404},
		{name: "list: malformed group ID", caller: otherID, target: "/api/groups/" + malformedUUIDs + "/lobbies", wantCode: "group_not_found", want: 404},
		{name: "get: non-member", caller: missingID, target: lobbiesPath + "/" + otherLobby, wantCode: "group_not_found", want: 404},
		{name: "get: non-member on a missing lobby", caller: missingID, target: lobbiesPath + "/" + missingID, wantCode: "group_not_found", want: 404},
		{name: "get: ended lobby", caller: otherID, target: lobbiesPath + "/" + endedLobby, wantCode: "lobby_not_found", want: 404},
		{name: "get: missing lobby", caller: otherID, target: lobbiesPath + "/" + missingID, wantCode: "lobby_not_found", want: 404},
		{name: "get: malformed lobby ID", caller: otherID, target: lobbiesPath + "/" + malformedUUIDs, wantCode: "lobby_not_found", want: 404},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := call(newRouter(upcomingStore(), fridayDirectory()), http.MethodGet, tc.target, asUser(tc.caller), "")

			assertErrorEnvelope(t, response, tc.want, tc.wantCode)
		})
	}
}

func TestUpcomingAndGetLobbyNeedALoggedInUserAndADatabase(t *testing.T) {
	for _, target := range []string{lobbiesPath, lobbiesPath + "/" + otherLobby} {
		assertErrorEnvelope(t, call(newRouter(upcomingStore(), fridayDirectory()), http.MethodGet, target, nil, ""),
			http.StatusUnauthorized, "unauthenticated")

		store := upcomingStore()
		store.err = domain.ErrUnavailable
		assertErrorEnvelope(t, call(newRouter(store, fridayDirectory()), http.MethodGet, target, asUser(otherID), ""),
			http.StatusServiceUnavailable, "service_unavailable")
	}
}

const playerPath = lobbiesPath + "/" + aliceLobby + "/players/me"

func TestJoinLobbyAddsTheCallerAndLeaveRemovesThem(t *testing.T) {
	store := upcomingStore()
	router := newRouter(store, fridayDirectory())

	join := call(router, http.MethodPut, playerPath, asUser(otherID), "")
	joinedAgain := call(router, http.MethodPut, playerPath, asUser(otherID), "")

	if join.Code != http.StatusNoContent || joinedAgain.Code != http.StatusNoContent || store.lobbies[aliceLobby].PlayerCount != 3 {
		t.Fatalf("join %d, again %d, players %d; want 204, 204 and 3", join.Code, joinedAgain.Code, store.lobbies[aliceLobby].PlayerCount)
	}
	left := call(router, http.MethodDelete, playerPath, asUser(otherID), "")
	leftAgain := call(router, http.MethodDelete, playerPath, asUser(otherID), "")
	if left.Code != http.StatusNoContent || leftAgain.Code != http.StatusNoContent || store.lobbies[aliceLobby].PlayerCount != 2 {
		t.Fatalf("leave %d, again %d, players %d; want 204, 204 and 2", left.Code, leftAgain.Code, store.lobbies[aliceLobby].PlayerCount)
	}
}

func TestJoinAndLeaveLobbyGiveTheContractErrors(t *testing.T) {
	full := 2
	tests := []struct {
		name     string
		method   string
		caller   string
		target   string
		prepare  func(*memoryGroups)
		wantCode string
		want     int
	}{
		{name: "join: non-member", method: http.MethodPut, caller: missingID, target: playerPath, wantCode: "group_not_found", want: 404},
		{name: "join: missing lobby", method: http.MethodPut, caller: otherID, target: lobbiesPath + "/" + missingID + "/players/me", wantCode: "lobby_not_found", want: 404},
		{name: "join: malformed lobby ID", method: http.MethodPut, caller: otherID, target: lobbiesPath + "/" + malformedUUIDs + "/players/me", wantCode: "lobby_not_found", want: 404},
		{name: "join: ended", method: http.MethodPut, caller: otherID, target: lobbiesPath + "/" + endedLobby + "/players/me", wantCode: "lobby_has_ended", want: 409},
		{name: "join: full", method: http.MethodPut, caller: otherID, target: playerPath, wantCode: "lobby_full", want: 409,
			prepare: func(s *memoryGroups) {
				lobby := s.lobbies[aliceLobby]
				lobby.MaxPlayers = &full
				s.lobbies[aliceLobby] = lobby
			}},
		{name: "leave: non-member", method: http.MethodDelete, caller: missingID, target: playerPath, wantCode: "group_not_found", want: 404},
		{name: "leave: missing lobby", method: http.MethodDelete, caller: otherID, target: lobbiesPath + "/" + missingID + "/players/me", wantCode: "lobby_not_found", want: 404},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := upcomingStore()
			if tc.prepare != nil {
				tc.prepare(store)
			}
			before := store.lobbies[aliceLobby].PlayerCount

			response := call(newRouter(store, fridayDirectory()), tc.method, tc.target, asUser(tc.caller), "")

			assertErrorEnvelope(t, response, tc.want, tc.wantCode)
			if store.lobbies[aliceLobby].PlayerCount != before {
				t.Fatal("a refused call changed the players")
			}
		})
	}
}

func TestJoinAndLeaveLobbyNeedALogin(t *testing.T) {
	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		response := call(newRouter(upcomingStore(), fridayDirectory()), method, playerPath, nil, "")

		if response.Code != http.StatusUnauthorized {
			t.Errorf("%s status %d, want 401", method, response.Code)
		}
	}
}

// The create response and the lists carry the genre of the lobby's game (ADR 0016).
func TestLobbyResponsesCarryTheGameGenre(t *testing.T) {
	store := lobbyStore()
	strategy := domain.Genre("strategy")
	store.games[0].Genre = &strategy
	store.lobbies[aliceLobby] = domain.Lobby{ID: aliceLobby, GroupID: fridayID, CreatedByUserID: alexID, GameName: "Chess", GameGenre: &strategy}

	created := call(newRouter(store, fridayDirectory()), http.MethodPost, lobbiesPath, asUser(otherID), lobbyJSON(validStart, validEnd, withChess))
	listed := call(newRouter(store, fridayDirectory()), http.MethodGet, lobbiesPath, asUser(otherID), "")

	if !strings.Contains(created.Body.String(), `"gameGenre":"strategy"`) || !strings.Contains(listed.Body.String(), `"gameGenre":"strategy"`) {
		t.Fatalf("created %q, listed %q; want gameGenre strategy in both", created.Body.String(), listed.Body.String())
	}
}
