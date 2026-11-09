package application_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

const (
	raidModeID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
	tankRoleID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
	dpsRoleID  = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"
)

// questCatalog has a game with a mode "Raid" of Tank 1 and DPS 2.
func questCatalog() *fakeCatalog {
	raid := domain.GameMode{ID: raidModeID, Name: "Raid", MaxPlayers: intPtr(3), GameRoles: []domain.GameRole{
		{ID: tankRoleID, Name: "Tank", Slots: 1}, {ID: dpsRoleID, Name: "DPS", Slots: 2}}}
	return &fakeCatalog{listed: []domain.Game{{ID: chessID, Name: "Quest", Modes: []domain.GameMode{raid}}}}
}

func TestCreateLobbyReadsTheGameTreeBeforeTheLockAndKeepsTheCopies(t *testing.T) {
	store, catalog := newLobbyStore(), questCatalog()
	findsAtLock := -1
	store.onLock = func() { findsAtLock = catalog.findCalls }
	request := createRequest(bobID)
	request.ModeID, request.Seat = strPtr(raidModeID), domain.Seat{GameRoleID: strPtr(tankRoleID)}

	lobby, err := newLobbies(store, catalog).Create(context.Background(), request)

	if err != nil {
		t.Fatal(err)
	}
	if findsAtLock != 1 {
		t.Fatalf("game list read %d times when the lock was taken, want once before it", findsAtLock)
	}
	if *lobby.ModeName != "Raid" || *lobby.MaxPlayers != 3 || len(lobby.RoleSlots) != 2 || lobby.RoleSlots[0].PlayerCount != 1 || *store.inserted[0].CreatorRoleID != tankRoleID {
		t.Fatalf("lobby %+v, want mode Raid, max 3, two role slots and the creator as Tank", lobby)
	}
}

// The check order of ADR 0017 section 7: a failing game, mode or seat is reported in its place and nothing is stored.
func TestCreateLobbyChecksGameThenModeThenRolesThenSeat(t *testing.T) {
	tests := []struct {
		name   string
		change func(*domain.NewLobbyRequest)
		want   error
	}{
		{name: "membership first", change: func(r *domain.NewLobbyRequest) { r.CreatorID, r.ModeID = strangerID, strPtr("nope") }, want: domain.ErrGroupNotFound},
		{name: "time before game", change: func(r *domain.NewLobbyRequest) { r.StartsAt, r.ModeID = now, strPtr("nope") }, want: domain.ErrLobbyInPast},
		{name: "game before mode", change: func(r *domain.NewLobbyRequest) { r.GameID, r.ModeID = strPtr(newLobby), strPtr("nope") }, want: domain.ErrInvalidGame},
		{name: "mode before activity", change: func(r *domain.NewLobbyRequest) { r.ModeID, r.ActivityID = strPtr("nope"), strPtr("nope") }, want: domain.ErrInvalidMode},
		{name: "activity before roles", change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.ActivityID, r.MaxPlayers = strPtr(raidModeID), strPtr("nope"), intPtr(3)
		}, want: domain.ErrInvalidActivity},
		{name: "roles before seat", change: func(r *domain.NewLobbyRequest) { r.ModeID, r.MaxPlayers = strPtr(raidModeID), intPtr(3) }, want: domain.ErrInvalidCapacity},
		{name: "seat last", change: func(r *domain.NewLobbyRequest) { r.ModeID = strPtr(raidModeID) }, want: domain.ErrInvalidGameRole},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLobbyStore()
			request := createRequest(bobID)
			tc.change(&request)

			_, err := newLobbies(store, questCatalog()).Create(context.Background(), request)

			if !errors.Is(err, tc.want) || len(store.inserted) != 0 {
				t.Fatalf("error %v with %d stored, want %v and nothing stored", err, len(store.inserted), tc.want)
			}
		})
	}
}

// raidLobbyStore has a lobby of Tank 1 and DPS 2 (max 3). Bob is the Tank.
func raidLobbyStore() *lobbyStore {
	store := openLobbyStore(intPtr(3))
	lobby := store.lobbies[lobbyID]
	lobby.RoleSlots = []domain.RoleSlot{{GameRoleID: tankRoleID, Name: "Tank", Slots: 1}, {GameRoleID: dpsRoleID, Name: "DPS", Slots: 2}}
	store.lobbies[lobbyID] = lobby
	store.seats[lobbyID+"/"+bobID] = strPtr(tankRoleID)
	return store
}

func TestJoinSavesTheSeat(t *testing.T) {
	store := raidLobbyStore()
	lobbies := newLobbies(store, chessCatalog())

	if err := lobbies.Join(context.Background(), fridayID, lobbyID, aliceID, domain.Seat{GameRoleID: strPtr(dpsRoleID)}); err != nil {
		t.Fatal(err)
	}
	if got := store.seats[lobbyID+"/"+aliceID]; got == nil || *got != dpsRoleID {
		t.Fatalf("Alice's seat %v, want DPS", got)
	}
	if err := lobbies.Join(context.Background(), fridayID, lobbyID, aliceID, domain.Seat{Flex: true}); err != nil {
		t.Fatal(err)
	}
	if store.seats[lobbyID+"/"+aliceID] != nil || !slices.Equal(store.players[lobbyID], []string{bobID, aliceID}) {
		t.Fatalf("seat %v and players %v, want Alice moved to flex and still once in the lobby", store.seats[lobbyID+"/"+aliceID], store.players[lobbyID])
	}
}

func TestJoinChecksSeatBeforeFullAndFullBeforeRole(t *testing.T) {
	tests := []struct {
		name   string
		setup  func(*lobbyStore)
		caller string
		seat   domain.Seat
		want   error
	}{
		{name: "no seat in a lobby with roles", caller: aliceID, want: domain.ErrInvalidGameRole},
		{name: "seat is checked before the lobby is full", setup: fillRaid, caller: daveID, seat: domain.Seat{GameRoleID: strPtr("nope")}, want: domain.ErrInvalidGameRole},
		{name: "lobby full before role full", setup: fillRaid, caller: daveID, seat: domain.Seat{GameRoleID: strPtr(tankRoleID)}, want: domain.ErrLobbyFull},
		{name: "role full", caller: aliceID, seat: domain.Seat{GameRoleID: strPtr(tankRoleID)}, want: domain.ErrGameRoleFull},
		{name: "a player moving to a full role", setup: func(s *lobbyStore) { s.players[lobbyID] = append(s.players[lobbyID], aliceID) }, caller: aliceID,
			seat: domain.Seat{GameRoleID: strPtr(tankRoleID)}, want: domain.ErrGameRoleFull},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := raidLobbyStore()
			store.members[fridayID] = append(store.members[fridayID], domain.Member{UserID: daveID, Role: domain.RoleMember})
			if tc.setup != nil {
				tc.setup(store)
			}
			before := slices.Clone(store.players[lobbyID])

			err := newLobbies(store, chessCatalog()).Join(context.Background(), fridayID, lobbyID, tc.caller, tc.seat)

			if !errors.Is(err, tc.want) || !slices.Equal(store.players[lobbyID], before) {
				t.Fatalf("error %v, players %v; want %v and no change from %v", err, store.players[lobbyID], tc.want, before)
			}
		})
	}
}

const daveID = "99999999-9999-4999-8999-999999999992"

// fillRaid makes the lobby full: Bob is the Tank, and Alice and Carol take the two DPS slots.
func fillRaid(store *lobbyStore) {
	store.players[lobbyID] = []string{bobID, aliceID, "carol"}
	store.seats[lobbyID+"/"+aliceID] = strPtr(dpsRoleID)
	store.seats[lobbyID+"/carol"] = strPtr(dpsRoleID)
}

func TestSameSeatInAFullLobbyChangesNothing(t *testing.T) {
	store := raidLobbyStore()
	fillRaid(store)

	err := newLobbies(store, chessCatalog()).Join(context.Background(), fridayID, lobbyID, aliceID, domain.Seat{GameRoleID: strPtr(dpsRoleID)})

	if err != nil || len(store.players[lobbyID]) != 3 {
		t.Fatalf("error %v, players %v; want no error and no change", err, store.players[lobbyID])
	}
}

func TestGetReturnsThePlayersGameRoles(t *testing.T) {
	store := raidLobbyStore()
	names := &fakeDirectory{names: map[string]string{bobID: "Bob"}}

	_, players, err := newLobbiesWithNames(store, chessCatalog(), names).Get(context.Background(), fridayID, lobbyID, bobID)

	if err != nil || len(players) != 1 || players[0].GameRoleID == nil || *players[0].GameRoleID != tankRoleID || players[0].DisplayName != "Bob" {
		t.Fatalf("players %+v, error %v; want Bob as Tank", players, err)
	}
}
