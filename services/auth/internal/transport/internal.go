package transport

import (
	"context"
	"errors"
	"log/slog"

	"openlobby/pkg/requestid"
	"openlobby/services/auth/internal/application"
	internalapi "openlobby/services/auth/internal/transport/gen/internalapi"
)

// internalHandler implements the endpoints that only other services call (ADR 0003, api/auth/internal.yaml).
type internalHandler struct {
	auth   *application.Auth
	logger *slog.Logger
}

var _ internalapi.StrictServerInterface = internalHandler{}

// ValidateSession returns the user of a session token. The role is decided on every call (ADR 0011).
// A missing, empty, unknown or expired token gives the same 401 (ADR 0003).
func (h internalHandler) ValidateSession(ctx context.Context, request internalapi.ValidateSessionRequestObject) (internalapi.ValidateSessionResponseObject, error) {
	token := ""
	if request.Body != nil && request.Body.Token != nil {
		token = *request.Body.Token
	}
	account, err := h.auth.ValidateSession(ctx, token)
	switch {
	case isUnauthenticated(err):
		return internalapi.ValidateSession401JSONResponse{Error: internalErrorBody(ctx, internalapi.ErrorBodyCodeUnauthenticated)}, nil
	case isUnavailable(err):
		return internalapi.ValidateSession503JSONResponse{ServiceUnavailableJSONResponse: internalapi.ServiceUnavailableJSONResponse{
			Error: internalErrorBody(ctx, internalapi.ErrorBodyCodeServiceUnavailable),
		}}, nil
	case err != nil:
		return nil, err
	}
	id, err := parseUUID(account.UserID)
	if err != nil {
		return nil, err
	}
	return internalapi.ValidateSession200JSONResponse{UserId: id, IsSystemAdmin: account.IsSystemAdmin}, nil
}

// LookupUsers returns the display names of the given users. Unknown IDs are left out (ADR 0003).
func (h internalHandler) LookupUsers(ctx context.Context, request internalapi.LookupUsersRequestObject) (internalapi.LookupUsersResponseObject, error) {
	var userIDs []string
	if request.Body != nil && request.Body.UserIds != nil {
		for _, id := range *request.Body.UserIds {
			userIDs = append(userIDs, id.String())
		}
	}
	if len(userIDs) > application.MaxLookupUserIDs {
		return internalapi.LookupUsers400JSONResponse{Error: internalErrorBody(ctx, internalapi.ErrorBodyCodeInvalidRequest)}, nil
	}
	users, err := h.auth.LookupUsers(ctx, userIDs)
	switch {
	case isUnavailable(err):
		return internalapi.LookupUsers503JSONResponse{ServiceUnavailableJSONResponse: internalapi.ServiceUnavailableJSONResponse{
			Error: internalErrorBody(ctx, internalapi.ErrorBodyCodeServiceUnavailable),
		}}, nil
	case err != nil:
		return nil, err
	}
	names := make([]internalapi.UserName, 0, len(users))
	for _, user := range users {
		id, err := parseUUID(user.ID)
		if err != nil {
			return nil, errors.Join(err, errors.New("stored user id is not a uuid"))
		}
		names = append(names, internalapi.UserName{UserId: id, DisplayName: user.DisplayName})
	}
	return internalapi.LookupUsers200JSONResponse{Users: names}, nil
}

func internalErrorBody(ctx context.Context, code internalapi.ErrorBodyCode) internalapi.ErrorBody {
	return internalapi.ErrorBody{Code: code, RequestId: requestid.FromContext(ctx)}
}
