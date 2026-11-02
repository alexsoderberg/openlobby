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
	groups *application.Groups
}

var _ publicapi.StrictServerInterface = publicHandler{}

// ListGroups returns the groups where the caller is a member. 503 when the database does not answer (ADR 0001).
func (h publicHandler) ListGroups(ctx context.Context, _ publicapi.ListGroupsRequestObject) (publicapi.ListGroupsResponseObject, error) {
	groups, err := h.groups.ListMine(ctx, userIDFrom(ctx))
	if errors.Is(err, domain.ErrUnavailable) {
		return publicapi.ListGroups503JSONResponse{ServiceUnavailableJSONResponse: publicapi.ServiceUnavailableJSONResponse{
			Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeServiceUnavailable),
		}}, nil
	}
	if err != nil {
		return nil, err
	}
	return groupSummaries(groups)
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

func publicErrorBody(ctx context.Context, code publicapi.ErrorBodyCode) publicapi.ErrorBody {
	return publicapi.ErrorBody{Code: code, RequestId: requestid.FromContext(ctx)}
}

func parseUUID(value string) (openapi_types.UUID, error) {
	var id openapi_types.UUID
	err := id.UnmarshalText([]byte(value))
	return id, err
}
