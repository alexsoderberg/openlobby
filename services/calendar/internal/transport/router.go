package transport

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"openlobby/pkg/health"
	"openlobby/pkg/httpapi"
	"openlobby/pkg/requestid"
	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// NewRouter wires the contract operations, the health endpoints and the correlation ID.
// ready checks the service's own database (ADR 0008).
func NewRouter(groups *application.Groups, invites *application.InviteLinks, games *application.Games, lobbies *application.Lobbies, memberships *application.Memberships, ready func(context.Context) error, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	health.Register(mux, ready)

	strict := publicapi.NewStrictHandlerWithOptions(publicHandler{groups: groups, invites: invites, games: games, lobbies: lobbies, memberships: memberships}, nil,
		publicapi.StrictHTTPServerOptions{
			RequestErrorHandlerFunc:  httpapi.InvalidRequestHandler,
			ResponseErrorHandlerFunc: errorHandler(logger),
		})
	publicapi.HandlerWithOptions(strict, publicapi.StdHTTPServerOptions{
		BaseRouter:       mux,
		ErrorHandlerFunc: httpapi.InvalidRequestHandler,
		// The last one wraps outermost: 401 first, then 404 for a malformed path ID, then the body (400) (ADR 0001).
		Middlewares: []publicapi.MiddlewareFunc{httpapi.LimitBody, rejectMalformedPathID, requireUserID},
	})

	return requestid.Middleware(mux)
}

// pathIDCodes gives the not-found code of each path ID, in the order of the routes (ADR 0001 step 1). The token is not
// listed, because a token is not a uuid and IsUUID would reject valid tokens.
var pathIDCodes = []struct {
	param string
	code  publicapi.ErrorBodyCode
}{
	{param: "groupId", code: publicapi.ErrorBodyCodeGroupNotFound},
	{param: "userId", code: publicapi.ErrorBodyCodeMemberNotFound},
	{param: "linkId", code: publicapi.ErrorBodyCodeInviteInvalid},
	{param: "lobbyId", code: publicapi.ErrorBodyCodeLobbyNotFound},
	{param: "gameId", code: publicapi.ErrorBodyCodeGameNotFound},
}

// rejectMalformedPathID answers 404 with the not-found code of the resource when a path ID is not a canonical uuid.
// The shape of the path comes before the body and the permission (ADR 0001 step 1).
func rejectMalformedPathID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, pathID := range pathIDCodes {
			if value := r.PathValue(pathID.param); value != "" && !httpapi.IsUUID(value) {
				httpapi.WriteError(r.Context(), w, http.StatusNotFound, string(pathID.code))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// errorHandler answers 503 when the database or auth did not answer and 500 for any other error (ADR 0001). The
// handlers return the error and do not map it themselves.
func errorHandler(logger *slog.Logger) func(http.ResponseWriter, *http.Request, error) {
	internal := httpapi.InternalErrorHandler(logger)
	return func(w http.ResponseWriter, r *http.Request, err error) {
		if errors.Is(err, domain.ErrUnavailable) {
			logger.WarnContext(r.Context(), "dependency unavailable", "error", err.Error())
			httpapi.WriteError(r.Context(), w, http.StatusServiceUnavailable, string(publicapi.ErrorBodyCodeServiceUnavailable))
			return
		}
		internal(w, r, err)
	}
}
