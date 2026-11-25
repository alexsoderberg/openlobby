//go:build integration

package postgres

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

func mustAddGoal(t *testing.T, store *Store, userID, gameID string, itemID domain.ItemID) {
	t.Helper()
	if err := store.Goals().AddGoal(context.Background(), userID, gameID, itemID); err != nil {
		t.Fatalf("add goal %d: %v", itemID, err)
	}
}

// createActivityGame creates a game with one mode and one Named activity, and puts the items on its drop list.
func createActivityGame(t *testing.T, store *Store, name string, items ...domain.ItemID) domain.Game {
	t.Helper()
	game, err := store.Games().Create(context.Background(), domain.Game{Name: name, Modes: []domain.GameMode{
		{Name: "Dungeon", MaxPlayers: intPtr(5), Activities: []domain.Activity{{Name: "Deadmines"}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range items {
		mustAddDrop(t, store, game.ID, game.Modes[0].Activities[0].ID, item)
	}
	return game
}

// An add is idempotent and needs the item on a drop list of the game; a remove needs none; a game delete takes the
// goals with it (ADR 0029 sections 3 and 5).
func TestGoalWritesFollowTheContract(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	game := createActivityGame(t, store, "Raid Game", 10)
	other := createActivityGame(t, store, "Other Game", 11)

	mustAddGoal(t, store, alexID, game.ID, 10)
	mustAddGoal(t, store, alexID, game.ID, 10)
	if rows := count(t, store, `SELECT count(*) FROM goals`); rows != 1 {
		t.Fatalf("%d goals; want one after two adds", rows)
	}
	for name, err := range map[string]error{
		"on no drop list":                  store.Goals().AddGoal(ctx, alexID, game.ID, 12),
		"on the drop list of another game": store.Goals().AddGoal(ctx, alexID, game.ID, 11),
		"add to an unknown game":           store.Goals().AddGoal(ctx, alexID, nobodyID, 99),
		"remove of an unknown game":        store.Goals().RemoveGoal(ctx, alexID, nobodyID, 10),
	} {
		want := map[string]error{"on no drop list": domain.ErrInvalidItem, "on the drop list of another game": domain.ErrInvalidItem,
			"add to an unknown game": application.ErrGameNotFound, "remove of an unknown game": application.ErrGameNotFound}[name]
		if !errors.Is(err, want) {
			t.Errorf("%s: %v, want %v", name, err, want)
		}
	}

	if err := store.DropLists().RemoveDrop(ctx, game.ID, game.Modes[0].Activities[0].ID, 10); err != nil {
		t.Fatal(err)
	}
	mustAddGoal(t, store, alexID, game.ID, 10)
	if rows := count(t, store, `SELECT count(*) FROM goals`); rows != 1 {
		t.Fatalf("%d goals after the item left the drop list and a second add; want it kept, one row", rows)
	}
	if err := store.Goals().AddGoal(ctx, otherID, game.ID, 10); !errors.Is(err, domain.ErrInvalidItem) {
		t.Fatalf("new goal off the drop list: %v; want ErrInvalidItem", err)
	}
	for range 2 {
		if err := store.Goals().RemoveGoal(ctx, alexID, game.ID, 10); err != nil {
			t.Fatalf("remove: %v; want idempotent with no drop-list check", err)
		}
	}
	if rows := count(t, store, `SELECT count(*) FROM goals`); rows != 0 {
		t.Fatalf("%d goals after the remove; want none", rows)
	}

	mustAddGoal(t, store, alexID, other.ID, 11)
	if err := store.Games().Delete(ctx, other.ID); err != nil {
		t.Fatal(err)
	}
	games, err := store.Goals().GameGoals(ctx, alexID)
	if err != nil || len(games) != 0 || count(t, store, `SELECT count(*) FROM goals`) != 0 {
		t.Fatalf("games %+v, error %v; want the goal gone with its game, and no game with a goal or a drop list", games, err)
	}
}

// The list has the games with a goal or a drop list, in the game list's order, and each goal once with the activities
// of its own game that drop it (ADR 0029 section 5).
func TestGameGoalsListsTheCallersGoalsByGame(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	raid := createRaidGame(t, store)
	castle, vault := raid.Modes[1].Activities[0], raid.Modes[1].Activities[1]
	mustAddDrop(t, store, raid.ID, vault.ID, 10)
	mustAddDrop(t, store, raid.ID, castle.ID, 10)
	mustAddDrop(t, store, raid.ID, castle.ID, 20)
	alpha := createActivityGame(t, store, "alpha", 10)
	if _, err := store.Games().Create(ctx, domain.Game{Name: "Zed"}); err != nil {
		t.Fatal(err)
	}
	mustAddGoal(t, store, alexID, raid.ID, 20)
	mustAddGoal(t, store, alexID, raid.ID, 10)
	mustAddGoal(t, store, otherID, alpha.ID, 10)
	mustAddDrop(t, store, alpha.ID, alpha.Modes[0].Activities[0].ID, 30)
	mustAddGoal(t, store, alexID, alpha.ID, 30)
	if err := store.DropLists().RemoveDrop(ctx, alpha.ID, alpha.Modes[0].Activities[0].ID, 30); err != nil {
		t.Fatal(err)
	}

	games, err := store.Goals().GameGoals(ctx, alexID)

	castleDrop := domain.DropActivity{ActivityID: castle.ID, ActivityName: "Castle", ModeName: "Raid"}
	vaultDrop := domain.DropActivity{ActivityID: vault.ID, ActivityName: "Vault", ModeName: "Raid"}
	want := []domain.GameGoals{
		{GameID: alpha.ID, GameName: "alpha", Goals: []domain.GameItem{{Item: domain.Item{ID: 30}, DropsIn: []domain.DropActivity{}}}},
		{GameID: raid.ID, GameName: "Raid Game", Goals: []domain.GameItem{
			{Item: domain.Item{ID: 10}, DropsIn: []domain.DropActivity{castleDrop, vaultDrop}},
			{Item: domain.Item{ID: 20}, DropsIn: []domain.DropActivity{castleDrop}},
		}},
	}
	if err != nil || !reflect.DeepEqual(games, want) {
		t.Fatalf("games %+v, error %v; want %+v", games, err, want)
	}
}

// The lobby read shows a player's goals of the lobby's game on the drop list of its activity, for members only; a goal
// of another game with the same item is not shown (ADR 0029 section 5).
func TestLobbyPlayersShowTheirGoalsOnTheLobbysDropList(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	addMember(t, store, fridayID, otherID)
	ctx := context.Background()
	raid := createRaidGame(t, store)
	mode, castle, vault := raid.Modes[1], raid.Modes[1].Activities[0], raid.Modes[1].Activities[1]
	mustAddDrop(t, store, raid.ID, castle.ID, 20)
	mustAddDrop(t, store, raid.ID, castle.ID, 10)
	mustAddDrop(t, store, raid.ID, vault.ID, 30)
	second := createActivityGame(t, store, "Second Game", 40)
	mustAddDrop(t, store, raid.ID, castle.ID, 40)
	mustAddGoal(t, store, alexID, raid.ID, 20)
	mustAddGoal(t, store, alexID, raid.ID, 10)
	mustAddGoal(t, store, alexID, raid.ID, 30)
	mustAddGoal(t, store, otherID, second.ID, 40)
	mustAddGoal(t, store, nobodyID, raid.ID, 10)
	request := newLobby(fridayID, alexID, &raid.ID, raid.Name)
	request.ModeID, request.ModeName, request.ActivityID, request.ActivityName = &mode.ID, &mode.Name, &castle.ID, &castle.Name
	lobby := insertLobby(t, store, request)
	addPlayer(t, store, lobby.ID, otherID, joinedAt)
	// nobody is a player but not a member, as a former member who still has a row.
	addPlayer(t, store, lobby.ID, nobodyID, joinedAt)
	withoutActivity := insertLobby(t, store, newLobby(fridayID, alexID, &raid.ID, raid.Name))

	_, players, err := store.Lobbies().Lobby(ctx, fridayID, lobby.ID, alexID, joinedAt)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string][]domain.Item{}
	for _, player := range players {
		got[player.UserID] = player.Goals
	}
	want := map[string][]domain.Item{alexID: {{ID: 10}, {ID: 20}}, otherID: nil, nobodyID: nil}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("goals %+v; want %+v: the castle's items of the lobby's game, by item ID, members only", got, want)
	}

	_, players, err = store.Lobbies().Lobby(ctx, fridayID, withoutActivity.ID, alexID, joinedAt)
	if err != nil || len(players) != 1 || players[0].Goals != nil {
		t.Fatalf("players %+v, error %v; want no goals on a lobby without a Named activity", players, err)
	}
}
