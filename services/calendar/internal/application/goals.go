package application

import (
	"context"
	"fmt"

	"openlobby/services/calendar/internal/domain"
)

// GoalRepository stores the goals of each person: item IDs and our own links only (ADR 0029 C1).
type GoalRepository interface {
	// GameGoals returns the games with a goal of the user or a drop-list item, sorted as the game list. Each has the
	// user's goals ordered by item ID, with item IDs only and the activities of the game whose drop list has the item.
	GameGoals(ctx context.Context, userID string) ([]domain.GameGoals, error)
	// AddGoal stores the goal; an existing goal is no error, whatever the drop lists hold. It gives ErrGameNotFound for
	// an unknown game, then domain.ErrInvalidItem for a new goal whose item is on no drop list of the game.
	AddGoal(ctx context.Context, userID, gameID string, itemID domain.ItemID) error
	// RemoveGoal removes the goal; a missing goal is no error. It gives ErrGameNotFound for an unknown game.
	RemoveGoal(ctx context.Context, userID, gameID string, itemID domain.ItemID) error
}

// Goals holds the use cases of a person's own goals. Any signed-in person may use them; the owner is always the caller
// (ADR 0029 section 8).
type Goals struct {
	goals GoalRepository
	items *Items
}

// NewGoals returns the goal use cases with their port and the item names.
func NewGoals(goals GoalRepository, items *Items) *Goals {
	return &Goals{goals: goals, items: items}
}

// List returns the user's goals by game, with their names resolved within the name budget.
func (g *Goals) List(ctx context.Context, userID string) ([]domain.GameGoals, error) {
	games, err := g.goals.GameGoals(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list goals: %w", err)
	}
	var names []*domain.Item
	for _, game := range games {
		for k := range game.Goals {
			names = append(names, &game.Goals[k].Item)
		}
	}
	g.items.resolveNames(ctx, names)
	return games, nil
}

// Add makes the item a goal of the user for the game. A new goal's item must be on a drop list of the game (ADR 0029
// C3, Amendment 2026-11-25 item 10).
func (g *Goals) Add(ctx context.Context, userID, gameID, rawItemID string) error {
	itemID, err := domain.ParseItemID(rawItemID)
	if err != nil {
		return fmt.Errorf("add goal: %w", err)
	}
	if err := g.goals.AddGoal(ctx, userID, gameID, itemID); err != nil {
		return fmt.Errorf("add goal: %w", err)
	}
	return nil
}

// Remove takes the item out of the user's goals for the game, with no drop-list check (ADR 0029 section 5).
func (g *Goals) Remove(ctx context.Context, userID, gameID, rawItemID string) error {
	itemID, err := domain.ParseItemID(rawItemID)
	if err != nil {
		return fmt.Errorf("remove goal: %w", err)
	}
	if err := g.goals.RemoveGoal(ctx, userID, gameID, itemID); err != nil {
		return fmt.Errorf("remove goal: %w", err)
	}
	return nil
}
