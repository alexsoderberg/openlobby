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
		wantName string
		wantID   *string
		want     error
	}{
		{name: "game of the list", change: func(*domain.NewLobbyRequest) {}, wantName: "Chess", wantID: strPtr("game-1")},
		{name: "custom name is trimmed", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr("  Go  ")
		}, wantName: "Go"},
		{name: "custom name of 50 code points", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr(strings.Repeat("å", 50))
		}, wantName: strings.Repeat("å", 50)},
		{name: "custom name Other is allowed", change: func(r *domain.NewLobbyRequest) {
			r.GameID, r.Game, r.CustomGameName = nil, nil, strPtr("Other")
		}, wantName: "Other"},
		{name: "no game", change: func(r *domain.NewLobbyRequest) { r.GameID, r.Game = nil, nil }, want: domain.ErrInvalidGame},
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
			if lobby.GameName != tc.wantName {
				t.Fatalf("game name %q, want %q", lobby.GameName, tc.wantName)
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
	request.GameID, request.Game = nil, nil
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
