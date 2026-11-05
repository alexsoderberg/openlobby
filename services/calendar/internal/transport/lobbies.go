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

// ListUpcomingLobbies returns the group's lobbies that have not ended, to a member.
func (h publicHandler) ListUpcomingLobbies(ctx context.Context, request publicapi.ListUpcomingLobbiesRequestObject) (publicapi.ListUpcomingLobbiesResponseObject, error) {
	lobbies, err := h.lobbies.Upcoming(ctx, request.GroupId, userIDFrom(ctx))
	if errors.Is(err, domain.ErrGroupNotFound) {
		return publicapi.ListUpcomingLobbies404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	}
	if err != nil {
		return nil, err
	}
	list := make(publicapi.ListUpcomingLobbies200JSONResponse, 0, len(lobbies))
	for _, lobby := range lobbies {
		body, err := lobbyBody(lobby)
		if err != nil {
			return nil, err
		}
		list = append(list, publicapi.Lobby(body))
	}
	return list, nil
}

// GetLobby returns an upcoming lobby with its players to a member.
func (h publicHandler) GetLobby(ctx context.Context, request publicapi.GetLobbyRequestObject) (publicapi.GetLobbyResponseObject, error) {
	lobby, players, err := h.lobbies.Get(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.GetLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrLobbyNotFound):
		return publicapi.GetLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyNotFound)}, nil
	case err != nil:
		return nil, err
	}
	body, err := lobbyBody(lobby)
	if err != nil {
		return nil, err
	}
	refs := make([]publicapi.UserRef, 0, len(players))
	for _, player := range players {
		userID, err := parseUUID(player.UserID)
		if err != nil {
			return nil, err
		}
		refs = append(refs, publicapi.UserRef{UserId: userID, DisplayName: player.DisplayName})
	}
	return publicapi.GetLobby200JSONResponse{
		Id: body.Id, GameName: body.GameName, MaxPlayers: body.MaxPlayers, StartsAt: body.StartsAt, EndsAt: body.EndsAt,
		CreatedByUserId: body.CreatedByUserId, PlayerCount: body.PlayerCount, JoinedByMe: body.JoinedByMe, Players: refs,
	}, nil
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
		JoinedByMe:      lobby.JoinedByMe,
	}, nil
}

// JoinLobby makes the caller a player. Joining twice is a 204 as well.
func (h publicHandler) JoinLobby(ctx context.Context, request publicapi.JoinLobbyRequestObject) (publicapi.JoinLobbyResponseObject, error) {
	err := h.lobbies.Join(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.JoinLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrLobbyNotFound):
		return publicapi.JoinLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyNotFound)}, nil
	case errors.Is(err, domain.ErrLobbyHasEnded):
		return publicapi.JoinLobby409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyHasEnded)}, nil
	case errors.Is(err, domain.ErrLobbyFull):
		return publicapi.JoinLobby409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyFull)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.JoinLobby204Response{}, nil
}

// LeaveLobby removes the caller from the players. Leaving when not a player is a 204 as well.
func (h publicHandler) LeaveLobby(ctx context.Context, request publicapi.LeaveLobbyRequestObject) (publicapi.LeaveLobbyResponseObject, error) {
	err := h.lobbies.Leave(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.LeaveLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrLobbyNotFound):
		return publicapi.LeaveLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyNotFound)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.LeaveLobby204Response{}, nil
}
