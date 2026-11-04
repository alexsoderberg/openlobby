package application

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"

	"openlobby/services/calendar/internal/domain"
)

// ErrGameNotFound means no game of the list has the ID (ADR 0010).
var ErrGameNotFound = errors.New("game not found")

// ErrGameTaken means another game already has the name, ignoring case (ADR 0010).
var ErrGameTaken = errors.New("game taken")

// Games holds the use cases about the game list (ADR 0010). The transport layer gives each one the verified caller.
type Games struct {
	reader  GroupReader
	catalog GameCatalog
	editor  GameCatalogEditor
	logger  *slog.Logger
}

// NewGames returns the game list use cases with their ports. The logger is injected, so the operations log is
// written by the one logger of the service.
func NewGames(reader GroupReader, catalog GameCatalog, editor GameCatalogEditor, logger *slog.Logger) *Games {
	return &Games{reader: reader, catalog: catalog, editor: editor, logger: logger}
}

// ListGames returns the whole game list to a system admin (ADR 0010, ADR 0011). Anyone else gets domain.ErrNotAllowed.
func (g *Games) ListGames(ctx context.Context, actor domain.Actor) ([]domain.Game, error) {
	if err := requireSystemAdmin(actor); err != nil {
		return nil, fmt.Errorf("list games: %w", err)
	}
	games, err := g.catalog.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list games: %w", err)
	}
	return games, nil
}

// CreateGame adds a game to the list. The admin check comes first and the name and default max are checked before
// any write (ADR 0010).
func (g *Games) CreateGame(ctx context.Context, actor domain.Actor, rawName string, defaultMaxPlayers *int) (domain.Game, error) {
	if err := requireSystemAdmin(actor); err != nil {
		return domain.Game{}, fmt.Errorf("create game: %w", err)
	}
	game, err := domain.NewGame("", rawName, defaultMaxPlayers)
	if err != nil {
		return domain.Game{}, fmt.Errorf("create game: %w", err)
	}
	created, err := g.editor.Create(ctx, game)
	if err != nil {
		return domain.Game{}, fmt.Errorf("create game: %w", err)
	}
	g.logChange(ctx, "create", actor, created.ID)
	return created, nil
}

// ReplaceGame changes the name and default max of a game. The ID never changes, and lobbies keep their own values (ADR 0010).
func (g *Games) ReplaceGame(ctx context.Context, actor domain.Actor, gameID, rawName string, defaultMaxPlayers *int) (domain.Game, error) {
	if err := requireSystemAdmin(actor); err != nil {
		return domain.Game{}, fmt.Errorf("replace game: %w", err)
	}
	game, err := domain.NewGame(gameID, rawName, defaultMaxPlayers)
	if err != nil {
		return domain.Game{}, fmt.Errorf("replace game: %w", err)
	}
	if err := g.editor.Replace(ctx, game); err != nil {
		return domain.Game{}, fmt.Errorf("replace game: %w", err)
	}
	g.logChange(ctx, "replace", actor, gameID)
	return game, nil
}

// DeleteGame removes a game from the list. Lobbies keep their own copy of the game name and max players, so nothing else
// changes (ADR 0010).
func (g *Games) DeleteGame(ctx context.Context, actor domain.Actor, gameID string) error {
	if err := requireSystemAdmin(actor); err != nil {
		return fmt.Errorf("delete game: %w", err)
	}
	if err := g.editor.Delete(ctx, gameID); err != nil {
		return fmt.Errorf("delete game: %w", err)
	}
	g.logChange(ctx, "delete", actor, gameID)
	return nil
}

// ListGroupGames returns the game list to a member, most used first: lobby count descending, then name ignoring case,
// then ID (ADR 0010). A non-member gets domain.ErrGroupNotFound, the same as an unknown group (ADR 0004 rule 2).
func (g *Games) ListGroupGames(ctx context.Context, groupID, callerID string) ([]domain.Game, error) {
	if _, err := requireMember(ctx, g.reader, groupID, callerID); err != nil {
		return nil, fmt.Errorf("list group games: %w", err)
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

// logChange writes the operations log of a successful write: who changed which game (ADR 0010). Tokens and secrets are
// never logged here.
func (g *Games) logChange(ctx context.Context, action string, actor domain.Actor, gameID string) {
	g.logger.InfoContext(ctx, "game list changed", "action", action, "actorUserId", actor.UserID, "gameId", gameID)
}

// requireSystemAdmin refuses every caller who is not a system admin. The role gives no right in a group (ADR 0011).
func requireSystemAdmin(actor domain.Actor) error {
	if !actor.IsSystemAdmin {
		return domain.ErrNotAllowed
	}
	return nil
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
