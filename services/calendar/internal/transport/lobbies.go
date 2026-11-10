package transport

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"

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
	{domain.ErrInvalidMode, publicapi.ErrorBodyCodeInvalidMode},
	{domain.ErrInvalidActivity, publicapi.ErrorBodyCodeInvalidActivity},
	{domain.ErrInvalidGameRole, publicapi.ErrorBodyCodeInvalidGameRole},
	{domain.ErrInvalidCapacity, publicapi.ErrorBodyCodeInvalidCapacity},
}

// CreateLobby saves a lobby for a member, with the caller as its first player. A missing or null time is
// invalid_request, checked before membership as the contract orders it.
func (h publicHandler) CreateLobby(ctx context.Context, request publicapi.CreateLobbyRequestObject) (publicapi.CreateLobbyResponseObject, error) {
	body := request.Body
	if body == nil || body.StartsAt.IsZero() || body.EndsAt.IsZero() {
		return publicapi.CreateLobby400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidRequest)}, nil
	}
	lobby, err := h.lobbies.Create(ctx, newLobbyRequest(request.GroupId, userIDFrom(ctx), *body))
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

func newLobbyRequest(groupID, creatorID string, body publicapi.CreateLobbyJSONRequestBody) domain.NewLobbyRequest {
	return domain.NewLobbyRequest{
		GroupID:        groupID,
		CreatorID:      creatorID,
		StartsAt:       body.StartsAt,
		EndsAt:         body.EndsAt,
		GameID:         body.GameId,
		CustomGameName: body.CustomGameName,
		MaxPlayers:     body.MaxPlayers,
		ModeID:         body.ModeId,
		ActivityID:     body.ActivityId,
		RoleSlots:      roleSlotInputs(body.RoleSlots),
		Seat:           domain.Seat{GameRoleID: body.GameRoleId, Flex: body.Flex != nil && *body.Flex},
	}
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
	detail, err := lobbyDetailBody(lobby, players)
	if err != nil {
		return nil, err
	}
	return publicapi.GetLobby200JSONResponse(detail), nil
}

// lobbyDetailBody converts a lobby and its players into the contract shape.
func lobbyDetailBody(lobby domain.Lobby, players []domain.Player) (publicapi.LobbyDetail, error) {
	body, err := lobbyBody(lobby)
	if err != nil {
		return publicapi.LobbyDetail{}, err
	}
	refs, err := playerBodies(players)
	if err != nil {
		return publicapi.LobbyDetail{}, err
	}
	return publicapi.LobbyDetail{
		Id: body.Id, GameId: body.GameId, GameName: body.GameName, GameGenre: body.GameGenre, MaxPlayers: body.MaxPlayers,
		ModeId: body.ModeId, ModeName: body.ModeName, ActivityId: body.ActivityId, ActivityName: body.ActivityName,
		StartsAt: body.StartsAt, EndsAt: body.EndsAt, CreatedByUserId: body.CreatedByUserId, PlayerCount: body.PlayerCount,
		JoinedByMe: body.JoinedByMe, FlexCount: body.FlexCount, RoleSlots: body.RoleSlots, Players: refs,
	}, nil
}

func playerBodies(players []domain.Player) ([]publicapi.LobbyPlayer, error) {
	refs := make([]publicapi.LobbyPlayer, 0, len(players))
	for _, player := range players {
		userID, err := parseUUID(player.UserID)
		if err != nil {
			return nil, err
		}
		roleID, err := parseOptionalUUID(player.GameRoleID)
		if err != nil {
			return nil, err
		}
		refs = append(refs, publicapi.LobbyPlayer{UserId: userID, DisplayName: player.DisplayName, GameRoleId: roleID})
	}
	return refs, nil
}

// roleSlotInputs keeps the difference between an omitted list (nil) and an empty one.
func roleSlotInputs(input *[]publicapi.RoleSlotInput) []domain.RoleSlotInput {
	if input == nil {
		return nil
	}
	slots := make([]domain.RoleSlotInput, 0, len(*input))
	for _, slot := range *input {
		slots = append(slots, domain.RoleSlotInput{GameRoleID: slot.GameRoleId, Slots: slot.Slots})
	}
	return slots
}

// parseOptionalUUID parses an ID that may be absent.
func parseOptionalUUID(value *string) (*openapi_types.UUID, error) {
	if value == nil {
		return nil, nil
	}
	id, err := parseUUID(*value)
	return &id, err
}

func roleSlotBodies(slots []domain.RoleSlot) ([]publicapi.RoleSlot, error) {
	bodies := make([]publicapi.RoleSlot, 0, len(slots))
	for _, slot := range slots {
		id, err := parseUUID(slot.GameRoleID)
		if err != nil {
			return nil, err
		}
		bodies = append(bodies, publicapi.RoleSlot{GameRoleId: id, Name: slot.Name, Slots: slot.Slots, PlayerCount: slot.PlayerCount})
	}
	return bodies, nil
}

// lobbyBody converts a lobby into the contract shape. Times are sent in UTC (ADR 0001). The optional IDs are sent as null.
func lobbyBody(lobby domain.Lobby) (publicapi.CreateLobby201JSONResponse, error) {
	var body publicapi.CreateLobby201JSONResponse
	var err error
	if body.Id, err = parseUUID(lobby.ID); err != nil {
		return body, err
	}
	if body.CreatedByUserId, err = parseUUID(lobby.CreatedByUserID); err != nil {
		return body, err
	}
	if body.GameId, err = parseOptionalUUID(lobby.GameID); err != nil {
		return body, err
	}
	if body.ModeId, err = parseOptionalUUID(lobby.ModeID); err != nil {
		return body, err
	}
	if body.ActivityId, err = parseOptionalUUID(lobby.ActivityID); err != nil {
		return body, err
	}
	slots, err := roleSlotBodies(lobby.RoleSlots)
	if err != nil {
		return body, err
	}
	body.GameName, body.GameGenre, body.MaxPlayers = lobby.GameName, convertGenre[publicapi.Genre](lobby.GameGenre), lobby.MaxPlayers
	body.ModeName, body.ActivityName = lobby.ModeName, lobby.ActivityName
	body.StartsAt, body.EndsAt = lobby.StartsAt.UTC(), lobby.EndsAt.UTC()
	body.PlayerCount, body.JoinedByMe, body.FlexCount, body.RoleSlots = lobby.PlayerCount, lobby.JoinedByMe, &lobby.FlexCount, &slots
	return body, nil
}

// JoinLobby makes the caller a player in a seat, or moves a player to another seat. Joining with the same seat twice is a
// 204 as well. The body is optional: without one the seat is empty, which a lobby without game roles accepts.
func (h publicHandler) JoinLobby(ctx context.Context, request publicapi.JoinLobbyRequestObject) (publicapi.JoinLobbyResponseObject, error) {
	var seat domain.Seat
	if body := request.Body; body != nil {
		seat = domain.Seat{GameRoleID: body.GameRoleId, Flex: body.Flex != nil && *body.Flex}
	}
	err := h.lobbies.Join(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx), seat)
	switch {
	case errors.Is(err, domain.ErrInvalidGameRole):
		return publicapi.JoinLobby400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidGameRole)}, nil
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.JoinLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrLobbyNotFound):
		return publicapi.JoinLobby404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyNotFound)}, nil
	case errors.Is(err, domain.ErrLobbyHasEnded):
		return publicapi.JoinLobby409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyHasEnded)}, nil
	case errors.Is(err, domain.ErrLobbyFull):
		return publicapi.JoinLobby409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeLobbyFull)}, nil
	case errors.Is(err, domain.ErrGameRoleFull):
		return publicapi.JoinLobby409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameRoleFull)}, nil
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
