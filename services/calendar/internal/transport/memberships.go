package transport

import (
	"context"
	"errors"

	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// LeaveGroup removes the caller's membership. A non-member, an unknown group and a malformed ID all give group_not_found
// (ADR 0004 rule 2, ADR 0001).
func (h publicHandler) LeaveGroup(ctx context.Context, request publicapi.LeaveGroupRequestObject) (publicapi.LeaveGroupResponseObject, error) {
	err := h.memberships.Leave(ctx, request.GroupId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.LeaveGroup404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrOwnUpcomingLobbiesExist):
		return publicapi.LeaveGroup409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeOwnUpcomingLobbiesExist)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.LeaveGroup204Response{}, nil
}
