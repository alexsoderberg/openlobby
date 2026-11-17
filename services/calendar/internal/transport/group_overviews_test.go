package transport_test

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/domain"
)

func listOverviews(t *testing.T, store *memoryGroups, directory *fakeDirectory) []map[string]any {
	t.Helper()
	response := call(newRouter(store, directory), http.MethodGet, "/api/group-overviews", asUser(alexID), "")
	if response.Code != http.StatusOK {
		t.Fatalf("status %d, body %q; want 200", response.Code, response.Body.String())
	}
	var list []map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	return list
}

func TestListGroupOverviewsIsAnEmptyArrayForUserInNoGroup(t *testing.T) {
	response := call(newRouter(&memoryGroups{}, &fakeDirectory{}), http.MethodGet, "/api/group-overviews", asUser(alexID), "")

	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "[]" {
		t.Fatalf("status %d, body %q; want 200 and []", response.Code, response.Body.String())
	}
}

func TestListGroupOverviewsSendsEveryKeyWithNullsAndFiveMembers(t *testing.T) {
	members := make([]domain.Member, domain.MaxOverviewMembers)
	names := map[string]string{}
	for i := range members {
		members[i].UserID = strings.Replace(fridayID, "1", string(rune('a'+i)), 1)
		names[members[i].UserID] = "Person " + string(rune('A'+i))
	}
	store := &memoryGroups{overviews: []domain.GroupOverview{
		{Group: domain.Group{ID: fridayID, Name: "Friday"}, MemberCount: 7, Members: members,
			NextLobby: &domain.Lobby{StartsAt: clockNow, EndsAt: clockNow.Add(2 * time.Hour), PlayerCount: 1}},
		{Group: domain.Group{ID: missingID, Name: "Sunday"}, MemberCount: 1},
	}}

	list := listOverviews(t, store, &fakeDirectory{names: names})

	if len(list) != 2 {
		t.Fatalf("got %d overviews, want 2", len(list))
	}
	friday := list[0]
	if friday["id"] != fridayID || friday["name"] != "Friday" || friday["memberCount"] != 7.0 {
		t.Fatalf("overview %v, want Friday with 7 members", friday)
	}
	if got := friday["members"].([]any); len(got) != domain.MaxOverviewMembers ||
		!reflect.DeepEqual(got[0], map[string]any{"userId": members[0].UserID, "displayName": "Person A"}) {
		t.Fatalf("members %v, want five UserRefs in order", got)
	}
	wantLobby := map[string]any{
		"gameName": nil, "modeName": nil, "activityName": nil, "gameGenre": nil, "maxPlayers": nil,
		"startsAt": "2026-11-02T18:00:00Z", "endsAt": "2026-11-02T20:00:00Z", "playerCount": 1.0,
	}
	if !reflect.DeepEqual(friday["nextLobby"], wantLobby) {
		t.Fatalf("next lobby %v, want %v", friday["nextLobby"], wantLobby)
	}
	sunday := list[1]
	if lobby, present := sunday["nextLobby"]; !present || lobby != nil {
		t.Fatalf("overview %v, want the key nextLobby with null", sunday)
	}
	if got, ok := sunday["members"].([]any); !ok || len(got) != 0 {
		t.Fatalf("members %v, want [] and not null", sunday["members"])
	}
}

func TestListGroupOverviewsSendsTheLobbyNames(t *testing.T) {
	game, mode, activity, genre, five := "Counter-Strike 2", "Ranked", "Vault", domain.Genre("shooter"), 5
	store := &memoryGroups{overviews: []domain.GroupOverview{{
		Group: domain.Group{ID: fridayID, Name: "Friday"}, MemberCount: 1, Members: []domain.Member{{UserID: alexID}},
		NextLobby: &domain.Lobby{GameName: &game, ModeName: &mode, ActivityName: &activity, GameGenre: &genre, MaxPlayers: &five,
			StartsAt: clockNow, EndsAt: clockNow.Add(time.Hour), PlayerCount: 2},
	}}}

	lobby := listOverviews(t, store, fridayDirectory())[0]["nextLobby"].(map[string]any)

	if lobby["gameName"] != game || lobby["modeName"] != mode || lobby["activityName"] != activity || lobby["gameGenre"] != "shooter" || lobby["maxPlayers"] != 5.0 {
		t.Fatalf("next lobby %v, want its names, genre and max players", lobby)
	}
}

func TestListGroupOverviewsReturns503WhenAuthIsDown(t *testing.T) {
	store := &memoryGroups{overviews: []domain.GroupOverview{{Group: domain.Group{ID: fridayID, Name: "Friday"}, MemberCount: 1, Members: []domain.Member{{UserID: alexID}}}}}

	response := call(newRouter(store, &fakeDirectory{err: domain.ErrUnavailable}), http.MethodGet, "/api/group-overviews", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestListGroupOverviewsRefusesMissingIdentity(t *testing.T) {
	store := &memoryGroups{}

	response := call(newRouter(store, &fakeDirectory{}), http.MethodGet, "/api/group-overviews", nil, "")

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
	}
}
