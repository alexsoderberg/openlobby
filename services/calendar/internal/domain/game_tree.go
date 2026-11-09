package domain

// maxGameRoleNameLength is the limit of a game role name in code points; the database check mirrors it (ADR 0017).
const maxGameRoleNameLength = 30

// GameRole is a named role of a game or of a mode, with slots (REQ-0011). ID is empty for a new role in a write.
type GameRole struct {
	ID    string
	Name  string
	Slots int
}

// Activity is a named activity of a mode (REQ-0015). ID is empty for a new activity in a write.
type Activity struct {
	ID   string
	Name string
}

// GameMode is a kind of play in a game. In a write, MaxPlayers is nil for a mode with game roles and required for a mode
// without; when read it always holds the stored value (the sum of the slots, or the given maximum).
type GameMode struct {
	ID         string
	Name       string
	MaxPlayers *int
	GameRoles  []GameRole
	Activities []Activity
}

// slotSum returns the sum of the slots of one owner. The sum must be within the capacity (ADR 0017 section 6). It is the
// one sum and, with validCapacity, the one capacity check for games and modes (ADR 0017 section 17).
func slotSum(roles []GameRole) (int, error) {
	sum := 0
	for _, role := range roles {
		sum += role.Slots
	}
	if len(roles) > 0 && !validCapacity(&sum) {
		return 0, ErrInvalidCapacity
	}
	return sum, nil
}

// newGameRoles trims and checks the roles of one owner and returns them with their slot sum. A nil list stays nil.
func newGameRoles(raw []GameRole) ([]GameRole, int, error) {
	if raw == nil {
		return nil, 0, nil
	}
	roles := make([]GameRole, 0, len(raw))
	for _, role := range raw {
		name, ok := trimName(role.Name, maxGameRoleNameLength)
		if !ok {
			return nil, 0, ErrInvalidGameRole
		}
		if !validCapacity(&role.Slots) {
			return nil, 0, ErrInvalidCapacity
		}
		roles = append(roles, GameRole{ID: role.ID, Name: name, Slots: role.Slots})
	}
	sum, err := slotSum(roles)
	return roles, sum, err
}

func newActivities(raw []Activity) ([]Activity, error) {
	activities := make([]Activity, 0, len(raw))
	for _, activity := range raw {
		name, ok := trimName(activity.Name, maxNameLength)
		if !ok {
			return nil, ErrInvalidActivity
		}
		activities = append(activities, Activity{ID: activity.ID, Name: name})
	}
	return activities, nil
}

func newModes(raw []GameMode) ([]GameMode, error) {
	if raw == nil {
		return nil, nil
	}
	modes := make([]GameMode, 0, len(raw))
	for _, mode := range raw {
		checked, err := newMode(mode)
		if err != nil {
			return nil, err
		}
		modes = append(modes, checked)
	}
	return modes, nil
}

// newMode checks one mode in the order of ADR 0017 section 6: max players against the roles, the roles, the activities,
// then the name.
func newMode(raw GameMode) (GameMode, error) {
	hasRoles := len(raw.GameRoles) > 0
	if hasRoles && raw.MaxPlayers != nil {
		return GameMode{}, ErrInvalidCapacity // the sum is used
	}
	if !hasRoles && (raw.MaxPlayers == nil || !validCapacity(raw.MaxPlayers)) {
		return GameMode{}, ErrInvalidCapacity // a mode is never unlimited
	}
	roles, sum, err := newGameRoles(raw.GameRoles)
	if err != nil {
		return GameMode{}, err
	}
	activities, err := newActivities(raw.Activities)
	if err != nil {
		return GameMode{}, err
	}
	name, ok := trimName(raw.Name, maxNameLength)
	if !ok {
		return GameMode{}, ErrInvalidMode
	}
	maxPlayers := raw.MaxPlayers
	if hasRoles {
		maxPlayers = &sum
	}
	return GameMode{ID: raw.ID, Name: name, MaxPlayers: maxPlayers, GameRoles: roles, Activities: activities}, nil
}

// EffectiveDefaultMax returns the default max the game will store (ADR 0017 section 6). A game without modes and with game
// roles stores the sum of its slots, and a given value must be nil or equal to it. Roles and modes that the write omits
// are those of current, the stored game (the zero Game for a new one).
func (g Game) EffectiveDefaultMax(current Game) (*int, error) {
	roles, modes := g.GameRoles, g.Modes
	if roles == nil {
		roles = current.GameRoles
	}
	if modes == nil {
		modes = current.Modes
	}
	if len(modes) > 0 || len(roles) == 0 {
		return g.DefaultMaxPlayers, nil
	}
	sum, err := slotSum(roles)
	if err != nil {
		return nil, err
	}
	if g.DefaultMaxPlayers != nil && *g.DefaultMaxPlayers != sum {
		return nil, ErrInvalidCapacity
	}
	return &sum, nil
}

// CheckIDs reports ErrInvalidID when an ID of the write is repeated or is not a current ID of the same owner: a mode of
// this game, a role of the game or of the same mode, an activity of the same mode (ADR 0017 section 6). Omitted lists
// are not checked, and an entry without an ID is new.
func (g Game) CheckIDs(current Game) error {
	seen := map[string]bool{}
	claim := func(id string, owned map[string]bool) bool {
		if id == "" {
			return true
		}
		if !owned[id] || seen[id] {
			return false
		}
		seen[id] = true
		return true
	}
	if !claimAll(g.GameRoles, current.GameRoles, func(r GameRole) string { return r.ID }, claim) || !claimAll(g.Modes, current.Modes, modeID, claim) {
		return ErrInvalidID
	}
	for _, mode := range g.Modes {
		var stored GameMode
		for _, candidate := range current.Modes {
			if mode.ID != "" && candidate.ID == mode.ID {
				stored = candidate
			}
		}
		if !claimAll(mode.GameRoles, stored.GameRoles, func(r GameRole) string { return r.ID }, claim) ||
			!claimAll(mode.Activities, stored.Activities, func(a Activity) string { return a.ID }, claim) {
			return ErrInvalidID
		}
	}
	return nil
}

func modeID(mode GameMode) string { return mode.ID }

// claimAll reports whether every entry of given is new or claims a distinct ID that is in current.
func claimAll[T any](given, current []T, id func(T) string, claim func(string, map[string]bool) bool) bool {
	owned := make(map[string]bool, len(current))
	for _, entry := range current {
		owned[id(entry)] = true
	}
	for _, entry := range given {
		if !claim(id(entry), owned) {
			return false
		}
	}
	return true
}
