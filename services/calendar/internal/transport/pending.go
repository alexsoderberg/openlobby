package transport

import (
	"context"
	"errors"

	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// errOperationPending is returned by the operations of later requirements. The strict handler passes it to
// ResponseErrorHandlerFunc, which answers 500 internal_error without details (ADR 0001, ADR 0012).
var errOperationPending = errors.New("operation not implemented yet")

// pendingOperations gives the contract operations that later requirements build. The strict interface needs a
// method for every operation, so each of them returns errOperationPending.
type pendingOperations struct{}

func (pendingOperations) ListGames(context.Context, publicapi.ListGamesRequestObject) (publicapi.ListGamesResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) CreateGame(context.Context, publicapi.CreateGameRequestObject) (publicapi.CreateGameResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) DeleteGame(context.Context, publicapi.DeleteGameRequestObject) (publicapi.DeleteGameResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) ReplaceGame(context.Context, publicapi.ReplaceGameRequestObject) (publicapi.ReplaceGameResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) MakeGroupAdmin(context.Context, publicapi.MakeGroupAdminRequestObject) (publicapi.MakeGroupAdminResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) ListGroupGames(context.Context, publicapi.ListGroupGamesRequestObject) (publicapi.ListGroupGamesResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) ListInviteLinks(context.Context, publicapi.ListInviteLinksRequestObject) (publicapi.ListInviteLinksResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) CreateInviteLink(context.Context, publicapi.CreateInviteLinkRequestObject) (publicapi.CreateInviteLinkResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) RevokeInviteLink(context.Context, publicapi.RevokeInviteLinkRequestObject) (publicapi.RevokeInviteLinkResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) ListUpcomingLobbies(context.Context, publicapi.ListUpcomingLobbiesRequestObject) (publicapi.ListUpcomingLobbiesResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) CreateLobby(context.Context, publicapi.CreateLobbyRequestObject) (publicapi.CreateLobbyResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) DeleteLobby(context.Context, publicapi.DeleteLobbyRequestObject) (publicapi.DeleteLobbyResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) GetLobby(context.Context, publicapi.GetLobbyRequestObject) (publicapi.GetLobbyResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) LeaveLobby(context.Context, publicapi.LeaveLobbyRequestObject) (publicapi.LeaveLobbyResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) JoinLobby(context.Context, publicapi.JoinLobbyRequestObject) (publicapi.JoinLobbyResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) LeaveGroup(context.Context, publicapi.LeaveGroupRequestObject) (publicapi.LeaveGroupResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) GetInvite(context.Context, publicapi.GetInviteRequestObject) (publicapi.GetInviteResponseObject, error) {
	return nil, errOperationPending
}

func (pendingOperations) JoinInvite(context.Context, publicapi.JoinInviteRequestObject) (publicapi.JoinInviteResponseObject, error) {
	return nil, errOperationPending
}
