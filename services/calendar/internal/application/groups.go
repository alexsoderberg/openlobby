package application

import (
	"context"
	"fmt"

	"openlobby/services/calendar/internal/domain"
)

// Groups holds the use cases about groups. Each one is given the verified user ID by the transport layer.
type Groups struct {
	repo GroupRepository
}

// NewGroups returns the group use cases with their repository.
func NewGroups(repo GroupRepository) *Groups {
	return &Groups{repo: repo}
}

// ListMine returns the groups where userID is a member. A user in no group gets no groups.
func (g *Groups) ListMine(ctx context.Context, userID string) ([]domain.Group, error) {
	groups, err := g.repo.ListForUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	return groups, nil
}
