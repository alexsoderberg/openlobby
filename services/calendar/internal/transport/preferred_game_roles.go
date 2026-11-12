package transport

import (
	"context"
	"errors"

	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// errPreferredGameRolesNotBuilt is returned until ADR 0022 PR2 adds the use cases. The gateway routes these operations
// already, so until then a signed-in client gets 500 internal_error, with no details.
var errPreferredGameRolesNotBuilt = errors.New("preferred game roles: not built before ADR 0022 PR2")

// GetPreferredGameRoles is a placeholder until ADR 0022 PR2.
func (publicHandler) GetPreferredGameRoles(context.Context, publicapi.GetPreferredGameRolesRequestObject) (publicapi.GetPreferredGameRolesResponseObject, error) {
	return nil, errPreferredGameRolesNotBuilt
}

// ReplacePreferredGameRoles is a placeholder until ADR 0022 PR2.
func (publicHandler) ReplacePreferredGameRoles(context.Context, publicapi.ReplacePreferredGameRolesRequestObject) (publicapi.ReplacePreferredGameRolesResponseObject, error) {
	return nil, errPreferredGameRolesNotBuilt
}
