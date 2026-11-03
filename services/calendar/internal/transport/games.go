package transport

import (
	"context"
	"errors"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// ListGroupGames returns the game list in the group's order to a member. A malformed group ID and a non-member get the
// same 404 as an unknown group (ADR 0001, ADR 0004 rule 2). "Other" is not in the list; the client adds it.
func (h publicHandler) ListGroupGames(ctx context.Context, request publicapi.ListGroupGamesRequestObject) (publicapi.ListGroupGamesResponseObject, error) {
	if !httpapi.IsUUID(request.GroupId) {
		return publicapi.ListGroupGames404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	}
	games, err := h.games.ListGroupGames(ctx, request.GroupId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.ListGroupGames404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case err != nil:
		return nil, err
	}
	return gameList(games)
}

// gameList converts the games into the contract shape. An empty input gives an empty list, never null.
func gameList(games []domain.Game) (publicapi.ListGroupGames200JSONResponse, error) {
	list := make(publicapi.ListGroupGames200JSONResponse, 0, len(games))
	for _, game := range games {
		id, err := parseUUID(game.ID)
		if err != nil {
			return nil, err
		}
		list = append(list, publicapi.Game{Id: id, Name: game.Name, DefaultMaxPlayers: game.DefaultMaxPlayers})
	}
	return list, nil
}
