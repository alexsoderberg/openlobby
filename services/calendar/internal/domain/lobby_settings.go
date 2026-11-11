package domain

import (
	"errors"
	"time"
)

// ErrLobbyChanged means the caller's view of the lobby's mode is old: another change was saved first (ADR 0017 section 11).
var ErrLobbyChanged = errors.New("lobby changed")

// ErrLobbyHasMorePlayers means the new mode's limit is below the number of players (ADR 0017 section 10).
var ErrLobbyHasMorePlayers = errors.New("lobby has more players")

// ErrLobbyGameSet means the lobby has a game or a custom name already; a game once set never changes (REQ-0015).
var ErrLobbyGameSet = errors.New("lobby game set")

// ErrStoredModeInvalid means a stored mode has no usable limit. The request cannot fix it, so it is not a 400: the
// transport leaves it to the 500 handling on purpose.
var ErrStoredModeInvalid = errors.New("stored mode has no valid limit")

// LobbyFacts is what the settings rules need to know about a lobby and the caller. It is read under the group lock.
type LobbyFacts struct {
	EndsAt      time.Time
	GameID      *string // nil for a lobby with no game, or a custom name
	HasGame     bool    // a game or a custom name is set
	ModeID      *string
	PlayerCount int
	IsPlayer    bool
}

// CheckChange applies the checks that every settings change shares, in order: an ended lobby refuses, and only a player
// may change it (ADR 0017 section 10).
func (f LobbyFacts) CheckChange(now time.Time) error {
	switch {
	case !f.EndsAt.After(now):
		return ErrLobbyHasEnded
	case !f.IsPlayer:
		return ErrNotAllowed
	}
	return nil
}

// ModeChange is what a mode change writes: the mode, its limit and the lobby's new role slots. The activity is cleared,
// and the database sets every player to flex when the old slots are removed (ADR 0017 section 17).
type ModeChange struct {
	Mode       GameMode
	MaxPlayers int
	Slots      []RoleSlot
}

// CheckModeChange applies the rules of ADR 0017 section 10 after CheckChange: the mode must be a mode of the lobby's game
// (mode is nil when it is not), then the caller's view of the mode must be current, and the new limit must hold the
// players. It reports whether to save; the mode that is already the lobby's changes nothing.
func (f LobbyFacts) CheckModeChange(now time.Time, currentModeID *string, mode *GameMode) (change ModeChange, save bool, err error) {
	if err := f.CheckChange(now); err != nil {
		return ModeChange{}, false, err
	}
	if mode == nil {
		return ModeChange{}, false, ErrInvalidMode
	}
	if !sameID(currentModeID, f.ModeID) {
		return ModeChange{}, false, ErrLobbyChanged
	}
	if sameID(f.ModeID, &mode.ID) {
		return ModeChange{}, false, nil
	}
	limit, err := modeLimit(*mode)
	switch {
	case err != nil:
		return ModeChange{}, false, err
	case f.PlayerCount > limit:
		return ModeChange{}, false, ErrLobbyHasMorePlayers
	}
	return ModeChange{Mode: *mode, MaxPlayers: limit, Slots: storedSlots(mode.GameRoles)}, true, nil
}

// modeLimit is the sum of the mode's role slots, or its max players when it has no roles. A mode without a valid limit
// is corrupt data (a mode is never unlimited, ADR 0017 section 6), so the error is ErrStoredModeInvalid.
func modeLimit(mode GameMode) (int, error) {
	if len(mode.GameRoles) > 0 {
		sum, err := slotSum(mode.GameRoles)
		if err != nil {
			return 0, ErrStoredModeInvalid
		}
		return sum, nil
	}
	if mode.MaxPlayers == nil || !validCapacity(mode.MaxPlayers) {
		return 0, ErrStoredModeInvalid
	}
	return *mode.MaxPlayers, nil
}

// CheckActivityChange applies the rules of ADR 0017 section 10 after CheckChange. The activity is nil when it is not an
// activity of the lobby's mode, which is also the case for a lobby with no mode.
func (f LobbyFacts) CheckActivityChange(now time.Time, activity *Activity) error {
	if err := f.CheckChange(now); err != nil {
		return err
	}
	if activity == nil {
		return ErrInvalidActivity
	}
	return nil
}

// CheckGameChange applies the rules of ADR 0017 section 10 after CheckChange. The game is nil when it is not in the game
// list; only a lobby with no game, not even a custom name, may get one.
func (f LobbyFacts) CheckGameChange(now time.Time, game *Game) error {
	if err := f.CheckChange(now); err != nil {
		return err
	}
	switch {
	case game == nil:
		return ErrInvalidGame
	case f.HasGame:
		return ErrLobbyGameSet
	}
	return nil
}
