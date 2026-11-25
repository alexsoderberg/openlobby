package transport

import (
	"context"
	"errors"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// GetGoals returns the caller's own goals by game (ADR 0029 section 5).
func (h publicHandler) GetGoals(ctx context.Context, _ publicapi.GetGoalsRequestObject) (publicapi.GetGoalsResponseObject, error) {
	games, err := h.goals.List(ctx, userIDFrom(ctx))
	if err != nil {
		return nil, err
	}
	list := publicapi.GetGoals200JSONResponse{Games: make([]publicapi.GameGoals, 0, len(games))}
	for _, game := range games {
		gameID, err := parseUUID(game.GameID)
		if err != nil {
			return nil, err
		}
		body := publicapi.GameGoals{GameId: gameID, GameName: game.GameName, GameLogoVersion: game.GameLogoVersion, Goals: make([]publicapi.GameItem, 0, len(game.Goals))}
		for _, goal := range game.Goals {
			item, err := gameItemBody(goal)
			if err != nil {
				return nil, err
			}
			body.Goals = append(body.Goals, item)
		}
		list.Games = append(list.Games, body)
	}
	return list, nil
}

// AddGoal makes the item a goal of the caller, never of a user named in the request (ADR 0029 section 8).
func (h publicHandler) AddGoal(ctx context.Context, request publicapi.AddGoalRequestObject) (publicapi.AddGoalResponseObject, error) {
	err := h.goals.Add(ctx, userIDFrom(ctx), request.GameId, request.ItemId)
	switch {
	case errors.Is(err, domain.ErrInvalidItem):
		return publicapi.AddGoal400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidItem)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.AddGoal404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.AddGoal204Response{}, nil
}

// RemoveGoal takes the item out of the caller's goals; a missing goal is also 204.
func (h publicHandler) RemoveGoal(ctx context.Context, request publicapi.RemoveGoalRequestObject) (publicapi.RemoveGoalResponseObject, error) {
	err := h.goals.Remove(ctx, userIDFrom(ctx), request.GameId, request.ItemId)
	switch {
	case errors.Is(err, domain.ErrInvalidItem):
		return publicapi.RemoveGoal400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidItem)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.RemoveGoal404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.RemoveGoal204Response{}, nil
}
