package transport

import (
	"context"
	"errors"

	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// lobbyErrorCodes maps the rule errors of a new lobby to the contract's 400 codes.
var lobbyErrorCodes = []struct {
	err  error
	code publicapi.ErrorBodyCode
}{
	{domain.ErrLobbyInPast, publicapi.ErrorBodyCodeLobbyInPast},
	{domain.ErrLobbyEndNotAfterStart, publicapi.ErrorBodyCodeLobbyEndNotAfterStart},
	{domain.ErrLobbyTooLong, publicapi.ErrorBodyCodeLobbyTooLong},
	{domain.ErrInvalidGame, publicapi.ErrorBodyCodeInvalidGame},
	{domain.ErrInvalidCapacity, publicapi.ErrorBodyCodeInvalidCapacity},
}

// CreateLobby saves a lobby for a member, with the caller as its first player. A missing or null time is
// invalid_request, checked before membership as the contract orders it.
func (h publicHandler) CreateLobby(ctx context.Context, request publicapi.CreateLobbyRequestObject) (publicapi.CreateLobbyResponseObject, error) {
	body := request.Body
	if body == nil || body.StartsAt.IsZero() || body.EndsAt.IsZero() {
		return publicapi.CreateLobby400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidRequest)}, nil
	}
	lobby, err := h.lobbies.Create(ctx, domain.NewLobbyRequest{
		GroupID:        request.GroupId,
		CreatorID:      userIDFrom(ctx),
		StartsAt:       body.StartsAt,
		EndsAt:         body.EndsAt,
		GameID:         body.GameId,
		CustomGameName: body.CustomGameName,
		MaxPlayers:     body.MaxPlayers,
	})
	if errors.Is(err, domain.ErrGroupNotFound) {
		return publicapi.CreateLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	}
	for _, rule := range lobbyErrorCodes {
		if errors.Is(err, rule.err) {
			return publicapi.CreateLobby400JSONResponse{Error: publicErrorBody(ctx, rule.code)}, nil
		}
	}
	if err != nil {
		return nil, err
	}
	return lobbyBody(lobby)
}

// DeleteLobby removes a lobby for its creator. A malformed group or lobby ID is a 404 before this runs (ADR 0001).
func (h publicHandler) DeleteLobby(ctx context.Context, request publicapi.DeleteLobbyRequestObject) (publicapi.DeleteLobbyResponseObject, error) {
	err := h.lobbies.Delete(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.DeleteLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrLobbyNotFound):
		return publicapi.DeleteLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyNotFound)}, nil
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.DeleteLobby403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.DeleteLobby204Response{}, nil
}

// lobbyBody converts a new lobby into the contract shape. Times are sent in UTC (ADR 0001).
func lobbyBody(lobby domain.Lobby) (publicapi.CreateLobby201JSONResponse, error) {
	id, err := parseUUID(lobby.ID)
	if err != nil {
		return publicapi.CreateLobby201JSONResponse{}, err
	}
	creatorID, err := parseUUID(lobby.CreatedByUserID)
	if err != nil {
		return publicapi.CreateLobby201JSONResponse{}, err
	}
	return publicapi.CreateLobby201JSONResponse{
		Id:              id,
		GameName:        lobby.GameName,
		MaxPlayers:      lobby.MaxPlayers,
		StartsAt:        lobby.StartsAt.UTC(),
		EndsAt:          lobby.EndsAt.UTC(),
		CreatedByUserId: creatorID,
		PlayerCount:     lobby.PlayerCount,
	}, nil
}
