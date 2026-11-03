package application

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"strings"

	"openlobby/services/calendar/internal/domain"
)

// Games holds the use cases about the game list (ADR 0010). The transport layer gives each one the verified caller.
type Games struct {
	reader  GroupReader
	catalog GameCatalog
}

// NewGames returns the game list use cases with their ports.
func NewGames(reader GroupReader, catalog GameCatalog) *Games {
	return &Games{reader: reader, catalog: catalog}
}

// ListGroupGames returns the game list to a member, most used first: lobby count descending, then name ignoring case,
// then ID (ADR 0010). A non-member gets domain.ErrGroupNotFound, the same as an unknown group (ADR 0004 rule 2).
func (g *Games) ListGroupGames(ctx context.Context, groupID, callerID string) ([]domain.Game, error) {
	_, isMember, err := g.reader.Membership(ctx, groupID, callerID)
	if err != nil {
		return nil, fmt.Errorf("list group games: %w", err)
	}
	if !isMember {
		return nil, domain.ErrGroupNotFound
	}
	usages, err := g.catalog.ListForGroup(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("list group games: %w", err)
	}
	slices.SortFunc(usages, mostUsedFirst)
	games := make([]domain.Game, 0, len(usages))
	for _, usage := range usages {
		games = append(games, usage.Game)
	}
	return games, nil
}

// mostUsedFirst orders two games of the choice: more lobbies first, then the name ignoring case, then the ID.
func mostUsedFirst(a, b GameUsage) int {
	if byCount := cmp.Compare(b.LobbyCount, a.LobbyCount); byCount != 0 {
		return byCount
	}
	if byName := strings.Compare(strings.ToLower(a.Game.Name), strings.ToLower(b.Game.Name)); byName != 0 {
		return byName
	}
	return strings.Compare(a.Game.ID, b.Game.ID)
}
