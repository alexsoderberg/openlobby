package domain_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/domain"
)

var lobbyNow = time.Date(2026, 11, 2, 18, 0, 0, 0, time.UTC)

func strPtr(value string) *string { return &value }

func maxPtr(value int) *int { return &value }

var chess = domain.Game{ID: "game-1", Name: "Chess"}

// validRequest is a lobby of two hours that starts in an hour, with a game of the list.
func validRequest() domain.NewLobbyRequest {
	return domain.NewLobbyRequest{
		GroupID:   "group-1",
		CreatorID: "alex",
		StartsAt:  lobbyNow.Add(time.Hour),
		EndsAt:    lobbyNow.Add(3 * time.Hour),
		GameID:    strPtr("game-1"),
		Game:      &chess,
	}
}

func TestNewLobbyTimeRules(t *testing.T) {
	tests := []struct {
		name   string
		starts time.Duration // from now
		ends   time.Duration // from now
		want   error
	}{
		{name: "starts one microsecond ahead", starts: time.Microsecond, ends: time.Hour},
		{name: "starts now is in the past", starts: 0, ends: time.Hour, want: domain.ErrLobbyInPast},
		{name: "starts earlier is in the past", starts: -time.Minute, ends: time.Hour, want: domain.ErrLobbyInPast},
		{name: "past start is checked before the end", starts: -time.Minute, ends: -time.Hour, want: domain.ErrLobbyInPast},
		{name: "end equal to start", starts: time.Hour, ends: time.Hour, want: domain.ErrLobbyEndNotAfterStart},
		{name: "end before start", starts: time.Hour, ends: time.Minute, want: domain.ErrLobbyEndNotAfterStart},
		{name: "end one microsecond after start", starts: time.Hour, ends: time.Hour + time.Microsecond},
		{name: "just under 24 hours", starts: time.Hour, ends: time.Hour + 24*time.Hour - time.Microsecond},
		{name: "exactly 24 hours is denied", starts: time.Hour, ends: time.Hour + 24*time.Hour, want: domain.ErrLobbyTooLong},
		{name: "over 24 hours", starts: time.Hour, ends: 30 * time.Hour, want: domain.ErrLobbyTooLong},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := validRequest()
			request.StartsAt, request.EndsAt = lobbyNow.Add(tc.starts), lobbyNow.Add(tc.ends)

			_, err := domain.NewLobby(request, lobbyNow)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
}

func TestNewLobbyGameRules(t *testing.T) {
	tests := []struct {
		name     string
		change   func(*domain.NewLobbyRequest)
		wantName *string
		wantID   *string
		want     error
	}{
		{name: "game of the list", change: func(*domain.NewLobbyRequest) {}, wantName: strPtr("Chess"), wantID: strPtr("game-1")},
		{name: "custom name is trimmed", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr("  Go  ")
		}, wantName: strPtr("Go")},
		{name: "custom name of 50 code points", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr(strings.Repeat("å", 50))
		}, wantName: strPtr(strings.Repeat("å", 50))},
		{name: "custom name Other is allowed", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr("Other")
		}, wantName: strPtr("Other")},
		{name: "no game is an open lobby", change: func(r *domain.NewLobbyRequest) { r.GameID, r.Game = nil, nil }},
		{name: "both game and custom name", change: func(r *domain.NewLobbyRequest) { r.CustomGameName = strPtr("Go") }, want: domain.ErrInvalidGame},
		{name: "unknown game id", change: func(r *domain.NewLobbyRequest) { r.Game = nil }, want: domain.ErrInvalidGame},
		{name: "blank custom name", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr(" \t ")
		}, want: domain.ErrInvalidGame},
		{name: "empty custom name", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr("")
		}, want: domain.ErrInvalidGame},
		{name: "custom name of 51 code points", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr(strings.Repeat("å", 51))
		}, want: domain.ErrInvalidGame},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := validRequest()
			tc.change(&request)

			lobby, err := domain.NewLobby(request, lobbyNow)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if tc.want != nil {
				return
			}
			if (lobby.GameName == nil) != (tc.wantName == nil) || (tc.wantName != nil && *lobby.GameName != *tc.wantName) {
				t.Fatalf("game name %v, want %v", lobby.GameName, tc.wantName)
			}
			if (lobby.GameID == nil) != (tc.wantID == nil) || (tc.wantID != nil && *lobby.GameID != *tc.wantID) {
				t.Fatalf("game id %v, want %v", lobby.GameID, tc.wantID)
			}
		})
	}
}

func TestNewLobbyCapacityRules(t *testing.T) {
	tests := []struct {
		name string
		max  *int
		want error
	}{
		{name: "omitted means unlimited", max: nil},
		{name: "one", max: maxPtr(1)},
		{name: "largest", max: maxPtr(2147483647)},
		{name: "zero", max: maxPtr(0), want: domain.ErrInvalidCapacity},
		{name: "negative", max: maxPtr(-1), want: domain.ErrInvalidCapacity},
		{name: "one above the largest", max: maxPtr(2147483648), want: domain.ErrInvalidCapacity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := validRequest()
			request.MaxPlayers = tc.max

			lobby, err := domain.NewLobby(request, lobbyNow)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if tc.want == nil && (lobby.MaxPlayers == nil) != (tc.max == nil) {
				t.Fatalf("max players %v, want %v", lobby.MaxPlayers, tc.max)
			}
		})
	}
}

// The rules run in the order of the contract: time rules, then game, then capacity.
func TestNewLobbyReportsTheFirstBrokenRule(t *testing.T) {
	request := validRequest()
	request.StartsAt = lobbyNow.Add(-time.Hour)
	request.Game = nil // an unknown game
	request.MaxPlayers = maxPtr(0)
	if _, err := domain.NewLobby(request, lobbyNow); !errors.Is(err, domain.ErrLobbyInPast) {
		t.Fatalf("error %v, want ErrLobbyInPast", err)
	}

	request.StartsAt = lobbyNow.Add(time.Hour)
	if _, err := domain.NewLobby(request, lobbyNow); !errors.Is(err, domain.ErrInvalidGame) {
		t.Fatalf("error %v, want ErrInvalidGame", err)
	}
}

func TestNewLobbyKeepsTheCreatorAsFirstPlayer(t *testing.T) {
	lobby, err := domain.NewLobby(validRequest(), lobbyNow)

	if err != nil {
		t.Fatal(err)
	}
	if lobby.CreatedByUserID != "alex" || lobby.GroupID != "group-1" || lobby.PlayerCount != 1 || !lobby.CreatedAt.Equal(lobbyNow) {
		t.Fatalf("lobby %+v, want creator alex, group-1, one player, created now", lobby)
	}
}

// PostgreSQL stores microseconds, so the rules apply to the truncated moments. Otherwise a pair that passes at
// nanosecond precision could break the database checks and give a 500.
func TestNewLobbyAppliesTheRulesAtMicrosecondPrecision(t *testing.T) {
	start := lobbyNow.Add(time.Hour + 500*time.Nanosecond)
	tests := []struct {
		name string
		end  time.Time
		want error
	}{
		{name: "one nanosecond under 24 hours is 24 hours once stored", end: start.Add(24*time.Hour - time.Nanosecond), want: domain.ErrLobbyTooLong},
		{name: "one nanosecond after the start is the start once stored", end: start.Add(time.Nanosecond), want: domain.ErrLobbyEndNotAfterStart},
		{name: "one microsecond after the start", end: start.Add(time.Microsecond)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			request := validRequest()
			request.StartsAt, request.EndsAt = start, tc.end

			lobby, err := domain.NewLobby(request, lobbyNow)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if err == nil && (lobby.StartsAt.Nanosecond()%1000 != 0 || lobby.EndsAt.Nanosecond()%1000 != 0) {
				t.Fatalf("stored moments %v and %v have sub-microsecond parts", lobby.StartsAt, lobby.EndsAt)
			}
		})
	}
}

func TestCheckJoinAppliesTheContractOrder(t *testing.T) {
	future, past := lobbyNow.Add(time.Hour), lobbyNow.Add(-time.Hour)
	tests := []struct {
		name    string
		state   domain.JoinState
		wantAdd bool
		want    error
	}{
		{name: "open spot", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(2), PlayerCount: 1}, wantAdd: true},
		{name: "unlimited", state: domain.JoinState{EndsAt: future, PlayerCount: 100}, wantAdd: true},
		{name: "last spot", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(3), PlayerCount: 2}, wantAdd: true},
		{name: "full", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(2), PlayerCount: 2}, want: domain.ErrLobbyFull},
		{name: "already a player in a full lobby changes nothing", state: domain.JoinState{EndsAt: future, MaxPlayers: maxPtr(2), PlayerCount: 2, IsPlayer: true}},
		{name: "ended", state: domain.JoinState{EndsAt: past}, want: domain.ErrLobbyHasEnded},
		{name: "ends exactly now", state: domain.JoinState{EndsAt: lobbyNow}, want: domain.ErrLobbyHasEnded},
		{name: "ended beats already a player", state: domain.JoinState{EndsAt: past, IsPlayer: true}, want: domain.ErrLobbyHasEnded},
		{name: "ended beats full", state: domain.JoinState{EndsAt: past, MaxPlayers: maxPtr(1), PlayerCount: 1}, want: domain.ErrLobbyHasEnded},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			add, _, err := tc.state.CheckJoin(lobbyNow, domain.Seat{})

			if add != tc.wantAdd || !errors.Is(err, tc.want) {
				t.Fatalf("add %v, error %v; want %v, %v", add, err, tc.wantAdd, tc.want)
			}
		})
	}
}

// The lobby shows the genre of the game it was made with; a custom name has none (ADR 0016).
func TestNewLobbyTakesTheGenreFromTheGame(t *testing.T) {
	shooter := domain.Genre("shooter")
	game := domain.Game{ID: "game-1", Name: "Chess", Genre: &shooter}
	start := time.Date(2026, 11, 7, 18, 0, 0, 0, time.UTC)
	custom := "Go"

	fromGame, err := domain.NewLobby(domain.NewLobbyRequest{GameID: &game.ID, Game: &game, StartsAt: start, EndsAt: start.Add(time.Hour)}, start.Add(-time.Hour))
	if err != nil || fromGame.GameGenre == nil || *fromGame.GameGenre != shooter {
		t.Fatalf("lobby %+v, error %v; want genre shooter", fromGame, err)
	}
	named, err := domain.NewLobby(domain.NewLobbyRequest{CustomGameName: &custom, StartsAt: start, EndsAt: start.Add(time.Hour)}, start.Add(-time.Hour))
	if err != nil || named.GameGenre != nil {
		t.Fatalf("lobby %+v, error %v; want no genre", named, err)
	}
}
