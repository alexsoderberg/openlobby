package domain

import (
	"errors"
	"time"
)

// ErrLobbyInPast means the lobby does not start in the future (ADR 0004 rule 6).
var ErrLobbyInPast = errors.New("lobby in past")

// ErrLobbyEndNotAfterStart means the lobby ends at or before its start (ADR 0004 rule 6).
var ErrLobbyEndNotAfterStart = errors.New("lobby end not after start")

// ErrLobbyTooLong means the lobby is 24 hours or longer (ADR 0004 rule 6).
var ErrLobbyTooLong = errors.New("lobby too long")

// ErrLobbyNotFound means the group has no lobby with the ID (ADR 0004 rule 7).
var ErrLobbyNotFound = errors.New("lobby not found")

// maxLobbyDuration is the exclusive upper bound of a lobby's length. The database check mirrors it (ADR 0006).
const maxLobbyDuration = 24 * time.Hour

// Lobby is a bookable slot in a group (ADR 0006). The game name is a copy, so the lobby is independent of the game list.
type Lobby struct {
	ID              string
	GroupID         string
	CreatedByUserID string
	GameID          *string // nil for a custom game name
	GameName        string
	GameGenre       *Genre // the game's genre now, read from the game list; nil for a custom name or a removed game
	MaxPlayers      *int   // nil means unlimited
	StartsAt        time.Time
	EndsAt          time.Time
	CreatedAt       time.Time
	PlayerCount     int
	JoinedByMe      bool // whether the caller is a player; set by the reader, true for a new lobby
}

// Player is a person in a lobby, with the name shown to the group.
type Player struct {
	UserID      string
	DisplayName string
}

// NewLobbyRequest is what a member asks for. Game is the game found for GameID in the game list, nil when none was found.
type NewLobbyRequest struct {
	GroupID        string
	CreatorID      string
	StartsAt       time.Time
	EndsAt         time.Time
	GameID         *string
	Game           *Game
	CustomGameName *string
	MaxPlayers     *int
}

// NewLobby checks the rules of ADR 0004 rule 6 in the order of the contract: time, game, then max players. The creator
// is the first player, so the new lobby has one.
func NewLobby(request NewLobbyRequest, now time.Time) (Lobby, error) {
	// PostgreSQL keeps microseconds, so the rules must see the value that will be stored, or its checks could refuse
	// what the rules accepted.
	request.StartsAt = request.StartsAt.Truncate(time.Microsecond)
	request.EndsAt = request.EndsAt.Truncate(time.Microsecond)
	if err := checkLobbyTimes(request.StartsAt, request.EndsAt, now); err != nil {
		return Lobby{}, err
	}
	gameID, gameName, err := chooseGame(request)
	if err != nil {
		return Lobby{}, err
	}
	if !validCapacity(request.MaxPlayers) {
		return Lobby{}, ErrInvalidCapacity
	}
	var gameGenre *Genre
	if gameID != nil {
		gameGenre = request.Game.Genre // chooseGame guarantees Game is set when gameID is
	}
	return Lobby{
		GroupID:         request.GroupID,
		CreatedByUserID: request.CreatorID,
		GameID:          gameID,
		GameName:        gameName,
		GameGenre:       gameGenre,
		MaxPlayers:      request.MaxPlayers,
		StartsAt:        request.StartsAt,
		EndsAt:          request.EndsAt,
		CreatedAt:       now,
		PlayerCount:     1,
		JoinedByMe:      true,
	}, nil
}

func checkLobbyTimes(startsAt, endsAt, now time.Time) error {
	switch {
	case !startsAt.After(now):
		return ErrLobbyInPast
	case !endsAt.After(startsAt):
		return ErrLobbyEndNotAfterStart
	case endsAt.Sub(startsAt) >= maxLobbyDuration:
		return ErrLobbyTooLong
	}
	return nil
}

// chooseGame requires exactly one of a game of the list and a custom name, and returns the id and the name to store.
func chooseGame(request NewLobbyRequest) (*string, string, error) {
	switch {
	case (request.GameID == nil) == (request.CustomGameName == nil):
		return nil, "", ErrInvalidGame
	case request.GameID != nil:
		if request.Game == nil {
			return nil, "", ErrInvalidGame
		}
		id := request.Game.ID
		return &id, request.Game.Name, nil
	}
	name, ok := trimName(*request.CustomGameName, maxNameLength)
	if !ok {
		return nil, "", ErrInvalidGame
	}
	return nil, name, nil
}

// ErrLobbyHasEnded means the lobby's end time has passed, so nobody can join it (REQ-0005).
var ErrLobbyHasEnded = errors.New("lobby has ended")

// ErrLobbyFull means all spots of the lobby are taken (REQ-0005).
var ErrLobbyFull = errors.New("lobby full")

// JoinState is what the join rules need to know about a lobby and the caller.
type JoinState struct {
	EndsAt      time.Time
	MaxPlayers  *int // nil means unlimited
	PlayerCount int
	IsPlayer    bool
}

// CheckJoin applies the rules in the order of the contract: an ended lobby refuses even a player, a player who is
// already in changes nothing even when the lobby is full, then a full lobby refuses. It reports whether to add the caller.
func (s JoinState) CheckJoin(now time.Time) (add bool, err error) {
	switch {
	case !s.EndsAt.After(now):
		return false, ErrLobbyHasEnded
	case s.IsPlayer:
		return false, nil
	case s.MaxPlayers != nil && s.PlayerCount >= *s.MaxPlayers:
		return false, ErrLobbyFull
	}
	return true, nil
}
