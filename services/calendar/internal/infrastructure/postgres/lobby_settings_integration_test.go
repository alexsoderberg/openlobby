//go:build integration

package postgres

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// strangerID is no member of Friday.
const strangerID = "77777777-7777-4777-8777-777777777777"

// squadGame has three modes without game roles: Duel (2), Squad (4) and Trio (3, no activity).
func squadGame() domain.Game {
	return domain.Game{Name: "Squad Game", Modes: []domain.GameMode{
		{Name: "Duel", MaxPlayers: intPtr(2), Activities: []domain.Activity{{Name: "Arena"}, {Name: "Pit"}}},
		{Name: "Squad", MaxPlayers: intPtr(4), Activities: []domain.Activity{{Name: "Ridge"}}},
		{Name: "Trio", MaxPlayers: intPtr(3)},
	}}
}

// squadLobby creates a lobby of the mode (an index of squadGame) with Alex as its only player and the other users as
// members of Friday. Its activity is the first one of the mode, when it has one.
func squadLobby(t *testing.T, store *Store, mode int) (domain.Game, domain.Lobby) {
	t.Helper()
	seedGroups(t, store)
	game, err := store.Games().Create(context.Background(), squadGame())
	if err != nil {
		t.Fatal(err)
	}
	for _, user := range []string{otherID, nobodyID, thirdID, fourthID} {
		addMember(t, store, fridayID, user)
	}
	return game, newSquadLobby(t, store, game, mode)
}

func newSquadLobby(t *testing.T, store *Store, game domain.Game, mode int) domain.Lobby {
	t.Helper()
	chosen := game.Modes[mode]
	request := domain.NewLobbyRequest{GroupID: fridayID, CreatorID: alexID, StartsAt: joinedAt.Add(time.Hour), EndsAt: joinedAt.Add(3 * time.Hour),
		GameID: &game.ID, ModeID: &chosen.ID, MaxPlayers: chosen.MaxPlayers}
	if len(chosen.Activities) > 0 {
		request.ActivityID = &chosen.Activities[0].ID
	}
	lobby, err := seatLobbies(store).Create(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	return lobby
}

// lobbyState holds the settings columns; an empty string is NULL.
type lobbyState struct {
	modeID, modeName, activityID, activityName string
	maxPlayers                                 int
}

func stateOf(t *testing.T, store *Store, lobbyID string) lobbyState {
	t.Helper()
	var state lobbyState
	err := store.db.QueryRow(`SELECT COALESCE(game_mode_id::text, ''), COALESCE(mode_name, ''), COALESCE(activity_id::text, ''), COALESCE(activity_name, ''), max_players FROM lobbies WHERE id = $1`, lobbyID).
		Scan(&state.modeID, &state.modeName, &state.activityID, &state.activityName, &state.maxPlayers)
	if err != nil {
		t.Fatal(err)
	}
	return state
}

func setMode(store *Store, lobbyID, userID, modeID string, current *string) error {
	_, err := seatLobbies(store).SetMode(context.Background(), fridayID, lobbyID, userID, modeID, current)
	return err
}

func setActivity(store *Store, lobbyID, userID, activityID string) error {
	_, err := seatLobbies(store).SetActivity(context.Background(), fridayID, lobbyID, userID, activityID)
	return err
}

func TestSetModeReplacesTheSlotsFlexesEveryoneAndClearsTheActivity(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 2, healerSeat)
	ranked, raid := game.Modes[0], game.Modes[1]
	if err := joinSeatAt(store, lobby.ID, otherID, tankSeat(game)); err != nil {
		t.Fatal(err)
	}

	changed, err := seatLobbies(store).SetMode(context.Background(), fridayID, lobby.ID, alexID, ranked.ID, &raid.ID)

	if err != nil {
		t.Fatal(err)
	}
	state := stateOf(t, store, lobby.ID)
	if state.modeName != "Ranked" || state.maxPlayers != 5 || state.activityID != "" || state.activityName != "" || changed.MaxPlayers == nil || *changed.MaxPlayers != 5 || len(changed.RoleSlots) != 0 {
		t.Fatalf("state %+v and lobby %+v, want Ranked, max 5, no activity and no slots", state, changed)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_role_slots WHERE lobby_id = $1`, lobby.ID); n != 0 || changed.PlayerCount != 2 {
		t.Fatalf("%d role slots and lobby %+v, want none and 2 players", n, changed)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND game_role_id IS NOT NULL`, lobby.ID); n != 0 {
		t.Fatalf("%d players still have a game role, want the foreign key to have cleared all", n)
	}

	back, err := seatLobbies(store).SetMode(context.Background(), fridayID, lobby.ID, otherID, raid.ID, &ranked.ID)

	if err != nil || len(back.RoleSlots) != 2 || back.RoleSlots[0].Name != "Tank" || back.RoleSlots[0].Slots != 1 || back.RoleSlots[1].Slots != 4 || *back.MaxPlayers != 5 || back.FlexCount != 2 {
		t.Fatalf("lobby %+v error %v, want the Raid slots as new copies (Tank 1, Healer 4), max 5 and 2 flex players", back, err)
	}
}

func TestSetModeToTheCurrentModeChangesNothing(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 2, healerSeat)
	raid := game.Modes[1]
	before := stateOf(t, store, lobby.ID)

	err := setMode(store, lobby.ID, alexID, raid.ID, &raid.ID)

	after := stateOf(t, store, lobby.ID)
	var role *string
	if rowErr := store.db.QueryRow(`SELECT game_role_id FROM lobby_players WHERE lobby_id = $1 AND user_id = $2`, lobby.ID, alexID).Scan(&role); rowErr != nil {
		t.Fatal(rowErr)
	}
	if err != nil || after != before || role == nil {
		t.Fatalf("error %v, state %+v (before %+v), role %v; want nothing changed", err, after, before, role)
	}
}

func TestSetModeRefusals(t *testing.T) {
	store := migratedStore(t)
	game, lobby := squadLobby(t, store, 0) // Duel, max 2
	duel, squad := game.Modes[0], game.Modes[1]
	if err := joinAt(store, fridayID, lobby.ID, otherID, joinedAt); err != nil {
		t.Fatal(err)
	}
	other, err := store.Games().Create(context.Background(), domain.Game{Name: "Other Game", Modes: []domain.GameMode{{Name: "Solo", MaxPlayers: intPtr(1)}}})
	if err != nil {
		t.Fatal(err)
	}
	noGame := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	trio := game.Modes[2]
	missing := "99999999-9999-4999-8999-999999999999"

	tests := []struct {
		name    string
		lobbyID string
		modeID  string
		current *string
		want    error
	}{
		{name: "a mode of another game", lobbyID: lobby.ID, modeID: other.Modes[0].ID, current: &duel.ID, want: domain.ErrInvalidMode},
		{name: "an unknown mode", lobbyID: lobby.ID, modeID: missing, current: &duel.ID, want: domain.ErrInvalidMode},
		{name: "a lobby without a game", lobbyID: noGame.ID, modeID: squad.ID, want: domain.ErrInvalidMode},
		{name: "a stale view", lobbyID: lobby.ID, modeID: squad.ID, current: &trio.ID, want: domain.ErrLobbyChanged},
		{name: "a view of no mode", lobbyID: lobby.ID, modeID: squad.ID, want: domain.ErrLobbyChanged},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := setMode(store, tc.lobbyID, alexID, tc.modeID, tc.current); !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
	if state := stateOf(t, store, lobby.ID); state.modeName != "Duel" || state.activityName == "" {
		t.Fatalf("state %+v, want the lobby unchanged", state)
	}
}

func TestSetModeBelowThePlayerCountIsRefusedAndAtTheCountIsAllowed(t *testing.T) {
	store := migratedStore(t)
	game, lobby := squadLobby(t, store, 1) // Squad, max 4
	duel, squad, trio := game.Modes[0], game.Modes[1], game.Modes[2]
	for _, user := range []string{otherID, nobodyID} {
		if err := joinAt(store, fridayID, lobby.ID, user, joinedAt); err != nil {
			t.Fatal(err)
		}
	}

	refused := setMode(store, lobby.ID, alexID, duel.ID, &squad.ID)
	allowed := setMode(store, lobby.ID, alexID, trio.ID, &squad.ID)

	if !errors.Is(refused, domain.ErrLobbyHasMorePlayers) || allowed != nil {
		t.Fatalf("errors %v and %v, want more players for max 2 with 3 players, and none for max 3", refused, allowed)
	}
	if state := stateOf(t, store, lobby.ID); state.modeName != "Trio" || state.maxPlayers != 3 {
		t.Fatalf("state %+v, want Trio with max 3", state)
	}
}

func TestSetAndClearActivity(t *testing.T) {
	store := migratedStore(t)
	game, lobby := squadLobby(t, store, 0) // Duel with the activity Arena
	pit, ridge := game.Modes[0].Activities[1], game.Modes[1].Activities[0]

	set := setActivity(store, lobby.ID, alexID, pit.ID)
	afterSet := stateOf(t, store, lobby.ID)
	foreign := setActivity(store, lobby.ID, alexID, ridge.ID)
	cleared, clearErr := seatLobbies(store).ClearActivity(context.Background(), fridayID, lobby.ID, alexID)
	_, again := seatLobbies(store).ClearActivity(context.Background(), fridayID, lobby.ID, alexID)

	state := stateOf(t, store, lobby.ID)
	if set != nil || afterSet.activityName != "Pit" || afterSet.maxPlayers != 2 {
		t.Fatalf("set error %v, state %+v, want Pit and the limit kept", set, afterSet)
	}
	if !errors.Is(foreign, domain.ErrInvalidActivity) {
		t.Fatalf("an activity of another mode: error %v, want invalid activity", foreign)
	}
	if clearErr != nil || again != nil || state.activityID != "" || state.activityName != "" || state.modeName != "Duel" || cleared.ActivityID != nil {
		t.Fatalf("clear errors %v, %v and state %+v, want the activity gone twice over and the mode kept", clearErr, again, state)
	}
}

func TestSetActivityRefusesALobbyWithoutAModeAndTheCheckOrderHolds(t *testing.T) {
	store := migratedStore(t)
	game, lobby := squadLobby(t, store, 0)
	arena := game.Modes[0].Activities[0]
	noMode := insertLobby(t, store, newLobby(fridayID, alexID, &game.ID, "Squad Game"))
	ended := application.NewLobbies(store.Lobbies(), store.Lobbies(), store.Games(), nil, fixedNow{joinedAt.Add(4 * time.Hour)})

	_, noModeErr := seatLobbies(store).SetActivity(context.Background(), fridayID, noMode.ID, alexID, arena.ID)
	_, endedSet := ended.SetActivity(context.Background(), fridayID, lobby.ID, otherID, arena.ID)
	_, endedClear := ended.ClearActivity(context.Background(), fridayID, lobby.ID, alexID)
	_, endedMode := ended.SetMode(context.Background(), fridayID, lobby.ID, alexID, game.Modes[1].ID, nil)

	if !errors.Is(noModeErr, domain.ErrInvalidActivity) || !errors.Is(endedSet, domain.ErrLobbyHasEnded) || !errors.Is(endedClear, domain.ErrLobbyHasEnded) || !errors.Is(endedMode, domain.ErrLobbyHasEnded) {
		t.Fatalf("errors %v, %v, %v, %v; want invalid activity for no mode, and has ended before the player and the values", noModeErr, endedSet, endedClear, endedMode)
	}
}

// Only a player may change the settings, and only a member is told the lobby exists (ADR 0017 section 15).
func TestSettingsChangesAreForPlayersOfTheGroup(t *testing.T) {
	store := migratedStore(t)
	game, lobby := squadLobby(t, store, 0)
	squad, arena := game.Modes[1], game.Modes[0].Activities[0]
	lobbies := seatLobbies(store)
	ctx := context.Background()

	for _, caller := range []struct {
		userID string
		want   error
	}{{strangerID, domain.ErrGroupNotFound}, {otherID, domain.ErrNotAllowed}} {
		_, mode := lobbies.SetMode(ctx, fridayID, lobby.ID, caller.userID, squad.ID, &game.Modes[0].ID)
		_, set := lobbies.SetActivity(ctx, fridayID, lobby.ID, caller.userID, arena.ID)
		_, cleared := lobbies.ClearActivity(ctx, fridayID, lobby.ID, caller.userID)
		for name, err := range map[string]error{"mode": mode, "activity": set, "clear": cleared} {
			if !errors.Is(err, caller.want) {
				t.Fatalf("%s by %s: error %v, want %v", name, caller.userID, err, caller.want)
			}
		}
	}
	if state := stateOf(t, store, lobby.ID); state.modeName != "Duel" || state.activityName != "Arena" {
		t.Fatalf("state %+v, want the lobby unchanged", state)
	}
}

// Both orders of a mode change and an activity change end with no activity or one of the final mode (ADR 0017 section 10).
func TestPutModeRacesPutActivity(t *testing.T) {
	store := migratedStore(t)
	game, _ := squadLobby(t, store, 0)
	squad, ridge := game.Modes[1], game.Modes[1].Activities[0]

	for round := range 20 {
		lobby := newSquadLobby(t, store, game, 0)
		results := raceTwo(
			func() error { return setMode(store, lobby.ID, alexID, squad.ID, &game.Modes[0].ID) },
			func() error { return setActivity(store, lobby.ID, alexID, ridge.ID) },
		)

		state := stateOf(t, store, lobby.ID)
		if results[0] != nil || (results[1] != nil && !errors.Is(results[1], domain.ErrInvalidActivity)) {
			t.Fatalf("round %d: errors %v and %v, want none for the mode and none or invalid activity for the activity", round, results[0], results[1])
		}
		if state.modeID != squad.ID || (state.activityID != "" && state.activityID != ridge.ID) || (results[1] == nil) != (state.activityID != "") {
			t.Fatalf("round %d: state %+v with activity error %v, want Squad and an activity of Squad exactly when it was saved", round, state, results[1])
		}
	}
}

// raceTwo starts both functions together and returns their errors in order.
func raceTwo(first, second func() error) [2]error {
	var results [2]error
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i, fn := range []func() error{first, second} {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			results[i] = fn()
		}()
	}
	close(start)
	wg.Wait()
	return results
}

// The leave and the change serialize: the change is saved and the leave follows, or the change is refused and the
// leave works. No player row is created.
func TestActivityChangeAfterLeaveInFlight(t *testing.T) {
	store := migratedStore(t)
	game, _ := squadLobby(t, store, 0)
	pit := game.Modes[0].Activities[1]

	for round := range 20 {
		lobby := newSquadLobby(t, store, game, 0)
		if err := joinAt(store, fridayID, lobby.ID, otherID, joinedAt); err != nil {
			t.Fatal(err)
		}
		results := raceTwo(
			func() error { return setActivity(store, lobby.ID, otherID, pit.ID) },
			func() error {
				return seatLobbies(store).Leave(context.Background(), fridayID, lobby.ID, otherID)
			},
		)

		state := stateOf(t, store, lobby.ID)
		saved := results[0] == nil
		if (!saved && !errors.Is(results[0], domain.ErrNotAllowed)) || results[1] != nil || saved != (state.activityName == "Pit") {
			t.Fatalf("round %d: errors %v and %v with activity %v, want a saved change or not_allowed, and the leave working", round, results[0], results[1], state.activityName)
		}
		if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND user_id = $2`, lobby.ID, otherID); n != 0 {
			t.Fatalf("round %d: %d player rows for the leaver, want none", round, n)
		}
	}
}

// Two changes from the same view: one is saved and the other sees that the mode has changed.
func TestPutModeTwiceSameCurrentMode(t *testing.T) {
	store := migratedStore(t)
	game, _ := squadLobby(t, store, 0)
	duel, squad, trio := game.Modes[0], game.Modes[1], game.Modes[2]

	for round := range 20 {
		lobby := newSquadLobby(t, store, game, 0)
		results := raceTwo(
			func() error { return setMode(store, lobby.ID, alexID, squad.ID, &duel.ID) },
			func() error { return setMode(store, lobby.ID, alexID, trio.ID, &duel.ID) },
		)

		state := stateOf(t, store, lobby.ID)
		winner := map[bool]string{true: squad.ID, false: trio.ID}[results[0] == nil]
		if (results[0] == nil) == (results[1] == nil) || (results[0] != nil && !errors.Is(results[0], domain.ErrLobbyChanged)) ||
			(results[1] != nil && !errors.Is(results[1], domain.ErrLobbyChanged)) || state.modeID != winner {
			t.Fatalf("round %d: errors %v and %v, mode %s; want exactly one saved, the other lobby_changed, and the winner's mode", round, results[0], results[1], state.modeID)
		}
	}
}

// A join for a role that the mode change removes either comes first (and the player becomes flex) or is refused.
func TestJoinRacesModeChange(t *testing.T) {
	store := migratedStore(t)
	game, _ := raidLobby(t, store, 1, 2, healerSeat)
	ranked, raid := game.Modes[0], game.Modes[1]

	for round := range 20 {
		lobby, err := seatLobbies(store).Create(context.Background(), raidRequest(game, 1, 2, healerSeat(game)))
		if err != nil {
			t.Fatal(err)
		}
		results := raceTwo(
			func() error { return joinSeatAt(store, lobby.ID, otherID, tankSeat(game)) },
			func() error { return setMode(store, lobby.ID, alexID, ranked.ID, &raid.ID) },
		)

		if results[1] != nil || (results[0] != nil && !errors.Is(results[0], domain.ErrInvalidGameRole)) {
			t.Fatalf("round %d: errors %v and %v, want a mode change and a join or invalid game role", round, results[0], results[1])
		}
		if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND game_role_id IS NOT NULL`, lobby.ID); n != 0 {
			t.Fatalf("round %d: %d players hold a game role the lobby no longer has", round, n)
		}
		wantPlayers := map[bool]int{true: 2, false: 1}[results[0] == nil]
		if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID); n != wantPlayers {
			t.Fatalf("round %d: %d players with join error %v, want %d", round, n, results[0], wantPlayers)
		}
	}
}

// One spot is left in a Trio lobby with two players. A join and a change to Duel (max 2) race for it: exactly one wins,
// and no limit is passed.
func TestJoinLastSpotRacesModeChange(t *testing.T) {
	store := migratedStore(t)
	game, _ := squadLobby(t, store, 2)
	duel, trio := game.Modes[0], game.Modes[2]

	for round := range 20 {
		lobby := newSquadLobby(t, store, game, 2)
		if err := joinAt(store, fridayID, lobby.ID, nobodyID, joinedAt); err != nil {
			t.Fatal(err)
		}
		results := raceTwo(
			func() error { return joinAt(store, fridayID, lobby.ID, otherID, joinedAt) },
			func() error { return setMode(store, lobby.ID, alexID, duel.ID, &trio.ID) },
		)

		state := stateOf(t, store, lobby.ID)
		players := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID)
		okJoin := results[0] == nil && results[1] != nil && errors.Is(results[1], domain.ErrLobbyHasMorePlayers) && players == 3 && state.maxPlayers == 3
		okMode := results[1] == nil && results[0] != nil && errors.Is(results[0], domain.ErrLobbyFull) && players == 2 && state.maxPlayers == 2
		if !okJoin && !okMode {
			t.Fatalf("round %d: errors %v and %v with %d players and max %d, want the join or the change to win, never both", round, results[0], results[1], players, state.maxPlayers)
		}
	}
}

// A reader sees a mode change whole or not at all: the limit, the role slots, the counts and the players' game roles
// come from one snapshot (ADR 0017 section 10).
func TestReadersRaceModeChange(t *testing.T) {
	store := migratedStore(t)
	game, _ := raidLobby(t, store, 1, 2, healerSeat)
	ranked, raid := game.Modes[0], game.Modes[1]
	ctx := context.Background()

	for round := range 20 {
		lobby, err := seatLobbies(store).Create(ctx, raidRequest(game, 1, 2, healerSeat(game)))
		if err != nil {
			t.Fatal(err)
		}
		if err := joinSeatAt(store, lobby.ID, otherID, tankSeat(game)); err != nil {
			t.Fatal(err)
		}
		results := raceTwo(
			func() error { return setMode(store, lobby.ID, alexID, ranked.ID, &raid.ID) },
			func() error {
				for range 5 {
					listed, err := store.Lobbies().Upcoming(ctx, fridayID, alexID, joinedAt)
					if err != nil {
						return err
					}
					for _, l := range listed {
						if err := wholeModeChange(l, nil); err != nil {
							return err
						}
					}
					one, players, err := store.Lobbies().Lobby(ctx, fridayID, lobby.ID, alexID, joinedAt)
					if err != nil {
						return err
					}
					if err := wholeModeChange(one, players); err != nil {
						return err
					}
				}
				return nil
			},
		)

		if results[0] != nil || results[1] != nil {
			t.Fatalf("round %d: change error %v, read %v; want the change saved and every read whole", round, results[0], results[1])
		}
	}
}

// wholeModeChange reports a lobby read that mixes the Raid and Ranked modes of createRaidGame. Raid has game roles,
// so its slots sum to its limit; Ranked has none. Players, when given, must match the counts.
func wholeModeChange(lobby domain.Lobby, players []domain.Player) error {
	sum := 0
	for _, slot := range lobby.RoleSlots {
		sum += slot.Slots
	}
	if lobby.ModeName == nil || lobby.MaxPlayers == nil {
		return fmt.Errorf("lobby %s: no mode or no limit", lobby.ID)
	}
	if (*lobby.ModeName == "Raid") != (len(lobby.RoleSlots) > 0) || (len(lobby.RoleSlots) > 0 && sum != *lobby.MaxPlayers) {
		return fmt.Errorf("lobby %s: mode %s with max %d and slots %+v", lobby.ID, *lobby.ModeName, *lobby.MaxPlayers, lobby.RoleSlots)
	}
	if players == nil {
		return nil
	}
	inRole := map[string]int{}
	for _, player := range players {
		if player.GameRoleID != nil {
			inRole[*player.GameRoleID]++
		}
	}
	for _, slot := range lobby.RoleSlots {
		if inRole[slot.GameRoleID] != slot.PlayerCount {
			return fmt.Errorf("lobby %s: slot %+v but players %+v", lobby.ID, slot, players)
		}
		delete(inRole, slot.GameRoleID)
	}
	if len(players) != lobby.PlayerCount || len(inRole) != 0 {
		return fmt.Errorf("lobby %s: %d players and %+v but players %+v", lobby.ID, lobby.PlayerCount, lobby.RoleSlots, players)
	}
	return nil
}

// rolesGame has game roles on the game and no modes, so a lobby created with it would get role slots.
func rolesGame(t *testing.T, store *Store) domain.Game {
	t.Helper()
	game, err := store.Games().Create(context.Background(), domain.Game{Name: "Roles Game", GameRoles: []domain.GameRole{{Name: "Tank", Slots: 1}, {Name: "Healer", Slots: 2}}})
	if err != nil {
		t.Fatal(err)
	}
	return game
}

// openLobby creates a lobby with no game and room for three, with Alex as its only player.
func openLobby(t *testing.T, store *Store) domain.Lobby {
	t.Helper()
	lobby, err := seatLobbies(store).Create(context.Background(), domain.NewLobbyRequest{GroupID: fridayID, CreatorID: alexID,
		StartsAt: joinedAt.Add(time.Hour), EndsAt: joinedAt.Add(3 * time.Hour), MaxPlayers: intPtr(3)})
	if err != nil {
		t.Fatal(err)
	}
	return lobby
}

// A lobby created with no game stores no name, and its game can be set once: the ID and name are copied, the max
// players stay and no role slots are made (ADR 0017 section 10).
func TestCreateOpenLobbyThenSetItsGameOnce(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	game := rolesGame(t, store)
	lobby := openLobby(t, store)
	ctx := context.Background()
	if n := count(t, store, `SELECT count(*) FROM lobbies WHERE id = $1 AND game_id IS NULL AND game_name IS NULL`, lobby.ID); n != 1 || lobby.GameName != nil {
		t.Fatalf("stored %d open rows, name %v; want an open lobby with no game", n, lobby.GameName)
	}

	saved, err := seatLobbies(store).SetGame(ctx, fridayID, lobby.ID, alexID, game.ID)

	if err != nil {
		t.Fatal(err)
	}
	if saved.GameID == nil || *saved.GameID != game.ID || saved.GameName == nil || *saved.GameName != "Roles Game" ||
		saved.MaxPlayers == nil || *saved.MaxPlayers != 3 || len(saved.RoleSlots) != 0 || saved.ModeID != nil || !saved.JoinedByMe {
		t.Fatalf("saved %+v, want the game copied, max 3 kept and no role slots", saved)
	}
	if _, err := seatLobbies(store).SetGame(ctx, fridayID, lobby.ID, alexID, counterStrikeID); !errors.Is(err, domain.ErrLobbyGameSet) {
		t.Fatalf("second set: error %v, want ErrLobbyGameSet", err)
	}
	if n := count(t, store, `SELECT count(*) FROM lobbies WHERE id = $1 AND game_id = $2 AND game_name = 'Roles Game'`, lobby.ID, game.ID); n != 1 {
		t.Fatal("the game changed after it was set")
	}
}

// The refusals of PUT .../game in the order of ADR 0017 section 10, and the lobby keeps no game after them.
func TestSetGameRefusals(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	addMember(t, store, fridayID, otherID)
	lobby := openLobby(t, store)
	custom := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	lobbies := seatLobbies(store)
	ended := application.NewLobbies(store.Lobbies(), store.Lobbies(), store.Games(), nil, fixedNow{joinedAt.Add(4 * time.Hour)})
	ctx := context.Background()

	for name, tc := range map[string]struct {
		lobbies         *application.Lobbies
		lobbyID, userID string
		gameID          string
		want            error
	}{
		"non-member":           {lobbies, lobby.ID, strangerID, counterStrikeID, domain.ErrGroupNotFound},
		"member, not a player": {lobbies, lobby.ID, otherID, counterStrikeID, domain.ErrNotAllowed},
		"unknown lobby":        {lobbies, nobodyID, alexID, counterStrikeID, domain.ErrLobbyNotFound},
		"ended":                {ended, lobby.ID, alexID, nobodyID, domain.ErrLobbyHasEnded},
		"unknown game":         {lobbies, lobby.ID, alexID, nobodyID, domain.ErrInvalidGame},
		"unknown game first":   {lobbies, custom.ID, alexID, nobodyID, domain.ErrInvalidGame},
		"custom name is set":   {lobbies, custom.ID, alexID, counterStrikeID, domain.ErrLobbyGameSet},
	} {
		if _, err := tc.lobbies.SetGame(ctx, fridayID, tc.lobbyID, tc.userID, tc.gameID); !errors.Is(err, tc.want) {
			t.Fatalf("%s: error %v, want %v", name, err, tc.want)
		}
	}
	if n := count(t, store, `SELECT count(*) FROM lobbies WHERE id = $1 AND game_id IS NULL AND game_name IS NULL`, lobby.ID); n != 1 {
		t.Fatal("a refused change was saved")
	}
}
