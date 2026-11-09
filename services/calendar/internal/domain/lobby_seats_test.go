package domain_test

import (
	"errors"
	"testing"
	"time"

	"openlobby/services/calendar/internal/domain"
)

const (
	tankID   = "role-tank"
	healerID = "role-healer"
	dpsID    = "role-dps"
)

// rs builds a role slot.
func rs(id, name string, slots, players int) domain.RoleSlot {
	return domain.RoleSlot{GameRoleID: id, Name: name, Slots: slots, PlayerCount: players}
}

// raidMode has Tank 1, Healer 1 and DPS 2, so 4 players. Activities: one of the mode.
func raidMode() domain.GameMode {
	return domain.GameMode{
		ID: "mode-raid", Name: "Raid", MaxPlayers: maxPtr(4),
		GameRoles:  []domain.GameRole{{ID: tankID, Name: "Tank", Slots: 1}, {ID: healerID, Name: "Healer", Slots: 1}, {ID: dpsID, Name: "DPS", Slots: 2}},
		Activities: []domain.Activity{{ID: "act-keep", Name: "The Keep"}},
	}
}

// duelMode has no roles, only a max of 2.
func duelMode() domain.GameMode {
	return domain.GameMode{ID: "mode-duel", Name: "Duel", MaxPlayers: maxPtr(2), Activities: []domain.Activity{{ID: "act-arena", Name: "Arena"}}}
}

func modeGame() domain.Game {
	return domain.Game{ID: "game-1", Name: "Quest", Modes: []domain.GameMode{raidMode(), duelMode()}}
}

func roleGame() domain.Game {
	return domain.Game{ID: "game-1", Name: "Quest", GameRoles: []domain.GameRole{{ID: tankID, Name: "Tank", Slots: 1}, {ID: dpsID, Name: "DPS", Slots: 3}}}
}

func requestFor(game domain.Game) domain.NewLobbyRequest {
	request := validRequest()
	request.Game = &game
	return request
}

func TestNewLobbyModeAndActivityRules(t *testing.T) {
	tests := []struct {
		name   string
		change func(*domain.NewLobbyRequest)
		want   error
	}{
		{name: "mode of the game", change: func(r *domain.NewLobbyRequest) { r.ModeID = strPtr("mode-duel"); r.MaxPlayers = maxPtr(2) }},
		{name: "unknown mode", change: func(r *domain.NewLobbyRequest) { r.ModeID = strPtr("nope") }, want: domain.ErrInvalidMode},
		{name: "mode with a custom game name", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName, r.ModeID = nil, nil, strPtr("Go"), strPtr("mode-duel")
		}, want: domain.ErrInvalidMode},
		{name: "unknown game is checked before the mode", change: func(r *domain.NewLobbyRequest) { r.Game, r.ModeID = nil, strPtr("mode-duel") }, want: domain.ErrInvalidGame},
		{name: "activity of the mode", change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.ActivityID, r.MaxPlayers = strPtr("mode-duel"), strPtr("act-arena"), maxPtr(2)
		}},
		{name: "activity of another mode", change: func(r *domain.NewLobbyRequest) { r.ModeID, r.ActivityID = strPtr("mode-duel"), strPtr("act-keep") }, want: domain.ErrInvalidActivity},
		{name: "activity without a mode", change: func(r *domain.NewLobbyRequest) { r.ActivityID = strPtr("act-arena") }, want: domain.ErrInvalidActivity},
		{name: "bad mode is checked before bad activity and capacity", change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.ActivityID, r.MaxPlayers = strPtr("nope"), strPtr("nope"), maxPtr(0)
		}, want: domain.ErrInvalidMode},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := requestFor(modeGame())
			tc.change(&request)

			_, err := domain.NewLobby(request, lobbyNow)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
}

func TestNewLobbyCopiesModeAndActivity(t *testing.T) {
	request := requestFor(modeGame())
	request.ModeID, request.ActivityID, request.MaxPlayers = strPtr("mode-duel"), strPtr("act-arena"), maxPtr(2)

	lobby, err := domain.NewLobby(request, lobbyNow)

	if err != nil || *lobby.ModeID != "mode-duel" || *lobby.ModeName != "Duel" || *lobby.ActivityID != "act-arena" || *lobby.ActivityName != "Arena" {
		t.Fatalf("lobby %+v, error %v; want the mode and activity copied", lobby, err)
	}
}

func TestNewLobbyRolesAndCapacity(t *testing.T) {
	flexSeat := domain.Seat{Flex: true}
	tests := []struct {
		name      string
		game      domain.Game
		change    func(*domain.NewLobbyRequest)
		want      error
		wantMax   *int
		wantSlots []domain.RoleSlot
	}{
		{name: "mode roles are used as they are", game: modeGame(), change: func(r *domain.NewLobbyRequest) { r.ModeID, r.Seat = strPtr("mode-raid"), flexSeat },
			wantMax: maxPtr(4), wantSlots: []domain.RoleSlot{rs(tankID, "Tank", 1, 0), rs(healerID, "Healer", 1, 0), rs(dpsID, "DPS", 2, 0)}},
		{name: "roleSlots override, unlisted roles count 0 and are not stored", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat = strPtr("mode-raid"), domain.Seat{GameRoleID: strPtr(dpsID)}
			r.RoleSlots = []domain.RoleSlotInput{{GameRoleID: dpsID, Slots: 3}, {GameRoleID: healerID, Slots: 0}}
		}, wantMax: maxPtr(3), wantSlots: []domain.RoleSlot{rs(dpsID, "DPS", 3, 1)}},
		{name: "game without modes uses the game's roles", game: roleGame(), change: func(r *domain.NewLobbyRequest) { r.Seat = domain.Seat{GameRoleID: strPtr(tankID)} },
			wantMax: maxPtr(4), wantSlots: []domain.RoleSlot{rs(tankID, "Tank", 1, 1), rs(dpsID, "DPS", 3, 0)}},
		{name: "game with modes but no mode has no roles", game: modeGame(), change: func(r *domain.NewLobbyRequest) {}},
		{name: "unknown role in roleSlots", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat, r.RoleSlots = strPtr("mode-raid"), flexSeat, []domain.RoleSlotInput{{GameRoleID: "nope", Slots: 1}}
		}, want: domain.ErrInvalidGameRole},
		{name: "duplicate role in roleSlots", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat, r.RoleSlots = strPtr("mode-raid"), flexSeat, []domain.RoleSlotInput{{GameRoleID: dpsID, Slots: 1}, {GameRoleID: dpsID, Slots: 1}}
		}, want: domain.ErrInvalidGameRole},
		{name: "roleSlots for an owner without roles", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.MaxPlayers, r.RoleSlots = strPtr("mode-duel"), maxPtr(2), []domain.RoleSlotInput{}
		}, want: domain.ErrInvalidGameRole},
		{name: "negative slots", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat, r.RoleSlots = strPtr("mode-raid"), flexSeat, []domain.RoleSlotInput{{GameRoleID: dpsID, Slots: -1}}
		}, want: domain.ErrInvalidCapacity},
		{name: "all slots 0", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat, r.RoleSlots = strPtr("mode-raid"), flexSeat, []domain.RoleSlotInput{{GameRoleID: dpsID, Slots: 0}}
		}, want: domain.ErrInvalidCapacity},
		{name: "sum above the limit", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat = strPtr("mode-raid"), flexSeat
			r.RoleSlots = []domain.RoleSlotInput{{GameRoleID: dpsID, Slots: 2147483647}, {GameRoleID: tankID, Slots: 1}}
		}, want: domain.ErrInvalidCapacity},
		{name: "slots above the limit", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat, r.RoleSlots = strPtr("mode-raid"), flexSeat, []domain.RoleSlotInput{{GameRoleID: dpsID, Slots: 2147483648}}
		}, want: domain.ErrInvalidCapacity},
		{name: "maxPlayers with roles", game: modeGame(), change: func(r *domain.NewLobbyRequest) {
			r.ModeID, r.Seat, r.MaxPlayers = strPtr("mode-raid"), flexSeat, maxPtr(4)
		},
			want: domain.ErrInvalidCapacity},
		{name: "mode without roles needs maxPlayers", game: modeGame(), change: func(r *domain.NewLobbyRequest) { r.ModeID = strPtr("mode-duel") }, want: domain.ErrInvalidCapacity},
		{name: "mode without roles with maxPlayers", game: modeGame(), change: func(r *domain.NewLobbyRequest) { r.ModeID, r.MaxPlayers = strPtr("mode-duel"), maxPtr(5) },
			wantMax: maxPtr(5)},
		{name: "open lobby may be unlimited", game: modeGame(), change: func(r *domain.NewLobbyRequest) {}},
		{name: "open lobby keeps the capacity rule", game: modeGame(), change: func(r *domain.NewLobbyRequest) { r.MaxPlayers = maxPtr(0) }, want: domain.ErrInvalidCapacity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := requestFor(tc.game)
			tc.change(&request)

			lobby, err := domain.NewLobby(request, lobbyNow)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if err != nil {
				return
			}
			if (lobby.MaxPlayers == nil) != (tc.wantMax == nil) || (tc.wantMax != nil && *lobby.MaxPlayers != *tc.wantMax) {
				t.Errorf("max players %v, want %v", lobby.MaxPlayers, tc.wantMax)
			}
			if len(lobby.RoleSlots) != len(tc.wantSlots) {
				t.Fatalf("role slots %+v, want %+v", lobby.RoleSlots, tc.wantSlots)
			}
			for i, slot := range tc.wantSlots {
				if lobby.RoleSlots[i] != slot {
					t.Errorf("role slot %d = %+v, want %+v", i, lobby.RoleSlots[i], slot)
				}
			}
		})
	}
}

func TestNewLobbySeatRule(t *testing.T) {
	tests := []struct {
		name     string
		mode     string
		seat     domain.Seat
		want     error
		wantFlex int
	}{
		{name: "role", mode: "mode-raid", seat: domain.Seat{GameRoleID: strPtr(tankID)}},
		{name: "flex", mode: "mode-raid", seat: domain.Seat{Flex: true}, wantFlex: 1},
		{name: "none with roles", mode: "mode-raid", want: domain.ErrInvalidGameRole},
		{name: "flex false is none", mode: "mode-raid", seat: domain.Seat{Flex: false}, want: domain.ErrInvalidGameRole},
		{name: "both", mode: "mode-raid", seat: domain.Seat{GameRoleID: strPtr(tankID), Flex: true}, want: domain.ErrInvalidGameRole},
		{name: "role of another lobby", mode: "mode-raid", seat: domain.Seat{GameRoleID: strPtr("nope")}, want: domain.ErrInvalidGameRole},
		{name: "role in a lobby without roles", mode: "mode-duel", seat: domain.Seat{GameRoleID: strPtr(tankID)}, want: domain.ErrInvalidGameRole},
		{name: "flex in a lobby without roles", mode: "mode-duel", seat: domain.Seat{Flex: true}, want: domain.ErrInvalidGameRole},
		{name: "none without roles", mode: "mode-duel"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := requestFor(modeGame())
			request.ModeID, request.Seat, request.MaxPlayers = &tc.mode, tc.seat, maxPtr(2)
			if tc.mode == "mode-raid" {
				request.MaxPlayers = nil
			}

			lobby, err := domain.NewLobby(request, lobbyNow)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if err == nil && (lobby.FlexCount != tc.wantFlex || (tc.seat.GameRoleID != nil) != (lobby.CreatorRoleID != nil)) {
				t.Fatalf("flex %d and creator role %v, want flex %d for seat %+v", lobby.FlexCount, lobby.CreatorRoleID, tc.wantFlex, tc.seat)
			}
		})
	}
}

func TestCheckJoinSeatRules(t *testing.T) {
	future := lobbyNow.Add(time.Hour)
	roles := func(tank, healer int) []domain.RoleSlot {
		return []domain.RoleSlot{{GameRoleID: tankID, Name: "Tank", Slots: 1, PlayerCount: tank}, {GameRoleID: healerID, Name: "Healer", Slots: 2, PlayerCount: healer}}
	}
	tank, healer, flex := domain.Seat{GameRoleID: strPtr(tankID)}, domain.Seat{GameRoleID: strPtr(healerID)}, domain.Seat{Flex: true}
	tests := []struct {
		name     string
		state    domain.JoinState
		seat     domain.Seat
		wantSave bool
		wantRole *string
		want     error
	}{
		{name: "new player takes a free role", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 1, Roles: roles(0, 1)}, seat: tank, wantSave: true, wantRole: strPtr(tankID)},
		{name: "new player takes flex", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 1, Roles: roles(0, 1)}, seat: flex, wantSave: true},
		{name: "no seat in a lobby with roles", state: domain.JoinState{EndsAt: future, Roles: roles(0, 0)}, want: domain.ErrInvalidGameRole},
		{name: "a seat in a lobby without roles", state: domain.JoinState{EndsAt: future}, seat: tank, want: domain.ErrInvalidGameRole},
		{name: "unknown role", state: domain.JoinState{EndsAt: future, Roles: roles(0, 0)}, seat: domain.Seat{GameRoleID: strPtr("nope")}, want: domain.ErrInvalidGameRole},
		{name: "role full", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 1, Roles: roles(1, 0)}, seat: tank, want: domain.ErrGameRoleFull},
		{name: "lobby full is checked before role full", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 3, Roles: roles(1, 1)}, seat: tank, want: domain.ErrLobbyFull},
		{name: "flex needs a free spot", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 3, Roles: roles(1, 1)}, seat: flex, want: domain.ErrLobbyFull},
		{name: "same seat is a no-op in a full lobby", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 3, IsPlayer: true, CurrentRole: strPtr(tankID), Roles: roles(1, 2)}, seat: tank},
		{name: "same flex seat is a no-op", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 3, IsPlayer: true, Roles: roles(1, 1)}, seat: flex},
		{name: "change to a free role in a full lobby", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 3, IsPlayer: true, CurrentRole: strPtr(tankID), Roles: roles(1, 1)},
			seat: healer, wantSave: true, wantRole: strPtr(healerID)},
		{name: "change to a full role", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 2, IsPlayer: true, Roles: roles(1, 0)}, seat: tank, want: domain.ErrGameRoleFull},
		{name: "change to flex is always allowed", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 3, IsPlayer: true, CurrentRole: strPtr(tankID), Roles: roles(1, 2)},
			seat: flex, wantSave: true},
		{name: "ended beats a bad seat", state: domain.JoinState{EndsAt: lobbyNow, Roles: roles(0, 0)}, want: domain.ErrLobbyHasEnded},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			save, role, err := tc.state.CheckJoin(lobbyNow, tc.seat)

			if save != tc.wantSave || !errors.Is(err, tc.want) || (role == nil) != (tc.wantRole == nil) || (role != nil && *role != *tc.wantRole) {
				t.Fatalf("save %v, role %v, error %v; want %v, %v, %v", save, role, err, tc.wantSave, tc.wantRole, tc.want)
			}
		})
	}
}
