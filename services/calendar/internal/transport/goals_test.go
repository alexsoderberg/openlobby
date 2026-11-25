package transport_test

import (
	"context"
	"net/http"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const goalsPath = "/api/users/me/goals"

// memoryGoal is one goal of one person for one game.
type memoryGoal struct {
	userID, gameID string
	itemID         domain.ItemID
}

// memoryGoals keeps the goals of memoryGroups with the adapter's rules: an unknown game is not found, and only an item
// of Overwatch's drop list can become a goal.
type memoryGoals struct{ store *memoryGroups }

func (m memoryGoals) GameGoals(_ context.Context, userID string) ([]domain.GameGoals, error) {
	var games []domain.GameGoals // nil when empty, as the adapter gives it
	for _, game := range m.store.games {
		entry := domain.GameGoals{GameID: game.ID, GameName: game.Name, Goals: []domain.GameItem{}}
		for _, goal := range m.store.goals {
			if goal.userID == userID && goal.gameID == game.ID {
				entry.Goals = append(entry.Goals, domain.GameItem{Item: domain.Item{ID: goal.itemID}, DropsIn: []domain.DropActivity{}})
			}
		}
		if len(entry.Goals) > 0 || (game.ID == overwatchID && len(m.store.drops) > 0) {
			games = append(games, entry)
		}
	}
	return games, m.store.err
}

func (m memoryGoals) AddGoal(_ context.Context, userID, gameID string, itemID domain.ItemID) error {
	if m.store.gameIndex(gameID) < 0 {
		return application.ErrGameNotFound
	}
	goal := memoryGoal{userID: userID, gameID: gameID, itemID: itemID}
	if slices.Contains(m.store.goals, goal) {
		return nil
	}
	onList := slices.ContainsFunc(m.store.drops, func(drop domain.Drop) bool { return drop.ItemID == itemID })
	if gameID != overwatchID || !onList {
		return domain.ErrInvalidItem
	}
	m.store.goals = append(m.store.goals, goal)
	return nil
}

func (m memoryGoals) RemoveGoal(_ context.Context, userID, gameID string, itemID domain.ItemID) error {
	if m.store.gameIndex(gameID) < 0 {
		return application.ErrGameNotFound
	}
	m.store.goals = slices.DeleteFunc(m.store.goals, func(goal memoryGoal) bool { return goal == memoryGoal{userID, gameID, itemID} })
	return nil
}

// goalStore has Thunderfury on Overwatch's drop list.
func goalStore() *memoryGroups {
	store := itemStore()
	store.drops = []domain.Drop{{ItemID: thunderfuryID, Activity: moltenCore}}
	return store
}

func goalPath(gameID string, itemID string) string {
	return "/api/users/me/games/" + gameID + "/goals/" + itemID
}

var thunderfuryGoal = goalPath(overwatchID, strconv.Itoa(int(thunderfuryID)))

// The goal is the caller's, and a second add changes nothing (ADR 0029 section 5).
func TestAddGoalIsIdempotentAndForTheCaller(t *testing.T) {
	store := goalStore()
	router := gameRouter(store)

	first := call(router, http.MethodPut, thunderfuryGoal, asUser(otherID), "")
	second := call(router, http.MethodPut, thunderfuryGoal, asUser(otherID), "")

	if first.Code != http.StatusNoContent || second.Code != http.StatusNoContent {
		t.Fatalf("status %d and %d; want 204 twice", first.Code, second.Code)
	}
	want := []memoryGoal{{userID: otherID, gameID: overwatchID, itemID: thunderfuryID}}
	if !reflect.DeepEqual(store.goals, want) {
		t.Fatalf("goals %+v; want %+v", store.goals, want)
	}
}

// An existing goal is 204 also when its item left every drop list (ADR 0029 Amendment 2026-11-25 item 10).
func TestAddGoalKeepsAnExistingGoalOffTheDropList(t *testing.T) {
	store := goalStore()
	store.drops = nil
	store.goals = []memoryGoal{{userID: otherID, gameID: overwatchID, itemID: thunderfuryID}}

	response := call(gameRouter(store), http.MethodPut, thunderfuryGoal, asUser(otherID), "")

	if response.Code != http.StatusNoContent || len(store.goals) != 1 {
		t.Fatalf("status %d, goals %+v; want 204 and the one goal", response.Code, store.goals)
	}
}

// A goal whose item left the drop list can be removed, and removing a missing goal is also 204 (ADR 0029 section 5).
func TestRemoveGoalNeedsNoDropListAndIsIdempotent(t *testing.T) {
	store := goalStore()
	store.drops = nil
	store.goals = []memoryGoal{{userID: otherID, gameID: overwatchID, itemID: thunderfuryID}, {userID: alexID, gameID: overwatchID, itemID: thunderfuryID}}
	router := gameRouter(store)

	first := call(router, http.MethodDelete, thunderfuryGoal, asUser(otherID), "")
	second := call(router, http.MethodDelete, thunderfuryGoal, asUser(otherID), "")

	if first.Code != http.StatusNoContent || second.Code != http.StatusNoContent {
		t.Fatalf("status %d and %d; want 204 twice", first.Code, second.Code)
	}
	if want := []memoryGoal{{userID: alexID, gameID: overwatchID, itemID: thunderfuryID}}; !reflect.DeepEqual(store.goals, want) {
		t.Fatalf("goals %+v; want only Alex's goal kept", store.goals)
	}
}

// The checks come in the contract's order, and a refused write changes nothing (ADR 0029 section 5).
func TestGoalWritesRefuse(t *testing.T) {
	tests := []struct {
		name    string
		method  string
		path    string
		headers map[string]string
		status  int
		code    string
	}{
		{name: "no identity", path: thunderfuryGoal, headers: map[string]string{}, status: http.StatusUnauthorized, code: "unauthenticated"},
		{name: "malformed game before the item", path: goalPath("nope", "x"), headers: asUser(otherID), status: http.StatusNotFound, code: "game_not_found"},
		{name: "item not a number", path: goalPath(overwatchID, "x"), headers: asUser(otherID), status: http.StatusBadRequest, code: "invalid_item"},
		{name: "item zero", path: goalPath(overwatchID, "0"), headers: asUser(otherID), status: http.StatusBadRequest, code: "invalid_item"},
		{name: "item before the game", path: goalPath(missingID, "-1"), headers: asUser(otherID), status: http.StatusBadRequest, code: "invalid_item"},
		{name: "unknown game before an off-list item", path: goalPath(missingID, "1"), headers: asUser(otherID), status: http.StatusNotFound, code: "game_not_found"},
		{name: "item on no drop list of the game", method: http.MethodPut, path: goalPath(counterStrikeID, strconv.Itoa(int(thunderfuryID))), headers: asUser(otherID), status: http.StatusBadRequest, code: "invalid_item"},
		{name: "item on no drop list", method: http.MethodPut, path: goalPath(overwatchID, "7"), headers: asUser(otherID), status: http.StatusBadRequest, code: "invalid_item"},
	}
	for _, tc := range tests {
		methods := []string{http.MethodPut, http.MethodDelete}
		if tc.method != "" {
			methods = []string{tc.method}
		}
		for _, method := range methods {
			t.Run(method+" "+tc.name, func(t *testing.T) {
				store := goalStore()

				assertErrorEnvelope(t, call(gameRouter(store), method, tc.path, tc.headers, ""), tc.status, tc.code)
				if len(store.goals) != 0 {
					t.Fatalf("goals %+v; want none", store.goals)
				}
			})
		}
	}
}

// The list holds the caller's goals only, with the name status of each (ADR 0029 section 5).
func TestGetGoalsListsTheCallersGoals(t *testing.T) {
	store := goalStore()
	store.goals = []memoryGoal{{userID: otherID, gameID: overwatchID, itemID: thunderfuryID}, {userID: otherID, gameID: overwatchID, itemID: unknownItemID}, {userID: alexID, gameID: counterStrikeID, itemID: 1}}

	response := call(gameRouter(store), http.MethodGet, goalsPath, asUser(otherID), "")

	assertJSON(t, response, http.StatusOK, map[string]any{"games": []any{map[string]any{
		"gameId": overwatchID, "gameName": "Overwatch", "gameLogoVersion": nil, "goals": []any{
			map[string]any{"itemId": float64(19019), "name": "Thunderfury, Blessed Blade of the Windseeker", "status": "known", "dropsIn": []any{}},
			map[string]any{"itemId": float64(7), "name": nil, "status": "unknown", "dropsIn": []any{}},
		},
	}}})
}

func TestGetGoalsAnswers401WithoutIdentity(t *testing.T) {
	assertErrorEnvelope(t, call(gameRouter(goalStore()), http.MethodGet, goalsPath, map[string]string{}, ""), http.StatusUnauthorized, "unauthenticated")
}

// The lobby read sends each player's goals with their names, [] for none (ADR 0029 section 5).
func TestGetLobbySendsThePlayersGoals(t *testing.T) {
	store := upcomingStore()
	store.itemNames = map[domain.ItemID]string{thunderfuryID: "Thunderfury"}
	store.lobbyGoals = map[string][]domain.Item{alexID: {{ID: thunderfuryID}, {ID: unknownItemID}}}

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, lobbiesPath+"/"+otherLobby, asUser(otherID), "")

	body := decode(t, response.Body.String())
	players, _ := body["players"].([]any)
	var goals []any
	for _, player := range players {
		goals = append(goals, player.(map[string]any)["goals"])
	}
	want := []any{[]any{}, []any{
		map[string]any{"itemId": float64(19019), "name": "Thunderfury", "status": "known"},
		map[string]any{"itemId": float64(7), "name": nil, "status": "unknown"},
	}}
	if response.Code != http.StatusOK || !reflect.DeepEqual(goals, want) {
		t.Fatalf("status %d, goals %v; want 200, %v", response.Code, goals, want)
	}
}

// A person with no goals and no drop lists gets an empty list, never null.
func TestGetGoalsAnswersAnEmptyList(t *testing.T) {
	response := call(gameRouter(itemStore()), http.MethodGet, goalsPath, asUser(otherID), "")

	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != `{"games":[]}` {
		t.Fatalf("status %d, body %q; want 200 with {\"games\":[]}", response.Code, response.Body.String())
	}
}
