package transport

import (
	"context"
	"log/slog"
	"net/http"

	"openlobby/pkg/health"
	"openlobby/pkg/httpapi"
	"openlobby/pkg/requestid"
	"openlobby/services/auth/internal/application"
	internalapi "openlobby/services/auth/internal/transport/gen/internalapi"
	publicapi "openlobby/services/auth/internal/transport/gen/publicapi"
)

// NewRouter wires the public and internal endpoints, the health endpoints and the correlation ID.
// ready checks the service's own database (ADR 0008).
func NewRouter(auth *application.Auth, ready func(context.Context) error, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	health.Register(mux, ready)

	publicStrict := publicapi.NewStrictHandlerWithOptions(publicHandler{auth: auth, logger: logger}, nil,
		publicapi.StrictHTTPServerOptions{
			RequestErrorHandlerFunc:  httpapi.InvalidRequestHandler,
			ResponseErrorHandlerFunc: httpapi.InternalErrorHandler(logger),
		})
	publicapi.HandlerWithOptions(publicStrict, publicapi.StdHTTPServerOptions{
		BaseRouter:       mux,
		ErrorHandlerFunc: publicBindingErrorHandler,
		Middlewares:      []publicapi.MiddlewareFunc{withCredentials},
	})

	internalStrict := internalapi.NewStrictHandlerWithOptions(internalHandler{auth: auth, logger: logger}, nil,
		internalapi.StrictHTTPServerOptions{
			RequestErrorHandlerFunc:  httpapi.InvalidRequestHandler,
			ResponseErrorHandlerFunc: httpapi.InternalErrorHandler(logger),
		})
	internalapi.HandlerWithOptions(internalStrict, internalapi.StdHTTPServerOptions{
		BaseRouter:       mux,
		ErrorHandlerFunc: httpapi.InvalidRequestHandler,
		Middlewares:      []internalapi.MiddlewareFunc{httpapi.LimitBody},
	})

	return requestid.Middleware(mux)
}
