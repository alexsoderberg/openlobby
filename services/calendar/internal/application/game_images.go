package application

import (
	"context"
	"fmt"
	"log/slog"

	"openlobby/services/calendar/internal/domain"
)

// GameImages holds the use cases about the logo of a game (ADR 0026).
type GameImages struct {
	images GameImageRepository
	logger *slog.Logger
}

// NewGameImages returns the game image use cases with their port.
func NewGameImages(images GameImageRepository, logger *slog.Logger) *GameImages {
	return &GameImages{images: images, logger: logger}
}

// Set stores the image of the kind and returns the game with its new version, read in the same transaction as the write,
// so a committed write never answers a dependency error. The kind is part of the path form and comes first, then the
// admin check before any check of the bytes, then the size, the type and the game (ADR 0026 point 3).
func (g *GameImages) Set(ctx context.Context, actor domain.Actor, gameID, kind string, data []byte) (domain.Game, error) {
	if err := domain.CheckGameImageKind(kind); err != nil {
		return domain.Game{}, fmt.Errorf("set game image: %w", err)
	}
	if err := requireSystemAdmin(actor); err != nil {
		return domain.Game{}, fmt.Errorf("set game image: %w", err)
	}
	image, err := domain.NewGameImage(kind, data)
	if err != nil {
		return domain.Game{}, fmt.Errorf("set game image: %w", err)
	}
	game, err := g.images.Save(ctx, gameID, image)
	if err != nil {
		return domain.Game{}, fmt.Errorf("set game image: %w", err)
	}
	g.logChange(ctx, "set", actor, gameID, kind)
	return game, nil
}

// Remove deletes the image of the kind. A game without one is no error (ADR 0026 point 3).
func (g *GameImages) Remove(ctx context.Context, actor domain.Actor, gameID, kind string) error {
	if err := domain.CheckGameImageKind(kind); err != nil {
		return fmt.Errorf("remove game image: %w", err)
	}
	if err := requireSystemAdmin(actor); err != nil {
		return fmt.Errorf("remove game image: %w", err)
	}
	if err := g.images.Delete(ctx, gameID, kind); err != nil {
		return fmt.Errorf("remove game image: %w", err)
	}
	g.logChange(ctx, "remove", actor, gameID, kind)
	return nil
}

// Image returns the image of the kind for any logged-in user, but only at its current version, so a cached URL never
// names newer bytes (ADR 0026 point 4).
func (g *GameImages) Image(ctx context.Context, gameID, kind, version string) (domain.GameImage, error) {
	if err := domain.CheckGameImageKind(kind); err != nil {
		return domain.GameImage{}, fmt.Errorf("game image: %w", err)
	}
	image, found, err := g.images.Find(ctx, gameID, kind, version)
	if err != nil {
		return domain.GameImage{}, fmt.Errorf("game image: %w", err)
	}
	if !found {
		return domain.GameImage{}, domain.ErrGameImageNotFound
	}
	return image, nil
}

// logChange writes who changed which image of which game. Never the bytes (ADR 0026 point 7).
func (g *GameImages) logChange(ctx context.Context, action string, actor domain.Actor, gameID, kind string) {
	g.logger.InfoContext(ctx, "game image changed", "action", action, "actorUserId", actor.UserID, "gameId", gameID, "kind", kind)
}
