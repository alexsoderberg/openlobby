package transport

import (
	"context"
	"errors"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// ListGroupGames returns the game list in the group's order to a member. A malformed group ID and a non-member get the
// same 404 as an unknown group (ADR 0001, ADR 0004 rule 2). "Other" is not in the list; the client adds it.
func (h publicHandler) ListGroupGames(ctx context.Context, request publicapi.ListGroupGamesRequestObject) (publicapi.ListGroupGamesResponseObject, error) {
	games, err := h.games.ListGroupGames(ctx, request.GroupId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.ListGroupGames404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case err != nil:
		return nil, err
	}
	list, err := gameList(games)
	if err != nil {
		return nil, err
	}
	return publicapi.ListGroupGames200JSONResponse(list), nil
}

// ListGames returns the whole game list to a system admin. Anyone else gets 403 (REQ-0010, ADR 0011).
func (h publicHandler) ListGames(ctx context.Context, _ publicapi.ListGamesRequestObject) (publicapi.ListGamesResponseObject, error) {
	games, err := h.games.ListGames(ctx, actorFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.ListGames403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case err != nil:
		return nil, err
	}
	list, err := gameList(games)
	if err != nil {
		return nil, err
	}
	return publicapi.ListGames200JSONResponse(list), nil
}

// CreateGame adds a game and returns it with its generated ID. The checks run in the order of ADR 0001: permission,
// then the name, then the default max, then the duplicate name.
func (h publicHandler) CreateGame(ctx context.Context, request publicapi.CreateGameRequestObject) (publicapi.CreateGameResponseObject, error) {
	game, err := h.games.CreateGame(ctx, actorFrom(ctx), valueOrEmpty(request.Body.Name), request.Body.DefaultMaxPlayers)
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.CreateGame403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, domain.ErrInvalidGame):
		return publicapi.CreateGame400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidGame)}, nil
	case errors.Is(err, domain.ErrInvalidCapacity):
		return publicapi.CreateGame400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidCapacity)}, nil
	case errors.Is(err, application.ErrGameTaken):
		return publicapi.CreateGame409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameTaken)}, nil
	case err != nil:
		return nil, err
	}
	body, err := gameBody(game)
	if err != nil {
		return nil, err
	}
	return publicapi.CreateGame201JSONResponse(body), nil
}

// ReplaceGame changes a game's name and default max and keeps its ID. A malformed ID is 404 before the permission check
// (ADR 0001 step 1), so a non-admin learns nothing from it.
func (h publicHandler) ReplaceGame(ctx context.Context, request publicapi.ReplaceGameRequestObject) (publicapi.ReplaceGameResponseObject, error) {
	game, err := h.games.ReplaceGame(ctx, actorFrom(ctx), request.GameId, valueOrEmpty(request.Body.Name), request.Body.DefaultMaxPlayers)
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.ReplaceGame403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, domain.ErrInvalidGame):
		return publicapi.ReplaceGame400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidGame)}, nil
	case errors.Is(err, domain.ErrInvalidCapacity):
		return publicapi.ReplaceGame400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidCapacity)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.ReplaceGame404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case errors.Is(err, application.ErrGameTaken):
		return publicapi.ReplaceGame409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameTaken)}, nil
	case err != nil:
		return nil, err
	}
	body, err := gameBody(game)
	if err != nil {
		return nil, err
	}
	return publicapi.ReplaceGame200JSONResponse(body), nil
}

// DeleteGame removes a game from the list. A malformed ID is 404 before the permission check (ADR 0001 step 1).
func (h publicHandler) DeleteGame(ctx context.Context, request publicapi.DeleteGameRequestObject) (publicapi.DeleteGameResponseObject, error) {
	err := h.games.DeleteGame(ctx, actorFrom(ctx), request.GameId)
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.DeleteGame403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.DeleteGame404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.DeleteGame204Response{}, nil
}

// valueOrEmpty returns the string, or "" when it is omitted or null. The domain then refuses the empty name (ADR 0001).
func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

// gameList converts the games into the contract shape. An empty input gives an empty list, never null.
func gameList(games []domain.Game) ([]publicapi.Game, error) {
	list := make([]publicapi.Game, 0, len(games))
	for _, game := range games {
		body, err := gameBody(game)
		if err != nil {
			return nil, err
		}
		list = append(list, body)
	}
	return list, nil
}

// gameBody converts one game into the contract shape. A nil default max is sent as null.
func gameBody(game domain.Game) (publicapi.Game, error) {
	id, err := parseUUID(game.ID)
	if err != nil {
		return publicapi.Game{}, err
	}
	return publicapi.Game{Id: id, Name: game.Name, DefaultMaxPlayers: game.DefaultMaxPlayers}, nil
}
