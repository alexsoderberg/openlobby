package transport_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	moltenCoreID   = "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0"
	dropListPath   = gamePath + "/activities/" + moltenCoreID + "/items/"
	thunderfuryID  = domain.ItemID(19019)
	unknownItemID  = domain.ItemID(7)
	itemIconPrefix = "/api/items/"
)

var moltenCore = domain.DropActivity{ActivityID: moltenCoreID, ActivityName: "Molten Core", ModeName: "Raid"}

// memoryDrops keeps the drop lists of memoryGroups with the adapter's rules: an unknown game is not found, and Molten
// Core is the only activity, of Overwatch.
type memoryDrops struct{ store *memoryGroups }

func (m memoryDrops) check(gameID, activityID string) error {
	if m.store.gameIndex(gameID) < 0 {
		return application.ErrGameNotFound
	}
	if activityID != "" && (gameID != overwatchID || activityID != moltenCoreID) {
		return domain.ErrInvalidActivity
	}
	return nil
}

func (m memoryDrops) Drops(_ context.Context, gameID, activityID string) ([]domain.Drop, error) {
	return m.store.drops, m.check(gameID, activityID)
}

func (m memoryDrops) AddDrop(_ context.Context, gameID, activityID string, itemID domain.ItemID) error {
	if err := m.check(gameID, activityID); err != nil {
		return err
	}
	drop := domain.Drop{ItemID: itemID, Activity: moltenCore}
	if slices.Contains(m.store.drops, drop) {
		return application.ErrDropItemTaken
	}
	m.store.drops = append(m.store.drops, drop)
	return nil
}

func (m memoryDrops) RemoveDrop(_ context.Context, gameID, activityID string, itemID domain.ItemID) error {
	if err := m.check(gameID, activityID); err != nil {
		return err
	}
	m.store.drops = slices.DeleteFunc(m.store.drops, func(drop domain.Drop) bool { return drop.ItemID == itemID })
	return nil
}

func (m memoryDrops) IsReferenced(_ context.Context, itemID domain.ItemID) (bool, error) {
	onList := slices.ContainsFunc(m.store.drops, func(drop domain.Drop) bool { return drop.ItemID == itemID })
	inGoal := slices.ContainsFunc(m.store.goals, func(goal memoryGoal) bool { return goal.itemID == itemID })
	return onList || inGoal, m.store.err
}

// memoryCatalog knows the items of itemNames, each with a PNG icon.
type memoryCatalog struct{ store *memoryGroups }

func (m memoryCatalog) Item(_ context.Context, itemID domain.ItemID) (domain.CatalogItem, error) {
	name, known := m.store.itemNames[itemID]
	switch {
	case m.store.catalogDown:
		return domain.CatalogItem{}, application.ErrCatalogUnavailable
	case !known:
		return domain.CatalogItem{}, application.ErrItemNotFound
	}
	return domain.CatalogItem{Name: name}, nil
}

func (m memoryCatalog) ItemIcon(ctx context.Context, itemID domain.ItemID) (domain.ItemIcon, error) {
	if _, err := m.Item(ctx, itemID); err != nil {
		return domain.ItemIcon{}, err
	}
	return domain.ItemIcon{MediaType: "image/png", Bytes: []byte(pngOf(32))}, nil
}

func itemStore() *memoryGroups {
	store := gameStore()
	store.itemNames = map[domain.ItemID]string{thunderfuryID: "Thunderfury, Blessed Blade of the Windseeker"}
	return store
}

func itemPath(id domain.ItemID) string { return dropListPath + strconv.Itoa(int(id)) }

// A system admin adds a known and an unknown item; the answer gives the name status at once (REQ-0030).
func TestAddDropItemAnswers201WithTheNameStatus(t *testing.T) {
	store := itemStore()
	router := gameRouter(store)

	known := call(router, http.MethodPut, itemPath(thunderfuryID), asAdminUser(alexID), "")
	unknown := call(router, http.MethodPut, itemPath(unknownItemID), asAdminUser(alexID), "")

	assertJSON(t, known, http.StatusCreated, map[string]any{"itemId": float64(19019), "name": "Thunderfury, Blessed Blade of the Windseeker", "status": "known"})
	assertJSON(t, unknown, http.StatusCreated, map[string]any{"itemId": float64(7), "name": nil, "status": "unknown"})
	if len(store.drops) != 2 {
		t.Fatalf("drops %+v; want both stored", store.drops)
	}
}

// The checks come in the contract's order, and a refused write changes nothing (ADR 0029 section 5).
func TestDropListWritesRefuse(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		headers  map[string]string
		status   int
		code     string
		existing bool
	}{
		{name: "no identity", path: itemPath(thunderfuryID), headers: map[string]string{}, status: http.StatusUnauthorized, code: "unauthenticated"},
		{name: "malformed game", path: gameRoot + "/nope/activities/" + moltenCoreID + "/items/1", headers: asAdminUser(alexID), status: http.StatusNotFound, code: "game_not_found"},
		{name: "malformed game before permission", path: gameRoot + "/nope/activities/nope/items/x", headers: asUser(otherID), status: http.StatusNotFound, code: "game_not_found"},
		{name: "malformed activity before permission", path: gamePath + "/activities/nope/items/1", headers: asUser(otherID), status: http.StatusBadRequest, code: "invalid_activity"},
		{name: "not a system admin", path: itemPath(thunderfuryID), headers: asUser(otherID), status: http.StatusForbidden, code: "not_allowed"},
		{name: "invalid item", path: dropListPath + "0", headers: asAdminUser(alexID), status: http.StatusBadRequest, code: "invalid_item"},
		{name: "unknown game", path: gameRoot + "/" + missingID + "/activities/" + moltenCoreID + "/items/1", headers: asAdminUser(alexID), status: http.StatusNotFound, code: "game_not_found"},
		{name: "activity of another game", path: gameRoot + "/" + counterStrikeID + "/activities/" + moltenCoreID + "/items/1", headers: asAdminUser(alexID), status: http.StatusBadRequest, code: "invalid_activity"},
	}
	for _, method := range []string{http.MethodPut, http.MethodDelete} {
		for _, tc := range tests {
			t.Run(method+" "+tc.name, func(t *testing.T) {
				store := itemStore()
				store.drops = []domain.Drop{{ItemID: thunderfuryID, Activity: moltenCore}}

				response := call(gameRouter(store), method, tc.path, tc.headers, "")

				assertErrorEnvelope(t, response, tc.status, tc.code)
				if len(store.drops) != 1 {
					t.Fatalf("drops %+v; want unchanged", store.drops)
				}
			})
		}
	}
}

func TestAddDropItemAnswers409WhenTheItemIsOnTheList(t *testing.T) {
	store := itemStore()
	store.drops = []domain.Drop{{ItemID: thunderfuryID, Activity: moltenCore}}

	response := call(gameRouter(store), http.MethodPut, itemPath(thunderfuryID), asAdminUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusConflict, "drop_item_taken")
}

// Removing is idempotent once the checks pass.
func TestRemoveDropItemAnswers204(t *testing.T) {
	store := itemStore()
	store.drops = []domain.Drop{{ItemID: thunderfuryID, Activity: moltenCore}}
	router := gameRouter(store)

	for range 2 {
		if response := call(router, http.MethodDelete, itemPath(thunderfuryID), asAdminUser(alexID), ""); response.Code != http.StatusNoContent {
			t.Fatalf("status %d, want 204; body %q", response.Code, response.Body.String())
		}
	}
	if len(store.drops) != 0 {
		t.Fatalf("drops %+v; want none", store.drops)
	}
}

// Any signed-in person lists the items; the search keeps unknown items, and an unavailable catalog marks the search
// as not complete (ADR 0029 section 5).
func TestListGameItems(t *testing.T) {
	store := itemStore()
	store.drops = []domain.Drop{{ItemID: thunderfuryID, Activity: moltenCore}, {ItemID: unknownItemID, Activity: moltenCore}}
	router := gameRouter(store)
	dropsIn := []any{map[string]any{"activityId": moltenCoreID, "activityName": "Molten Core", "modeName": "Raid"}}

	response := call(router, http.MethodGet, gamePath+"/items?activityId="+moltenCoreID+"&q=%20blessed%20", asUser(otherID), "")

	assertJSON(t, response, http.StatusOK, map[string]any{"nameSearchComplete": true, "items": []any{
		map[string]any{"itemId": float64(19019), "name": "Thunderfury, Blessed Blade of the Windseeker", "status": "known", "dropsIn": dropsIn},
		map[string]any{"itemId": float64(7), "name": nil, "status": "unknown", "dropsIn": dropsIn},
	}})

	store.catalogDown = true
	response = call(router, http.MethodGet, gamePath+"/items?q=nothing", asUser(otherID), "")

	assertJSON(t, response, http.StatusOK, map[string]any{"nameSearchComplete": false, "items": []any{
		map[string]any{"itemId": float64(19019), "name": nil, "status": "unavailable", "dropsIn": dropsIn},
		map[string]any{"itemId": float64(7), "name": nil, "status": "unavailable", "dropsIn": dropsIn},
	}})
}

func TestListGameItemsRefuses(t *testing.T) {
	tests := []struct {
		name   string
		path   string
		status int
		code   string
	}{
		{name: "malformed game before the search", path: gameRoot + "/nope/items?activityId=nope&q=" + strings.Repeat("a", 51), status: http.StatusNotFound, code: "game_not_found"},
		{name: "activity not a uuid", path: gamePath + "/items?activityId=nope", status: http.StatusBadRequest, code: "invalid_request"},
		{name: "search too long", path: gamePath + "/items?q=" + strings.Repeat("a", 51), status: http.StatusBadRequest, code: "invalid_request"},
		{name: "unknown game", path: gameRoot + "/" + missingID + "/items", status: http.StatusNotFound, code: "game_not_found"},
		{name: "activity of another game", path: gameRoot + "/" + counterStrikeID + "/items?activityId=" + moltenCoreID, status: http.StatusBadRequest, code: "invalid_activity"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assertErrorEnvelope(t, call(gameRouter(itemStore()), http.MethodGet, tc.path, asUser(otherID), ""), tc.status, tc.code)
		})
	}
	assertErrorEnvelope(t, call(gameRouter(itemStore()), http.MethodGet, gamePath+"/items?activityId=nope", map[string]string{}, ""), http.StatusUnauthorized, "unauthenticated")
}

// The icon is served for an item on a drop list, and for an item that is only in a goal (REQ-0030).
func TestGetItemIcon(t *testing.T) {
	store := itemStore()
	store.drops = []domain.Drop{{ItemID: thunderfuryID, Activity: moltenCore}}
	store.itemNames[42] = "Goal only"
	store.goals = []memoryGoal{{userID: alexID, gameID: counterStrikeID, itemID: 42}}
	router := gameRouter(store)

	for _, id := range []string{"19019", "42"} {
		response := call(router, http.MethodGet, itemIconPrefix+id+"/icon", asUser(otherID), "")

		if response.Code != http.StatusOK || response.Body.String() != pngOf(32) {
			t.Fatalf("item %s: status %d; want 200 with the icon", id, response.Code)
		}
		wantHeaders := map[string]string{"Content-Type": "image/png", "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"}
		for name, want := range wantHeaders {
			if got := response.Header().Get(name); got != want {
				t.Errorf("%s = %q, want %q", name, got, want)
			}
		}
	}
}

func TestGetItemIconRefuses(t *testing.T) {
	store := itemStore()
	store.drops = []domain.Drop{{ItemID: thunderfuryID, Activity: moltenCore}, {ItemID: unknownItemID, Activity: moltenCore}}
	router := gameRouter(store)

	assertErrorEnvelope(t, call(router, http.MethodGet, itemIconPrefix+"19019/icon", map[string]string{}, ""), http.StatusUnauthorized, "unauthenticated")
	assertErrorEnvelope(t, call(router, http.MethodGet, itemIconPrefix+"abc/icon", asUser(otherID), ""), http.StatusBadRequest, "invalid_item")
	assertErrorEnvelope(t, call(router, http.MethodGet, itemIconPrefix+"5/icon", asUser(otherID), ""), http.StatusNotFound, "item_not_found")
	assertErrorEnvelope(t, call(router, http.MethodGet, itemIconPrefix+"7/icon", asUser(otherID), ""), http.StatusNotFound, "item_not_found")
	store.catalogDown = true
	assertErrorEnvelope(t, call(router, http.MethodGet, itemIconPrefix+"19019/icon", asUser(otherID), ""), http.StatusServiceUnavailable, "service_unavailable")
}

func assertJSON(t *testing.T, response *httptest.ResponseRecorder, wantStatus int, want map[string]any) {
	t.Helper()
	result := response.Result()
	var got map[string]any
	if err := json.NewDecoder(result.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if result.StatusCode != wantStatus || !reflect.DeepEqual(got, want) {
		t.Fatalf("status %d, body %v; want %d, %v", result.StatusCode, got, wantStatus, want)
	}
}
