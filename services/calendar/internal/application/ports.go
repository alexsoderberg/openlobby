// Package application holds the use cases of the calendar service and the ports they need (ADR 0004).
package application

import (
	"context"

	"openlobby/services/calendar/internal/domain"
)

// GroupRepository reads the groups in which a user is a member (ADR 0006).
type GroupRepository interface {
	ListForUser(ctx context.Context, userID string) ([]domain.Group, error)
}
