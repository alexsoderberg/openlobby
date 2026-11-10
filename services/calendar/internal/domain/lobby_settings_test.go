package domain_test

import (
	"errors"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/domain"
)

// factsOf is a lobby in game-1 with the mode, two players and the caller among them, ending after lobbyNow.
func factsOf(modeID *string) domain.LobbyFacts {
	return domain.LobbyFacts{EndsAt: lobbyNow.Add(time.Hour), GameID: strPtr("game-1"), ModeID: modeID, PlayerCount: 2, IsPlayer: true}
}

func TestCheckModeChange(t *testing.T) {
	raid, duel := raidMode(), duelMode()
	tests := []struct {
		name    string
		facts   func(*domain.LobbyFacts)
		current *string
		mode    *domain.GameMode
		want    error
		save    bool
	}{
		{name: "from no mode to a mode with roles", mode: &raid, save: true},
		{name: "from a mode to a mode without roles", facts: func(f *domain.LobbyFacts) { f.ModeID = strPtr("mode-raid") }, current: strPtr("mode-raid"), mode: &duel, save: true},
		{name: "ended before everything else", facts: func(f *domain.LobbyFacts) { f.EndsAt, f.IsPlayer = lobbyNow, false }, want: domain.ErrLobbyHasEnded},
		{name: "not a player before the mode", facts: func(f *domain.LobbyFacts) { f.IsPlayer = false }, want: domain.ErrNotAllowed},
		{name: "invalid mode before a stale view", current: strPtr("old"), want: domain.ErrInvalidMode},
		{name: "stale view", current: strPtr("old"), mode: &raid, want: domain.ErrLobbyChanged},
		{name: "a view of no mode when the lobby has one", facts: func(f *domain.LobbyFacts) { f.ModeID = strPtr("mode-duel") }, mode: &raid, want: domain.ErrLobbyChanged},
		{name: "the same mode changes nothing even with a stale view of players", facts: func(f *domain.LobbyFacts) { f.ModeID, f.PlayerCount = strPtr("mode-duel"), 9 }, current: strPtr("mode-duel"), mode: &duel},
		{name: "limit equal to the players", facts: func(f *domain.LobbyFacts) { f.PlayerCount = 2 }, mode: &duel, save: true},
		{name: "limit below the players", facts: func(f *domain.LobbyFacts) { f.PlayerCount = 3 }, mode: &duel, want: domain.ErrLobbyHasMorePlayers},
		{name: "a mode without roles and without max", mode: &domain.GameMode{ID: "m"}, want: domain.ErrStoredModeInvalid},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			facts := factsOf(nil)
			if tc.facts != nil {
				tc.facts(&facts)
			}

			_, save, err := facts.CheckModeChange(lobbyNow, tc.current, tc.mode)

			if !errors.Is(err, tc.want) || save != tc.save {
				t.Fatalf("error %v, save %v, want %v and %v", err, save, tc.want, tc.save)
			}
		})
	}
}

func TestCheckModeChangeTakesTheLimitAndSlotsFromTheMode(t *testing.T) {
	raid := raidMode()
	raid.MaxPlayers = maxPtr(99) // the sum of the roles decides, not the stored value

	change, _, err := factsOf(nil).CheckModeChange(lobbyNow, nil, &raid)

	if err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	for _, slot := range change.Slots {
		ids = append(ids, slot.GameRoleID)
		if slot.PlayerCount != 0 {
			t.Fatalf("slot %+v, want no players: the database sets every player to flex", slot)
		}
	}
	if change.MaxPlayers != 4 || !slices.Equal(ids, []string{tankID, healerID, dpsID}) || change.Mode.Name != "Raid" {
		t.Fatalf("change %+v, want max 4 and the roles of Raid", change)
	}
}

func TestCheckActivityChange(t *testing.T) {
	activity := &domain.Activity{ID: "act-keep", Name: "The Keep"}
	tests := []struct {
		name     string
		facts    func(*domain.LobbyFacts)
		activity *domain.Activity
		want     error
	}{
		{name: "an activity of the mode", activity: activity},
		{name: "ended", facts: func(f *domain.LobbyFacts) { f.EndsAt = lobbyNow }, activity: activity, want: domain.ErrLobbyHasEnded},
		{name: "not a player before the activity", facts: func(f *domain.LobbyFacts) { f.IsPlayer = false }, want: domain.ErrNotAllowed},
		{name: "an activity not of the mode, or a lobby with no mode", want: domain.ErrInvalidActivity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			facts := factsOf(strPtr("mode-raid"))
			if tc.facts != nil {
				tc.facts(&facts)
			}

			if err := facts.CheckActivityChange(lobbyNow, tc.activity); !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
}
