package application

import (
	"context"
	"fmt"

	"openlobby/services/calendar/internal/domain"
)

// PreferredGameRoleChoices is a person's preferred game roles with every game that offers game roles (ADR 0022).
type PreferredGameRoleChoices struct {
	// GameRoleIDs are the effective chosen game roles, in the order of Games, their modes and their roles.
	GameRoleIDs []string
	// Games have at least one effective game role. A game with modes has no game-level roles here, so a hidden role is
	// never offered.
	Games []domain.Game
}

// PreferredGameRoles holds the use cases about a person's own preferred game roles (ADR 0022). Any signed-in person may
// read and replace their own; no membership and no system admin is needed (ADR 0022 point 4).
type PreferredGameRoles struct {
	choices PreferredGameRoleRepository
	catalog GameCatalog
}

// NewPreferredGameRoles returns the preferred game role use cases with their ports.
func NewPreferredGameRoles(choices PreferredGameRoleRepository, catalog GameCatalog) *PreferredGameRoles {
	return &PreferredGameRoles{choices: choices, catalog: catalog}
}

// Choices returns the user's effective choices and the games that have effective game roles, sorted as the game list.
// The lists are never nil.
func (p *PreferredGameRoles) Choices(ctx context.Context, userID string) (PreferredGameRoleChoices, error) {
	games, err := p.catalog.List(ctx)
	if err != nil {
		return PreferredGameRoleChoices{}, fmt.Errorf("preferred game roles: %w", err)
	}
	stored, err := p.choices.ChosenGameRoleIDs(ctx, userID)
	if err != nil {
		return PreferredGameRoleChoices{}, fmt.Errorf("preferred game roles: %w", err)
	}
	chosen := make(map[string]bool, len(stored))
	for _, id := range stored {
		chosen[id] = true
	}
	return offeredChoices(games, chosen), nil
}

// offeredChoices keeps the games that have effective game roles, without the hidden game-level roles of a game with
// modes, and the chosen effective roles in game, mode and role order.
func offeredChoices(games []domain.Game, chosen map[string]bool) PreferredGameRoleChoices {
	result := PreferredGameRoleChoices{GameRoleIDs: []string{}, Games: []domain.Game{}}
	for _, game := range games {
		effective := game.EffectiveGameRoles()
		if len(effective) == 0 {
			continue
		}
		if len(game.Modes) > 0 {
			game.GameRoles = []domain.GameRole{}
		}
		result.Games = append(result.Games, game)
		for _, role := range effective {
			if chosen[role.ID] {
				result.GameRoleIDs = append(result.GameRoleIDs, role.ID)
			}
		}
	}
	return result
}

// Replace stores the given game roles as the user's choices and returns the stored state; an empty list clears them.
// An ID that is not an effective game role is domain.ErrInvalidGameRole (ADR 0022 point 4). The transport has refused a
// repeated ID and an ID that is not in the standard uuid form, and gives the IDs in lower case. A nil list is
// domain.ErrInvalidID: only an empty list clears.
func (p *PreferredGameRoles) Replace(ctx context.Context, userID string, gameRoleIDs []string) (PreferredGameRoleChoices, error) {
	if gameRoleIDs == nil {
		return PreferredGameRoleChoices{}, fmt.Errorf("replace preferred game roles: %w", domain.ErrInvalidID)
	}
	if err := p.choices.Replace(ctx, userID, gameRoleIDs); err != nil {
		return PreferredGameRoleChoices{}, fmt.Errorf("replace preferred game roles: %w", err)
	}
	return p.Choices(ctx, userID)
}
