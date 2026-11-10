package application_test

import (
	"context"
	"errors"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

const (
	duelModeID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd2"
	keepID     = "99999999-9999-4999-8999-999999999991"
	arenaID    = "99999999-9999-4999-8999-999999999992"
)

// settingsStore has the raid lobby of Quest (Tank 1, DPS 2; Bob is the Tank) in the mode Raid with the activity The Keep.
// Quest also has the mode Duel (max 2, activity Arena).
func settingsStore() *lobbyStore {
	store := raidLobbyStore()
	raid := domain.GameMode{ID: raidModeID, Name: "Raid", MaxPlayers: intPtr(3), Activities: []domain.Activity{{ID: keepID, Name: "The Keep"}},
		GameRoles: []domain.GameRole{{ID: tankRoleID, Name: "Tank", Slots: 1}, {ID: dpsRoleID, Name: "DPS", Slots: 2}}}
	duel := domain.GameMode{ID: duelModeID, Name: "Duel", MaxPlayers: intPtr(2), Activities: []domain.Activity{{ID: arenaID, Name: "Arena"}}}
	store.tree = []domain.Game{{ID: chessID, Name: "Quest", Modes: []domain.GameMode{raid, duel}}}
	editLobby(store, func(l *domain.Lobby) {
		l.GameID, l.ModeID, l.ModeName = strPtr(chessID), strPtr(raidModeID), strPtr("Raid")
		l.ActivityID, l.ActivityName = strPtr(keepID), strPtr("The Keep")
	})
	return store
}

func editLobby(store *lobbyStore, edit func(*domain.Lobby)) {
	lobby := store.lobbies[lobbyID]
	edit(&lobby)
	store.lobbies[lobbyID] = lobby
}

func TestSetModeReplacesLimitSlotsAndActivityAndMakesEveryoneFlex(t *testing.T) {
	store := settingsStore()

	lobby, err := newLobbies(store, chessCatalog()).SetMode(context.Background(), fridayID, lobbyID, bobID, duelModeID, strPtr(raidModeID))

	if err != nil {
		t.Fatal(err)
	}
	if *lobby.ModeName != "Duel" || *lobby.MaxPlayers != 2 || len(lobby.RoleSlots) != 0 || lobby.ActivityID != nil || len(store.players[lobbyID]) != 1 || store.seats[lobbyID+"/"+bobID] != nil {
		t.Fatalf("lobby %+v seats %+v, want Duel, max 2, no slots, no activity and Bob as flex", lobby, store.seats)
	}
}

func TestSetModeToTheCurrentModeChangesNothing(t *testing.T) {
	store := settingsStore()

	lobby, err := newLobbies(store, chessCatalog()).SetMode(context.Background(), fridayID, lobbyID, bobID, raidModeID, strPtr(raidModeID))

	if err != nil {
		t.Fatal(err)
	}
	if *lobby.ActivityID != keepID || len(lobby.RoleSlots) != 2 || *store.seats[lobbyID+"/"+bobID] != tankRoleID {
		t.Fatalf("lobby %+v, want the activity, the slots and Bob's role kept", lobby)
	}
}

// The check order of ADR 0017 section 10: each case fails in its own place although every later check would fail too.
func TestSetModeChecksInTheOrderOfTheContract(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(*domain.Lobby)
		players []string // added to Bob
		groupID string
		lobbyID string
		caller  string
		modeID  string
		current *string
		want    error
	}{
		{name: "group", groupID: missingID, lobbyID: lobbyID, caller: bobID, modeID: "nope", current: strPtr("old"), want: domain.ErrGroupNotFound},
		{name: "membership before lobby", groupID: fridayID, lobbyID: missingID, caller: strangerID, modeID: "nope", want: domain.ErrGroupNotFound},
		{name: "missing lobby", groupID: fridayID, lobbyID: missingID, caller: bobID, modeID: "nope", want: domain.ErrLobbyNotFound},
		{name: "ended before player", setup: func(l *domain.Lobby) { l.EndsAt = now }, groupID: fridayID, lobbyID: lobbyID, caller: aliceID, modeID: "nope", want: domain.ErrLobbyHasEnded},
		{name: "player before mode", groupID: fridayID, lobbyID: lobbyID, caller: aliceID, modeID: "nope", want: domain.ErrNotAllowed},
		{name: "mode before state", groupID: fridayID, lobbyID: lobbyID, caller: bobID, modeID: "nope", current: strPtr("old"), want: domain.ErrInvalidMode},
		{name: "a lobby with no game refuses every mode", setup: func(l *domain.Lobby) { l.GameID = nil }, groupID: fridayID, lobbyID: lobbyID, caller: bobID, modeID: duelModeID, current: strPtr(raidModeID), want: domain.ErrInvalidMode},
		{name: "a mode of another game", setup: func(l *domain.Lobby) { l.GameID = strPtr(newLobby) }, groupID: fridayID, lobbyID: lobbyID, caller: bobID, modeID: duelModeID, current: strPtr(raidModeID), want: domain.ErrInvalidMode},
		{name: "stale view", groupID: fridayID, lobbyID: lobbyID, caller: bobID, modeID: duelModeID, current: strPtr(duelModeID), want: domain.ErrLobbyChanged},
		{name: "stale view of no mode", groupID: fridayID, lobbyID: lobbyID, caller: bobID, modeID: duelModeID, want: domain.ErrLobbyChanged},
		{name: "more players than the limit", players: []string{aliceID, daveID}, groupID: fridayID, lobbyID: lobbyID, caller: bobID, modeID: duelModeID, current: strPtr(raidModeID), want: domain.ErrLobbyHasMorePlayers},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := settingsStore()
			store.players[lobbyID] = append(store.players[lobbyID], tc.players...)
			if tc.setup != nil {
				editLobby(store, tc.setup)
			}
			before := store.lobbies[lobbyID]

			_, err := newLobbies(store, chessCatalog()).SetMode(context.Background(), tc.groupID, tc.lobbyID, tc.caller, tc.modeID, tc.current)

			after := store.lobbies[lobbyID]
			if !errors.Is(err, tc.want) || *after.ModeID != raidModeID || *after.ActivityID != keepID || *after.MaxPlayers != *before.MaxPlayers {
				t.Fatalf("error %v, lobby %+v, want %v and the lobby unchanged", err, after, tc.want)
			}
		})
	}
}

func TestSetActivityAndClearActivity(t *testing.T) {
	store := settingsStore()
	lobbies := newLobbies(store, chessCatalog())
	// In the mode Duel, The Keep is an activity of another mode.
	if _, err := lobbies.SetMode(context.Background(), fridayID, lobbyID, bobID, duelModeID, strPtr(raidModeID)); err != nil {
		t.Fatal(err)
	}

	if _, err := lobbies.SetActivity(context.Background(), fridayID, lobbyID, bobID, keepID); !errors.Is(err, domain.ErrInvalidActivity) {
		t.Fatalf("an activity of another mode: error %v, want invalid activity", err)
	}
	lobby, err := lobbies.SetActivity(context.Background(), fridayID, lobbyID, bobID, arenaID)
	if err != nil || *lobby.ActivityName != "Arena" || *lobby.MaxPlayers != 2 {
		t.Fatalf("lobby %+v error %v, want Arena and the limit kept", lobby, err)
	}
	for range 2 {
		lobby, err = lobbies.ClearActivity(context.Background(), fridayID, lobbyID, bobID)
		if err != nil || lobby.ActivityID != nil || lobby.ActivityName != nil || *lobby.ModeName != "Duel" {
			t.Fatalf("lobby %+v error %v, want the activity cleared and the mode kept, also the second time", lobby, err)
		}
	}
}

func TestActivityChangesCheckInTheOrderOfTheContract(t *testing.T) {
	tests := []struct {
		name   string
		setup  func(*domain.Lobby)
		caller string
		lobby  string
		want   error
	}{
		{name: "non-member", caller: strangerID, lobby: lobbyID, want: domain.ErrGroupNotFound},
		{name: "missing lobby", caller: bobID, lobby: missingID, want: domain.ErrLobbyNotFound},
		{name: "ended", setup: func(l *domain.Lobby) { l.EndsAt = now }, caller: bobID, lobby: lobbyID, want: domain.ErrLobbyHasEnded},
		{name: "member who is not a player", caller: aliceID, lobby: lobbyID, want: domain.ErrNotAllowed},
	}
	for _, tc := range tests {
		for _, set := range []bool{true, false} {
			t.Run(tc.name, func(t *testing.T) {
				store := settingsStore()
				if tc.setup != nil {
					editLobby(store, tc.setup)
				}
				lobbies := newLobbies(store, chessCatalog())

				var err error
				if set {
					_, err = lobbies.SetActivity(context.Background(), fridayID, tc.lobby, tc.caller, "nope")
				} else {
					_, err = lobbies.ClearActivity(context.Background(), fridayID, tc.lobby, tc.caller)
				}

				if !errors.Is(err, tc.want) || *store.lobbies[lobbyID].ActivityID != keepID {
					t.Fatalf("error %v, want %v and the activity kept", err, tc.want)
				}
			})
		}
	}
}

func TestSetActivityRefusesALobbyWithoutAModeWithoutReadingTheTree(t *testing.T) {
	store := settingsStore()
	editLobby(store, func(l *domain.Lobby) { l.ModeID = nil })

	_, err := newLobbies(store, chessCatalog()).SetActivity(context.Background(), fridayID, lobbyID, bobID, keepID)

	if !errors.Is(err, domain.ErrInvalidActivity) || store.reads != 0 {
		t.Fatalf("error %v with %d reads, want invalid activity without a read", err, store.reads)
	}
}

// A saved change is answered with the lobby as saved, without a name lookup in auth: auth being down cannot turn a
// committed change into a 503 (ADR 0017 section 10, Amendment 2026-11-09). The lobby ending or the caller leaving the
// group right after the commit does not change the answer either.
func TestSavedSettingsChangeIsAnsweredWithoutAuth(t *testing.T) {
	tests := []struct {
		name string
		then func(*lobbyStore)
	}{
		{name: "nothing happens", then: func(*lobbyStore) {}},
		{name: "the lobby ends", then: func(s *lobbyStore) { editLobby(s, func(l *domain.Lobby) { l.EndsAt = now }) }},
		{name: "the caller leaves the group", then: func(s *lobbyStore) { s.members[fridayID] = s.members[fridayID][:1] }},
	}
	for _, tc := range tests {
		for _, op := range []string{"mode", "activity", "clear"} {
			t.Run(tc.name+" "+op, func(t *testing.T) {
				store := settingsStore()
				store.afterCommit = func() { tc.then(store) }
				names := &fakeDirectory{err: domain.ErrUnavailable}
				lobbies := newLobbiesWithNames(store, chessCatalog(), names)
				var lobby domain.Lobby
				var err error
				var want func(domain.Lobby) bool
				switch op {
				case "mode":
					lobby, err = lobbies.SetMode(context.Background(), fridayID, lobbyID, bobID, duelModeID, strPtr(raidModeID))
					want = func(l domain.Lobby) bool { return l.ModeID != nil && *l.ModeID == duelModeID && *l.MaxPlayers == 2 }
				case "activity":
					editLobby(store, func(l *domain.Lobby) { l.ActivityID, l.ActivityName = nil, nil })
					lobby, err = lobbies.SetActivity(context.Background(), fridayID, lobbyID, bobID, keepID)
					want = func(l domain.Lobby) bool { return l.ActivityID != nil && *l.ActivityID == keepID }
				default:
					lobby, err = lobbies.ClearActivity(context.Background(), fridayID, lobbyID, bobID)
					want = func(l domain.Lobby) bool { return l.ActivityID == nil && l.ActivityName == nil }
				}

				if err != nil || lobby.ID != lobbyID || !want(lobby) || !want(store.lobbies[lobbyID]) || names.calls != 0 {
					t.Fatalf("lobby %+v error %v, %d name lookups; want the saved change in the answer and the store, and no lookup",
						lobby, err, names.calls)
				}
			})
		}
	}
}

func TestSetModeToACorruptModeIsNotABadRequest(t *testing.T) {
	store := settingsStore()
	store.tree[0].Modes[1].MaxPlayers = nil

	_, err := newLobbies(store, chessCatalog()).SetMode(context.Background(), fridayID, lobbyID, bobID, duelModeID, strPtr(raidModeID))

	if !errors.Is(err, domain.ErrStoredModeInvalid) || errors.Is(err, domain.ErrInvalidCapacity) {
		t.Fatalf("error %v, want the stored-mode error and not invalid capacity", err)
	}
}
