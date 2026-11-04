// Package transport maps HTTP requests to the application use cases and their results to status codes (ADR 0001).
package transport

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"openlobby/pkg/requestid"
	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// publicHandler implements the public endpoints of the OpenAPI contract. Operations that are not built yet come from
// pendingOperations.
type publicHandler struct {
	pendingOperations
	groups  *application.Groups
	games   *application.Games
	invites *application.InviteLinks
	lobbies *application.Lobbies
}

var _ publicapi.StrictServerInterface = publicHandler{}

// ListGroups returns the groups where the caller is a member. 503 when the database does not answer (ADR 0001).
func (h publicHandler) ListGroups(ctx context.Context, _ publicapi.ListGroupsRequestObject) (publicapi.ListGroupsResponseObject, error) {
	groups, err := h.groups.ListMine(ctx, userIDFrom(ctx))
	if err != nil {
		return nil, err
	}
	return groupSummaries(groups)
}

// CreateGroup makes the caller the admin of a new group. An omitted or null name is an empty name (REQ-0002).
func (h publicHandler) CreateGroup(ctx context.Context, request publicapi.CreateGroupRequestObject) (publicapi.CreateGroupResponseObject, error) {
	name := ""
	if request.Body.Name != nil {
		name = *request.Body.Name
	}
	group, err := h.groups.Create(ctx, userIDFrom(ctx), name)
	switch {
	case errors.Is(err, domain.ErrInvalidGroupName):
		return publicapi.CreateGroup400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidGroupName)}, nil
	case err != nil:
		return nil, err
	}
	id, err := parseUUID(group.ID)
	if err != nil {
		return nil, err
	}
	return publicapi.CreateGroup201JSONResponse{Id: id, Name: group.Name}, nil
}

// GetGroup returns the group and its members to a member. A non-member gets the same 404 as an unknown group, so the
// group's existence is not revealed (ADR 0004 rule 2). A malformed ID is the same 404 (ADR 0001).
func (h publicHandler) GetGroup(ctx context.Context, request publicapi.GetGroupRequestObject) (publicapi.GetGroupResponseObject, error) {
	group, members, err := h.groups.Get(ctx, userIDFrom(ctx), request.GroupId)
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return groupNotFound(ctx), nil
	case err != nil:
		return nil, err
	}
	return groupDetail(group, members)
}

func groupNotFound(ctx context.Context) publicapi.GetGroup404JSONResponse {
	return publicapi.GetGroup404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}
}

// groupSummaries converts the groups into the contract shape. An empty input gives an empty list, never null.
func groupSummaries(groups []domain.Group) (publicapi.ListGroups200JSONResponse, error) {
	list := make(publicapi.ListGroups200JSONResponse, 0, len(groups))
	for _, group := range groups {
		id, err := parseUUID(group.ID)
		if err != nil {
			return nil, err
		}
		list = append(list, publicapi.GroupSummary{Id: id, Name: group.Name})
	}
	return list, nil
}

// groupDetail converts the group and its members into the contract shape. Members is never null.
func groupDetail(group domain.Group, members []domain.Member) (publicapi.GetGroup200JSONResponse, error) {
	id, err := parseUUID(group.ID)
	if err != nil {
		return publicapi.GetGroup200JSONResponse{}, err
	}
	list := make([]publicapi.Member, 0, len(members))
	for _, member := range members {
		userID, err := parseUUID(member.UserID)
		if err != nil {
			return publicapi.GetGroup200JSONResponse{}, err
		}
		list = append(list, publicapi.Member{UserId: userID, DisplayName: member.DisplayName, Role: publicapi.MemberRole(member.Role)})
	}
	return publicapi.GetGroup200JSONResponse{Id: id, Name: group.Name, Members: list}, nil
}

func publicErrorBody(ctx context.Context, code publicapi.ErrorBodyCode) publicapi.ErrorBody {
	return publicapi.ErrorBody{Code: code, RequestId: requestid.FromContext(ctx)}
}

func parseUUID(value string) (openapi_types.UUID, error) {
	var id openapi_types.UUID
	err := id.UnmarshalText([]byte(value))
	return id, err
}
