//go:build integration

package postgres

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	thirdID  = "33333333-3333-4333-8333-333333333334"
	fourthID = "44444444-4444-4444-8444-444444444445"
)

func seatLobbies(store *Store) *application.Lobbies {
	return application.NewLobbies(store.Lobbies(), store.Lobbies(), store.Games(), nil, fixedNow{joinedAt})
}

func joinSeatAt(store *Store, lobbyID, userID string, seat domain.Seat) error {
	return seatLobbies(store).Join(context.Background(), fridayID, lobbyID, userID, seat)
}

func role(id string) domain.Seat { return domain.Seat{GameRoleID: &id} }

var flex = domain.Seat{Flex: true}

// raidRequest asks for a lobby of the Raid mode of createRaidGame with Tank and Healer slots as given.
func raidRequest(game domain.Game, tank, healer int, seat domain.Seat) domain.NewLobbyRequest {
	raid := game.Modes[1]
	return domain.NewLobbyRequest{
		GroupID: fridayID, CreatorID: alexID, StartsAt: joinedAt.Add(time.Hour), EndsAt: joinedAt.Add(3 * time.Hour),
		GameID: &game.ID, ModeID: &raid.ID, ActivityID: &raid.Activities[1].ID, Seat: seat,
		RoleSlots: []domain.RoleSlotInput{{GameRoleID: raid.GameRoles[0].ID, Slots: tank}, {GameRoleID: raid.GameRoles[1].ID, Slots: healer}},
	}
}

// raidLobby creates a lobby with Tank and Healer slots through the use case and adds the members that the tests use.
func raidLobby(t *testing.T, store *Store, tank, healer int, seat func(game domain.Game) domain.Seat) (domain.Game, domain.Lobby) {
	t.Helper()
	seedGroups(t, store)
	game := createRaidGame(t, store)
	for _, user := range []string{otherID, nobodyID, thirdID, fourthID} {
		addMember(t, store, fridayID, user)
	}
	lobby, err := seatLobbies(store).Create(context.Background(), raidRequest(game, tank, healer, seat(game)))
	if err != nil {
		t.Fatal(err)
	}
	return game, lobby
}

func tankSeat(game domain.Game) domain.Seat   { return role(game.Modes[1].GameRoles[0].ID) }
func healerSeat(game domain.Game) domain.Seat { return role(game.Modes[1].GameRoles[1].ID) }

func TestCreateWithModeAndRolesStoresTheSlotCopies(t *testing.T) {
	store := migratedStore(t)

	game, lobby := raidLobby(t, store, 1, 2, healerSeat)

	raid := game.Modes[1]
	var modeID, modeName, activityName string
	var maxPlayers int
	err := store.db.QueryRow(`SELECT game_mode_id, mode_name, activity_name, max_players FROM lobbies WHERE id = $1`, lobby.ID).Scan(&modeID, &modeName, &activityName, &maxPlayers)
	if err != nil || modeID != raid.ID || modeName != "Raid" || activityName != "Vault" || maxPlayers != 3 {
		t.Fatalf("lobby row %q %q %q %d, error %v; want the Raid mode copied, activity Vault and max 3", modeID, modeName, activityName, maxPlayers, err)
	}
	rows, err := store.db.Query(`SELECT game_role_id, name, slots, sort_order FROM lobby_role_slots WHERE lobby_id = $1 ORDER BY sort_order`, lobby.ID)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	var got []domain.RoleSlot
	for i := 0; rows.Next(); i++ {
		var slot domain.RoleSlot
		var order int
		if err := rows.Scan(&slot.GameRoleID, &slot.Name, &slot.Slots, &order); err != nil || order != i {
			t.Fatalf("slot %d: order %d, error %v", i, order, err)
		}
		got = append(got, slot)
	}
	want := []domain.RoleSlot{{GameRoleID: raid.GameRoles[0].ID, Name: "Tank", Slots: 1}, {GameRoleID: raid.GameRoles[1].ID, Name: "Healer", Slots: 2}}
	if !slices.Equal(got, want) {
		t.Fatalf("role slots %+v, want the copies %+v", got, want)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND user_id = $2 AND game_role_id = $3`, lobby.ID, alexID, raid.GameRoles[1].ID); n != 1 {
		t.Fatalf("%d creator rows as Healer, want 1", n)
	}
}

func TestCreateLeavesOutRolesWithZeroSlots(t *testing.T) {
	store := migratedStore(t)

	_, lobby := raidLobby(t, store, 0, 2, healerSeat)

	if n := count(t, store, `SELECT count(*) FROM lobby_role_slots WHERE lobby_id = $1`, lobby.ID); n != 1 || *lobby.MaxPlayers != 2 {
		t.Fatalf("%d role slots and max %d, want one slot and max 2", n, *lobby.MaxPlayers)
	}
}

func TestReadersReturnRoleSlotsWithPlayerCountsAndFlex(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 2, healerSeat)
	if err := joinSeatAt(store, lobby.ID, otherID, flex); err != nil {
		t.Fatal(err)
	}
	// A second lobby without roles in the same group must come back with no slots, from the same two queries.
	plain := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))
	ctx := context.Background()

	listed, err := store.Lobbies().Upcoming(ctx, fridayID, alexID, joinedAt)
	single, singleErr := store.Lobbies().Lobby(ctx, fridayID, lobby.ID, alexID, joinedAt)

	if err != nil || singleErr != nil || len(listed) != 2 {
		t.Fatalf("list %d lobbies, errors %v, %v; want 2", len(listed), err, singleErr)
	}
	wantSlots := []domain.RoleSlot{
		{GameRoleID: game.Modes[1].GameRoles[0].ID, Name: "Tank", Slots: 1},
		{GameRoleID: game.Modes[1].GameRoles[1].ID, Name: "Healer", Slots: 2, PlayerCount: 1},
	}
	for _, got := range []domain.Lobby{single, listed[slices.IndexFunc(listed, func(l domain.Lobby) bool { return l.ID == lobby.ID })]} {
		if !slices.Equal(got.RoleSlots, wantSlots) || got.FlexCount != 1 || got.PlayerCount != 2 || *got.ModeName != "Raid" || *got.ActivityName != "Vault" {
			t.Fatalf("lobby %+v, want slots %+v, flex 1 and 2 players", got, wantSlots)
		}
	}
	if other := listed[slices.IndexFunc(listed, func(l domain.Lobby) bool { return l.ID == plain.ID })]; len(other.RoleSlots) != 0 || other.FlexCount != 0 || other.ModeID != nil {
		t.Fatalf("lobby without roles %+v, want no slots, no flex and no mode", other)
	}
}

func TestJoinWithARoleWithFlexAndChangeOfSeat(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 2, healerSeat)
	tank, healer := game.Modes[1].GameRoles[0].ID, game.Modes[1].GameRoles[1].ID
	seatOf := func(user string) *string {
		players, err := store.Lobbies().Players(context.Background(), lobby.ID)
		if err != nil {
			t.Fatal(err)
		}
		for _, player := range players {
			if player.UserID == user {
				return player.GameRoleID
			}
		}
		t.Fatalf("%s is not a player", user)
		return nil
	}

	if err := joinSeatAt(store, lobby.ID, otherID, tankSeat(game)); err != nil {
		t.Fatal(err)
	}
	if got := seatOf(otherID); got == nil || *got != tank {
		t.Fatalf("seat %v, want Tank", got)
	}
	if err := joinSeatAt(store, lobby.ID, otherID, healerSeat(game)); err != nil {
		t.Fatal(err)
	}
	if got := seatOf(otherID); got == nil || *got != healer {
		t.Fatalf("seat %v, want Healer after the change", got)
	}
	if err := joinSeatAt(store, lobby.ID, otherID, flex); err != nil {
		t.Fatal(err)
	}
	if got := seatOf(otherID); got != nil {
		t.Fatalf("seat %v, want flex", got)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID); n != 2 {
		t.Fatalf("%d players after three seat changes, want 2", n)
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND user_id = $2 AND joined_at = $3`, lobby.ID, otherID, joinedAt); n != 1 {
		t.Fatal("a seat change moved the join time")
	}
}

func TestGameRoleFullAndLobbyFullOrder(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 1, tankSeat)

	roleFull := joinSeatAt(store, lobby.ID, otherID, tankSeat(game))
	if err := joinSeatAt(store, lobby.ID, otherID, healerSeat(game)); err != nil {
		t.Fatal(err)
	}
	lobbyFull := joinSeatAt(store, lobby.ID, nobodyID, tankSeat(game))
	flexFull := joinSeatAt(store, lobby.ID, nobodyID, flex)

	if !errors.Is(roleFull, domain.ErrGameRoleFull) || !errors.Is(lobbyFull, domain.ErrLobbyFull) || !errors.Is(flexFull, domain.ErrLobbyFull) {
		t.Fatalf("errors %v, %v, %v; want role full, lobby full for a full role, lobby full for flex", roleFull, lobbyFull, flexFull)
	}
}

func TestSameSeatInAFullLobbyIsANoOpAndAMoveToFlexIsAllowed(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 1, tankSeat)
	if err := joinSeatAt(store, lobby.ID, otherID, healerSeat(game)); err != nil {
		t.Fatal(err)
	}

	same := joinSeatAt(store, lobby.ID, otherID, healerSeat(game))
	toFlex := joinSeatAt(store, lobby.ID, otherID, flex)

	if same != nil || toFlex != nil {
		t.Fatalf("errors %v, %v; want none for the same seat and for a move to flex in a full lobby", same, toFlex)
	}
	if err := joinSeatAt(store, lobby.ID, otherID, tankSeat(game)); !errors.Is(err, domain.ErrGameRoleFull) {
		t.Fatalf("move to the taken Tank: %v, want role full (a full lobby does not matter for a seat change)", err)
	}
}

func TestJoinWithABadSeatChangesNothing(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 1, tankSeat)
	plain := insertLobby(t, store, newLobby(fridayID, alexID, nil, "Go"))

	noSeat := joinSeatAt(store, lobby.ID, otherID, domain.Seat{})
	foreign := joinSeatAt(store, lobby.ID, otherID, role(game.GameRoles[0].ID))
	seatWithoutRoles := joinSeatAt(store, plain.ID, otherID, flex)

	for _, err := range []error{noSeat, foreign, seatWithoutRoles} {
		if !errors.Is(err, domain.ErrInvalidGameRole) {
			t.Fatalf("error %v, want invalid game role", err)
		}
	}
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE user_id = $1`, otherID); n != 0 {
		t.Fatalf("%d player rows for Other, want none", n)
	}
}

// Four users race for the one Tank slot of a lobby with room for all of them: one wins, the others get role full.
func TestConcurrentJoinsNeverPassARoleSlot(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 4, healerSeat)
	users := []string{otherID, nobodyID, thirdID, fourthID}
	results := make(chan error, len(users))

	for _, user := range users {
		go func() { results <- joinSeatAt(store, lobby.ID, user, tankSeat(game)) }()
	}
	succeeded, full := 0, 0
	for range users {
		switch err := <-results; {
		case err == nil:
			succeeded++
		case errors.Is(err, domain.ErrGameRoleFull):
			full++
		default:
			t.Fatalf("unexpected error %v", err)
		}
	}

	tank := game.Modes[1].GameRoles[0].ID
	if n := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND game_role_id = $2`, lobby.ID, tank); n != 1 || succeeded != 1 || full != 3 {
		t.Fatalf("Tank players %d, succeeded %d, role full %d; want 1, 1 and 3", n, succeeded, full)
	}
}

// Two joins race for the last Tank slot and two for the last two spots of the total: neither the total nor the role
// count passes its limit (ADR 0017 section 11).
func TestConcurrentJoinsNeverPassTheTotalOrARole(t *testing.T) {
	store := migratedStore(t)
	game, lobby := raidLobby(t, store, 1, 2, healerSeat)
	seats := map[string]domain.Seat{otherID: tankSeat(game), nobodyID: tankSeat(game), thirdID: flex, fourthID: flex}
	results := make(chan error, len(seats))

	for user, seat := range seats {
		go func() { results <- joinSeatAt(store, lobby.ID, user, seat) }()
	}
	succeeded := 0
	for range seats {
		switch err := <-results; {
		case err == nil:
			succeeded++
		case errors.Is(err, domain.ErrGameRoleFull), errors.Is(err, domain.ErrLobbyFull):
		default:
			t.Fatalf("unexpected error %v", err)
		}
	}

	total := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1`, lobby.ID)
	tank := count(t, store, `SELECT count(*) FROM lobby_players WHERE lobby_id = $1 AND game_role_id = $2`, lobby.ID, game.Modes[1].GameRoles[0].ID)
	if total > 3 || tank > 1 || total != succeeded+1 {
		t.Fatalf("total %d, Tank %d, succeeded %d; want at most 3 and 1, and one row per success plus the creator", total, tank, succeeded)
	}
}
