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
	// IsMember reports whether the user is a member of the group.
	IsMember(ctx context.Context, groupID, userID string) (bool, error)
	// Group returns domain.ErrGroupNotFound when the group does not exist.
	Group(ctx context.Context, groupID string) (domain.Group, error)
	Members(ctx context.Context, groupID string) ([]domain.Member, error)
}

// UserDirectory gives the display names of users. The names are read from auth and never stored (ADR 0003, 0004).
type UserDirectory interface {
	DisplayNames(ctx context.Context, userIDs []string) (map[string]string, error)
}

// Clock gives the current time. Tests inject a fixed time.
type Clock interface {
	Now() time.Time
}
