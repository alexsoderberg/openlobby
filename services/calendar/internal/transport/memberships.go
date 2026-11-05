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

// MakeGroupAdmin makes a member group admin. A caller who is not a member gets group_not_found, a member who is not an
// admin gets not_allowed, and a target who is not a member gets member_not_found (REQ-0008).
func (h publicHandler) MakeGroupAdmin(ctx context.Context, request publicapi.MakeGroupAdminRequestObject) (publicapi.MakeGroupAdminResponseObject, error) {
	err := h.memberships.MakeAdmin(ctx, request.GroupId, userIDFrom(ctx), request.UserId)
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.MakeGroupAdmin404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrMemberNotFound):
		return publicapi.MakeGroupAdmin404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeMemberNotFound)}, nil
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.MakeGroupAdmin403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.MakeGroupAdmin204Response{}, nil
}
