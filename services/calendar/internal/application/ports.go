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

// GroupReader reads a group and its members. Reads outside the group lock are allowed (ADR 0006).
type GroupReader interface {
	// Membership returns the user's membership and false when the user is not a member. Not being one is no error.
	Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error)
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
	Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error)
	DeleteInactiveInviteLinks(ctx context.Context, groupID string, now time.Time) error
	InsertInviteLink(ctx context.Context, link domain.InviteLink) (domain.InviteLink, error)
	// LinkByID returns false when the link is not in this group.
	LinkByID(ctx context.Context, groupID, linkID string) (domain.InviteLink, bool, error)
	AddMember(ctx context.Context, groupID, userID string, joinedAt time.Time) error
	IncrementUse(ctx context.Context, groupID, linkID string) error
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

// UserDirectory gives the display names of users. The names are read from auth and never stored (ADR 0003, 0004).
type UserDirectory interface {
	DisplayNames(ctx context.Context, userIDs []string) (map[string]string, error)
}

// Clock gives the current time. Tests inject a fixed time.
type Clock interface {
	Now() time.Time
}
