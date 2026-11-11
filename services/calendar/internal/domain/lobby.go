package domain

import (
	"errors"
	"slices"
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
	GameID          *string // nil for a custom game name or no game
	GameName        *string // nil for a lobby with no game (ADR 0017)
	GameGenre       *Genre  // the game's genre now, read from the game list; nil for no game, a custom name or a removed game
	MaxPlayers      *int    // nil means unlimited
	StartsAt        time.Time
	EndsAt          time.Time
	CreatedAt       time.Time
	PlayerCount     int
	JoinedByMe      bool // whether the caller is a player; set by the reader, true for a new lobby
	// The mode and activity are copies, like GameName (ADR 0017 section 3). All nil for a lobby without them.
	ModeID       *string
	ModeName     *string
	ActivityID   *string
	ActivityName *string
	RoleSlots    []RoleSlot // empty for a lobby without game roles
	FlexCount    int        // players without a game role; 0 for a lobby without game roles
	// CreatorRoleID is the creator's game role when the lobby is new; nil is flex, or a lobby without game roles.
	CreatorRoleID *string
}

// RoleSlot is a lobby's copy of a game role, with the number of players in it (ADR 0017 section 1).
type RoleSlot struct {
	GameRoleID  string
	Name        string
	Slots       int
	PlayerCount int
}

// RoleSlotInput is the slots a creator asks for in one game role of the mode or game.
type RoleSlotInput struct {
	GameRoleID string
	Slots      int
}

// WithRoleSlots returns the lobby with its role slots and the flex count they give: the players that no role holds.
func (l Lobby) WithRoleSlots(slots []RoleSlot) Lobby {
	l.RoleSlots, l.FlexCount = slots, 0
	if len(slots) > 0 {
		l.FlexCount = l.PlayerCount
		for _, slot := range slots {
			l.FlexCount -= slot.PlayerCount
		}
	}
	return l
}

// Player is a person in a lobby, with the name shown to the group. A nil GameRoleID is flex, or a lobby without game roles.
type Player struct {
	UserID      string
	DisplayName string
	GameRoleID  *string
}

// Seat is the choice of a player: one game role, or flex (ADR 0017 section 8). Flex false counts as not given.
type Seat struct {
	GameRoleID *string
	Flex       bool
}

// role checks the seat against the lobby's game roles and returns the game role to store, nil for flex. A lobby with
// game roles needs exactly one of the two; a lobby without needs neither.
func (s Seat) role(roles []RoleSlot) (*string, error) {
	switch {
	case len(roles) == 0 && (s.GameRoleID != nil || s.Flex):
		return nil, ErrInvalidGameRole
	case len(roles) == 0 || s.Flex && s.GameRoleID == nil:
		return nil, nil
	case s.Flex || s.GameRoleID == nil:
		return nil, ErrInvalidGameRole
	}
	for _, role := range roles {
		if role.GameRoleID == *s.GameRoleID {
			return s.GameRoleID, nil
		}
	}
	return nil, ErrInvalidGameRole
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
	ModeID         *string
	ActivityID     *string
	RoleSlots      []RoleSlotInput // nil when omitted: the owner's own slots
	Seat           Seat            // the creator's seat
}

// NewLobby checks the rules of ADR 0004 rule 6 and ADR 0017 section 7 in the order of the contract: time, game, mode,
// activity, roles and max players, then the creator's seat. The creator is the first player, so the new lobby has one.
func NewLobby(request NewLobbyRequest, now time.Time) (Lobby, error) {
	// PostgreSQL keeps microseconds, so the rules must see the value that will be stored, or its checks could refuse
	// what the rules accepted.
	request.StartsAt = request.StartsAt.Truncate(time.Microsecond)
	request.EndsAt = request.EndsAt.Truncate(time.Microsecond)
	if err := checkLobbyTimes(request.StartsAt, request.EndsAt, now); err != nil {
		return Lobby{}, err
	}
	choices, err := chooseAll(request)
	if err != nil {
		return Lobby{}, err
	}
	return choices.lobby(request, now), nil
}

// lobbyChoices are the checked results of the creation rules, in the order they are checked.
type lobbyChoices struct {
	gameID      *string
	gameName    *string
	mode        *GameMode
	activity    *Activity
	slots       []RoleSlot
	maxPlayers  *int
	creatorRole *string
}

// chooseAll applies the rules of ADR 0017 section 7 in order: game, mode, activity, roles and max players, seat.
func chooseAll(request NewLobbyRequest) (c lobbyChoices, err error) {
	if c.gameID, c.gameName, err = chooseGame(request); err != nil {
		return c, err
	}
	if c.mode, c.activity, err = chooseModeAndActivity(request); err != nil {
		return c, err
	}
	if c.slots, c.maxPlayers, err = chooseRoles(request, c.mode); err != nil {
		return c, err
	}
	c.creatorRole, err = seatCreator(request.Seat, c.slots)
	return c, err
}

// lobby builds the new lobby, with the creator as its first player.
func (c lobbyChoices) lobby(request NewLobbyRequest, now time.Time) Lobby {
	lobby := Lobby{
		GroupID:         request.GroupID,
		CreatedByUserID: request.CreatorID,
		GameID:          c.gameID,
		GameName:        c.gameName,
		MaxPlayers:      c.maxPlayers,
		StartsAt:        request.StartsAt,
		EndsAt:          request.EndsAt,
		CreatedAt:       now,
		PlayerCount:     1,
		JoinedByMe:      true,
		CreatorRoleID:   c.creatorRole,
	}
	if c.gameID != nil {
		lobby.GameGenre = request.Game.Genre // chooseGame guarantees Game is set when gameID is
	}
	if c.mode != nil {
		lobby.ModeID, lobby.ModeName = &c.mode.ID, &c.mode.Name
	}
	if c.activity != nil {
		lobby.ActivityID, lobby.ActivityName = &c.activity.ID, &c.activity.Name
	}
	return lobby.WithRoleSlots(c.slots)
}

// seatCreator checks the creator's seat and counts the creator in the chosen role slot.
func seatCreator(seat Seat, slots []RoleSlot) (*string, error) {
	role, err := seat.role(slots)
	for i := range slots {
		if role != nil && slots[i].GameRoleID == *role {
			slots[i].PlayerCount = 1
		}
	}
	return role, err
}

// chooseModeAndActivity checks the mode, then the activity, which belongs to the mode.
func chooseModeAndActivity(request NewLobbyRequest) (*GameMode, *Activity, error) {
	mode, err := chooseMode(request)
	if err != nil {
		return nil, nil, err
	}
	activity, err := chooseActivity(request, mode)
	return mode, activity, err
}

// chooseMode finds the requested mode among the modes of the chosen game. A custom game name has no modes.
func chooseMode(request NewLobbyRequest) (*GameMode, error) {
	if request.ModeID == nil {
		return nil, nil
	}
	if request.Game != nil {
		for i, mode := range request.Game.Modes {
			if mode.ID == *request.ModeID {
				return &request.Game.Modes[i], nil
			}
		}
	}
	return nil, ErrInvalidMode
}

// chooseActivity finds the requested activity among the activities of the chosen mode.
func chooseActivity(request NewLobbyRequest, mode *GameMode) (*Activity, error) {
	if request.ActivityID == nil {
		return nil, nil
	}
	if mode != nil {
		for i, activity := range mode.Activities {
			if activity.ID == *request.ActivityID {
				return &mode.Activities[i], nil
			}
		}
	}
	return nil, ErrInvalidActivity
}

// ownedRoles returns the roles of the owner: the mode, else a game without modes, else nobody (ADR 0017 section 7).
func ownedRoles(request NewLobbyRequest, mode *GameMode) []GameRole {
	switch {
	case mode != nil:
		return mode.GameRoles
	case request.Game != nil && len(request.Game.Modes) == 0:
		return request.Game.GameRoles
	}
	return nil
}

// chooseRoles returns the lobby's role slots and its max players. With roles the sum of the slots is the max players.
func chooseRoles(request NewLobbyRequest, mode *GameMode) ([]RoleSlot, *int, error) {
	owned := ownedRoles(request, mode)
	if len(owned) == 0 {
		if request.RoleSlots != nil {
			return nil, nil, ErrInvalidGameRole
		}
		// A mode is never unlimited; an open lobby or a game without modes may be.
		if !validCapacity(request.MaxPlayers) || (mode != nil && request.MaxPlayers == nil) {
			return nil, nil, ErrInvalidCapacity
		}
		return nil, request.MaxPlayers, nil
	}
	asked, err := askedRoles(owned, request.RoleSlots)
	if err != nil {
		return nil, nil, err
	}
	sum, err := slotSum(asked)
	if err != nil {
		return nil, nil, err
	}
	if request.MaxPlayers != nil {
		return nil, nil, ErrInvalidCapacity // the sum is used
	}
	return storedSlots(asked), &sum, nil
}

// storedSlots keeps the roles with slots; a role with 0 is not stored.
func storedSlots(roles []GameRole) []RoleSlot {
	var slots []RoleSlot
	for _, role := range roles {
		if role.Slots > 0 {
			slots = append(slots, RoleSlot{GameRoleID: role.ID, Name: role.Name, Slots: role.Slots})
		}
	}
	return slots
}

// askedRoles applies the requested slots to the owner's roles. Omitted means the owner's own slots, and a role that is
// not listed counts 0.
func askedRoles(owned []GameRole, asked []RoleSlotInput) ([]GameRole, error) {
	if asked == nil {
		return owned, nil
	}
	roles := make([]GameRole, len(owned))
	for i, role := range owned {
		roles[i] = GameRole{ID: role.ID, Name: role.Name}
	}
	seen := map[string]bool{}
	for _, input := range asked {
		i := slices.IndexFunc(roles, func(role GameRole) bool { return role.ID == input.GameRoleID })
		if i < 0 || seen[input.GameRoleID] {
			return nil, ErrInvalidGameRole
		}
		if input.Slots < 0 || input.Slots > maxPlayersLimit {
			return nil, ErrInvalidCapacity
		}
		seen[input.GameRoleID] = true
		roles[i].Slots = input.Slots
	}
	return roles, nil
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

// chooseGame allows at most one of a game of the list and a custom name, and returns the id and the name to store.
// Neither is an open lobby with no game (ADR 0017 section 7).
func chooseGame(request NewLobbyRequest) (*string, *string, error) {
	switch {
	case request.GameID != nil && request.CustomGameName != nil:
		return nil, nil, ErrInvalidGame
	case request.GameID != nil:
		if request.Game == nil {
			return nil, nil, ErrInvalidGame
		}
		id, name := request.Game.ID, request.Game.Name
		return &id, &name, nil
	case request.CustomGameName == nil:
		return nil, nil, nil
	}
	name, ok := trimName(*request.CustomGameName, maxNameLength)
	if !ok {
		return nil, nil, ErrInvalidGame
	}
	return nil, &name, nil
}

// ErrLobbyHasEnded means the lobby's end time has passed, so nobody can join it (REQ-0005).
var ErrLobbyHasEnded = errors.New("lobby has ended")

// ErrLobbyFull means all spots of the lobby are taken (REQ-0005).
var ErrLobbyFull = errors.New("lobby full")

// ErrGameRoleFull means the chosen game role has no free slot (ADR 0017 section 9).
var ErrGameRoleFull = errors.New("game role full")

// JoinState is what the join rules need to know about a lobby and the caller. Roles hold the lobby's game roles with
// their player counts; CurrentRole is the caller's game role when the caller is a player, nil for flex.
type JoinState struct {
	EndsAt      time.Time
	MaxPlayers  *int // nil means unlimited
	PlayerCount int
	IsPlayer    bool
	Roles       []RoleSlot
	CurrentRole *string
}

// CheckJoin applies the rules in the order of ADR 0017 section 9: an ended lobby refuses even a player, a seat that does
// not fit the lobby is refused, a player who keeps the seat changes nothing even when the lobby is full, a new player
// needs a free spot and then a free slot, and a player who moves needs a free slot. It reports whether to save the
// caller, and in which game role (nil is flex or a lobby without game roles).
func (s JoinState) CheckJoin(now time.Time, seat Seat) (save bool, role *string, err error) {
	if !s.EndsAt.After(now) {
		return false, nil, ErrLobbyHasEnded
	}
	role, err = seat.role(s.Roles)
	switch {
	case err != nil:
		return false, nil, err
	case s.IsPlayer && sameID(role, s.CurrentRole):
		return false, nil, nil
	case !s.IsPlayer && s.MaxPlayers != nil && s.PlayerCount >= *s.MaxPlayers:
		return false, nil, ErrLobbyFull
	case role != nil && s.roleIsFull(*role):
		return false, nil, ErrGameRoleFull
	}
	return true, role, nil
}

// roleIsFull counts the players already in the role. A player who moves is not in the target role, so the caller is
// never counted against the slot they ask for.
func (s JoinState) roleIsFull(roleID string) bool {
	for _, role := range s.Roles {
		if role.GameRoleID == roleID {
			return role.PlayerCount >= role.Slots
		}
	}
	return false
}

func sameID(a, b *string) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}
