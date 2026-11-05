// Package application holds the use cases of the calendar service and the ports they need (ADR 0004).
package application

import (
	"context"
	"time"

	"openlobby/services/calendar/internal/domain"
)

// GroupsOfUser lists the groups where a user is a member (ADR 0006).
type GroupsOfUser interface {
	ListForUser(ctx context.Context, userID string) ([]domain.Group, error)
}

// GroupCreator stores a new group and the creator's admin membership in one transaction. The row is new, so no lock
// is needed (ADR 0004, amendment 2026-11-02).
type GroupCreator interface {
	Create(ctx context.Context, name, creatorID string, joinedAt time.Time) (domain.Group, error)
}

// MembershipReader reads one user's membership of a group.
type MembershipReader interface {
	// Membership returns the user's membership and false when the user is not a member. Not being one is no error.
	Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error)
}

// requireMember returns the caller's membership, or domain.ErrGroupNotFound for a non-member: the same answer as for
// an unknown group (ADR 0004 rule 2). It is the one place for that rule.
func requireMember(ctx context.Context, reader MembershipReader, groupID, userID string) (domain.Member, error) {
	member, isMember, err := reader.Membership(ctx, groupID, userID)
	if err != nil {
		return domain.Member{}, err
	}
	if !isMember {
		return domain.Member{}, domain.ErrGroupNotFound
	}
	return member, nil
}

// GroupReader reads a group and its members. Reads outside the group lock are allowed (ADR 0006).
type GroupReader interface {
	MembershipReader
	// Group returns domain.ErrGroupNotFound when the group does not exist.
	Group(ctx context.Context, groupID string) (domain.Group, error)
	Members(ctx context.Context, groupID string) ([]domain.Member, error)
}

// GroupLocker runs a write that touches a group under the group's row lock (ADR 0006). The lock is taken first and
// held until fn returns. It returns domain.ErrGroupNotFound when the group does not exist.
type GroupLocker interface {
	WithLockedGroup(ctx context.Context, groupID string, fn func(tx GroupTx) error) error
}

// GroupTx holds the operations that run under the group lock. Each one is scoped to the group (ADR 0006 rule 12).
type GroupTx interface {
	MembershipReader
	DeleteInactiveInviteLinks(ctx context.Context, groupID string, now time.Time) error
	InsertInviteLink(ctx context.Context, link domain.InviteLink) (domain.InviteLink, error)
	// LinkByID returns false when the link is not in this group.
	LinkByID(ctx context.Context, groupID, linkID string) (domain.InviteLink, bool, error)
	AddMember(ctx context.Context, groupID, userID string, joinedAt time.Time) error
	IncrementUse(ctx context.Context, groupID, linkID string) error
	DeleteInviteLink(ctx context.Context, groupID, linkID string) error
}

// LinkLookup is an invite link with its group, as found by its token.
type LinkLookup struct {
	Link  domain.InviteLink
	Group domain.Group
}

// InviteLinkReader reads invite links without a lock. A rule that decides a write is read again under the lock (ADR 0006).
type InviteLinkReader interface {
	AllLinks(ctx context.Context, groupID string) ([]domain.InviteLink, error)
	LinksCreatedBy(ctx context.Context, groupID, userID string) ([]domain.InviteLink, error)
	// FindLinkByToken returns false when no link has the token, or its group is gone.
	FindLinkByToken(ctx context.Context, token string) (LinkLookup, bool, error)
}

// TokenGenerator returns a new random invite token (ADR 0007). The token is a secret.
type TokenGenerator interface {
	NewToken() (string, error)
}

// GameUsage is a game of the list with the number of lobbies the group created with it (ADR 0010). The order of the
// game choice is decided in application, not by the adapter.
type GameUsage struct {
	Game       domain.Game
	LobbyCount int
}

// GameCatalog reads the game list with the lobby counts of one group (ADR 0010).
type GameCatalog interface {
	// List returns every game, sorted by name ignoring case, then ID (ADR 0010).
	List(ctx context.Context) ([]domain.Game, error)
	ListForGroup(ctx context.Context, groupID string) ([]GameUsage, error)
	// Find returns ErrGameNotFound when no game has the ID, also when the ID is not a uuid.
	Find(ctx context.Context, id string) (domain.Game, error)
}

// GameCatalogEditor changes the game list. Only the system admin use cases call it (ADR 0010). Each method returns
// ErrGameNotFound or ErrGameTaken for the rules it cannot check without the database.
type GameCatalogEditor interface {
	// Create stores the game with a generated ID and returns it.
	Create(ctx context.Context, game domain.Game) (domain.Game, error)
	Replace(ctx context.Context, game domain.Game) error
	Delete(ctx context.Context, id string) error
}

// UserDirectory gives the display names of users. The names are read from auth and never stored (ADR 0003, 0004).
type UserDirectory interface {
	DisplayNames(ctx context.Context, userIDs []string) (map[string]string, error)
}

// Clock gives the current time. Tests inject a fixed time.
type Clock interface {
	Now() time.Time
}

// LobbyRepository runs lobby writes under the group's row lock (ADR 0006). The lock is taken first and held until fn
// returns. It returns domain.ErrGroupNotFound when the group does not exist.
type LobbyRepository interface {
	WithLockedGroup(ctx context.Context, groupID string, fn func(tx LobbyTx) error) error
}

// LobbyReader reads lobbies without the group lock. "Upcoming" means ends_at > now (ADR 0004 rule 8).
type LobbyReader interface {
	MembershipReader
	// Upcoming returns the group's upcoming lobbies with their player counts and whether the caller is a player,
	// sorted by start time, then ID.
	Upcoming(ctx context.Context, groupID, callerID string, now time.Time) ([]domain.Lobby, error)
	// Lobby returns the upcoming lobby of this group, or domain.ErrLobbyNotFound.
	Lobby(ctx context.Context, groupID, lobbyID, callerID string, now time.Time) (domain.Lobby, error)
	// PlayerIDs returns the user IDs of the lobby's players, sorted by join time, then user ID.
	PlayerIDs(ctx context.Context, lobbyID string) ([]string, error)
}

// LobbyTx holds the operations that run under the group lock. Each one is scoped to the group (ADR 0006 rule 12).
type LobbyTx interface {
	MembershipReader
	// InsertLobby stores the lobby and its creator as the first player, and returns the lobby with its ID.
	InsertLobby(ctx context.Context, lobby domain.Lobby) (domain.Lobby, error)
	// CreatorOf returns the lobby creator's user ID, and false when the lobby is not in this group.
	CreatorOf(ctx context.Context, groupID, lobbyID string) (string, bool, error)
	// JoinState returns the lobby's end, capacity, player count and whether the user is a player, and false when the
	// lobby is not in this group.
	JoinState(ctx context.Context, groupID, lobbyID, userID string) (domain.JoinState, bool, error)
	// AddPlayer adds the user to the lobby.
	AddPlayer(ctx context.Context, lobbyID, userID string, joinedAt time.Time) error
	// RemovePlayer removes the user from the lobby. A user who is not a player is no error.
	RemovePlayer(ctx context.Context, lobbyID, userID string) error
	// DeleteLobby removes the lobby of this group with its players.
	DeleteLobby(ctx context.Context, groupID, lobbyID string) error
}

// MembershipLocker runs a membership change under the group's row lock (ADR 0006). It returns domain.ErrGroupNotFound
// when the group does not exist.
type MembershipLocker interface {
	WithLockedGroup(ctx context.Context, groupID string, fn func(tx MembershipTx) error) error
}

// MembershipTx holds the operations of changing a group's membership: leaving and promoting. Each one is scoped to
// the group (ADR 0006 rule 12).
type MembershipTx interface {
	MembershipReader
	// Members returns the members sorted by join time, then user ID.
	Members(ctx context.Context, groupID string) ([]domain.Member, error)
	// HasUpcomingLobbyBy tells whether the user created a lobby of the group that ends after now.
	HasUpcomingLobbyBy(ctx context.Context, groupID, userID string, now time.Time) (bool, error)
	// RemoveLeaverData removes the user's membership, their player rows on the group's upcoming lobbies, and the
	// invite links they created in the group. Ended lobbies keep their players.
	RemoveLeaverData(ctx context.Context, groupID, userID string, now time.Time) error
	// MakeAdmin sets the member's role to admin. It is idempotent.
	MakeAdmin(ctx context.Context, groupID, userID string) error
	// DeleteGroup removes the group with its members, lobbies, players and invite links.
	DeleteGroup(ctx context.Context, groupID string) error
}
