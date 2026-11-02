package transport

import (
	"context"
	"log/slog"
	"net/http"

	"openlobby/pkg/health"
	"openlobby/pkg/httpapi"
	"openlobby/pkg/requestid"
	"openlobby/services/calendar/internal/application"
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
			ResponseErrorHandlerFunc: httpapi.InternalErrorHandler(logger),
		})
	publicapi.HandlerWithOptions(strict, publicapi.StdHTTPServerOptions{
		BaseRouter:       mux,
		ErrorHandlerFunc: httpapi.InvalidRequestHandler,
		Middlewares:      []publicapi.MiddlewareFunc{requireUserID},
	})

	return requestid.Middleware(mux)
}
