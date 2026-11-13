// Package domain holds the entities and rules of the calendar service. It imports nothing outside the standard library.
package domain

import (
	"errors"
	"math"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

// ErrUnavailable means that a dependency (the database or auth) did not answer. The request was refused (ADR 0001).
var ErrUnavailable = errors.New("dependency unavailable")

// ErrGroupNotFound means the group does not exist or the caller is not a member. Both give the same answer (ADR 0004 rule 2).
var ErrGroupNotFound = errors.New("group not found")

// ErrInvalidGroupName means the name is empty after trim or longer than maxNameLength (REQ-0002).
var ErrInvalidGroupName = errors.New("invalid group name")

// ErrInvalidGame means the game name is empty after trim, longer than maxNameLength, or the reserved "Other" (ADR 0010).
var ErrInvalidGame = errors.New("invalid game")

// ErrInvalidCapacity means the default max players is neither omitted nor an integer from 1 to 2147483647 (ADR 0010).
var ErrInvalidCapacity = errors.New("invalid capacity")

// ErrInvalidGenre means the genre is not in the fixed list (REQ-0014, ADR 0016).
var ErrInvalidGenre = errors.New("invalid genre")

// ErrInvalidMode means a mode name is empty after trim or longer than maxNameLength (ADR 0017).
var ErrInvalidMode = errors.New("invalid mode")

// ErrInvalidActivity means an activity name is empty after trim or longer than maxNameLength (ADR 0017).
var ErrInvalidActivity = errors.New("invalid activity")

// ErrInvalidGameRole means a game role name is empty after trim or longer than maxGameRoleNameLength (ADR 0017).
var ErrInvalidGameRole = errors.New("invalid game role")

// ErrInvalidID means an ID in a game list write is repeated or is not a current ID of the same owner (ADR 0017 section 6).
var ErrInvalidID = errors.New("invalid id")

// ErrInvalidMaxUses means the requested max uses is outside 1 to InviteLinkMaxUsesLimit (ADR 0007).
var ErrInvalidMaxUses = errors.New("invalid max uses")

// ErrInviteInvalid means the link cannot be used: unknown, revoked, expired, used up, or its group is gone. Every case
// gives this one error, so the answer does not show which one it was (ADR 0007).
var ErrInviteInvalid = errors.New("invite invalid")

// ErrNotAllowed means the caller is a member but may not do this, e.g. revoke another member's link (ADR 0007).
var ErrNotAllowed = errors.New("not allowed")

// ErrMemberNotFound means the user is not a member of the group (REQ-0008).
var ErrMemberNotFound = errors.New("member not found")

// ErrOwnUpcomingLobbiesExist means the caller created lobbies that have not ended, so they cannot leave the group (ADR 0004 rule 5).
var ErrOwnUpcomingLobbiesExist = errors.New("own upcoming lobbies exist")

// InviteLinkLifetime is how long an invite link is valid after it is created (ADR 0007).
const InviteLinkLifetime = 10 * time.Minute

// InviteLinkMaxUsesLimit is the highest allowed max uses. The check in migration 0002 mirrors it (ADR 0007).
const InviteLinkMaxUsesLimit = 10

// InviteLinkDefaultMaxUses applies when the creator does not choose a value (ADR 0007).
const InviteLinkDefaultMaxUses = 1

// maxNameLength is the limit of a group name and a game name, counted in Unicode code points, the same as the database
// checks (ADR 0004 rule 1, ADR 0010).
const maxNameLength = 50

// maxPlayersLimit is the largest max players: the maximum of the PostgreSQL integer column (ADR 0010 Amendment 2026-11-04).
const maxPlayersLimit = math.MaxInt32

// reservedGameName is the client's free-text choice, which is not a game of the list (ADR 0010).
const reservedGameName = "Other"

// Role is a member's role in a group (ADR 0004 rule 4).
type Role string

// The two roles of a membership.
const (
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
)

// Group is a group of the calendar (ADR 0006). The caller sees it only as a member.
type Group struct {
	ID   string
	Name string
}

// Genre is the genre of a game from a fixed list (REQ-0014, ADR 0016). A nil *Genre means no genre.
type Genre string

// Genres returns the allowed genres. The list is kept equal to the contract's Genre enum and the database check by tests.
func Genres() []Genre {
	return []Genre{"shooter", "moba", "racing", "strategy", "survival", "party", "rpg", "sports"}
}

// IsGenre reports whether the value is one of Genres, exactly as written (lowercase).
func IsGenre(value string) bool {
	return slices.Contains(Genres(), Genre(value))
}

// Game is an entry of the game list (ADR 0010). Lobbies refer to it by ID, so a rename keeps its identity. A nil
// DefaultMaxPlayers means unlimited and a nil Genre means no genre. In a write, a nil GameRoles or Modes means "leave the
// stored entries unchanged" and an empty one means "remove them" (ADR 0017 section 6).
type Game struct {
	ID                string
	Name              string
	DefaultMaxPlayers *int
	Genre             *Genre
	GameRoles         []GameRole
	Modes             []GameMode
}

// Actor is the verified caller of a request (ADR 0011). Only the transport layer builds it, from the gateway's headers.
type Actor struct {
	UserID        string
	IsSystemAdmin bool
}

// Member is a user's membership in a group. DisplayName is not stored; the application fills it from auth.
type Member struct {
	UserID      string
	DisplayName string
	Role        Role
	// PreferredGameRoles are the member's effective preferred game roles, read with the members (ADR 0022 point 6).
	PreferredGameRoles []PreferredGameRole
}

// PreferredGameRole is a game role that a person usually plays, with the names shown next to the person (ADR 0022).
// ModeName is nil for a game role of a game with no modes.
type PreferredGameRole struct {
	GameRoleID string
	Name       string
	GameName   string
	ModeName   *string
}

// NewGroupName trims the name and checks its length. It returns the trimmed name.
func NewGroupName(raw string) (string, error) {
	name, ok := trimName(raw, maxNameLength)
	if !ok {
		return "", ErrInvalidGroupName
	}
	return name, nil
}

// trimName trims a name and reports whether it is 1 to maxLength code points.
func trimName(raw string, maxLength int) (string, bool) {
	name := strings.TrimSpace(raw)
	length := utf8.RuneCountInString(name)
	return name, length >= 1 && length <= maxLength
}

// validCapacity reports whether max players is omitted or from 1 to maxPlayersLimit.
func validCapacity(maxPlayers *int) bool {
	return maxPlayers == nil || (*maxPlayers >= 1 && *maxPlayers <= maxPlayersLimit)
}

// NewGame trims and checks a game's name, default max players, genre, game roles and modes (ADR 0010, 0016, 0017). The ID
// is kept as given; it is empty for a new game until the database generates it. The default max is finished later by
// EffectiveDefaultMax, because it depends on the roles and modes the game will have.
func NewGame(id, rawName string, defaultMaxPlayers *int, genre *Genre, gameRoles []GameRole, modes []GameMode) (Game, error) {
	name, ok := trimName(rawName, maxNameLength)
	if !ok || strings.EqualFold(name, reservedGameName) {
		return Game{}, ErrInvalidGame
	}
	if !validCapacity(defaultMaxPlayers) {
		return Game{}, ErrInvalidCapacity
	}
	if genre != nil && !IsGenre(string(*genre)) {
		return Game{}, ErrInvalidGenre
	}
	roles, _, err := newGameRoles(gameRoles)
	if err != nil {
		return Game{}, err
	}
	checkedModes, err := newModes(modes)
	if err != nil {
		return Game{}, err
	}
	return Game{ID: id, Name: name, DefaultMaxPlayers: defaultMaxPlayers, Genre: genre, GameRoles: roles, Modes: checkedModes}, nil
}

// InviteLinkMaxUses is how many joins an invite link allows, always from 1 to InviteLinkMaxUsesLimit.
type InviteLinkMaxUses int

// NewInviteLinkMaxUses returns the default when no value is requested, and checks the range otherwise (ADR 0007).
func NewInviteLinkMaxUses(requested *int) (InviteLinkMaxUses, error) {
	if requested == nil {
		return InviteLinkDefaultMaxUses, nil
	}
	if *requested < 1 || *requested > InviteLinkMaxUsesLimit {
		return 0, ErrInvalidMaxUses
	}
	return InviteLinkMaxUses(*requested), nil
}

// InviteLink is a link that lets a non-member join a group (ADR 0007). The token is a secret.
type InviteLink struct {
	ID              string
	GroupID         string
	Token           string
	CreatedByUserID string
	CreatedAt       time.Time
	ExpiresAt       time.Time
	UseCount        int
	MaxUses         InviteLinkMaxUses
}

// IsActive reports whether the link can still be used at now: before expiry and with uses left (ADR 0007).
func (link InviteLink) IsActive(now time.Time) bool {
	return now.Before(link.ExpiresAt) && link.UseCount < int(link.MaxUses)
}
