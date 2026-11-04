package application

import (
	"context"
	"fmt"

	"openlobby/services/calendar/internal/domain"
)

// Groups holds the use cases about groups. Each one is given the verified user ID by the transport layer.
type Groups struct {
	listing GroupsOfUser
	creator GroupCreator
	reader  GroupReader
	names   UserDirectory
	clock   Clock
}

// NewGroups returns the group use cases with their ports.
func NewGroups(listing GroupsOfUser, creator GroupCreator, reader GroupReader, names UserDirectory, clock Clock) *Groups {
	return &Groups{listing: listing, creator: creator, reader: reader, names: names, clock: clock}
}

// ListMine returns the groups where userID is a member. A user in no group gets no groups.
func (g *Groups) ListMine(ctx context.Context, userID string) ([]domain.Group, error) {
	groups, err := g.listing.ListForUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	return groups, nil
}

// Create makes the caller the admin of a new group. The name is checked before any write (REQ-0002).
func (g *Groups) Create(ctx context.Context, creatorID, rawName string) (domain.Group, error) {
	name, err := domain.NewGroupName(rawName)
	if err != nil {
		return domain.Group{}, fmt.Errorf("create group: %w", err)
	}
	group, err := g.creator.Create(ctx, name, creatorID, g.clock.Now())
	if err != nil {
		return domain.Group{}, fmt.Errorf("create group: %w", err)
	}
	return group, nil
}

// Get returns a group with its members and their display names. A non-member gets domain.ErrGroupNotFound before
// auth is asked, so a non-member never causes a lookup (ADR 0004 rule 2, amendment 2026-11-02).
func (g *Groups) Get(ctx context.Context, userID, groupID string) (domain.Group, []domain.Member, error) {
	if _, err := requireMember(ctx, g.reader, groupID, userID); err != nil {
		return domain.Group{}, nil, fmt.Errorf("get group: %w", err)
	}
	group, err := g.reader.Group(ctx, groupID)
	if err != nil {
		return domain.Group{}, nil, fmt.Errorf("get group: %w", err)
	}
	members, err := g.reader.Members(ctx, groupID)
	if err != nil {
		return domain.Group{}, nil, fmt.Errorf("get group members: %w", err)
	}
	if err := g.withDisplayNames(ctx, members); err != nil {
		return domain.Group{}, nil, err
	}
	return group, members, nil
}

// withDisplayNames fills in DisplayName. The directory adapter fails when a name is missing, so every member gets one.
func (g *Groups) withDisplayNames(ctx context.Context, members []domain.Member) error {
	ids := make([]string, len(members))
	for i, member := range members {
		ids[i] = member.UserID
	}
	names, err := g.names.DisplayNames(ctx, ids)
	if err != nil {
		return fmt.Errorf("look up display names: %w", err)
	}
	for i := range members {
		members[i].DisplayName = names[members[i].UserID]
	}
	return nil
}
