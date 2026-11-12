package transport

import (
	"context"
	"errors"
	"strings"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// GetPreferredGameRoles returns the caller's own preferred game roles with the games that offer game roles (ADR 0022).
func (h publicHandler) GetPreferredGameRoles(ctx context.Context, _ publicapi.GetPreferredGameRolesRequestObject) (publicapi.GetPreferredGameRolesResponseObject, error) {
	choices, err := h.preferredGameRoles.Choices(ctx, userIDFrom(ctx))
	if err != nil {
		return nil, err
	}
	body, err := choicesBody(choices)
	if err != nil {
		return nil, err
	}
	return publicapi.GetPreferredGameRoles200JSONResponse(body), nil
}

// ReplacePreferredGameRoles replaces the caller's own preferred game roles and returns the stored state. A missing or
// null gameRoleIds never reaches here (requiredBodyKeys). The entries are checked before any database access, in the
// contract's order (ADR 0022 point 4): see checkGameRoleIDs.
func (h publicHandler) ReplacePreferredGameRoles(ctx context.Context, request publicapi.ReplacePreferredGameRolesRequestObject) (publicapi.ReplacePreferredGameRolesResponseObject, error) {
	ids, code := checkGameRoleIDs(request.Body.GameRoleIds)
	if code != "" {
		return publicapi.ReplacePreferredGameRoles400JSONResponse{Error: publicErrorBody(ctx, code)}, nil
	}
	choices, err := h.preferredGameRoles.Replace(ctx, userIDFrom(ctx), ids)
	switch {
	case errors.Is(err, domain.ErrInvalidID):
		return publicapi.ReplacePreferredGameRoles400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidRequest)}, nil
	case errors.Is(err, domain.ErrInvalidGameRole):
		return publicapi.ReplacePreferredGameRoles400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidGameRole)}, nil
	case err != nil:
		return nil, err
	}
	body, err := choicesBody(choices)
	if err != nil {
		return nil, err
	}
	return publicapi.ReplacePreferredGameRoles200JSONResponse(body), nil
}

// checkGameRoleIDs lowers the case of every entry, then refuses a repeat among all entries (invalid_request), then an
// entry that is not a uuid in the standard form, 8-4-4-4-12 hex digits with dashes (invalid_game_role). Only that form
// is accepted, so no other spelling of an ID can hide a repeat. A nil list stays nil.
func checkGameRoleIDs(raw []string) ([]string, publicapi.ErrorBodyCode) {
	if raw == nil {
		return nil, ""
	}
	ids := make([]string, 0, len(raw))
	seen := make(map[string]bool, len(raw))
	for _, value := range raw {
		id := strings.ToLower(value)
		if seen[id] {
			return nil, publicapi.ErrorBodyCodeInvalidRequest
		}
		seen[id] = true
		ids = append(ids, id)
	}
	for _, id := range ids {
		if !httpapi.IsUUID(id) {
			return nil, publicapi.ErrorBodyCodeInvalidGameRole
		}
	}
	return ids, ""
}

// choicesBody converts the choices into the contract shape. Both lists are never null.
func choicesBody(choices application.PreferredGameRoleChoices) (publicapi.PreferredGameRoleChoices, error) {
	ids := make([]openapi_types.UUID, 0, len(choices.GameRoleIDs))
	for _, raw := range choices.GameRoleIDs {
		id, err := parseUUID(raw)
		if err != nil {
			return publicapi.PreferredGameRoleChoices{}, err
		}
		ids = append(ids, id)
	}
	games, err := gameList(choices.Games)
	return publicapi.PreferredGameRoleChoices{GameRoleIds: ids, Games: games}, err
}
