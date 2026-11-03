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
func NewRouter(groups *application.Groups, ready func(context.Context) error, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	health.Register(mux, ready)

	strict := publicapi.NewStrictHandlerWithOptions(publicHandler{groups: groups}, nil,
		publicapi.StrictHTTPServerOptions{
			RequestErrorHandlerFunc:  httpapi.InvalidRequestHandler,
			ResponseErrorHandlerFunc: errorHandler(logger),
		})
	publicapi.HandlerWithOptions(strict, publicapi.StdHTTPServerOptions{
		BaseRouter:       mux,
		ErrorHandlerFunc: httpapi.InvalidRequestHandler,
		// requireUserID is last, so it wraps outermost and refuses a caller without identity before the body is read.
		Middlewares: []publicapi.MiddlewareFunc{httpapi.LimitBody, requireUserID},
	})

	return requestid.Middleware(mux)
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
